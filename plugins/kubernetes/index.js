const assert = require('assert');
const crypto = require('crypto');
const k8s = require('@kubernetes/client-node');
const fs = require('fs');
const debug = require('debug')('daedalus:kubernetes');
const security = require('../../common/security.js');

// TODO: Add watch functionality and increase
// rate at which it pulls the world.

async function createDatabaseDefinition(pgpool, plural, hasNamespace = true) {
  const sql = `
    do $$
    begin
      create table if not exists kubernetes.${plural}_log (
        node_log uuid not null primary key,
        node uuid not null,
        name varchar(128) not null,
        ${hasNamespace ? 'namespace varchar(128) not null,' : ''}
        context varchar(128) not null,
        definition jsonb not null,
        status jsonb not null,
        hash varchar(64) not null,
        observed_on timestamp with time zone default now(),
        deleted boolean not null default false
      );
      comment on table kubernetes.${plural}_log is E'@name kubernetes${plural.split('_').map((x) => (x.substring(0, 1).toUpperCase() + x.substring(1))).join('')}Log';
      create unique index if not exists ${plural}_changed on kubernetes.${plural}_log (hash, deleted);
      create index if not exists ${plural}_partition_ndx on kubernetes.${plural}_log (name, ${hasNamespace ? 'namespace,' : ''} context, observed_on desc);
      create or replace view kubernetes.${plural} as
        with ordered_list as ( select
          node_log,
          node,
          name,
          ${hasNamespace ? 'namespace,' : ''}
          context,
          definition,
          status,
          hash,
          observed_on,
          deleted,
          row_number() over (partition by name, ${hasNamespace ? 'namespace,' : ''} context order by observed_on desc) as row_number
        from kubernetes.${plural}_log) 
      select 
        node_log,
        node,
        name,
        ${hasNamespace ? 'namespace,' : ''}
        context,
        definition,
        status,
        hash,
        observed_on 
      from
        ordered_list 
      where
        row_number = 1 and 
        deleted = false;
      comment on view kubernetes.${plural} is E'@name kubernetes${plural.split('_').map((x) => (x.substring(0, 1).toUpperCase() + x.substring(1))).join('')}';
    end
    $$;
  `;
  await pgpool.query(sql);
}

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
  const accessIngress = { spec: { resourceAttributes: { verb: 'watch', resource: 'ingress', group: 'extensions' } } };
  const accessStatefulSets = { spec: { resourceAttributes: { verb: 'watch', resource: 'statefulset', group: 'apps' } } };
  const accessDaemonSets = { spec: { resourceAttributes: { verb: 'watch', resource: 'daemonset', group: 'apps' } } };
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
  const canWatchIngress = (await k8sApi.createSelfSubjectAccessReview(accessIngress)).body.status.allowed; // eslint-disable-line max-len
  const canWatchStatefulSets = (await k8sApi.createSelfSubjectAccessReview(accessIngress)).body.status.allowed; // eslint-disable-line max-len
  const canWatchDaemonSets = (await k8sApi.createSelfSubjectAccessReview(accessIngress)).body.status.allowed; // eslint-disable-line max-len

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
  const canGetIngress = (await k8sApi.createSelfSubjectAccessReview(accessIngress)).body.status.allowed; // eslint-disable-line max-len
  const canGetStatefulSets = (await k8sApi.createSelfSubjectAccessReview(accessStatefulSets)).body.status.allowed; // eslint-disable-line max-len
  const canGetDaemonSets = (await k8sApi.createSelfSubjectAccessReview(accessDaemonSets)).body.status.allowed; // eslint-disable-line max-len

  return canWatchPods && canGetPods
    && canWatchDeployments && canGetDeployments
    && canWatchNodes && canGetNodes
    && canWatchServices && canGetServices
    && canWatchConfigMaps && canGetConfigMaps
    && canWatchPersistentVolumes && canGetPersistentVolumes
    && canWatchPersistentVolumeClaims && canGetPersistentVolumeClaims
    && canWatchEvents && canGetEvents
    && canWatchReplicaSets && canGetReplicaSets
    && canWatchIngress && canGetIngress
    && canWatchStatefulSets && canGetStatefulSets
    && canWatchDaemonSets && canGetDaemonSets;
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
  await createDatabaseDefinition(pgpool, 'configmaps');
  await createDatabaseDefinition(pgpool, 'deployments');
  await createDatabaseDefinition(pgpool, 'replicasets');
  await createDatabaseDefinition(pgpool, 'services');
  await createDatabaseDefinition(pgpool, 'nodes', false);
  await createDatabaseDefinition(pgpool, 'pods');
  await createDatabaseDefinition(pgpool, 'persistentvolumes', false);
  await createDatabaseDefinition(pgpool, 'persistentvolumeclaims');
  await createDatabaseDefinition(pgpool, 'events');
  await createDatabaseDefinition(pgpool, 'ingress');
  await createDatabaseDefinition(pgpool, 'daemonsets');
  await createDatabaseDefinition(pgpool, 'statefulsets');
  await createDatabaseDefinition(pgpool, 'jobs');
  await createDatabaseDefinition(pgpool, 'virtualservices');
  await createDatabaseDefinition(pgpool, 'gateways');
  await createDatabaseDefinition(pgpool, 'policies');
  await createDatabaseDefinition(pgpool, 'certificates');
  await createDatabaseDefinition(pgpool, 'issuers');
  await createDatabaseDefinition(pgpool, 'clusterissuers', false);
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

