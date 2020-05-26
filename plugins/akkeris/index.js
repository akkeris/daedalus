const debug = require('debug')('daedalus:akkeris');
const fs = require('fs');
const axios = require('axios');

async function init(pgpool) {
  debug('Initializing akkeris plugin...');
  await pgpool.query(fs.readFileSync('./plugins/akkeris/create.sql').toString());
  debug('Initializing akkeris plugin... done');
}

function lookupSpaceById(spaces, id) {
  return spaces.filter((space) => space.space === id)[0].space_log;
}

function lookupAppById(apps, id) {
  return apps.filter((app) => app.app === id)[0].app_log;
}

function lookupAddonServiceById(addonServices, id) {
  return addonServices
    .filter((addonService) => addonService.addon_service === id)[0]
    .addon_service_log;
}

function lookupAddonServiceByPlanId(addonServices, id) {
  return addonServices
    .filter((addonService) => addonService.definition.plans
      .filter((plan) => plan.id === id).length !== 0)[0]
    .addon_service_log;
}

function lookupSiteById(sites, id) {
  return sites.filter((site) => site.site === id)[0].site_log;
}

function lookupAddonById(addons, id) {
  return addons.filter((addon) => addon.addon === id)[0].addon_log;
}

async function run(pgpool) {
  if (process.env.AKKERIS !== 'true') {
    return;
  }
  if (!process.env.AKKERIS_URL || !process.env.AKKERIS_TOKEN) {
    return;
  }
  debug('Running akkeris plugin...');
  const get = axios.create({
    baseURL: process.env.AKKERIS_URL,
    timeout: 60 * 1000,
    headers: { authorization: `Bearer ${process.env.AKKERIS_TOKEN}` },
  });


  debug('Getting sites');
  const { data: sites } = await get('/sites');
  let sitesLog = (await Promise.all(sites.map((item) => pgpool.query(`
    insert into akkeris.sites_log (site_log, site, name, definition, observed_on, deleted)
    values (uuid_generate_v4(), $1, $2, $3, now(), false)
    on conflict (site, name, (definition->>'updated_at'), deleted)
    do update set name = EXCLUDED.name
    returning site_log, site, name, definition, observed_on, deleted
  `,
  [item.id, item.domain, item]))))
    .map((x) => x.rows).flat();

  debug('Getting addon services');
  const { data: addonServices } = await get('/addon-services');
  let addonServicesLog = (await Promise.all(addonServices.map((item) => pgpool.query(`
    insert into akkeris.addon_services_log (addon_service_log, addon_service, name, definition, observed_on, deleted)
    values (uuid_generate_v4(), $1, $2, $3, now(), false)
    on conflict (addon_service, name, (definition->>'updated_at'), deleted)
    do update set name = EXCLUDED.name, definition = $3
    returning addon_service_log, addon_service, name, definition, observed_on, deleted
  `,
  [item.id, item.name, item]))))
    .map((x) => x.rows).flat();

  debug('Getting spaces');
  const { data: spaces } = await get('/spaces');
  let spacesLog = (await Promise.all(spaces.map((item) => pgpool.query(`
    insert into akkeris.spaces_log (space_log, space, name, definition, observed_on, deleted)
    values (uuid_generate_v4(), $1, $2, $3, now(), false)
    on conflict (space, name, (definition->>'updated_at'), deleted)
    do update set name = EXCLUDED.name, definition = $3
    returning space_log, space, name, definition, observed_on, deleted
  `,
  [item.id, item.name, item]))))
    .map((x) => x.rows).flat();

  debug('Getting apps');
  const { data: apps } = await get('/apps');
  let appsLog = (await Promise.all(apps.map((item) => pgpool.query(`
    insert into akkeris.apps_log (app_log, app, name, space_log, definition, observed_on, deleted)
    values (uuid_generate_v4(), $1, $2, $3, $4, now(), false)
    on conflict (app, name, space_log, (definition->>'updated_at'), deleted)
    do update set name = EXCLUDED.name, definition = $4
    returning app_log, app, name, space_log, definition, observed_on, deleted
  `,
  [item.id, item.name, lookupSpaceById(spacesLog, item.space.id), item]))))
    .map((x) => x.rows).flat();

  debug('Getting routes');
  const { data: routes } = await get('/routes');
  (await Promise.all(routes.map((item) => pgpool.query(`
    insert into akkeris.routes_log (route_log, route, site_log, app_log, target_path, source_path, definition, observed_on, deleted)
    values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, now(), false)
    on conflict (route, site_log, app_log, (definition->>'updated_at'), deleted)
    do update set route = EXCLUDED.route, definition = $6
    returning route_log, route, site_log, app_log, target_path, source_path, definition, observed_on, deleted
  `,
  [item.id, lookupSiteById(sitesLog, item.site.id), lookupAppById(appsLog, item.app.id), item.source_path, item.target_path, item])))) // eslint-disable-line max-len
    .map((x) => x.rows).flat();

  debug('Getting addons');
  const { data: addons } = await get('/addons');
  let addonsLog = (await Promise.all(addons.map((item) => pgpool.query(`
    insert into akkeris.addons_log (addon_log, addon, app_log, addon_service_log, name, definition, observed_on, deleted)
    values (uuid_generate_v4(), $1, $2, $3, $4, $5, now(), false)
    on conflict (addon, app_log, addon_service_log, name, (definition->>'updated_at'), deleted)
    do update set name = EXCLUDED.name
    returning addon_log, addon, app_log, addon_service_log, name, definition, observed_on, deleted
  `,
  [item.id, lookupAppById(appsLog, item.app.id), lookupAddonServiceById(addonServicesLog, item.addon_service.id), item.name, item])))) // eslint-disable-line max-len
    .map((x) => x.rows).flat();

  debug('Getting addon attachments');
  const { data: addonAttachments } = await get('/addon-attachments');
  await Promise.all(addonAttachments.map(async (item) => {
    try {
      return pgpool.query(`
        insert into akkeris.addon_attachments_log (addon_attachment_log, addon_attachment, addon_log, app_log, addon_service_log, name, definition, observed_on, deleted)
        values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, now(), false)
        on conflict (addon_attachment, addon_log, app_log, addon_service_log, name, (definition->>'updated_at'), deleted)
        do update set name = EXCLUDED.name
        returning addon_attachment_log, addon_attachment, addon_log, app_log, addon_service_log, name, definition, observed_on, deleted
      `,
      [item.id + lookupAppById(appsLog, item.app.id), lookupAddonById(addonsLog, item.addon.id), lookupAppById(appsLog, item.app.id), lookupAddonServiceByPlanId(addonServicesLog, item.addon.plan.id), item.name, item]); // eslint-disable-line max-len
    } catch (e) {
      debug(`ERROR: Cannot process addon-attachment ${item.id} because ${e.stack}`); // eslint-disable-line no-console
      return {};
    }
  }));


  debug('Checking for routes deletions');
  (await pgpool.query('select routes.route_log, routes.route, routes.site_log, routes.app_log, routes.source_path, routes.target_path, routes.definition, routes.observed_on from akkeris.routes'))
    .rows
    .filter((route) => !routes.map((x) => x.id).includes(route.route))
    .map(async (route) => {
      try {
        return await pgpool.query(`
          insert into akkeris.routes_log (route_log, route, site_log, app_log, definition, source_path, target_path, observed_on, deleted)
          values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, now(), true)
          on conflict (route, site_log, app_log, (definition->>'updated_at'), deleted)
          do update set route = EXCLUDED.route
          returning route_log, route, site_log, app_log, definition, observed_on, deleted
      `, [route.route, route.site_log, route.app_log, route.definition, route.source_path, route.target_path]);
      } catch (e) {
        // TODO: this introduces a logical falicy, how do we detect whether a route is deleted if a
        // site is deleted?...
        debug(`ERROR: Unable to insert route deletion ${route.route} with ${route.site} due to: ${e.stack}`);
        return {};
      }
    });

  debug('Checking for site deletions');
  sitesLog = sitesLog.concat((await Promise.all((await pgpool.query('select site_log, site, name, definition, observed_on from akkeris.sites'))
    .rows
    .filter((site) => !sites.map((x) => x.id).includes(site.site))
    .map(async (site) => pgpool.query(`
      insert into akkeris.sites_log (site_log, site, name, definition, observed_on, deleted)
      values (uuid_generate_v4(), $1, $2, $3, now(), true)
      on conflict (site, name, (definition->>'updated_at'), deleted)
      do update set name = EXCLUDED.name
      returning site_log, site, name, definition, observed_on, deleted
    `, [site.site, site.name, site.definition]))))
    .map((x) => x.rows).flat());

  debug('Checking for addon service deletions');
  addonServicesLog = addonServicesLog.concat((await Promise.all((await pgpool.query('select addon_service_log, addon_service, name, definition, observed_on from akkeris.addon_services'))
    .rows
    .filter((addonService) => !addonServices.map((x) => x.id).includes(addonService.addon_service))
    .map((addonService) => pgpool.query(`
      insert into akkeris.addon_services_log (addon_service_log, addon_service, name, definition, observed_on, deleted)
      values (uuid_generate_v4(), $1, $2, $3, now(), true)
      on conflict (addon_service, name, (definition->>'updated_at'), deleted)
      do update set name = EXCLUDED.name
      returning addon_service_log, addon_service, name, definition, observed_on, deleted
    `, [addonService.addon_service, addonService.name, addonService.definition])))).map((x) => x.rows).flat());

  debug('Checking for spaces deletions');
  spacesLog = spacesLog.concat((await Promise.all((await pgpool.query('select space_log, space, name, definition, observed_on from akkeris.spaces'))
    .rows
    .filter((space) => !spaces.map((x) => x.id).includes(space.space))
    .map((space) => pgpool.query(`
      insert into akkeris.spaces_log (space_log, space, name, definition, observed_on, deleted)
      values (uuid_generate_v4(), $1, $2, $3, now(), true)
      on conflict (space, name, (definition->>'updated_at'), deleted)
      do update set name = EXCLUDED.name
      returning space_log, space, name, definition, observed_on, deleted
    `, [space.space, space.name, space.definition])))).map((x) => x.rows).flat());

  debug('Checking for apps deletions');
  appsLog = appsLog.concat((await Promise.all((await pgpool.query('select app_log, app, name, space_log, definition, observed_on from akkeris.apps'))
    .rows
    .filter((app) => !apps.map((x) => x.id).includes(app.app))
    .map((app) => pgpool.query(`
      insert into akkeris.apps_log (app_log, app, name, space_log, definition, observed_on, deleted)
      values (uuid_generate_v4(), $1, $2, $3, $4, now(), true)
      on conflict (app, name, space_log, (definition->>'updated_at'), deleted)
      do update set name = EXCLUDED.name
      returning app_log, app, name, space_log, definition, observed_on, deleted
    `, [app.app, app.name, app.space_log, app.definition]))))
    .map((x) => x.rows).flat());

  debug('Checking for addons deletions');
  addonsLog = addonsLog.concat((await Promise.all((await pgpool.query('select addon_log, addon, app_log, addon_service_log, name, definition, observed_on from akkeris.addons'))
    .rows
    .filter((addon) => !addons.map((x) => x.id).includes(addon.addon))
    .map((addon) => pgpool.query(`
      insert into akkeris.addons_log (addon_log, addon, app_log, addon_service_log, name, definition, observed_on, deleted)
      values (uuid_generate_v4(), $1, $2, $3, $4, $5, now(), true)
      on conflict (addon, app_log, addon_service_log, name, (definition->>'updated_at'), deleted)
      do update set name = EXCLUDED.name
      returning addon_log, addon, app_log, addon_service_log, name, definition, observed_on, deleted
    `, [addon.addon, addon.app_log, addon.addon_service_log, addon.name, addon.definition]))))
    .map((x) => x.rows).flat());

  debug('Checking for addon attachments deletions');
  (await pgpool.query('select addon_attachment_log, addon_attachment, addon_log, app_log, addon_service_log, name, definition, observed_on from akkeris.addon_attachments'))
    .rows
    .filter((addonAttachment) => !addonAttachments.map((x) => x.id).includes(addonAttachment.addon_attachment)) // eslint-disable-line max-len
    .map((addonAttachment) => pgpool.query(`
      insert into akkeris.addon_attachments_log (addon_attachment_log, addon_attachment, addon_log, app_log, addon_service_log, name, definition, observed_on, deleted)
      values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, now(), true)
      on conflict (addon_attachment, addon_log, app_log, addon_service_log, name, (definition->>'updated_at'), deleted)
      do update set name = EXCLUDED.name
      returning addon_attachment_log, addon_attachment, addon_log, app_log, addon_service_log, name, definition, observed_on, deleted
    `, [addonAttachment.addon_attachment, addonAttachment.addon_log, addonAttachment.app_log, addonAttachment.addon_service_log, addonAttachment.name, addonAttachment.definition]));

  // TODO: releases? builds? slugs? log-drains?
}

module.exports = {
  run,
  init,
};
