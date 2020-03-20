const assert = require('assert');
const k8s = require('@kubernetes/client-node');
const fs = require('fs');
const debug = require('debug')('daedalus:kubernetes');

// TODO: Add watch functionality and increase
// rate at which it pulls the world.

async function checkPermissions(kc) {
  const accessPods = { spec: { resourceAttributes: { verb: 'watch', resource: 'pods' } } };
  const accessServices = { spec: { resourceAttributes: { verb: 'watch', resource: 'services' } } };
  const accessNodes = { spec: { resourceAttributes: { verb: 'watch', resource: 'nodes' } } };
  const accessConfigMaps = { spec: { resourceAttributes: { verb: 'watch', resource: 'configmaps' } } };
  const accessPersistentVolumes = { spec: { resourceAttributes: { verb: 'watch', resource: 'persistentvolumes' } } };
  const accessPersistentVolumeClaims = { spec: { resourceAttributes: { verb: 'watch', resource: 'persistentvolumeclaims' } } };
  const accessEvents = { spec: { resourceAttributes: { verb: 'watch', resource: 'events' } } };
  const accessDeployments = { spec: { resourceAttributes: { verb: 'watch', resource: 'deployment', group: 'apps' } } };
  const k8sApi = kc.makeApiClient(k8s.AuthorizationV1Api);

  const canWatchPods = (await k8sApi.createSelfSubjectAccessReview(accessPods)).body.status.allowed;
  const canWatchServices = (await k8sApi.createSelfSubjectAccessReview(accessServices)).body.status.allowed; // eslint-disable-line max-len
  const canWatchNodes = (await k8sApi.createSelfSubjectAccessReview(accessNodes)).body.status.allowed; // eslint-disable-line max-len
  const canWatchConfigMaps = (await k8sApi.createSelfSubjectAccessReview(accessConfigMaps)).body.status.allowed; // eslint-disable-line max-len
  const canWatchDeployments = (await k8sApi.createSelfSubjectAccessReview(accessDeployments)).body.status.allowed; // eslint-disable-line max-len
  const canWatchPersistentVolumes = (await k8sApi.createSelfSubjectAccessReview(accessPersistentVolumes)).body.status.allowed; // eslint-disable-line max-len
  const canWatchPersistentVolumeClaims = (await k8sApi.createSelfSubjectAccessReview(accessPersistentVolumeClaims)).body.status.allowed; // eslint-disable-line max-len
  const canWatchEvents = (await k8sApi.createSelfSubjectAccessReview(accessEvents)).body.status.allowed; // eslint-disable-line max-len

  accessDeployments.spec.resourceAttributes.verb = 'get';
  accessPods.spec.resourceAttributes.verb = 'get';
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

  return canWatchPods && canGetPods
    && canWatchDeployments && canGetDeployments
    && canWatchNodes && canGetNodes
    && canWatchServices && canGetServices
    && canWatchConfigMaps && canGetConfigMaps
    && canWatchPersistentVolumes && canGetPersistentVolumes
    && canWatchPersistentVolumeClaims && canGetPersistentVolumeClaims
    && canWatchEvents && canGetEvents;
}

// TODO: remove this into its own plugin?, add configmaps to processing.
// TODO: Security, we should proactively strip values in the config map when storing, store a hash instead.

