const { grab } = require('./common.js');

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
    const { rows: metadata } = await pgpool.query('select * from metadata.objects where node = $1', [req.params.kubernetes_deployment_id]);
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
    `, [req.params.kubernetes_deployment_id]);

    const { rows: changes } = await pgpool.query(`
      select 
        'definition' as "$type",
        'cube' as "$icon",
        deployments_log.deployment as id,
        deployments_log.deleted,
        deployments_log.observed_on,
        (deployments_log.namespace || '/' || deployments_log.name) as name
      from 
        kubernetes.deployments_log 
      where
        deployments_log.deployment = $1
    `, [req.params.kubernetes_deployment_id]);

    const data = {
      ...metadata[0],
      ...req.params.kubernetes_deployment,
      changes,
      usedBy,
    };

    grab('./views/kubernetes.deployments.html', req, res, next, data);
  });
  app.post('/ui/kubernetes/deployments/:kubernetes_deployment_id/labels', async (req, res) => {
    try {
      const { rows: [{ type }] } = await pgpool.query('select type from metadata.node_types where name=\'kubernetes/deployments\'');
      await pgpool.query(`
        insert into metadata.labels (label, name, value, implicit, node, type) 
        values (uuid_generate_v4(), $1, $2, false, $3, $4) 
        on conflict (name, value, implicit, node, type) 
        do update set value = $2`,
      [req.body.name, req.body.value, req.params.kubernetes_deployment_id, type]);
      res.redirect(`/ui/kubernetes/deployments/${req.params.kubernetes_deployment_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/kubernetes/deployments/${req.params.kubernetes_deployment_id}?error=${e.message}#metadata`);
    }
  });
  app.post('/ui/kubernetes/deployments/:kubernetes_deployment_id/annotations', async (req, res) => {
    try {
      const { rows: [{ type }] } = await pgpool.query('select type from metadata.node_types where name=\'kubernetes/deployments\'');
      await pgpool.query(`
        insert into metadata.annotations (annotation, name, value, implicit, node, type) 
        values (uuid_generate_v4(), $1, $2, false, $3, $4) 
        on conflict (node, type, name, implicit) 
        do update set value = $2`,
      [req.body.name, req.body.value, req.params.kubernetes_deployment_id, type]);
      res.redirect(`/ui/kubernetes/deployments/${req.params.kubernetes_deployment_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/kubernetes/deployments/${req.params.kubernetes_deployment_id}?error=${e.message}#metadata`);
    }
  });
  app.get('/ui/kubernetes/deployments/:kubernetes_deployment_id/labels/:label/delete', async (req, res) => {
    try {
      const { rows: [{ type }] } = await pgpool.query('select type from metadata.node_types where name=\'kubernetes/deployments\'');
      await pgpool.query('delete from metadata.labels where node = $1 and name = $2 and type = $3',
        [req.params.kubernetes_deployment_id, req.params.label, type]);
      res.redirect(`/ui/kubernetes/deployments/${req.params.kubernetes_deployment_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/kubernetes/deployments/${req.params.kubernetes_deployment_id}?error=${e.message}#metadata`);
    }
  });
  app.get('/ui/kubernetes/deployments/:kubernetes_deployment_id/annotations/:annotation/delete', async (req, res) => {
    try {
      const { rows: [{ type }] } = await pgpool.query('select type from metadata.node_types where name=\'kubernetes/deployments\'');
      await pgpool.query('delete from metadata.annotations where node = $1 and name = $2 and type = $3',
        [req.params.kubernetes_deployment_id, req.params.annotation, type]);
      res.redirect(`/ui/kubernetes/deployments/${req.params.kubernetes_deployment_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/kubernetes/deployments/${req.params.kubernetes_deployment_id}?error=${e.message}#metadata`);
    }
  });
};
