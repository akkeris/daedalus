const assert = require('assert');
const k8s = require('@kubernetes/client-node');
const fs = require('fs');
const debug = require('debug')('daedalus:kubernetes');
const security = require('../../common/security.js');

// TODO: Add watch functionality and increase
// rate at which it pulls the world.

async function checkPermissions(kc) {
  const accessPods = { spec: { resourceAttributes: { verb: 'watch', resource: 'pods' } } };
  const accessReplicaSets = { spec: { resourceAttributes: { verb: 'watch', resource: 'replicasets' } } };
  const accessServices = { spec: { resourceAttributes: { verb: 'watch', resource: 'services' } } };
  const accessNodes = { spec: { resourceAttributes: { verb: 'watch', resource: 'nodes' } } };
  const accessConfigMaps = { spec: { resourceAttributes: { verb: 'watch', resource: 'configmaps' } } };
  const accessPersistentVolumes = { spec: { resourceAttributes: { verb: 'watch', resource: 'persistentvolumes' } } };
  const accessPersistentVolumeClaims = { spec: { resourceAttributes: { verb: 'watch', resource: 'persistentvolumeclaims' } } };
  const accessEvents = { spec: { resourceAttributes: { verb: 'watch', resource: 'events' } } };
  const accessDeployments = { spec: { resourceAttributes: { verb: 'watch', resource: 'deployment', group: 'apps' } } };
  const k8sApi = kc.makeApiClient(k8s.AuthorizationV1Api);

  const canWatchPods = (await k8sApi.createSelfSubjectAccessReview(accessPods)).body.status.allowed;
  const canWatchReplicaSets = (await k8sApi.createSelfSubjectAccessReview(accessReplicaSets)).body.status.allowed; // eslint-disable-line max-len
  const canWatchServices = (await k8sApi.createSelfSubjectAccessReview(accessServices)).body.status.allowed; // eslint-disable-line max-len
  const canWatchNodes = (await k8sApi.createSelfSubjectAccessReview(accessNodes)).body.status.allowed; // eslint-disable-line max-len
  const canWatchConfigMaps = (await k8sApi.createSelfSubjectAccessReview(accessConfigMaps)).body.status.allowed; // eslint-disable-line max-len
  const canWatchDeployments = (await k8sApi.createSelfSubjectAccessReview(accessDeployments)).body.status.allowed; // eslint-disable-line max-len
  const canWatchPersistentVolumes = (await k8sApi.createSelfSubjectAccessReview(accessPersistentVolumes)).body.status.allowed; // eslint-disable-line max-len
  const canWatchPersistentVolumeClaims = (await k8sApi.createSelfSubjectAccessReview(accessPersistentVolumeClaims)).body.status.allowed; // eslint-disable-line max-len
  const canWatchEvents = (await k8sApi.createSelfSubjectAccessReview(accessEvents)).body.status.allowed; // eslint-disable-line max-len

  accessDeployments.spec.resourceAttributes.verb = 'get';
  accessPods.spec.resourceAttributes.verb = 'get';
  accessReplicaSets.spec.resourceAttributes.verb = 'get';
  accessNodes.spec.resourceAttributes.verb = 'get';
  accessServices.spec.resourceAttributes.verb = 'get';
  accessConfigMaps.spec.resourceAttributes.verb = 'get';
  accessPersistentVolumes.spec.resourceAttributes.verb = 'get';
  accessPersistentVolumeClaims.spec.resourceAttributes.verb = 'get';
  accessEvents.spec.resourceAttributes.verb = 'get';

  const canGetPods = (await k8sApi.createSelfSubjectAccessReview(accessPods)).body.status.allowed;
  const canGetDeployments = (await k8sApi.createSelfSubjectAccessReview(accessDeployments)).body.status.allowed; // eslint-disable-line max-len
  const canGetServices = (await k8sApi.createSelfSubjectAccessReview(accessServices)).body.status.allowed; // eslint-disable-line max-len
  const canGetNodes = (await k8sApi.createSelfSubjectAccessReview(accessNodes)).body.status.allowed;
  const canGetConfigMaps = (await k8sApi.createSelfSubjectAccessReview(accessConfigMaps)).body.status.allowed; // eslint-disable-line max-len
  const canGetPersistentVolumes = (await k8sApi.createSelfSubjectAccessReview(accessPersistentVolumes)).body.status.allowed; // eslint-disable-line max-len
  const canGetPersistentVolumeClaims = (await k8sApi.createSelfSubjectAccessReview(accessPersistentVolumeClaims)).body.status.allowed; // eslint-disable-line max-len
  const canGetEvents = (await k8sApi.createSelfSubjectAccessReview(accessEvents)).body.status.allowed; // eslint-disable-line max-len
  const canGetReplicaSets = (await k8sApi.createSelfSubjectAccessReview(accessReplicaSets)).body.status.allowed; // eslint-disable-line max-len

  return canWatchPods && canGetPods
    && canWatchDeployments && canGetDeployments
    && canWatchNodes && canGetNodes
    && canWatchServices && canGetServices
    && canWatchConfigMaps && canGetConfigMaps
    && canWatchPersistentVolumes && canGetPersistentVolumes
    && canWatchPersistentVolumeClaims && canGetPersistentVolumeClaims
    && canWatchEvents && canGetEvents
    && canWatchReplicaSets && canGetReplicaSets;
}

