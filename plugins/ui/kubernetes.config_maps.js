const { grab } = require('./common.js');

module.exports = async function addExpressRoutes(pgpool, bus, app) {
  app.param('kubernetes_config_map_id', async (req, res, next) => {
    const { rows: config_map } = await pgpool.query('select * from kubernetes.config_maps where ((namespace::varchar(128) || \'/\' || name::varchar(128)) = $1 or config_map::varchar(128) = $1)', [req.params.kubernetes_config_map_id]); // eslint-disable-line camelcase
    if (config_map.length !== 1) {
      delete req.params.kubernetes_config_map_id;
      res.sendStatus(404);
      return;
    }
    req.params.kubernetes_config_map = config_map[0]; // eslint-disable-line prefer-destructuring
    req.params.kubernetes_config_map_id = config_map[0].config_map;
    next();
  });
  app.get('/ui/kubernetes/config_maps/:kubernetes_config_map_id', async (req, res, next) => {
    const { rows: metadata } = await pgpool.query('select * from metadata.objects where node = $1', [req.params.kubernetes_config_map_id]);
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
    `, [req.params.kubernetes_config_map_id]);

    const { rows: changes } = await pgpool.query(`
      select 
        'definition' as "$type",
        'cube' as "$icon",
        config_maps_log.config_map as id,
        config_maps_log.deleted,
        config_maps_log.observed_on,
        (config_maps_log.namespace || '/' || config_maps_log.name) as name
      from 
        kubernetes.config_maps_log 
      where
        config_maps_log.config_map = $1
    `, [req.params.kubernetes_config_map_id]);

    const data = {
      ...metadata[0],
      ...req.params.kubernetes_config_map,
      changes,
      usedBy,
    };

    grab('./views/kubernetes.config_maps.html', req, res, next, data);
  });
  app.post('/ui/kubernetes/config_maps/:kubernetes_config_map_id/labels', async (req, res) => {
    try {
      const { rows: [{ type }] } = await pgpool.query('select type from metadata.node_types where name=\'kubernetes/config_maps\'');
      await pgpool.query(`
        insert into metadata.labels (label, name, value, implicit, node, type) 
        values (uuid_generate_v4(), $1, $2, false, $3, $4) 
        on conflict (name, value, implicit, node, type) 
        do update set value = $2`,
      [req.body.name, req.body.value, req.params.kubernetes_config_map_id, type]);
      res.redirect(`/ui/kubernetes/config_maps/${req.params.kubernetes_config_map_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/kubernetes/config_maps/${req.params.kubernetes_config_map_id}?error=${e.message}#metadata`);
    }
  });
  app.post('/ui/kubernetes/config_maps/:kubernetes_config_map_id/annotations', async (req, res) => {
    try {
      const { rows: [{ type }] } = await pgpool.query('select type from metadata.node_types where name=\'kubernetes/config_maps\'');
      await pgpool.query(`
        insert into metadata.annotations (annotation, name, value, implicit, node, type) 
        values (uuid_generate_v4(), $1, $2, false, $3, $4) 
        on conflict (node, type, name, implicit) 
        do update set value = $2`,
      [req.body.name, req.body.value, req.params.kubernetes_config_map_id, type]);
      res.redirect(`/ui/kubernetes/config_maps/${req.params.kubernetes_config_map_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/kubernetes/config_maps/${req.params.kubernetes_config_map_id}?error=${e.message}#metadata`);
    }
  });
  app.get('/ui/kubernetes/config_maps/:kubernetes_config_map_id/labels/:label/delete', async (req, res) => {
    try {
      const { rows: [{ type }] } = await pgpool.query('select type from metadata.node_types where name=\'kubernetes/config_maps\'');
      await pgpool.query('delete from metadata.labels where node = $1 and name = $2 and type = $3',
        [req.params.kubernetes_config_map_id, req.params.label, type]);
      res.redirect(`/ui/kubernetes/config_maps/${req.params.kubernetes_config_map_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/kubernetes/config_maps/${req.params.kubernetes_config_map_id}?error=${e.message}#metadata`);
    }
  });
  app.get('/ui/kubernetes/config_maps/:kubernetes_config_map_id/annotations/:annotation/delete', async (req, res) => {
    try {
      const { rows: [{ type }] } = await pgpool.query('select type from metadata.node_types where name=\'kubernetes/config_maps\'');
      await pgpool.query('delete from metadata.annotations where node = $1 and name = $2 and type = $3',
        [req.params.kubernetes_config_map_id, req.params.annotation, type]);
      res.redirect(`/ui/kubernetes/config_maps/${req.params.kubernetes_config_map_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/kubernetes/config_maps/${req.params.kubernetes_config_map_id}?error=${e.message}#metadata`);
    }
  });
};
