const debug = require('debug')('daedalus:metadata');

async function writeKubernetesPodToReplicaSets(pgpool, type, podRecords) {
  if (type !== 'sync') {
    return;
  }
  let found = 0;
  debug(`Examining ${podRecords.length} pods for metadata to replicasets...`);
  await Promise.all(podRecords.map(async (pod) => {
    if (pod.definition.metadata.ownerReferences) {
      await Promise.all(pod.definition.metadata.ownerReferences.map(async (ref) => {
        try {
          if (ref.kind === 'ReplicaSet') {
            const { rows: [{ node_log }] } = await pgpool.query('select node_log, name, definition from kubernetes.replicasets where name = $1 and namespace = $2', // eslint-disable-line camelcase
              [ref.name, pod.definition.metadata.namespace]);
            await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
              [node_log, pod.node_log]); // eslint-disable-line camelcase
            found++; // eslint-disable-line no-plusplus
          } else if (ref.kind === 'Job') { // TODO
          } else if (ref.kind === 'DaemonSet') { // TODO
          } else if (ref.kind === 'StatefulSet') { // TODO
          } else {
            console.warn(`Warning: unknown owner reference found on pod ${pod.definition.metadata.name}/${pod.definition.metadata.namespace}: ${JSON.stringify(ref, null, 2)}`); // eslint-disable-line no-console
          }
        } catch (e) {
          debug(`Error unable to add link for pod ${pod.node_log} to replicaset ${`${ref.name}/${pod.definition.metadata.namespace} due to: ${e.message}`}`); // eslint-disable-line max-len,no-console
        }
      }));
    }
  }));
  debug(`Examining ${podRecords.length} pods for metadata to replicasets... done (${found} found).`);
}

async function writeKubernetesReplicaSetToDeployments(pgpool, type, replicaSetRecords) {
  if (type !== 'sync') {
    return;
  }
  let found = 0;
  debug(`Examining ${replicaSetRecords.length} replicasets for links to deployments...`);
  await Promise.all(replicaSetRecords.map(async (replicaSet) => {
    if (replicaSet.definition.metadata.ownerReferences) {
      await Promise.all(replicaSet.definition.metadata.ownerReferences.map(async (ref) => {
        try {
          if (ref.kind === 'Deployment') {
            const { rows: [{ node_log }] } = await pgpool.query('select node_log, name from kubernetes.deployments where name = $1 and namespace = $2', // eslint-disable-line camelcase
              [ref.name, replicaSet.definition.metadata.namespace]);
            await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
              [node_log, replicaSet.node_log]); // eslint-disable-line camelcase
            found++; // eslint-disable-line no-plusplus
          } else {
            console.warn(`Warning: unknown owner reference found on replicaset ${replicaSet.definition.metadata.name}/${replicaSet.definition.metadata.namespace}: ${JSON.stringify(ref, null, 2)}`); // eslint-disable-line no-console
          }
        } catch (e) {
          debug(`Error unable to add link for replicaset ${replicaSet.node_log} to deployment ${`${ref.name}/${replicaSet.definition.metadata.namespace}`} due to ${e.message}`); // eslint-disable-line max-len,no-console
        }
      }));
    }
  }));

  debug(`Examining ${replicaSetRecords.length} replicasets for links to deployments... done (${found} found)`);
}

async function writeKubernetesDeploymentToConfigMaps(pgpool, type, deployments) {
  if (type !== 'sync') {
    return;
  }
  let found = 0;
  debug(`Examining ${deployments.length} deployments for links to config maps...`);
  await Promise.all(deployments.map(async (deployment) => {
    if (deployment.definition.spec.template.spec.containers) {
      await Promise.all(deployment.definition.spec.template.spec.containers.map(async (container) => { // eslint-disable-line max-len
        if (container.envFrom) {
          await Promise.all(container.envFrom.map(async (envFrom) => {
            if (envFrom.configMapRef && envFrom.configMapRef.name) {
              try {
                const { rows: [{ node_log }] } = await pgpool.query('select node_log, name from kubernetes.configmaps where name = $1 and namespace = $2', // eslint-disable-line camelcase
                  [envFrom.configMapRef.name, deployment.definition.metadata.namespace]);
                await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                  [deployment.node_log, node_log]); // eslint-disable-line camelcase
                found++; // eslint-disable-line no-plusplus
              } catch (e) {
                debug(`Error unable to add link for deployment ${deployment.deployment} to configmap ${envFrom.configMapRef.name} due to ${e.message}`); // eslint-disable-line max-len,no-console
              }
            }
          }));
        }
      }));
    }
  }));
  debug(`Examining ${deployments.length} deployments for links to config maps... done (${found} found)`);
}

async function init(pgpool, bus) {
  bus.on('kubernetes.pod', writeKubernetesPodToReplicaSets.bind(null, pgpool));
  bus.on('kubernetes.replicaset', writeKubernetesReplicaSetToDeployments.bind(null, pgpool));
  bus.on('kubernetes.deployment', writeKubernetesDeploymentToConfigMaps.bind(null, pgpool));
}

async function run() { // eslint-disable-line no-empty-function
}

module.exports = {
  run,
  init,
};