async function loadFromKubeEnvironment(kc) {
  debug('Trying to load from env KUBERNETES_API_URL and KUBERNETES_TOKEN...');
  assert.ok(process.env.KUBERNETES_CONTEXT, 'The kubernetes context (KUBERNETES_CONTEXT) was not specified.');
  assert.ok(process.env.KUBERNETES_API_URL && process.env.KUBERNETES_API_URL.startsWith('http'),
    'The kubernetes API url (KUBERNETES_API_URL) was not specified or was not a https/http URI format.');
  assert.ok(process.env.KUBERNETES_TOKEN, 'The kubernetes token (KUBERNETES_TOKEN) was not specified.');
  kc.loadFromString(`
apiVersion: v1
current-context: ${process.env.KUBERNETES_CONTEXT}
kind: Config
preferences: {}
clusters:
- name: ${process.env.KUBERNETES_CONTEXT}
  cluster:
    insecure-skip-tls-verify: ${process.env.KUBERNETES_SKIP_TLS_VERIFY || 'false'}
    server: ${process.env.KUBERNETES_API_URL}
users:
- name: ${process.env.KUBERNETES_CONTEXT}
  user:
    token: ${process.env.KUBERNETES_TOKEN}
contexts:
- name: ${process.env.KUBERNETES_CONTEXT}
  context:
    user: ${process.env.KUBERNETES_CONTEXT}
    cluster: ${process.env.KUBERNETES_CONTEXT}
`);
  await checkPermissions(kc);
  debug('Loaded kubernetes from env KUBERNETES_API_URL and KUBERNETES_TOKEN...');
}

async function loadFromKubeConfig(kc) {
  debug(`Trying to load kubernetes from ${process.env.HOME}/.kube/config...`);
  assert.ok(process.env.HOME, 'The HOME environment variable was not found.');
  assert.ok(fs.existsSync(`${process.env.HOME}/.kube/config`),
    `The kubeconfig file was not found at ${process.env.HOME}/.kube/config`);
  kc.loadFromFile(`${process.env.HOME}/.kube/config`);
  await checkPermissions(kc);
  debug(`Loaded kubernetes from ${process.env.HOME}/.kube/config...`);
}

async function loadFromServiceAccount(kc) {
  debug('Trying to load from service account...');
  kc.loadFromCluster();
  await checkPermissions(kc);
  debug('Loaded from service account...');
}

