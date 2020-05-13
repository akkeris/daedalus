const {
  grab, findUses, findUsedBy, findMetaData, isFavorite,
  usersAndWatchers, addExpressAnnotationsAndLabelRoutes,
} = require('./common.js');

module.exports = async function addExpressRoutes(pgpool, bus, app) {
  app.param('kubernetes_replicaset_id', async (req, res, next) => {
    const { rows: replicaset } = await pgpool.query('select * from kubernetes.replicasets where ((namespace::varchar(128) || \'/\' || name::varchar(128)) = $1 or replicaset::varchar(128) = $1)', [req.params.kubernetes_replicaset_id]);
    if (replicaset.length !== 1) {
      delete req.params.kubernetes_replicaset_id;
      res.sendStatus(404);
      return;
    }
    req.params.kubernetes_replicaset = replicaset[0]; // eslint-disable-line prefer-destructuring
    req.params.kubernetes_replicaset_id = replicaset[0].replicaset;
    req.params.node = replicaset[0].replicaset;
    next();
  });
  app.get('/ui/kubernetes/replicasets/:kubernetes_replicaset_id', async (req, res, next) => {
    const { rows: changes } = await pgpool.query(`
      select 
        'definition' as "$type",
        'cube' as "$icon",
        replicasets_log.replicaset as id,
        replicasets_log.deleted,
        replicasets_log.observed_on,
        (replicasets_log.namespace || '/' || replicasets_log.name) as name
      from 
        kubernetes.replicasets_log 
      where
        replicasets_log.replicaset = $1
    `, [req.params.kubernetes_replicaset_id]);

    const data = {
      ...req.params.kubernetes_replicaset,
      ...(await findMetaData(pgpool, req.params.kubernetes_replicaset_id)),
      changes,
      usedBy: await findUsedBy(pgpool, req.params.kubernetes_replicaset_id),
      uses: await findUses(pgpool, req.params.kubernetes_replicaset_id),
      users: await usersAndWatchers(pgpool, req.params.kubernetes_replicaset_id),
      favorite: req.session.profile ? await isFavorite(pgpool, req.params.node, req.session.profile.user) : null, // eslint-disable-line max-len
    };

    grab('./views/kubernetes.replicasets.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'kubernetes/replicasets', 'kubernetes_replicaset_id');
};
