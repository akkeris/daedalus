const debug = require('debug')('daedalus:metadata');

async function writeAkkerisAppsToSites(pgpool) {
  const { rows: routes } = await pgpool.query(`
    select
      akkeris.sites.site_log,
      akkeris.apps.app_log,
      akkeris.routes.route_log,
      akkeris.apps.definition->>'web_url' as app_path,
      akkeris.sites.name as site_name,
      akkeris.routes.source_path as source_path,
      akkeris.routes.target_path as target_path,
      akkeris.apps.name as app_name,
      akkeris.routes.observed_on
    from akkeris.routes
      join akkeris.sites on akkeris.routes.site = akkeris.sites.site
      join akkeris.apps on akkeris.apps.app = akkeris.routes.app
    where akkeris.apps.definition->>'web_url' is not null
  `);
  debug(`Examining ${routes.length} routes for links from apps to sites.`);

  const appType = (await pgpool.query('select "type" from metadata.node_types where name = \'akkeris/apps\'')).rows[0].type;
  const sitesType = (await pgpool.query('select "type" from metadata.node_types where name = \'akkeris/sites\'')).rows[0].type;
  const routeType = (await pgpool.query('select "type" from metadata.node_types where name = \'akkeris/routes\'')).rows[0].type;

  await Promise.all(routes.map(async (route) => {
    try {
      await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do nothing',
        [route.app_log, route.app_name, appType]);
      await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do nothing',
        [route.site_log, route.site_name, sitesType]);
      await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do update set name = $2',
        [route.route_log, `Proxy https://${route.site_name + route.source_path} to ${route.app_path + route.target_path.substring(1)}`, routeType]);
      await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
        [route.app_log, route.route_log]);
      await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
        [route.route_log, route.site_log]);
    } catch (e) {
      debug(`Error cannot add link between ${route.app_log} and ${route.route_log} and ${route.site_log} due to: ${e.message}`);
    }
  }));

  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select route_log from akkeris.routes)', [routeType]);
}

async function init() {} // eslint-disable-line no-empty-function

async function run(pgpool) {
  await writeAkkerisAppsToSites(pgpool);
}

module.exports = {
  run,
  init,
};