async function init(pgpool) {
  debug('Initializing kubernetes plugin...');
  await pgpool.query(fs.readFileSync('./plugins/kubernetes/create.sql').toString());
  debug('Initializing kubernetes plugin... done');
}

function fromEnvArrayToObj(envs) {
  assert.ok(Array.isArray(envs), 'The env passed in was not an array.');
  return envs.filter((x) => x.value)
    .reduce((agg, x) => ({ ...agg, [x.name]: x.value }), {});
}

function redactConfigMaps(data) {
  const x = JSON.parse(JSON.stringify(data)); // make a copy
  if (x.data) {
    x.data = security.redact(x.data);
    if (x.metadata && x.metadata.annotations && x.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration']) {
      const lastAppliedConfig = JSON.parse(x.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration']);
      if (lastAppliedConfig.data) {
        x.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'] = JSON.stringify(security.redact(lastAppliedConfig.data));
      }
    }
  }
  return x;
}

function redactPods(data) {
  const x = JSON.parse(JSON.stringify(data)); // make a copy
  if (x.spec && x.spec.containers) {
    x.spec.containers = x.spec.containers.map((y) => {
      if (y.env) {
        const redactedValues = security.redact(fromEnvArrayToObj(y.env));
        return {
          ...y,
          env: y.env.map((q) => (q.value ? { ...q, value: redactedValues[q.name] } : q)),
        };
      }
      return y;
    });
  }
  if (x.metadata && x.metadata.annotations && x.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration']) {
    const lastAppliedConfig = JSON.parse(x.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration']);
    if (lastAppliedConfig.spec && lastAppliedConfig.spec.containers) {
      lastAppliedConfig.spec.containers = lastAppliedConfig.spec.containers.map((y) => {
        if (y.env) {
          const redactedValues = security.redact(fromEnvArrayToObj(y.env));
          return {
            ...y,
            env: y.env.map((q) => (q.value ? { ...q, value: redactedValues[q.name] } : q)),
          };
        }
        return y;
      });
      x.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'] = JSON.stringify(lastAppliedConfig);
    }
  }
  return x;
}

function redactDeployments(data) {
  const x = JSON.parse(JSON.stringify(data)); // make a copy
  if (x.spec && x.spec.template && x.spec.template.spec && x.spec.template.spec.containers) {
    x.spec.template.spec.containers = x.spec.template.spec.containers.map((y) => {
      if (y.env) {
        const redactedValues = security.redact(fromEnvArrayToObj(y.env));
        return {
          ...y,
          env: y.env.map((q) => (q.value ? { ...q, value: redactedValues[q.name] } : q)),
        };
      }
      return y;
    });
  }
  if (x.metadata && x.metadata.annotations && x.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration']) {
    const lastAppliedConfig = JSON.parse(x.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration']);
    if (lastAppliedConfig.spec
        && lastAppliedConfig.spec.template
        && lastAppliedConfig.spec.template.spec
        && lastAppliedConfig.spec.template.spec.containers) {
      lastAppliedConfig.spec.template.spec.containers = lastAppliedConfig.spec.template.spec.containers.map((y) => { // eslint-disable-line max-len
        if (y.env) {
          const redactedValues = security.redact(fromEnvArrayToObj(y.env));
          return {
            ...y,
            env: y.env.map((q) => (q.value ? { ...q, value: redactedValues[q.name] } : q)),
          };
        }
        return y;
      });
      x.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'] = JSON.stringify(lastAppliedConfig);
    }
  }
  return x;
}

async function writeNamespacedObjs(pgpool, bus, type, func, args) {
  const { body } = await func(args);
  assert.ok(body.items, 'The items field on the returned kube response was not there.');
  assert.ok(Array.isArray(body.items), 'The items field on the returned kube response was not an array');
  debug(`Received ${body.items.length} items for ${type}`);
  const dbObjs = await Promise.all(body.items.map(async (definition) => {
    let redacted = JSON.parse(JSON.stringify(definition));
    if (type === 'config_map') {
      redacted = redactConfigMaps(redacted);
    }
    if (type === 'pod') {
      redacted = redactPods(redacted);
    }
    if (type === 'deployment') {
      redacted = redactDeployments(redacted);
    }
    const dbObj = await pgpool.query(`
      insert into kubernetes.${type}s_log (${type}, name, namespace, context, definition, deleted)
      values (uuid_generate_v4(), $1, $2, $3, $4, $5)
      on conflict (name, context, namespace, ((definition -> 'metadata') ->> 'resourceVersion'), deleted) 
      do update set name = $1, definition = $4
      returning ${type}, name, context, definition, deleted
    `, [definition.metadata.name, definition.metadata.namespace, process.env.KUBERNETES_CONTEXT, JSON.stringify(redacted, null, 2), false]);
    dbObj.rows[0].definition = definition;
    return dbObj;
  }));
  debug(`Wrote ${body.items.length} items for ${type}`);
  bus.emit(`kubernetes.${type}`, 'sync', dbObjs.map((x) => x.rows).flat(), body.items);
  if (body.metadata.continue) {
    return body.items.concat(writeNamespacedObjs(pgpool, bus, type, func, { continue: body.metadata.continue, ...args })); // eslint-disable-line max-len
  }
  return body.items;
}

async function writeObjs(pgpool, bus, type, func, args) {
  const { body } = await func(args);
  assert.ok(body.items, 'The items field on the returned kube response was not there.');
  assert.ok(Array.isArray(body.items),
    'The items field on the returned kube response was not an array');
  debug(`Received ${body.items.length} items for ${type}`);
  const dbObjs = await Promise.all(body.items.map((item) => pgpool.query(`
    insert into kubernetes.${type}s_log (${type}, name, context, definition, deleted)
    values (uuid_generate_v4(), $1, $2, $3, $4)
    on conflict (name, context, ((definition -> 'metadata') ->> 'resourceVersion'), deleted) 
    do update set name = $1
    returning ${type}, name, context, definition, deleted
  `, [item.metadata.name, process.env.KUBERNETES_CONTEXT, JSON.stringify(item, null, 2), false])));
  debug(`Wrote ${body.items.length} items for ${type}`);
  bus.emit(`kubernetes.${type}`, 'sync', dbObjs.map((x) => x.rows).flat(), body.items);
  if (body.metadata.continue) {
    return body.items.concat(writeObjs(pgpool, bus, type, func, { continue: body.metadata.continue, ...args })); // eslint-disable-line max-len
  }
  return body.items;
}

async function writeDeletedNamespacedObjs(pgpool, type, items) {
  (await pgpool.query(`select ${type}, name, namespace, context, definition from kubernetes.${type}s`, []))
    .rows
    .filter((entry) => !items.some((item) => entry.namespace === item.metadata.namespace
          && entry.name === item.metadata.name
          && entry.context === process.env.KUBERNETES_CONTEXT))
    .map((item) => pgpool.query(`
      insert into kubernetes.${type}s_log (${type}, name, namespace, context, definition, deleted)
      values (uuid_generate_v4(), $1, $2, $3, $4, $5)
      on conflict (name, context, namespace, ((definition -> 'metadata') ->> 'resourceVersion'), deleted) 
      do nothing
    `, [item.definition.metadata.name, item.definition.metadata.namespace, process.env.KUBERNETES_CONTEXT, JSON.stringify(item.definition, null, 2), true]));
  return items;
}

async function writeDeletedObjs(pgpool, type, items) {
  (await pgpool.query(`select ${type}, name, context, definition from kubernetes.${type}s`, []))
    .rows
    .filter((entry) => !items.some((item) => entry.name === item.metadata.name
      && entry.context === process.env.KUBERNETES_CONTEXT))
    .map((item) => pgpool.query(`
      insert into kubernetes.${type}s_log (${type}, name, context, definition, deleted)
      values (uuid_generate_v4(), $1, $2, $3, $4)
      on conflict (name, context, ((definition -> 'metadata') ->> 'resourceVersion'), deleted) 
      do nothing
    `, [item.definition.metadata.name, process.env.KUBERNETES_CONTEXT, JSON.stringify(item.definition, null, 2), true]));
  return items;
}

async function run(pgpool, bus) {
  if (!process.env.KUBERNETES_CONTEXT) {
    return;
  }
  debug('Running kubernetes plugin');
  const kc = new k8s.KubeConfig();
  if (process.env.KUBERNETES_TOKEN && process.env.KUBERNETES_API_URL) {
    await loadFromKubeEnvironment(kc);
  } else {
    try {
      await loadFromServiceAccount(kc);
    } catch (e) {
      /* Intentionally swallow errors, and backup to checking for a kube config file */
      await loadFromKubeConfig(kc);
    }
  }
  /* This may not seem necessary as we could accept the context we receive, however
   * we want to explicitly require a context as an env when loading from a file,
   * this helps prevent accidently running it in the wrong environment. */
  kc.setCurrentContext(process.env.KUBERNETES_CONTEXT);
  debug(`Loaded kubernetes context ${process.env.KUBERNETES_CONTEXT}`);
  const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
  const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
  const maxMemory = 1 * 1024 * 1024;
  const labelSelector = process.env.KUBERNETES_LABEL_SELECTOR;

  // The order of these do matter.
  debug(`Refreshing config maps from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'config_map',
    await writeNamespacedObjs(pgpool, bus, 'config_map',
      k8sCoreApi.listConfigMapForAllNamespaces.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 4096), labelSelector }));
  debug(`Refreshing deployments from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'deployment',
    await writeNamespacedObjs(pgpool, bus, 'deployment',
      k8sAppsApi.listDeploymentForAllNamespaces.bind(k8sAppsApi),
      { limit: Math.floor(maxMemory / 4096), labelSelector }));
  debug(`Refreshing replicasets from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'replicaset',
    await writeNamespacedObjs(pgpool, bus, 'replicaset',
      k8sAppsApi.listReplicaSetForAllNamespaces.bind(k8sAppsApi),
      { limit: Math.floor(maxMemory / 4096), labelSelector }));
  debug(`Refreshing services from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'service',
    await writeNamespacedObjs(pgpool, bus, 'service',
      k8sCoreApi.listServiceForAllNamespaces.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 4096), labelSelector }));
  debug(`Refreshing nodes from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedObjs(pgpool, 'node',
    await writeObjs(pgpool, bus, 'node',
      k8sCoreApi.listNode.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 4096), labelSelector }));
  debug(`Refreshing pods from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'pod',
    await writeNamespacedObjs(pgpool, bus, 'pod',
      k8sCoreApi.listPodForAllNamespaces.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 4096), labelSelector }));
  debug(`Refreshing persistent volumes from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedObjs(pgpool, 'persistent_volume',
    await writeObjs(pgpool, bus, 'persistent_volume',
      k8sCoreApi.listPersistentVolume.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 2048), labelSelector }));
  debug(`Refreshing persistent volume claims from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'persistent_volume_claim',
    await writeNamespacedObjs(pgpool, bus, 'persistent_volume_claim',
      k8sCoreApi.listPersistentVolumeClaimForAllNamespaces.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 2048), labelSelector }));
  debug(`Refreshing events from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'event',
    await writeNamespacedObjs(pgpool, bus, 'event',
      k8sCoreApi.listEventForAllNamespaces.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 2048), labelSelector }));

  // TODO: Job? DaemonSet? StatefulSet?
  // TODO: istio?
  // TODO: ingress objects?
  // TODO: cert-manager objects?
  // TODO: docker images?
}

module.exports = {
  init,
  run,
};
