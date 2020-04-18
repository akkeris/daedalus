const { grab, addExpressAnnotationsAndLabelRoutes } = require('./common.js');

module.exports = async function addExpressRoutes(pgpool, bus, app) {
  app.param('akkeris_app_id', async (req, res, next) => {
    const { rows: apps } = await pgpool.query('select * from akkeris.apps where (app_log::varchar(128) = $1 or app::varchar(128) = $1 or name::varchar(128) = $1)', [req.params.akkeris_apps_id]);
    if (apps.length !== 1) {
      delete req.params.akkeris_apps_id;
      res.sendStatus(404);
      return;
    }
    req.params.akkeris_app = apps[0]; // eslint-disable-line prefer-destructuring
    req.params.akkeris_apps_id = apps[0].app_log;
    next();
  });
  app.get('/ui/akkeris/apps/:akkeris_apps_id', async (req, res, next) => {
    const { rows: metadata } = await pgpool.query('select * from metadata.objects where node = $1', [req.params.akkeris_apps_id]);
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
    `, [req.params.akkeris_apps_id]);

    const { rows: changes } = await pgpool.query(`
      select 
        'apps' as "$type",
        'app' as "$icon",
        apps_log.app_log as id,
        apps_log.deleted,
        apps_log.observed_on,
        apps_log.name
      from 
        akkeris.apps_log join akkeris.spaces_log on apps_log.space_log = spaces_log.space_log
      where
        apps_log.app_log = $1
    `, [req.params.akkeris_apps_id]);

    const data = {
      ...req.params.akkeris_app,
      ...metadata[0],
      changes,
      usedBy,
    };

    grab('./views/akkeris.apps.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'akkeris/apps', 'akkeis_apps_id');
};
