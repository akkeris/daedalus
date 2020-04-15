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
        const { rows: [{ app_log }] } = await pgpool.query('select app_log from akkeris.apps where app = $1', // eslint-disable-line camelcase
          [deployment.definition.metadata.labels['akkeris.io/app-uuid']]);

        await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do nothing',
          [deployment.deployment, deployment.name, deploymentType]);
        await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do nothing',
          [app_log, deployment.definition.metadata.labels['akkeris.io/app-name'], appType]); // eslint-disable-line camelcase
        await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
          [app_log, deployment.deployment]); // eslint-disable-line camelcase
      } catch (e) {
        debug(`warning: looking for app ${deployment.definition.metadata.labels['akkeris.io/app-uuid']} named ${deployment.definition.metadata.labels['akkeris.io/app-name']} failed: ${e.message}`);
      }
    }
  }));
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
