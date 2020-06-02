const debug = require('debug')('daedalus:akkeris');
const fs = require('fs');
const axios = require('axios');
const crawler = require('../../common/crawler.js');

const siteNode = (def) => def.id;
const siteSpec = (def) => ({ domain: def.domain, compliance: def.compliance });
const siteStatus = (def) => ({
  region: def.region,
  created_at: def.created_at,
  updated_at: def.updated_at,
});
const siteMetadata = (def) => ({ labels: def.labels });

const routeNode = (def) => def.id;
const routeSpec = (def) => ({
  app: def.app,
  space: def.space,
  source_path: def.source_path,
  target_path: def.target_path,
  site: def.site,
});
const routeStatus = (def) => ({
  pending: def.pending,
  created_at: def.created_at,
  updated_at: def.updated_at,
});

const spaceNode = (def) => def.id;
const spaceSpec = (def) => ({
  apps: def.apps,
  name: def.domain,
  compliance: def.compliance,
});
const spaceStatus = (def) => ({
  region: def.region,
  stack: def.stack,
  updated_at: def.updated_at,
  created_at: def.created_at,
  state: def.state,
});

const addonServiceNode = (def) => def.id;
const addonServiceSpec = (def) => ({
  actions: def.actions,
  available_regions: def.available_regions,
  supports_multiple_installations: def.supports_multiple_installations,
  supports_sharing: def.supports_sharing,
  plans: def.plans,
});
const addonServiceStatus = (def) => ({
  state: def.state,
  updated_at: def.updated_at,
  created_at: def.created_at,
});
const addonServiceMetadata = (def) => ({
  human_name: def.human_name,
  description: def.description,
});

const appNode = (def) => def.id;
const appSpec = (def) => ({
  git_url: def.git_url,
  git_branch: def.git_branch,
  maintenance: def.maintenance,
  formation: def.formation,
  region: def.region,
  released_at: def.released_at,
});
const appStatus = (def) => ({
  web_url: def.web_url,
  stack: def.stack,
  space: def.space,
  updated_at: def.updated_at,
  created_at: def.created_at,
});
const appMetadata = (def) => ({
  description: def.description,
  labels: def.labels,
  owner: def.owner,
  organization: def.organization,
});

const addonNode = (def) => def.id;
const addonSpec = (def) => ({
  plan: def.plan,
  name: def.name,
  primary: def.primary,
});
const addonStatus = (def) => ({
  created_at: def.created_at,
  updated_at: def.updated_at,
  provider_id: def.provider_id,
  state: def.state,
  state_description: def.state_description,
});
const addonMetadata = (def) => ({ web_url: def.web_url, billed_price: def.billed_price });

const addonAttachmentNode = (def) => def.id;
const addonAttachmentSpec = (def) => ({ addon: def.addon, app: def.app });
const addonAttachmentStatus = (def) => ({ created_at: def.created_at, updated_at: def.updated_at });
const addonAttachmentMetadata = (def) => ({ web_url: def.web_url });

async function run(pgpool) {
  if (process.env.AKKERIS !== 'true' || !process.env.AKKERIS_URL || !process.env.AKKERIS_TOKEN) {
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
  await crawler.writeDeletedObjs(pgpool, 'akkeris', 'site', (await Promise.all(sites.map((def) => crawler.writeObj(pgpool, 'akkeris', 'site', siteNode(def), def, siteSpec(def), siteStatus(def), siteMetadata(def), { name: def.domain })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

  debug('Getting spaces');
  const { data: spaces } = await get('/spaces');
  await crawler.writeDeletedObjs(pgpool, 'akkeris', 'space', (await Promise.all(spaces.map((def) => crawler.writeObj(pgpool, 'akkeris', 'space', spaceNode(def), def, spaceSpec(def), spaceStatus(def), {}, { name: def.name })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

  debug('Getting addon-services');
  const { data: addonServices } = await get('/addon-services');
  await crawler.writeDeletedObjs(pgpool, 'akkeris', 'addon_service', (await Promise.all(addonServices.map((def) => crawler.writeObj(pgpool, 'akkeris', 'addon_service', addonServiceNode(def), def, addonServiceSpec(def), addonServiceStatus(def), addonServiceMetadata(def), { name: def.name })))).map((x) => x.rows).flat()); // eslint-disable-line max-len,no-await-in-loop

  debug('Getting apps');
  const { data: apps } = await get('/apps');
  await crawler.writeDeletedObjs(pgpool, 'akkeris', 'app', (await Promise.all(apps.map((def) => crawler.writeObj(pgpool, 'akkeris', 'app', appNode(def), def, appSpec(def), appStatus(def), appMetadata(def), { name: def.name }, { space: { node: def.space.id } })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

  debug('Getting routes');
  const { data: routes } = await get('/routes');
  await crawler.writeDeletedObjs(pgpool, 'akkeris', 'route', (await Promise.all(routes.map((def) => crawler.writeObj(pgpool, 'akkeris', 'route', routeNode(def), def, routeSpec(def), routeStatus(def), {}, { target_path: def.target_path, source_path: def.source_path }, { app: { node: def.app.id }, site: { node: def.site.id } })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

  debug('Getting addons');
  const { data: addons } = await get('/addons');
  await crawler.writeDeletedObjs(pgpool, 'akkeris', 'addon', (await Promise.all(addons.map((def) => crawler.writeObj(pgpool, 'akkeris', 'addon', addonNode(def), def, addonSpec(def), addonStatus(def), addonMetadata(def), { name: def.name }, { app: { node: def.app.id }, addon_service: { node: def.addon_service.id } })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

  debug('Getting addon-attachments');
  const { data: addonAttachments } = await get('/addon-attachments');
  await crawler.writeDeletedObjs(pgpool, 'akkeris', 'addon_attachment', (await Promise.all(addonAttachments.map((def) => crawler.writeObj(pgpool, 'akkeris', 'addon_attachment', addonAttachmentNode(def), def, addonAttachmentSpec(def), addonAttachmentStatus(def), addonAttachmentMetadata(def), { name: def.name }, { app: { node: def.app.id }, addon: { node: def.addon.id } })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

  debug('Running akkeris plugin... done');
}

async function init(pgpool) {
  debug('Initializing akkeris plugin...');
  await pgpool.query(fs.readFileSync('./plugins/akkeris/create.sql').toString());
  await crawler.createTableDefinition(pgpool, 'akkeris', 'site', { name: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'akkeris', 'space', { name: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'akkeris', 'addon_service', { name: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'akkeris', 'app', { name: { type: 'text' } }, ['space']);
  await crawler.createTableDefinition(pgpool, 'akkeris', 'route', { target_path: { type: 'text' }, source_path: { type: 'text' } }, ['site', 'app']);
  await crawler.createTableDefinition(pgpool, 'akkeris', 'addon', { name: { type: 'text' } }, ['app', 'addon_service']);
  await crawler.createTableDefinition(pgpool, 'akkeris', 'addon_attachment', { name: { type: 'text' } }, ['app', 'addon']);
  debug('Initializing akkeris plugin... done');
}

module.exports = {
  run,
  init,
};
