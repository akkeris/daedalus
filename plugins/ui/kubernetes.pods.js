const {
  grab, findUses, findUsedBy, findMetaData, addExpressAnnotationsAndLabelRoutes,
} = require('./common.js');

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
      ...(await findMetaData(pgpool, req.params.kubernetes_pod_id)),
      ...req.params.kubernetes_pod,
      changes,
      usedBy: await findUsedBy(pgpool, req.params.kubernetes_pod_id),
      uses: await findUses(pgpool, req.params.kubernetes_pod_id),
    };

    grab('./views/kubernetes.pods.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'kubernetes/pods', 'kubernetes_pod_id');
};
