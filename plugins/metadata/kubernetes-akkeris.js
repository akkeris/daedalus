const debug = require('debug')('daedalus:metadata');

async function writeAkkersAppsFromDeployments(pgpool, type, deployments) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${deployments.length} deployments for links to apps.`);

  await Promise.all(deployments.map(async (deployment) => {
    if (deployment.definition.metadata && deployment.definition.metadata.labels && deployment.definition.metadata.labels['akkeris.io/app-uuid']) {
      try {
        const { rows: [{ app_log }] } = await pgpool.query('select app_log, name, definition from akkeris.apps where app = $1', // eslint-disable-line camelcase
          [deployment.definition.metadata.labels['akkeris.io/app-uuid']]);
        await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
          [app_log, deployment.node_log]); // eslint-disable-line camelcase
      } catch (e) {
        if (!(e.message && e.message.startsWith('Cannot read property \'app_log\''))) {
          // filter out deployments that reference an app that is no longer in akkeris.
          debug(`Error unable to link app ${deployment.definition.metadata.labels['akkeris.io/app-uuid']} named ${deployment.definition.metadata.labels['akkeris.io/app-name']} to deployment ${deployment.deployment} due to: ${e.message}`);
        }
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
