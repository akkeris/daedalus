const {
  grab, findUses, findUsedBy, findMetaData, addExpressAnnotationsAndLabelRoutes,
} = require('./common.js');

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
    const { rows: changes } = await pgpool.query(`
      select 
        'routes' as "$type",
        'route' as "$icon",
        routes_log.route_log as id,
        routes_log.deleted,
        routes_log.observed_on,
        ('Proxy https://' || sites_log.name || routes_log.source_path || ' to ' || (apps_log.definition::jsonb->>'web_url') || substring(routes_log.target_path from 2)) as name
      from 
        akkeris.sites_log 
          join akkeris.routes_log on sites_log.site_log = routes_log.site_log
          join akkeris.apps_log on routes_log.app_log = apps_log.app_log
      where
        sites_log.site_log = $1
    `, [req.params.akkeris_site_id]);

    const data = {
      ...req.params.akkeris_site,
      ...(await findMetaData(pgpool, req.params.akkeris_site_id)),
      changes,
      usedBy: await findUsedBy(pgpool, req.params.akkeris_site_id),
      uses: await findUses(pgpool, req.params.akkeris_site_id),
    };

    grab('./views/akkeris.sites.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'akkeris/sites', 'akkeris_site_id');
};