async function writePostgresqlFromPodsAndConfigMaps(pgpool, pods, configMaps) {
  debug(`Examining ${pods.length} pods for envs that have a postgres string.`);
  await Promise.all(pods.map(async (pod) => {
    if (pod.spec.containers) {
      await Promise.all(pod.spec.containers.reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && env.value.startsWith('postgres://')))
        .map(async (env) => {
          const dbUrl = new URL(env.value);
          const db = await pgpool.query(`
              insert into postgresql.databases_log 
                (database, name, host, port, deleted)
              values 
                (uuid_generate_v4(), $1, $2, $3, $4)
              on conflict (name, host, port, deleted) do update set name = $1 returning database`,
          [dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '5432' : dbUrl.port, false]);
          assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
          assert.ok(db.rows[0].database, 'Database was not set on return after insertion');
          await pgpool.query(`
              insert into postgresql.roles_log 
                (role, database, username, password, options, deleted)
              values 
                (uuid_generate_v4(), $1, $2, $3, $4, $5)
              on conflict (database, username, password, deleted) 
              do nothing`,
          [db.rows[0].database, dbUrl.username, dbUrl.password, dbUrl.search.replace(/\?/, ''), false]);
        }), []));
      // TODO: Detect deletions of databases from pods.
    }
  }));
  debug(`Examining ${configMaps.length} configMaps for envs that have a postgres string.`);
  await Promise.all(configMaps.map(async (configMap) => {
    if (configMap.data) {
      await Promise.all(Object.keys(configMap.data).map(async (env) => {
        if (configMap.data[env].startsWith('postgres://')) {
          const dbUrl = new URL(configMap.data[env]);
          const db = await pgpool.query(`
            insert into postgresql.databases_log 
              (database, name, host, port, deleted)
            values 
              (uuid_generate_v4(), $1, $2, $3, $4)
            on conflict (name, host, port, deleted) do update set name = $1 returning database`,
          [dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '5432' : dbUrl.port, false]);
          assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
          assert.ok(db.rows[0].database, 'Database was not set on return after insertion');
          await pgpool.query(`
            insert into postgresql.roles_log 
              (role, database, username, password, options, deleted)
            values 
              (uuid_generate_v4(), $1, $2, $3, $4, $5)
            on conflict (database, username, password, deleted) 
            do nothing`,
          [db.rows[0].database, dbUrl.username, dbUrl.password, dbUrl.search.replace(/\?/, ''), false]);
        }
      }), []);
      // TODO: Detect deletions of databases from configmaps.
    }
  }));
}

async function loadFromKubeConfig(kc) {
  assert.ok(process.env.HOME, 'The HOME environment variable was not found.');
  assert.ok(fs.existsSync(`${process.env.HOME}/.kube/config`),
    `The kubeconfig file was not found at ${process.env.HOME}/.kube/config`);
  kc.loadFromFile(`${process.env.HOME}/.kube/config`);
  await checkPermissions(kc);
}

async function init(pgpool) {
  debug('Initializing kubernetes plugin...');
  await pgpool.query(fs.readFileSync('./plugins/kubernetes/create.sql').toString());
}

async function writeNamespacedObjs(pgpool, type, func, args) {
  const { body } = await func(args);
  assert.ok(body.items, 'The items field on the returned kube response was not there.');
  assert.ok(Array.isArray(body.items), 'The items field on the returned kube response was not an array');
  debug(`Received ${body.items.length} items for ${type}`);
  await Promise.all(body.items.map((item) => pgpool.query(`
      insert into kubernetes.${type}s_log 
        (${type}, name, namespace, context, definition, deleted)
      values 
        (uuid_generate_v4(), $1, $2, $3, $4, $5)
      on conflict (name, context, namespace, ((definition -> 'metadata') ->> 'resourceVersion'), deleted) 
      do nothing
    `, [item.metadata.name, item.metadata.namespace, process.env.KUBERNETES_CONTEXT, JSON.stringify(item, null, 2), false])));
  debug(`Wrote ${body.items.length} items for ${type}`);
  if (body.metadata.continue) {
    return body.items.concat(writeNamespacedObjs(pgpool, type, func, { continue: body.metadata.continue, ...args })); // eslint-disable-line max-len
  }
  return body.items;
}

