const debug = require('debug')('daedalus:metadata');

async function writeAkkersAppsFromDeployments(pgpool, type, deployments) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${deployments.length} deployments for links to apps.`);

  const appType = (await pgpool.query('select "type" from metadata.node_types where name = \'akkeris/apps\'')).rows[0].type;
  const deploymentType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/deployments\'')).rows[0].type;

  await Promise.all(deployments.map(async (deployment) => {
    if (deployment.definition.metadata.labels['akkeris.io/app-uuid']) {
      try {
        const { rows: [{ app_log, name }] } = await pgpool.query('select app_log, name from akkeris.apps where app = $1', // eslint-disable-line camelcase
          [deployment.definition.metadata.labels['akkeris.io/app-uuid']]);

        await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do nothing',
          [deployment.deployment, deployment.name, deploymentType]);
        await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do nothing',
          [app_log, name, appType]); // eslint-disable-line camelcase
        await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
          [app_log, deployment.deployment]); // eslint-disable-line camelcase
      } catch (e) {
        if (!(e.message && e.message.startsWith('Cannot read property \'app_log\''))) {
          // filter out deployments that reference an app that is no longer in akkeris.
          debug(`Error unable to link app ${deployment.definition.metadata.labels['akkeris.io/app-uuid']} named ${deployment.definition.metadata.labels['akkeris.io/app-name']} to deployment ${deployment.deployment} due to: ${e.message}`);
        }
      }
    }
  }));

  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select app_log from akkeris.apps)', [appType]);
  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select deployment from kubernetes.deployments)', [deploymentType]);
}

async function init(pgpool, bus) {
  bus.on('kubernetes.deployment', writeAkkersAppsFromDeployments.bind(null, pgpool));
}

async function run() { // eslint-disable-line no-empty-function
}

module.exports = {
  run,
  init,
};
