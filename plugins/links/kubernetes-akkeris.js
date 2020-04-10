const debug = require('debug')('daedalus:links');

async function writeAkkersAppsFromDeployments(pgpool, type, deployments) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${deployments.length} deployments for links to apps.`);
  await Promise.all(deployments.map(async (deployment) => {
    if (deployment.definition.metadata.labels['akkeris.io/app-uuid']) {
      try {
        const { rows: [{ app_log }] } = await pgpool.query('select app_log from akkeris.apps where app = $1', // eslint-disable-line camelcase
          [deployment.definition.metadata.labels['akkeris.io/app-uuid']]);
        await pgpool.query(`
          insert into links.from_kubernetes_deployments_to_akkeris_apps_log
          (link, deployment, app_log, observed_on, deleted)
          values (uuid_generate_v4(), $1, $2, now(), false)
          on conflict (deployment, app_log, deleted)
          do nothing
        `, [deployment.deployment, app_log]); // eslint-disable-line camelcase
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