async function writeObjs(pgpool, type, func, args) {
  const { body } = await func(args);
  assert.ok(body.items, 'The items field on the returned kube response was not there.');
  assert.ok(Array.isArray(body.items),
    'The items field on the returned kube response was not an array');
  debug(`Received ${body.items.length} items for ${type}`);
  await Promise.all(body.items.map((item) => pgpool.query(`
      insert into kubernetes.${type}s_log 
        (${type}, name, context, definition, deleted)
      values 
        (uuid_generate_v4(), $1, $2, $3, $4)
      on conflict (name, context, ((definition -> 'metadata') ->> 'resourceVersion'), deleted) 
      do nothing
    `, [item.metadata.name, process.env.KUBERNETES_CONTEXT, JSON.stringify(item, null, 2), false])));
  debug(`Wrote ${body.items.length} items for ${type}`);
  if (body.metadata.continue) {
    return body.items.concat(writeObjs(pgpool, type, func, { continue: body.metadata.continue, ...args })); // eslint-disable-line max-len
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
      insert into kubernetes.${type}s_log 
        (${type}, name, namespace, context, definition, deleted)
      values 
        (uuid_generate_v4(), $1, $2, $3, $4, $5)
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
      insert into kubernetes.${type}s_log 
        (${type}, name, context, definition, deleted)
      values 
        (uuid_generate_v4(), $1, $2, $3, $4)
      on conflict (name, context, ((definition -> 'metadata') ->> 'resourceVersion'), deleted) 
      do nothing
    `, [item.definition.metadata.name, process.env.KUBERNETES_CONTEXT, JSON.stringify(item.definition, null, 2), true]));
  return items;
}

async function run(pgpool) {
  if (!process.env.KUBERNETES_CONTEXT) {
    return;
  }
  const kc = new k8s.KubeConfig();
  try {
    kc.loadFromCluster();
    await checkPermissions(kc);
  } catch (e) {
    /* Intentionally swallow errors, and backup to checking for a kube config file */
    await loadFromKubeConfig(kc);
    /* This may not seem necessary as we could accept the context we receive, however
     * we want to explicitly require a context as an env when loading from a file,
     * this helps prevent accidently running it in the wrong environment. */
    kc.setCurrentContext(process.env.KUBERNETES_CONTEXT);
  }
  debug(`Loaded context ${process.env.KUBERNETES_CONTEXT}`);
  const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
  const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
  const maxMemory = 1 * 1024 * 1024;
  debug(`Refreshing pods from ${process.env.KUBERNETES_CONTEXT}`);
  const pods = await writeDeletedNamespacedObjs(pgpool, 'pod',
    await writeNamespacedObjs(pgpool, 'pod',
      k8sCoreApi.listPodForAllNamespaces.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 4096) }));
  debug(`Refreshing services from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'service',
    await writeNamespacedObjs(pgpool, 'service',
      k8sCoreApi.listServiceForAllNamespaces.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 4096) }));
  debug(`Refreshing nodes from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedObjs(pgpool, 'node',
    await writeObjs(pgpool, 'node',
      k8sCoreApi.listNode.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 4096) }));
  debug(`Refreshing config maps from ${process.env.KUBERNETES_CONTEXT}`);
  const configMaps = await writeDeletedNamespacedObjs(pgpool, 'config_map',
    await writeNamespacedObjs(pgpool, 'config_map',
      k8sCoreApi.listConfigMapForAllNamespaces.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 4096) }));
  debug(`Refreshing persistent volumes from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedObjs(pgpool, 'persistent_volume',
    await writeObjs(pgpool, 'persistent_volume',
      k8sCoreApi.listPersistentVolume.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 2048) }));
  debug(`Refreshing persistent volume claims from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'persistent_volume_claim',
    await writeNamespacedObjs(pgpool, 'persistent_volume_claim',
      k8sCoreApi.listPersistentVolumeClaimForAllNamespaces.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 2048) }));
  debug(`Refreshing events from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'event',
    await writeNamespacedObjs(pgpool, 'event',
      k8sCoreApi.listEventForAllNamespaces.bind(k8sCoreApi),
      { limit: Math.floor(maxMemory / 2048) }));
  debug(`Refreshing deployments from ${process.env.KUBERNETES_CONTEXT}`);
  await writeDeletedNamespacedObjs(pgpool, 'deployment',
    await writeNamespacedObjs(pgpool, 'deployment',
      k8sAppsApi.listDeploymentForAllNamespaces.bind(k8sAppsApi),
      { limit: Math.floor(maxMemory / 4096) }));

  // TODO: istio?
  // TODO: ingress objects?
  // TODO: cert-manager objects?

  debug('Analyzing if any postgres databases exist in config maps or pods');
  await writePostgresqlFromPodsAndConfigMaps(pgpool, pods, configMaps);
}

module.exports = {
  init,
  run,
};
