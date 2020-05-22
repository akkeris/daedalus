const debug = require('debug')('daedalus:metadata');

async function writeAkkerisAppsToSites(pgpool) {
  const { rows: routes } = await pgpool.query(`
    select
      akkeris.sites.site_log,
      akkeris.apps.app_log,
      akkeris.routes.route_log,
      akkeris.apps.definition->>'web_url' as app_path,
      akkeris.sites.name as site_name,
      akkeris.sites.definition as site_definition,
      akkeris.routes.source_path as source_path,
      akkeris.routes.target_path as target_path,
      akkeris.routes.definition as route_definition,
      akkeris.apps.name as app_name,
      akkeris.apps.definition as app_definition,
      akkeris.routes.observed_on
    from akkeris.routes
      join akkeris.sites on akkeris.routes.site_log = akkeris.sites.site_log
      join akkeris.apps on akkeris.apps.app_log = akkeris.routes.app_log
    where akkeris.apps.definition->>'web_url' is not null
  `);
  debug(`Examining ${routes.length} routes for links from apps to sites.`);

  await Promise.all(routes.map(async (route) => {
    try {
      await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
        [route.site_log, route.route_log]);
      await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
        [route.route_log, route.app_log]);
    } catch (e) {
      debug(`Error cannot add link between app ${route.app_log} and route ${route.route_log} and site ${route.site_log} due to: ${e.message}`);
    }
  }));
}

async function init() {} // eslint-disable-line no-empty-function

async function run(pgpool) {
  await writeAkkerisAppsToSites(pgpool);
}

module.exports = {
  run,
  init,
};
