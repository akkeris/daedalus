const {
  grab, findUses, findMetaData, findUsedBy, addExpressAnnotationsAndLabelRoutes,
} = require('./common.js');

module.exports = async function addExpressRoutes(pgpool, bus, app) {
  app.param('kubernetes_deployment_id', async (req, res, next) => {
    const { rows: deployment } = await pgpool.query('select * from kubernetes.deployments where ((namespace::varchar(128) || \'/\' || name::varchar(128)) = $1 or deployment::varchar(128) = $1)', [req.params.kubernetes_deployment_id]);
    if (deployment.length !== 1) {
      delete req.params.kubernetes_deployment_id;
      res.sendStatus(404);
      return;
    }
    req.params.kubernetes_deployment = deployment[0]; // eslint-disable-line prefer-destructuring
    req.params.kubernetes_deployment_id = deployment[0].deployment;
    next();
  });
  app.get('/ui/kubernetes/deployments/:kubernetes_deployment_id', async (req, res, next) => {
    // TODO: Flip this to use the actual uid from kube.
    const { rows: changes } = await pgpool.query(`
      with a as (
        select
          'definition' as "$type",
          'cube' as "$icon",
          deployments_log.deployment as id,
          deployments_log.deleted,
          deployments_log.definition,
          deployments_log.observed_on,
          (deployments_log.namespace || '/' || deployments_log.name) as name,
          row_number() over (partition by deployments_log.namespace, deployments_log.name, deployments_log.context order by deployments_log.observed_on) as number
        from
          kubernetes.deployments_log
        where
          deployments_log.namespace = $1 and deployments_log.name = $2 and deployments_log.context = $3
      )
      select
        a."$type",
        a."$icon",
        a.id,
        a.definition,
        a.deleted,
        a.observed_on,
        a.name,
        b.definition as old_definition
      from a
        left join a as b on a.number = (b.number + 1)
      order by a.observed_on desc
    `, [req.params.kubernetes_deployment.namespace, req.params.kubernetes_deployment.name, req.params.kubernetes_deployment.context]);

    const data = {
      ...(await findMetaData(pgpool, req.params.kubernetes_deployment_id)),
      ...req.params.kubernetes_deployment,
      changes,
      usedBy: await findUsedBy(pgpool, req.params.kubernetes_deployment_id),
      uses: await findUses(pgpool, req.params.kubernetes_deployment_id),
    };

    grab('./views/kubernetes.deployments.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'kubernetes/deployments', 'kubernetes_deployment_id');
};
