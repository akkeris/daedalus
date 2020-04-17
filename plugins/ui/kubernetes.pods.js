const { grab, addExpressAnnotationsAndLabelRoutes } = require('./common.js');

module.exports = async function addExpressRoutes(pgpool, bus, app) {
  app.param('kubernetes_pod_id', async (req, res, next) => {
    const { rows: pod } = await pgpool.query('select * from kubernetes.pods where ((namespace::varchar(128) || \'/\' || name::varchar(128)) = $1 or pod::varchar(128) = $1)', [req.params.kubernetes_pod_id]);
    if (pod.length !== 1) {
      delete req.params.kubernetes_pod_id;
      res.sendStatus(404);
      return;
    }
    req.params.kubernetes_pod = pod[0]; // eslint-disable-line prefer-destructuring
    req.params.kubernetes_pod_id = pod[0].pod;
    next();
  });
  app.get('/ui/kubernetes/pods/:kubernetes_pod_id', async (req, res, next) => {
    const { rows: metadata } = await pgpool.query('select * from metadata.objects where node = $1', [req.params.kubernetes_pod_id]);
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
    `, [req.params.kubernetes_pod_id]);

    const { rows: changes } = await pgpool.query(`
      select 
        'definition' as "$type",
        'cube' as "$icon",
        pods_log.pod as id,
        pods_log.deleted,
        pods_log.observed_on,
        (pods_log.namespace || '/' || pods_log.name) as name
      from 
        kubernetes.pods_log 
      where
        pods_log.pod = $1
    `, [req.params.kubernetes_pod_id]);

    const data = {
      ...metadata[0],
      ...req.params.kubernetes_pod,
      changes,
      usedBy,
    };

    grab('./views/kubernetes.pods.html', req, res, next, data);
  });
  app.post('/ui/kubernetes/pods/:kubernetes_pod_id/labels', async (req, res) => {
    try {
      const { rows: [{ type }] } = await pgpool.query('select type from metadata.node_types where name=\'kubernetes/pods\'');
      await pgpool.query(`
        insert into metadata.labels (label, name, value, implicit, node, type) 
        values (uuid_generate_v4(), $1, $2, false, $3, $4) 
        on conflict (name, value, implicit, node, type) 
        do update set value = $2`,
      [req.body.name, req.body.value, req.params.kubernetes_pod_id, type]);
      res.redirect(`/ui/kubernetes/pods/${req.params.kubernetes_pod_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/kubernetes/pods/${req.params.kubernetes_pod_id}?error=${e.message}#metadata`);
    }
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'kubernetes/pods', 'kubernetes_pod_id');
};
