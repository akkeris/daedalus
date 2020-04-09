const debug = require('debug')('daedalus:links');

async function writeKubernetesPodToReplicaSets(pgpool, type, podRecords) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${podRecords.length} pods for links to replicasets.`);
  await Promise.all(podRecords.map(async (pod) => {
    if (pod.definition.metadata.ownerReferences) {
      await Promise.all(pod.definition.metadata.ownerReferences.map(async (ref) => {
        if (ref.kind === 'ReplicaSet') {
          const { rows: [{ replicaset }] } = await pgpool.query('select replicaset from kubernetes.replicasets where name = $1 and namespace = $2',
            [ref.name, pod.definition.metadata.namespace]);
          await pgpool.query(`
            insert into links.from_kubernetes_pods_to_kubernetes_replicasets_log
            (link, pod, replicaset, observed_on, deleted)
            values (uuid_generate_v4(), $1, $2, now(), false)
            on conflict (pod, replicaset, deleted)
            do nothing
          `, [pod.pod, replicaset]);
        } else if (ref.kind === 'Job') { // TODO
        } else if (ref.kind === 'DaemonSet') { // TODO
        } else if (ref.kind === 'StatefulSet') { // TODO
        } else {
          console.warn(`Warning: unknown owner reference found on pod ${pod.definition.metadata.name}/${pod.definition.metadata.namespace}: ${JSON.stringify(ref, null, 2)}`); // eslint-disable-line no-console
        }
      }));
    }
  }));
}

async function writeKubernetesReplicaSetToDeployments(pgpool, type, replicaSetRecords) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${replicaSetRecords.length} replicasets for links to deployments.`);
  await Promise.all(replicaSetRecords.map(async (replicaSet) => {
    if (replicaSet.definition.metadata.ownerReferences) {
      await Promise.all(replicaSet.definition.metadata.ownerReferences.map(async (ref) => {
        if (ref.kind === 'Deployment') {
          const { rows: [{ deployment }] } = await pgpool.query('select deployment from kubernetes.deployments where name = $1 and namespace = $2',
            [ref.name, replicaSet.definition.metadata.namespace]);
          await pgpool.query(`
            insert into links.from_kubernetes_replicasets_to_kubernetes_deployments_log
            (link, replicaset, deployment, observed_on, deleted)
            values (uuid_generate_v4(), $1, $2, now(), false)
            on conflict (replicaset, deployment, deleted)
            do nothing
          `, [replicaSet.replicaset, deployment]);
        } else {
          console.warn(`Warning: unknown owner reference found on replicaset ${replicaSet.definition.metadata.name}/${replicaSet.definition.metadata.namespace}: ${JSON.stringify(ref, null, 2)}`); // eslint-disable-line no-console
        }
      }));
    }
  }));
}

async function writeKubernetesDeploymentToConfigMaps(pgpool, type, deployments) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${deployments.length} deployments for links to config maps.`);
  await Promise.all(deployments.map(async (deployment) => {
    if (deployment.definition.spec.template.spec.containers) {
      await Promise.all(deployment.definition.spec.template.spec.containers.map(async (container) => { // eslint-disable-line max-len
        if (container.envFrom) {
          await Promise.all(container.envFrom.map(async (envFrom) => {
            if (envFrom.configMapRef && envFrom.configMapRef.name) {
              const { rows: [{ config_map }] } = await pgpool.query('select config_map from kubernetes.config_maps where name = $1 and namespace = $2', // eslint-disable-line camelcase
                [envFrom.configMapRef.name, deployment.definition.metadata.namespace]);
              await pgpool.query(`
                insert into links.from_kubernetes_deployments_to_kubernetes_config_maps_log
                (link, deployment, config_map, observed_on, deleted)
                values (uuid_generate_v4(), $1, $2, now(), false)
                on conflict (deployment, config_map, deleted)
                do nothing
              `, [deployment.deployment, config_map]); // eslint-disable-line camelcase
            }
          }));
        }
      }));
    }
  }));
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
