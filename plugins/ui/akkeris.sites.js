const { grab, addExpressAnnotationsAndLabelRoutes } = require('./common.js');

module.exports = async function addExpressRoutes(pgpool, bus, app) {
  app.param('akkeris_site_id', async (req, res, next) => {
    const { rows: sites } = await pgpool.query('select * from akkeris.sites where (site_log::varchar(128) = $1 or site::varchar(128) = $1 or name::varchar(128) = $1)', [req.params.akkeris_site_id]);
    if (sites.length !== 1) {
      delete req.params.akkeris_site_id;
      res.sendStatus(404);
      return;
    }
    req.params.akkeris_site = sites[0]; // eslint-disable-line prefer-destructuring
    req.params.akkeris_site_id = sites[0].site_log;
    next();
  });
  app.get('/ui/akkeris/sites/:akkeris_site_id', async (req, res, next) => {
    const { rows: metadata } = await pgpool.query('select * from metadata.objects where node = $1', [req.params.akkeris_site_id]);
    const { rows: usedBy } = await pgpool.query(`
      select 
        child_icon as "$icon",
        child_type as "$type",
        child as id,
        child_name as name,
        parent as owner,
        parent_name as owner_name,
        parent_type as "$owner_type",
        parent_icon as "$owner_icon"
      from 
        metadata.find_node_relatives($1)
    `, [req.params.akkeris_site_id]);

    const { rows: changes } = await pgpool.query(`
      select 
        'routes' as "$type",
        'route' as "$icon",
        routes_log.route_log as id,
        routes_log.deleted,
        routes_log.observed_on,
        'Proxy site path ' || routes_log.source_path || ' to application path ' || routes_log.target_path as name
      from 
        akkeris.sites_log join akkeris.routes_log on sites_log.site_log = routes_log.site_log
      where
        sites_log.site_log = $1
    `, [req.params.akkeris_site_id]);

    /* let changes = columnChanges.map((x) => ({ ...x, $type: 'column' }))
      .concat(tableChanges.map((x) => ({ ...x, $type: 'table' })))
      .concat(constraintChanges.map((x) => ({ ...x, $type: 'constraint' })))
      .concat(indexChanges.map((x) => ({ ...x, $type: 'index' })))
      .sort((a, b) => (a.observed_on.getTime() < b.observed_on.getTime() ? 1 : -1));

    changes = changes.slice(0, changes.length > 200 ? 200 : changes.length);
    let changes = []; */

    const data = {
      ...req.params.akkeris_site,
      ...metadata[0],
      changes,
      usedBy,
    };

    grab('./views/akkeris.sites.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'akkeris/sites', 'akkeris_site_id');
};
