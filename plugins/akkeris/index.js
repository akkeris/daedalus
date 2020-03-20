const debug = require('debug')('daedalus:akkeris');
const fs = require('fs');
const axios = require('axios');

async function init(pgpool) {
  debug('Initializing akkeris plugin...');
  await pgpool.query(fs.readFileSync('./plugins/akkeris/create.sql').toString());
}

function lookupSpaceById(spaces, id) {
  return spaces.filter((space) => space.space === id)[0].space_log;
}

function lookupAppById(apps, id) {
  return apps.filter((app) => app.app === id)[0].app_log;
}

function lookupAddonServiceById(addon_services, id) {
  return addon_services.filter((addon_service) => addon_service.addon_service === id)[0].addon_service_log;
}

function lookupAddonServiceByPlanId(addon_services, id) {
  return addon_services.filter((addon_service) => addon_service.definition.plans.filter((plan) => plan.id === id).length != 0)[0].addon_service_log;
}

function lookupSiteById(sites, id) {
  return sites.filter((site) => site.site === id)[0].site_log;
}

function lookupAddonById(addons, id) {
  return addons.filter((addon) =>  addon.addon === id)[0].addon_log;
}

async function run(pgpool) {
  if (!process.env.AKKERIS_URL || !process.env.AKKERIS_TOKEN) {
    return;
  }
  const get = axios.create({ baseURL: process.env.AKKERIS_URL, headers: { authorization: `Bearer ${process.env.AKKERIS_TOKEN}` } });
  
  debug('Running akkeris plugin...');

  debug('Getting sites');
  const { data: sites } = await get('/sites');
  let sites_log = (await Promise.all(sites.map((item) => pgpool.query(`
    insert into akkeris.sites_log (site_log, site, name, definition, observed_on, deleted)
    values (uuid_generate_v4(), $1, $2, $3, now(), false)
    on conflict (site, name, (definition->>'updated_at'), deleted)
    do update set name = EXCLUDED.name
    returning site_log, site, name, definition, observed_on, deleted
  `,
  [item.id, item.domain, item])))).map((x) => x.rows).flat();

  debug('Getting addon services');
  const { data: addon_services } = await get('/addon-services');
  let addon_services_log = (await Promise.all(addon_services.map((item) => pgpool.query(`
    insert into akkeris.addon_services_log (addon_service_log, addon_service, name, definition, observed_on, deleted)
    values (uuid_generate_v4(), $1, $2, $3, now(), false)
    on conflict (addon_service, name, (definition->>'updated_at'), deleted)
    do update set name = EXCLUDED.name
    returning addon_service_log, addon_service, name, definition, observed_on, deleted
  `,
  [item.id, item.name, item])))).map((x) => x.rows).flat();

  debug('Getting spaces');
  const { data: spaces } = await get('/spaces');
  let spaces_log = (await Promise.all(spaces.map((item) => pgpool.query(`
    insert into akkeris.spaces_log (space_log, space, name, definition, observed_on, deleted)
    values (uuid_generate_v4(), $1, $2, $3, now(), false)
    on conflict (space, name, (definition->>'updated_at'), deleted)
    do update set name = EXCLUDED.name
    returning space_log, space, name, definition, observed_on, deleted
  `,
  [item.id, item.name, item])))).map((x) => x.rows).flat();

  debug('Getting routes');
  const { data: routes } = await get('/routes');
  (await Promise.all(routes.map((item) => pgpool.query(`
    insert into akkeris.routes_log (route_log, route, site_log, definition, observed_on, deleted)
    values (uuid_generate_v4(), $1, $2, $3, now(), false)
    on conflict (route, site_log, (definition->>'updated_at'), deleted)
    do update set route = EXCLUDED.route
    returning route_log, route, site_log, definition, observed_on, deleted
  `,
  [item.id, lookupSiteById(sites_log, item.site.id), item])))).map((x) => x.rows).flat();

  debug('Getting apps');
  const { data: apps } = await get('/apps');
  let apps_log = (await Promise.all(apps.map((item) => pgpool.query(`
    insert into akkeris.apps_log (app_log, app, name, space_log, definition, observed_on, deleted)
    values (uuid_generate_v4(), $1, $2, $3, $4, now(), false)
    on conflict (app, name, space_log, (definition->>'updated_at'), deleted)
    do update set name = EXCLUDED.name
    returning app_log, app, name, space_log, definition, observed_on, deleted
  `,
  [item.id, item.name, lookupSpaceById(spaces_log, item.space.id), item])))).map((x) => x.rows).flat();

  debug('Getting addons');
  const { data: addons } = await get('/addons');
  let addons_log = (await Promise.all(addons.map((item) => pgpool.query(`
    insert into akkeris.addons_log (addon_log, addon, app_log, addon_service_log, name, definition, observed_on, deleted)
    values (uuid_generate_v4(), $1, $2, $3, $4, $5, now(), false)
    on conflict (addon, app_log, addon_service_log, name, (definition->>'updated_at'), deleted)
    do update set name = EXCLUDED.name
    returning addon_log, addon, app_log, addon_service_log, name, definition, observed_on, deleted
  `,
  [item.id, lookupAppById(apps_log, item.app.id), lookupAddonServiceById(addon_services_log, item.addon_service.id), item.name, item])))).map((x) => x.rows).flat();

  debug('Getting addon attachments');
  const { data: addon_attachments } = await get('/addon-attachments');
  await Promise.all(addon_attachments.map((item) => pgpool.query(`
    insert into akkeris.addon_attachments_log (addon_attachment_log, addon_attachment, addon_log, app_log, addon_service_log, name, definition, observed_on, deleted)
    values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, now(), false)
    on conflict (addon_attachment, addon_log, app_log, addon_service_log, name, (definition->>'updated_at'), deleted)
    do update set name = EXCLUDED.name
    returning addon_attachment_log, addon_attachment, addon_log, app_log, addon_service_log, name, definition, observed_on, deleted
  `,
  [item.id, lookupAddonById(addons_log, item.addon.id), lookupAppById(apps_log, item.app.id), lookupAddonServiceByPlanId(addon_services_log, item.addon.plan.id), item.name, item])));


  debug('Checking for site deletions');
  sites_log = sites_log.concat((await Promise.all((await pgpool.query(`select site, name, definition, observed_on from akkeris.sites`))
    .rows
    .filter((site) => !sites.map((x) => x.site).includes(site.site))
    .map((site) => pgpool.query(`
      insert into akkeris.sites_log (site_log, site, name, definition, observed_on, deleted)
      values (uuid_generate_v4(), $1, $2, $3, now(), true)
      on conflict (site, name, (definition->>'updated_at'), deleted)
      do update set name = EXCLUDED.name
      returning site_log, site, name, definition, observed_on, deleted
    `, [site.site, site.name, site.definition])))).map((x) => x.rows).flat());
  
  debug('Checking for addon service deletions');
  addon_services_log = addon_services_log.concat((await Promise.all((await pgpool.query(`select addon_service, name, definition, observed_on from akkeris.addon_services`))
    .rows
    .filter((addon_service) => !addon_services.map((x) => x.id).includes(addon_service.addon_service))
    .map((addon_service) => pgpool.query(`
      insert into akkeris.addon_services_log (addon_service_log, addon_service, name, definition, observed_on, deleted)
      values (uuid_generate_v4(), $1, $2, $3, now(), true)
      on conflict (addon_service, name, (definition->>'updated_at'), deleted)
      do update set name = EXCLUDED.name
      returning addon_service_log, addon_service, name, definition, observed_on, deleted
    `, [addon_service.addon_service, addon_service.name, addon_service.definition])))).map((x) => x.rows).flat());

  debug('Checking for spaces deletions');
  spaces_log = spaces_log.concat((await Promise.all((await pgpool.query(`select space, name, definition, observed_on from akkeris.spaces`))
    .rows
    .filter((space) => !spaces.map((x) => x.id).includes(space.space))
    .map((space) => pgpool.query(`
      insert into akkeris.spaces_log (space_log, space, name, definition, observed_on, deleted)
      values (uuid_generate_v4(), $1, $2, now(), true)
      on conflict (space, name, (definition->>'updated_at'), deleted)
      do update set name = EXCLUDED.name
      returning space_log, space, name, definition, observed_on, deleted
    `, [space.space, space.name, space.definition])))).map((x) => x.rows).flat());

  debug('Checking for routes deletions');
  (await pgpool.query(`select route, site, definition, observed_on from akkeris.routes`))
    .rows
    .filter((route) => !routes.map((x) => x.id).includes(route.route))
    .map((route) => pgpool.query(`
      insert into akkeris.routes_log (route, site_log, definition, observed_on, deleted)
      values (uuid_generate_v4(), $1, $2, now(), true)
      on conflict (route, site_log, (definition->>'updated_at'), deleted)
      do update set route = EXCLUDED.route
      returning route_log, route, site_log, definition, observed_on, deleted
    `, [route.route, lookupSiteById(sites_log, route.site), route.definition]));

  debug('Checking for apps deletions');
  apps_log = apps_log.concat((await Promise.all((await pgpool.query(`select app, name, space, definition, observed_on from akkeris.apps`))
    .rows
    .filter((app) => !apps.map((x) => x.id).includes(app.app))
    .map((app) => pgpool.query(`
      insert into akkeris.apps_log (app_log, app, name, space_log, definition, observed_on, deleted)
      values (uuid_generate_v4(), $1, $2, $3, $4, now(), true)
      on conflict (app, name, space_log, (definition->>'updated_at'), deleted)
      do update set name = EXCLUDED.name
      returning app_log, app, name, space_log, definition, observed_on, deleted
    `, [app.app, app.name, lookupSpaceById(spaces_log, app.space), app.definition])))).map((x) => x.rows).flat());

  debug('Checking for addons deletions');
  addons_log = addons_log.concat((await Promise.all((await pgpool.query(`select addon, app, addon_service, name, definition, observed_on from akkeris.addons`))
    .rows
    .filter((addon) => !addons.map((x) => x.id).includes(addon.addon))
    .map((addon) => pgpool.query(`
      insert into akkeris.addons_log (addon_log, addon, app_log, addon_service_log, name, definition, observed_on, deleted)
      values (uuid_generate_v4(), $1, $2, $3, $4, $5, now(), true)
      on conflict (addon, app_log, addon_service_log, name, (definition->>'updated_at'), deleted)
      do update set name = EXCLUDED.name
      returning addon_log, addon, app_log, addon_service_log, name, definition, observed_on, deleted
    `, [addon.addon, lookupAppById(apps_log, addon.app), lookupAddonServiceById(addon_services_log, addon.addon_service), addon.name, addon.definition])))).map((x) => x.rows).flat());

  debug('Checking for addon attachments deletions');
  (await pgpool.query(`select addon_attachment, addon, app, addon_service, name, definition, observed_on from akkeris.addon_attachments`))
    .rows
    .filter((addon_attachment) => !addon_attachments.map((x) => x.id).includes(addon_attachment.addon_attachment))
    .map((addon_attachment) => pgpool.query(`
      insert into akkeris.addon_attachments_log (addon_attachment_log, addon_attachment, addon_log, app_log, addon_service_log, name, definition, observed_on, deleted)
      values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, now(), true)
      on conflict (addon_attachment, addon_log, app_log, addon_service_log, name, (definition->>'updated_at'), deleted)
      do update set name = EXCLUDED.name
      returning addon_attachment_log, addon_attachment, addon_log, app_log, addon_service_log, name, definition, observed_on, deleted
    `, [addon_attachment.addon_attachment, lookupAddonById(addons_log, addon_attachment.addon), lookupAppById(apps_log, addon_attachment.app), lookupAddonServiceById(addon_services_log, addon_attachment.addon_service), addon_attachment.name, addon_attachment.definition]));
  
  // TODO: releases? builds? slugs? log-drains?
}

module.exports = {
  run,
  init,
};