function redactDeploymentsAndReplicasets(data) {
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

function getDefinitionHash(item) {
  const i = JSON.parse(JSON.stringify(item));
  delete i.metadata.resourceVersion;
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(i, null, 2));
  return hash.digest('hex');
}

async function writeNamespacedObjs(pgpool, bus, type, func, args) {
  const plural = type.endsWith('cy') ? `${type.substring(0, type.length - 1)}ies` : (type.endsWith('ss') ? type : `${type}s`); // eslint-disable-line no-nested-ternary
  const { body } = await func(args);
  assert.ok(body.items, 'The items field on the returned kube response was not there.');
  assert.ok(Array.isArray(body.items), 'The items field on the returned kube response was not an array');
  debug(`Received ${body.items.length} items for ${type}`);
  // TODO: flip this from a promise all to for loop
  const dbObjs = await Promise.all(body.items.map(async (definition) => {
    let redacted = JSON.parse(JSON.stringify(definition));
    if (type === 'configmap') {
      redacted = redactConfigMaps(redacted);
    }
    if (type === 'pod') {
      redacted = redactPods(redacted);
    }
    if (type === 'deployment' || type === 'replicaset') {
      redacted = redactDeploymentsAndReplicasets(redacted);
    }
    const dbObj = await pgpool.query(`
      insert into kubernetes.${plural}_log (node_log, node, name, namespace, context, definition, status, hash, deleted)
      values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (hash, deleted) 
      do update set name = $2, status = $6
      returning node_log, node, name, namespace, context, definition, status, hash, deleted
    `, [definition.metadata.uid, definition.metadata.name, definition.metadata.namespace, process.env.KUBERNETES_CONTEXT, redacted, redacted.status || {}, getDefinitionHash(definition), false]);
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
  const plural = type.endsWith('cy') ? `${type.substring(0, type.length - 1)}ies` : (type.endsWith('ss') ? type : `${type}s`); // eslint-disable-line no-nested-ternary
  const { body } = await func(args);
  assert.ok(body.items, 'The items field on the returned kube response was not there.');
  assert.ok(Array.isArray(body.items),
    'The items field on the returned kube response was not an array');
  debug(`Received ${body.items.length} items for ${type}`);
  // TODO: flip this from a promise all to for loop
  const dbObjs = await Promise.all(body.items.map((item) => pgpool.query(`
    insert into kubernetes.${plural}_log (node_log, node, name, context, definition, status, hash, deleted)
    values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
    on conflict (hash, deleted) 
    do update set name = $2, status = $5
    returning node_log, node, name, context, definition, status, hash, deleted
  `, [item.metadata.uid, item.metadata.name, process.env.KUBERNETES_CONTEXT, item, item.status || {}, getDefinitionHash(item), false])));
  debug(`Wrote ${body.items.length} items for ${type}`);
  bus.emit(`kubernetes.${type}`, 'sync', dbObjs.map((x) => x.rows).flat(), body.items);
  if (body.metadata.continue) {
    return body.items.concat(writeObjs(pgpool, bus, type, func, { continue: body.metadata.continue, ...args })); // eslint-disable-line max-len
  }
  return body.items;
}

async function writeDeletedNamespacedObjs(pgpool, type, items) {
  const plural = type.endsWith('cy') ? `${type.substring(0, type.length - 1)}ies` : (type.endsWith('ss') ? type : `${type}s`); // eslint-disable-line no-nested-ternary
  (await pgpool.query(`select node_log, node, name, namespace, context, definition, status, hash from kubernetes.${plural}`, []))
    .rows
    .filter((entry) => !items.some((item) => entry.namespace === item.metadata.namespace
          && entry.name === item.metadata.name
          && entry.context === process.env.KUBERNETES_CONTEXT))
    .map((item) => pgpool.query(`
      insert into kubernetes.${plural}_log (node_log, node, name, namespace, context, definition, status, hash, deleted)
      values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8)
      on conflict (hash, deleted) 
      do nothing
    `, [item.node, item.definition.metadata.name, item.definition.metadata.namespace, process.env.KUBERNETES_CONTEXT, item.definition, item.status, item.hash, true]));
  return items;
}

async function writeDeletedObjs(pgpool, type, items) {
  const plural = type.endsWith('cy') ? `${type.substring(0, type.length - 1)}ies` : (type.endsWith('ss') ? type : `${type}s`); // eslint-disable-line no-nested-ternary
  (await pgpool.query(`select node_log, node, name, context, definition, status, hash from kubernetes.${plural}`, []))
    .rows
    .filter((entry) => !items.some((item) => entry.name === item.metadata.name
      && entry.context === process.env.KUBERNETES_CONTEXT))
    .map((item) => pgpool.query(`
      insert into kubernetes.${plural}_log (node_log, node, name, context, definition, status, hash, deleted)
      values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
      on conflict (hash, deleted) 
      do nothing
    `, [item.node, item.definition.metadata.name, process.env.KUBERNETES_CONTEXT, item.definition, item.status, item.hash, true]));
  return items;
}

async function run(pgpool, bus) {
  if (process.env.KUBERNETES !== 'true') {
    return;
  }
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
  const k8sExtensionsApi = kc.makeApiClient(k8s.ExtensionsV1beta1Api);
  const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);
  const k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);
  const maxMemory = 1 * 1024 * 1024;
  const labelSelector = process.env.KUBERNETES_LABEL_SELECTOR;

  // The order of these do matter.
  debug(`Refreshing config maps from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'configmap',
    await writeNamespacedObjs(pgpool, bus, 'configmap',
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
  await writeDeletedObjs(pgpool, 'persistentvolume',
    await writeObjs(pgpool, bus, 'persistentvolume',
      k8sCoreApi.listPersistentVolume.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 2048), labelSelector }));
  debug(`Refreshing persistent volume claims from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'persistentvolumeclaim',
    await writeNamespacedObjs(pgpool, bus, 'persistentvolumeclaim',
      k8sCoreApi.listPersistentVolumeClaimForAllNamespaces.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 2048), labelSelector }));
  debug(`Refreshing events from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'event',
    await writeNamespacedObjs(pgpool, bus, 'event',
      k8sCoreApi.listEventForAllNamespaces.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 2048), labelSelector }));
  debug(`Refreshing ingresses from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'ingress',
    await writeNamespacedObjs(pgpool, bus, 'ingress',
      k8sExtensionsApi.listIngressForAllNamespaces.bind(k8sExtensionsApi),
      { limit: Math.floor(maxMemory / 2048), labelSelector }));
  debug(`Refreshing daemon sets from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'daemonset',
    await writeNamespacedObjs(pgpool, bus, 'daemonset',
      k8sAppsApi.listDaemonSetForAllNamespaces.bind(k8sAppsApi),
      { limit: Math.floor(maxMemory / 2048), labelSelector }));
  debug(`Refreshing stateful sets from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'statefulset',
    await writeNamespacedObjs(pgpool, bus, 'statefulset',
      k8sAppsApi.listStatefulSetForAllNamespaces.bind(k8sAppsApi),
      { limit: Math.floor(maxMemory / 2048), labelSelector }));
  debug(`Refreshing jobs from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'job',
    await writeNamespacedObjs(pgpool, bus, 'job',
      k8sBatchApi.listJobForAllNamespaces.bind(k8sAppsApi),
      { limit: Math.floor(maxMemory / 2048), labelSelector }));

  if (process.env.ISTIO === 'true') {
    try {
      debug(`Refreshing virtual services from ${process.env.KUBERNETES_CONTEXT}`);
      await writeDeletedNamespacedObjs(pgpool, 'virtualservice',
        await writeNamespacedObjs(pgpool, bus, 'virtualservice',
          k8sCustomApi.listClusterCustomObject.bind(k8sCustomApi, 'networking.istio.io', 'v1alpha3', 'virtualservices'),
          {
            limit: Math.floor(maxMemory / 2048), labelSelector, group: 'networking.istio.io', version: 'v1alpha3', plural: 'virtualservices',
          }));
      debug(`Refreshing gateways from ${process.env.KUBERNETES_CONTEXT}`);
      await writeDeletedNamespacedObjs(pgpool, 'gateway',
        await writeNamespacedObjs(pgpool, bus, 'gateway',
          k8sCustomApi.listClusterCustomObject.bind(k8sCustomApi, 'networking.istio.io', 'v1alpha3', 'gateways'),
          {
            limit: Math.floor(maxMemory / 2048), labelSelector, group: 'networking.istio.io', version: 'v1alpha3', plural: 'gateways',
          }));
      debug(`Refreshing gateways from ${process.env.KUBERNETES_CONTEXT}`);
      await writeDeletedNamespacedObjs(pgpool, 'policy',
        await writeNamespacedObjs(pgpool, bus, 'policy',
          k8sCustomApi.listClusterCustomObject.bind(k8sCustomApi, 'authentication.istio.io', 'v1alpha1', 'policies'),
          {
            limit: Math.floor(maxMemory / 2048), labelSelector, group: 'authentication.istio.io', version: 'v1alpha1', plural: 'policies',
          }));
    } catch (e) {
      debug(`Failed to get istio custom objects in kubernetes: ${e.stack}`);
    }
  }
  if (process.env.CERT_MANAGER === 'true') {
    try {
      debug(`Refreshing certificates from ${process.env.KUBERNETES_CONTEXT}`);
      await writeDeletedNamespacedObjs(pgpool, 'certificate',
        await writeNamespacedObjs(pgpool, bus, 'certificate',
          k8sCustomApi.listClusterCustomObject.bind(k8sCustomApi, 'cert-manager.io', 'v1alpha2', 'certificates'),
          {
            limit: Math.floor(maxMemory / 2048), labelSelector, group: 'cert-manager.io', version: 'v1alpha2', plural: 'certificates',
          }));
      debug(`Refreshing cluster issuers from ${process.env.KUBERNETES_CONTEXT}`);
      await writeDeletedObjs(pgpool, 'clusterissuer',
        await writeObjs(pgpool, bus, 'clusterissuer',
          k8sCustomApi.listClusterCustomObject.bind(k8sCustomApi, 'cert-manager.io', 'v1alpha2', 'clusterissuers'),
          {
            limit: Math.floor(maxMemory / 2048), labelSelector, group: 'cert-manager.io', version: 'v1alpha2', plural: 'clusterissuers',
          }));
      debug(`Refreshing issuers from ${process.env.KUBERNETES_CONTEXT}`);
      await writeDeletedObjs(pgpool, 'issuer',
        await writeObjs(pgpool, bus, 'issuer',
          k8sCustomApi.listClusterCustomObject.bind(k8sCustomApi, 'cert-manager.io', 'v1alpha2', 'issuers'),
          {
            limit: Math.floor(maxMemory / 2048), labelSelector, group: 'cert-manager.io', version: 'v1alpha2', plural: 'issuers',
          }));
    } catch (e) {
      debug(`Failed to get custom objects in kubernetes: ${e.stack}`);
    }
  }
}

module.exports = {
  init,
  run,
};
