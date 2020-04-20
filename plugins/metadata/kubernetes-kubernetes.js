const debug = require('debug')('daedalus:metadata');

async function writeKubernetesPodToReplicaSets(pgpool, type, podRecords) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${podRecords.length} pods for metadata to replicasets.`);

  const replicaSetType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/replicasets\'')).rows[0].type;
  const podType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/pods\'')).rows[0].type;

  await Promise.all(podRecords.map(async (pod) => {
    if (pod.definition.metadata.ownerReferences) {
      await Promise.all(pod.definition.metadata.ownerReferences.map(async (ref) => {
        try {
          if (ref.kind === 'ReplicaSet') {
            const { rows: [{ replicaset, name, definition }] } = await pgpool.query('select replicaset, name, definition from kubernetes.replicasets where name = $1 and namespace = $2',
              [ref.name, pod.definition.metadata.namespace]);
            await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do nothing',
              [pod.pod, pod.name, podType]);
            await pgpool.query('insert into metadata.nodes (node, name, type, transient) values ($1, $2, $3, $4) on conflict (node) do update set transient = $4',
              [replicaset, name, replicaSetType, definition.spec.replicas === 0]);
            await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
              [replicaset, pod.pod]);
          } else if (ref.kind === 'Job') { // TODO
          } else if (ref.kind === 'DaemonSet') { // TODO
          } else if (ref.kind === 'StatefulSet') { // TODO
          } else {
            console.warn(`Warning: unknown owner reference found on pod ${pod.definition.metadata.name}/${pod.definition.metadata.namespace}: ${JSON.stringify(ref, null, 2)}`); // eslint-disable-line no-console
          }
        } catch (e) {
          debug(`Error unable to add link for pod ${pod.pod} to replicaset ${`${ref.name}/${pod.definition.metadata.namespace}`}`); // eslint-disable-line max-len,no-console
        }
      }));
    }
  }));

  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select pod from kubernetes.pods)', [podType]);
}

async function writeKubernetesReplicaSetToDeployments(pgpool, type, replicaSetRecords) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${replicaSetRecords.length} replicasets for links to deployments.`);

  const replicaSetType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/replicasets\'')).rows[0].type;
  const deploymentType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/deployments\'')).rows[0].type;

  await Promise.all(replicaSetRecords.map(async (replicaSet) => {
    if (replicaSet.definition.metadata.ownerReferences) {
      await Promise.all(replicaSet.definition.metadata.ownerReferences.map(async (ref) => {
        try {
          if (ref.kind === 'Deployment') {
            const { rows: [{ deployment, name }] } = await pgpool.query('select deployment, name from kubernetes.deployments where name = $1 and namespace = $2',
              [ref.name, replicaSet.definition.metadata.namespace]);
            await pgpool.query('insert into metadata.nodes (node, name, type, transient) values ($1, $2, $3, $4) on conflict (node) do update set transient = $4',
              [replicaSet.replicaset, replicaSet.name, replicaSetType, replicaSet.definition.spec.replicas === 0]); // eslint-disable-line max-len
            await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do nothing',
              [deployment, name, deploymentType]);
            await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
              [deployment, replicaSet.replicaset]);
          } else {
            console.warn(`Warning: unknown owner reference found on replicaset ${replicaSet.definition.metadata.name}/${replicaSet.definition.metadata.namespace}: ${JSON.stringify(ref, null, 2)}`); // eslint-disable-line no-console
          }
        } catch (e) {
          debug(`Error unable to add link for replicaset ${replicaSet.replicaset} to deployment ${`${ref.name}/${replicaSet.definition.metadata.namespace}`}`); // eslint-disable-line max-len,no-console
        }
      }));
    }
  }));

  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select replicaset from kubernetes.replicasets)', [replicaSetType]);
}

async function writeKubernetesDeploymentToConfigMaps(pgpool, type, deployments) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${deployments.length} deployments for links to config maps.`);

  const configMapType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/config_maps\'')).rows[0].type;
  const deploymentType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/deployments\'')).rows[0].type;

  await Promise.all(deployments.map(async (deployment) => {
    if (deployment.definition.spec.template.spec.containers) {
      await Promise.all(deployment.definition.spec.template.spec.containers.map(async (container) => { // eslint-disable-line max-len
        if (container.envFrom) {
          await Promise.all(container.envFrom.map(async (envFrom) => {
            if (envFrom.configMapRef && envFrom.configMapRef.name) {
              try {
                const { rows: [{ config_map, name }] } = await pgpool.query('select config_map, name from kubernetes.config_maps where name = $1 and namespace = $2', // eslint-disable-line camelcase
                  [envFrom.configMapRef.name, deployment.definition.metadata.namespace]);
                await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do nothing',
                  [deployment.deployment, deployment.name, deploymentType]);
                await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do nothing',
                  [config_map, name, configMapType]); // eslint-disable-line camelcase
                await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                  [config_map, deployment.deployment]); // eslint-disable-line camelcase
              } catch (e) {
                debug(`Error unable to add link for deployment ${deployment.deployment} to configmap ${envFrom.configMapRef.name}`); // eslint-disable-line max-len,no-console
              }
            }
          }));
        }
      }));
    }
  }));
  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select config_map from kubernetes.config_maps)', [configMapType]);
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
