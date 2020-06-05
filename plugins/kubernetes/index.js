const assert = require('assert');
const k8s = require('@kubernetes/client-node');
const fs = require('fs');
const debug = require('debug')('daedalus:kubernetes');
const security = require('../../common/security.js');
const crawler = require('../../common/crawler.js');

// TODO: Add watch functionality and increase
// rate at which it pulls the world.

// todo: pod -> configmap
// todo: replicaset -> configmap
// todo: deployments -> services (based on configuration)
// todo: nodes -> pods

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

async function writeKubernetesPodToReplicaSets(pgpool, podRecords) {
  await Promise.all(podRecords.map(async (pod) => {
    if (pod.definition.metadata.ownerReferences) {
      await Promise.all(pod.definition.metadata.ownerReferences.map(async (ref) => {
        try {
          if (ref.kind === 'Deployment') {
            const { rows: [{ node_log }] } = await pgpool.query('select node_log, name, definition from kubernetes.deployments where name = $1 and namespace = $2', // eslint-disable-line camelcase
              [ref.name, pod.definition.metadata.namespace]);
            await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
              [node_log, pod.node_log]); // eslint-disable-line camelcase
          } else if (ref.kind === 'ReplicaSet') {
            const { rows: [{ node_log }] } = await pgpool.query('select node_log, name, definition from kubernetes.replicasets where name = $1 and namespace = $2', // eslint-disable-line camelcase
              [ref.name, pod.definition.metadata.namespace]);
            await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
              [node_log, pod.node_log]); // eslint-disable-line camelcase
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
}

async function writeKubernetesReplicaSetToDeployments(pgpool, replicaSetRecords) {
  await Promise.all(replicaSetRecords.map(async (replicaSet) => {
    if (replicaSet.definition.metadata.ownerReferences) {
      await Promise.all(replicaSet.definition.metadata.ownerReferences.map(async (ref) => {
        try {
          if (ref.kind === 'Deployment') {
            const { rows: [{ node_log }] } = await pgpool.query('select node_log, name from kubernetes.deployments where name = $1 and namespace = $2', // eslint-disable-line camelcase
              [ref.name, replicaSet.definition.metadata.namespace]);
            await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
              [node_log, replicaSet.node_log]); // eslint-disable-line camelcase
          } else {
            console.warn(`Warning: unknown owner reference found on replicaset ${replicaSet.definition.metadata.name}/${replicaSet.definition.metadata.namespace}: ${JSON.stringify(ref, null, 2)}`); // eslint-disable-line no-console
          }
        } catch (e) {
          debug(`Error unable to add link for replicaset ${replicaSet.node_log} to deployment ${`${ref.name}/${replicaSet.definition.metadata.namespace}`} due to ${e.message}`); // eslint-disable-line max-len,no-console
        }
      }));
    }
  }));
}

async function writeKubernetesDeploymentToConfigMaps(pgpool, deployments) {
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
              } catch (e) {
                debug(`Error unable to add link for deployment ${deployment.deployment} to configmap ${envFrom.configMapRef.name} due to ${e.message}`); // eslint-disable-line max-len,no-console
              }
            }
          }));
        }
      }));
    }
  }));
}

async function writeAkkersAppsFromDeployments(pgpool, deployments) {
  await Promise.all(deployments.map(async (deployment) => {
    if (deployment.definition.metadata && deployment.definition.metadata.labels && deployment.definition.metadata.labels['akkeris.io/app-uuid']) {
      try {
        const { rows: [{ node_log }] } = await pgpool.query('select node_log, name, definition from akkeris.apps where node = $1', // eslint-disable-line camelcase
          [deployment.definition.metadata.labels['akkeris.io/app-uuid']]);
        await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
          [node_log, deployment.node_log]); // eslint-disable-line camelcase
      } catch (e) {
        if (!(e.message && e.message.startsWith('Cannot read property \'node_log\''))) {
          // filter out deployments that reference an app that is no longer in akkeris.
          debug(`Error unable to link app ${deployment.definition.metadata.labels['akkeris.io/app-uuid']} named ${deployment.definition.metadata.labels['akkeris.io/app-name']} to deployment ${deployment.deployment} due to: ${e.message}`);
        }
      }
    }
  }));
}


function parseJDBC(value, name, map) {
  const components = (/^jdbc:oracle:thin:(.*)@([A-Za-z0-9\-\.]+):([0-9]*)[:/]([A-Za-z0-9\-\.]+)(.*)$/g).exec(value); // eslint-disable-line no-useless-escape
  const auth = components[1];
  let user = auth.split('/')[0];
  let pass = auth.split('/')[1];
  const host = components[2];
  const port = components[3];
  const service = components[4];

  if (!user || !pass) {
    const prefix = name.split('_').slice(0, -1).join('_');
    const usernames = map.filter((x) => x.name === `${prefix}_USER`
      || x.name === `${prefix}_USERNAME`
      || x.name === `${prefix}_NAME`
      || x.name === `${prefix}_LOGIN`)
      .map((x) => x.value);
    if (usernames.length === 0) {
      throw new Error('Username wasnt found');
    }
    const passwords = map.filter((x) => x.name === `${prefix}_PASSWORD`
      || x.name === `${prefix}_PW`
      || x.name === `${prefix}_PASS`
      || x.name === `${prefix}_PWORD`
      || x.name === `${prefix}_PASSWD`
      || x.name === `${prefix}_SECRET`
      || x.name === `${prefix}_TOKEN`)
      .map((x) => x.value);
    if (passwords.length === 0) {
      throw new Error('Password wasnt found');
    }
    user = usernames[0]; // eslint-disable-line prefer-destructuring
    pass = passwords[0]; // eslint-disable-line prefer-destructuring
  }
  return {
    hostname: host,
    port,
    pathname: service,
    username: user,
    password: pass,
    search: '',
  };
}

function objToArray(obj) {
  return Object.keys(obj).map((x) => ({ name: x, value: obj[x] }));
}

async function writeOracleFromConfigMaps(pgpool, configMapRecords) {
  await Promise.all(configMapRecords.map(async (configMap) => {
    if (configMap.definition.data) {
      await Promise.all(Object.keys(configMap.definition.data).map(async (env) => {
        if (configMap.definition.data[env].startsWith('jdbc:oracle:thin')) {
          try {
            const dbUrl = parseJDBC(configMap.definition.data[env], env, objToArray(configMap.definition.data)); // eslint-disable-line max-len
            const db = await pgpool.query(`
              insert into oracle.databases_log (database_log, database, name, host, port, deleted)
              values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5)
              on conflict (name, host, port, deleted) 
              do update set name = $2
              returning database_log, database`,
            [dbUrl.hostname + dbUrl.port + dbUrl.pathname, dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '1521' : dbUrl.port, false]);
            assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
            assert.ok(db.rows[0].database_log, 'Database was not set on return after insertion');
            const secret = security.encryptValue(process.env.SECRET, dbUrl.password);
            const role = await pgpool.query(`
              insert into oracle.roles_log (role_log, role, database_log, username, password, options, deleted)
              values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5, $6)
              on conflict (database_log, username, (password->>'hash'), deleted) 
              do update set username = $3 
              returning role_log, role, username`,
            [`${dbUrl.hostname}.${dbUrl.pathname}.${dbUrl.username}.${secret.hash}`, db.rows[0].database_log, dbUrl.username, secret, dbUrl.search.replace(/\?/, ''), false]);
            assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
            assert.ok(role.rows[0].role_log, 'Role was not set on return after insertion');
            assert.ok(configMap.node_log, 'configMap.node_log was undefined.');
            assert.ok(configMap.name, 'configMap.name was undefined.');
            assert.ok(role.rows[0].role_log, 'role.rows[0].role was undefined.');
            assert.ok(role.rows[0].username, 'role.rows[0].username was undefined.');
            assert.ok(db.rows[0].database_log, 'db.rows[0].database was undefined.');
            db.rows[0].name = db.rows[0].name ? db.rows[0].name : 'unknown';
            await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
              [db.rows[0].database_log, role.rows[0].role_log]);
            await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
              [configMap.node_log, role.rows[0].role_log]);
          } catch (e) {
            if (e.message.includes('Invalid URL')) {
              debug(`Warning, invalid oracle url: ${e.message}`);
            } else {
              debug(`Error adding link from ${configMap.node_log} to oracle role found inside, due to: ${e.message}`); // eslint-disable-line no-console
            }
          }
        }
      }), []);
    }
  }));
}

async function writeOracleFromReplicaSets(pgpool, replicaSetRecords) {
  await Promise.all(replicaSetRecords.map(async (replicaSet) => {
    await Promise.all((replicaSet.definition.spec.template.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && env.value.startsWith('jdbc:oracle:thin')))
        .map(async (env) => {
          if (env.value) {
            try {
              const dbUrl = parseJDBC(env.value, env.name, container.env);
              const db = await pgpool.query(`
                insert into oracle.databases_log (database_log, database, name, host, port, deleted)
                values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5)
                on conflict (name, host, port, deleted) 
                do update set name = $2 
                returning database_log, database, name, host, port`,
              [dbUrl.hostname + dbUrl.port + dbUrl.pathname, dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '1521' : dbUrl.port, false]);
              assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
              assert.ok(db.rows[0].database_log, 'Database was not set on return after insertion');
              const secret = security.encryptValue(process.env.SECRET, dbUrl.password);
              const role = await pgpool.query(`
                insert into oracle.roles_log (role_log, role, database_log, username, password, options, deleted)
                values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5, $6)
                on conflict (database_log, username, (password->>'hash'), deleted) 
                do update set username = $3 
                returning role_log, role, username`,
              [`${dbUrl.hostname}.${dbUrl.pathname}.${dbUrl.username}.${secret.hash}`, db.rows[0].database_log, dbUrl.username, secret, dbUrl.search.replace(/\?/, ''), false]);
              assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
              assert.ok(role.rows[0].role_log, 'Role was not set on return after insertion');
            } catch (e) {
              if (e.message.includes('Invalid URL')) {
                debug(`Warning, invalid oracle url: ${e.message}`);
              } else {
                debug(`Warning adding oracle entry from replicaset ${replicaSet.node_log} due to: ${e.message}`); // eslint-disable-line no-console
              }
            }
          }
        }), []));
  }));
}

async function writeOracleFromPods(pgpool, podRecords) {
  await Promise.all(podRecords.map(async (pod) => {
    await Promise.all((pod.definition.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && env.value.startsWith('jdbc:oracle:thin')))
        .map(async (env) => {
          if (env.value) {
            try {
              const dbUrl = parseJDBC(env.value, env.name, container.env);
              const db = await pgpool.query(`
                insert into oracle.databases_log (database_log, database, name, host, port, deleted)
                values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5)
                on conflict (name, host, port, deleted) 
                do update set name = $2 
                returning database_log, database, name, host, port`,
              [dbUrl.hostname + dbUrl.port + dbUrl.pathname, dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '1521' : dbUrl.port, false]);
              assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
              assert.ok(db.rows[0].database_log, 'Database was not set on return after insertion');
              const secret = security.encryptValue(process.env.SECRET, dbUrl.password);
              const role = await pgpool.query(`
                insert into oracle.roles_log (role_log, role, database_log, username, password, options, deleted)
                values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5, $6)
                on conflict (database_log, username, (password->>'hash'), deleted) 
                do update set username = $3 
                returning role_log, role, username`,
              [`${dbUrl.hostname}.${dbUrl.pathname}.${dbUrl.username}.${secret.hash}`, db.rows[0].database_log, dbUrl.username, secret, dbUrl.search.replace(/\?/, ''), false]);
              assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
              assert.ok(role.rows[0].role_log, 'Role was not set on return after insertion');
              assert.ok(pod.node_log, 'pod.node_log was undefined.');
              assert.ok(pod.name, 'pod.name was undefined.');
              assert.ok(role.rows[0].role_log, 'role.rows[0].role was undefined.');
              assert.ok(role.rows[0].username, 'role.rows[0].username was undefined.');
              assert.ok(db.rows[0].database_log, 'db.rows[0].database was undefined.');
              db.rows[0].name = db.rows[0].name ? db.rows[0].name : 'unknown';
              await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                [role.rows[0].role_log, db.rows[0].database_log]);
              await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                [pod.node_log, role.rows[0].role_log]);
            } catch (e) {
              if (e.message.includes('Invalid URL')) {
                debug(`Warning, invalid oracle url: ${e.message}`);
              } else {
                debug(`Warning adding oracle entry from pod ${pod.node_log} due to: ${e.message}`); // eslint-disable-line no-console
              }
            }
          }
        }), []));
  }));
}

async function writeOracleFromDeployments(pgpool, deploymentRecords) {
  await Promise.all(deploymentRecords.map(async (deployment) => {
    await Promise.all((deployment.definition.spec.template.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && env.value.startsWith('jdbc:oracle:thin')))
        .map(async (env) => {
          if (env.value) {
            try {
              const dbUrl = parseJDBC(env.value, env.name, container.env);
              const db = await pgpool.query(`
                insert into oracle.databases_log (database_log, database, name, host, port, deleted)
                values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5)
                on conflict (name, host, port, deleted) 
                do update set name = $2 
                returning database_log, database, name, host, port`,
              [dbUrl.hostname + dbUrl.port + dbUrl.pathname, dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '1521' : dbUrl.port, false]);
              assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
              assert.ok(db.rows[0].database_log, 'Database was not set on return after insertion');
              const secret = security.encryptValue(process.env.SECRET, dbUrl.password);
              const role = await pgpool.query(`
                insert into oracle.roles_log (role_log, role, database_log, username, password, options, deleted)
                values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5, $6)
                on conflict (database_log, username, (password->>'hash'), deleted) 
                do update set username = $3 
                returning role_log, role, username`,
              [`${dbUrl.hostname}.${dbUrl.pathname}.${dbUrl.username}.${secret.hash}`, db.rows[0].database_log, dbUrl.username, secret, dbUrl.search.replace(/\?/, ''), false]);
              assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
              assert.ok(role.rows[0].role_log, 'Role was not set on return after insertion');
              db.rows[0].name = db.rows[0].name ? db.rows[0].name : 'unknown';
              await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                [role.rows[0].role_log, db.rows[0].database_log]);
              await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                [deployment.node_log, role.rows[0].role_log]);
            } catch (e) {
              if (e.message.includes('Invalid URL')) {
                debug(`Warning, invalid oracle url: ${e.message}`);
              } else {
                debug(`Warning adding oracle entry from deployment ${deployment.node_log} due to: ${e.message}`); // eslint-disable-line no-console
              }
            }
          }
        }), []));
  }));
}

async function writePostgresqlFromConfigMaps(pgpool, configMapRecords) {
  await Promise.all(configMapRecords.map(async (configMap) => {
    if (configMap.definition.data) {
      await Promise.all(Object.keys(configMap.definition.data).map(async (env) => {
        if (configMap.definition.data[env].startsWith('postgres://')) {
          try {
            const dbUrl = new URL(configMap.definition.data[env]);
            const db = await pgpool.query(`
              insert into postgresql.databases_log (database_log, database, name, host, port, deleted)
              values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5)
              on conflict (name, host, port, deleted) 
              do update set name = $2
              returning database_log, database, host, port, name`,
            [dbUrl.hostname + dbUrl.port + dbUrl.pathname, dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '5432' : dbUrl.port, false]);
            assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
            assert.ok(db.rows[0].database, 'Database was not set on return after insertion');
            const secret = security.encryptValue(process.env.SECRET, dbUrl.password);
            const role = await pgpool.query(`
              insert into postgresql.roles_log (role_log, role, database_log, username, password, options, deleted)
              values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5, $6)
              on conflict (database_log, username, (password->>'hash'), deleted) 
              do update set username = $3 
              returning role_log, role, username`,
            [`${dbUrl.hostname}.${dbUrl.pathname}.${dbUrl.username}`, db.rows[0].database_log, dbUrl.username, secret, dbUrl.search.replace(/\?/, ''), false]);
            assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
            assert.ok(role.rows[0].role, 'Role was not set on return after insertion');
            assert.ok(configMap.node_log, 'configMap.node_log was undefined.');
            assert.ok(role.rows[0].role, 'role.rows[0].role was undefined.');
            assert.ok(role.rows[0].username, 'role.rows[0].username was undefined.');
            assert.ok(db.rows[0].database, 'db.rows[0].database was undefined.');
            db.rows[0].name = db.rows[0].name ? db.rows[0].name : 'unknown';
            await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
              [role.rows[0].role_log, db.rows[0].database_log]);
            await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
              [configMap.node_log, role.rows[0].role_log]);
          } catch (e) {
            if (e.message.includes('Invalid URL')) {
              debug(`Warning, invalid postgresql url: ${e.message}`);
            } else {
              debug(`Error adding link from ${configMap.node_log} to postgresql role found inside, due to: ${e.message}`); // eslint-disable-line no-console
            }
          }
        }
      }), []);
    }
  }));
}

async function writePostgresqlFromReplicaSets(pgpool, replicaSetRecords) {
  await Promise.all(replicaSetRecords.map(async (replicaSet) => {
    await Promise.all((replicaSet.definition.spec.template.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && env.value.startsWith('postgres://')))
        .map(async (env) => {
          if (env.value) {
            try {
              const dbUrl = new URL(env.value);
              const db = await pgpool.query(`
                insert into postgresql.databases_log (database_log, database, name, host, port, deleted)
                values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5)
                on conflict (name, host, port, deleted) 
                do update set name = $2
                returning database_log, database`,
              [dbUrl.hostname + dbUrl.port + dbUrl.pathname, dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '5432' : dbUrl.port, false]);
              assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
              assert.ok(db.rows[0].database, 'Database was not set on return after insertion');
              const secret = security.encryptValue(process.env.SECRET, dbUrl.password);
              const role = await pgpool.query(`
                insert into postgresql.roles_log (role_log, role, database_log, username, password, options, deleted)
                values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5, $6)
                on conflict (database_log, username, (password->>'hash'), deleted) 
                do update set username = $3 
                returning role_log, role, username`,
              [`${dbUrl.hostname}.${dbUrl.pathname}.${dbUrl.username}`, db.rows[0].database_log, dbUrl.username, secret, dbUrl.search.replace(/\?/, ''), false]);
              assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
              assert.ok(role.rows[0].role, 'Role was not set on return after insertion');
            } catch (e) {
              if (e.message.includes('Invalid URL')) {
                debug(`Warning, invalid postgresql url: ${e.message}`);
              } else {
                debug(`Error adding postgresql entry from replicaset ${replicaSet.node_log} due to: ${e.message}`); // eslint-disable-line no-console
              }
            }
          }
        }), []));
  }));
}

async function writePostgresqlFromPods(pgpool, podRecords) {
  await Promise.all(podRecords.map(async (pod) => {
    await Promise.all((pod.definition.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && env.value.startsWith('postgres://')))
        .map(async (env) => {
          if (env.value) {
            try {
              const dbUrl = new URL(env.value);
              const db = await pgpool.query(`
                insert into postgresql.databases_log (database_log, database, name, host, port, deleted)
                values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5)
                on conflict (name, host, port, deleted) 
                do update set name = $2 
                returning database_log, database, name, host, port`,
              [dbUrl.hostname + dbUrl.port + dbUrl.pathname, dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '5432' : dbUrl.port, false]);
              assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
              assert.ok(db.rows[0].database, 'Database was not set on return after insertion');
              const secret = security.encryptValue(process.env.SECRET, dbUrl.password);
              const role = await pgpool.query(`
                insert into postgresql.roles_log (role_log, role, database_log, username, password, options, deleted)
                values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5, $6)
                on conflict (database_log, username, (password->>'hash'), deleted) 
                do update set username = $3 
                returning role_log, role, username`,
              [`${dbUrl.hostname}.${dbUrl.pathname}.${dbUrl.username}`, db.rows[0].database_log, dbUrl.username, secret, dbUrl.search.replace(/\?/, ''), false]);
              assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
              assert.ok(role.rows[0].role, 'Role was not set on return after insertion');
              assert.ok(pod.node_log, 'pod.node_log was undefined.');
              assert.ok(role.rows[0].role, 'role.rows[0].role was undefined.');
              assert.ok(role.rows[0].username, 'role.rows[0].username was undefined.');
              assert.ok(db.rows[0].database, 'db.rows[0].database was undefined.');
              db.rows[0].name = db.rows[0].name ? db.rows[0].name : 'unknown';
              await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                [role.rows[0].role_log, db.rows[0].database_log]);
              await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                [pod.node_log, role.rows[0].role_log]);
            } catch (e) {
              if (e.message.includes('Invalid URL')) {
                debug(`Warning, invalid postgresql url: ${e.message}`);
              } else {
                debug(`Error adding postgresql entry from pod ${pod.node_log} due to: ${e.message}`); // eslint-disable-line no-console
              }
            }
          }
        }), []));
  }));
}

async function writePostgresqlFromDeployments(pgpool, deploymentRecords) {
  await Promise.all(deploymentRecords.map(async (deployment) => {
    await Promise.all((deployment.definition.spec.template.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && env.value.startsWith('postgres://')))
        .map(async (env) => {
          if (env.value) {
            try {
              const dbUrl = new URL(env.value);
              const db = await pgpool.query(`
                insert into postgresql.databases_log (database_log, database, name, host, port, deleted)
                values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5)
                on conflict (name, host, port, deleted) 
                do update set name = $2 
                returning database_log, database, name, host, port`,
              [dbUrl.hostname + dbUrl.port + dbUrl.pathname, dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '5432' : dbUrl.port, false]);
              assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
              assert.ok(db.rows[0].database, 'Database was not set on return after insertion');
              const secret = security.encryptValue(process.env.SECRET, dbUrl.password);
              const role = await pgpool.query(`
                insert into postgresql.roles_log (role_log, role, database_log, username, password, options, deleted)
                values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5, $6)
                on conflict (database_log, username, (password->>'hash'), deleted) 
                do update set username = $3 
                returning role_log, role, username`,
              [`${dbUrl.hostname}.${dbUrl.pathname}.${dbUrl.username}`, db.rows[0].database_log, dbUrl.username, secret, dbUrl.search.replace(/\?/, ''), false]);
              assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
              assert.ok(role.rows[0].role, 'Role was not set on return after insertion');
              db.rows[0].name = db.rows[0].name ? db.rows[0].name : 'unknown';
              await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                [role.rows[0].role_log, db.rows[0].database_log]);
              await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                [deployment.node_log, role.rows[0].role_log]);
            } catch (e) {
              if (e.message.includes('Invalid URL')) {
                debug(`Warning, invalid postgresql url: ${e.message}`);
              } else {
                debug(`Error adding postgresql entry from deployment ${deployment.node_log} due to: ${e.message}`); // eslint-disable-line no-console
              }
            }
          }
        }), []));
  }));
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
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'configmap', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'deployment', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'replicaset', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'service', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'node', { name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'pod', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'persistentvolume', { name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'persistentvolumeclaim', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'event', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'ingress', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'daemonset', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'statefulset', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'job', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'virtualservice', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'gateway', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'policy', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'certificate', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'issuer', { namespace: { type: 'text' }, name: { type: 'text' }, context: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'kubernetes', 'clusterissuer', { name: { type: 'text' }, context: { type: 'text' } });
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

function redactDeploymentsSetsAndJobs(data) {
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

function redact(type, definition) {
  let redacted = JSON.parse(JSON.stringify(definition));
  if (type === 'configmap') {
    redacted = redactConfigMaps(redacted);
  }
  if (type === 'pod') {
    redacted = redactPods(redacted);
  }
  if (type === 'deployment' || type === 'replicaset' || type === 'statefulset' || type === 'daemonset' || type === 'job') {
    redacted = redactDeploymentsSetsAndJobs(redacted);
  }
  return redacted;
}

async function fetch(type, func, args) {
  const { body } = await func(args);
  assert.ok(body.items, 'The items field on the returned kube response was not there.');
  assert.ok(Array.isArray(body.items), 'The items field on the returned kube response was not an array');
  debug(`Received ${body.items.length} items for ${type}`);
  if (body.metadata.continue) {
    return body.items.concat(await fetch(type, func, { continue: body.metadata.continue, ...args })); // eslint-disable-line max-len
  }
  return body.items;
}

const kubeNode = (def) => (def.metadata.uid);
const kubeSpec = (def) => (def.spec || {});
const kubeStatus = (def) => (def.status || {});
const kubeMetadata = (def) => (def.status || {});

async function run(pgpool) {
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
  debug(`Refreshing configmaps from ${process.env.KUBERNETES_CONTEXT}`);
  const configMaps = await fetch('configmap', k8sCoreApi.listConfigMapForAllNamespaces.bind(k8sCoreApi), { limit: Math.floor(maxMemory / 4096), labelSelector }); // eslint-disable-line max-len
  await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'configmap',
    (await Promise.all(configMaps
      .map(async (def) => {
        const redef = redact('configmap', def);
        const node = await crawler.writeObj(pgpool, 'kubernetes', 'configmap', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT }); // eslint-disable-line max-len
        await writeOracleFromConfigMaps(pgpool, [{ ...(node.rows[0]), definition: def }]);
        await writePostgresqlFromConfigMaps(pgpool, [{ ...(node.rows[0]), definition: def }]);
        return node;
      }))).map((x) => x.rows).flat());

  debug(`Refreshing deployments from ${process.env.KUBERNETES_CONTEXT}`);
  const deployments = await fetch('deployment', k8sAppsApi.listDeploymentForAllNamespaces.bind(k8sAppsApi), { limit: Math.floor(maxMemory / 4096), labelSelector }); // eslint-disable-line max-len
  await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'deployment',
    (await Promise.all(deployments
      .map(async (def) => {
        const redef = redact('deployment', def);
        const node = await crawler.writeObj(pgpool, 'kubernetes', 'deployment', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT }); // eslint-disable-line max-len
        await writeKubernetesDeploymentToConfigMaps(pgpool, [{ ...(node.rows[0]), definition: def }]); // eslint-disable-line max-len
        await writeAkkersAppsFromDeployments(pgpool, [{ ...(node.rows[0]), definition: def }]);
        await writePostgresqlFromDeployments(pgpool, [{ ...(node.rows[0]), definition: def }]);
        await writeOracleFromDeployments(pgpool, [{ ...(node.rows[0]), definition: def }]);
        return node;
      }))).map((x) => x.rows).flat());

  debug(`Refreshing replicasets from ${process.env.KUBERNETES_CONTEXT}`);
  const replicaSets = await fetch('replicaset', k8sAppsApi.listReplicaSetForAllNamespaces.bind(k8sAppsApi), { limit: Math.floor(maxMemory / 4096), labelSelector }); // eslint-disable-line max-len
  await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'replicaset',
    (await Promise.all(replicaSets
      .map(async (def) => {
        const redef = redact('replicaset', def);
        const node = await crawler.writeObj(pgpool, 'kubernetes', 'replicaset', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT }); // eslint-disable-line max-len
        await writeKubernetesReplicaSetToDeployments(pgpool, [{ ...(node.rows[0]), definition: def }]); // eslint-disable-line max-len
        await writeOracleFromReplicaSets(pgpool, [{ ...(node.rows[0]), definition: def }]);
        await writePostgresqlFromReplicaSets(pgpool, [{ ...(node.rows[0]), definition: def }]);
        return node;
      }))).map((x) => x.rows).flat());

  debug(`Refreshing services from ${process.env.KUBERNETES_CONTEXT}`);
  const services = await fetch('service', k8sCoreApi.listServiceForAllNamespaces.bind(k8sCoreApi), { limit: Math.floor(maxMemory / 4096), labelSelector }); // eslint-disable-line max-len
  await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'service',
    (await Promise.all(services
      .map((redef) => crawler.writeObj(pgpool, 'kubernetes', 'service', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

  debug(`Refreshing nodes from ${process.env.KUBERNETES_CONTEXT}`);
  const nodes = await fetch('node', k8sCoreApi.listNode.bind(k8sCoreApi), { limit: Math.floor(maxMemory / 4096), labelSelector }); // eslint-disable-line max-len
  await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'node',
    (await Promise.all(nodes
      .map((redef) => crawler.writeObj(pgpool, 'kubernetes', 'node', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, context: process.env.KUBERNETES_CONTEXT })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

  debug(`Refreshing pods from ${process.env.KUBERNETES_CONTEXT}`);
  const pods = await fetch('pod', k8sCoreApi.listPodForAllNamespaces.bind(k8sCoreApi), { limit: Math.floor(maxMemory / 4096), labelSelector }); // eslint-disable-line max-len
  await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'pod',
    (await Promise.all(pods
      .map(async (def) => {
        const redef = redact('pod', def);
        const node = await crawler.writeObj(pgpool, 'kubernetes', 'pod', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT }); // eslint-disable-line max-len
        await writeOracleFromPods(pgpool, [{ ...(node.rows[0]), definition: def }]);
        await writePostgresqlFromPods(pgpool, [{ ...(node.rows[0]), definition: def }]);
        await writeKubernetesPodToReplicaSets(pgpool, [{ ...(node.rows[0]), definition: def }]);
        return node;
      }))).map((x) => x.rows).flat());

  debug(`Refreshing persistentvolumes from ${process.env.KUBERNETES_CONTEXT}`);
  const pvs = await fetch('node', k8sCoreApi.listPersistentVolume.bind(k8sCoreApi), { limit: Math.floor(maxMemory / 2048), labelSelector }); // eslint-disable-line max-len
  await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'persistentvolume',
    (await Promise.all(pvs
      .map((redef) => crawler.writeObj(pgpool, 'kubernetes', 'persistentvolume', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, context: process.env.KUBERNETES_CONTEXT })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

  debug(`Refreshing persistentvolumeclaims from ${process.env.KUBERNETES_CONTEXT}`);
  const pvcs = await fetch('persistentvolumeclaim', k8sCoreApi.listPersistentVolumeClaimForAllNamespaces.bind(k8sCoreApi), { limit: Math.floor(maxMemory / 2048), labelSelector }); // eslint-disable-line max-len
  await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'persistentvolumeclaim',
    (await Promise.all(pvcs
      .map((redef) => crawler.writeObj(pgpool, 'kubernetes', 'persistentvolumeclaim', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

  debug(`Refreshing events from ${process.env.KUBERNETES_CONTEXT}`);
  const events = await fetch('event', k8sCoreApi.listEventForAllNamespaces.bind(k8sCoreApi), { limit: Math.floor(maxMemory / 2048), labelSelector }); // eslint-disable-line max-len
  await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'event',
    (await Promise.all(events
      .map((redef) => crawler.writeObj(pgpool, 'kubernetes', 'event', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

  debug(`Refreshing ingresses from ${process.env.KUBERNETES_CONTEXT}`);
  const ingresses = await fetch('ingress', k8sExtensionsApi.listIngressForAllNamespaces.bind(k8sExtensionsApi), { limit: Math.floor(maxMemory / 2048), labelSelector }); // eslint-disable-line max-len
  await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'ingress',
    (await Promise.all(ingresses
      .map((redef) => crawler.writeObj(pgpool, 'kubernetes', 'ingress', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

  debug(`Refreshing daemonsets from ${process.env.KUBERNETES_CONTEXT}`);
  const daemonSets = await fetch('daemonset', k8sAppsApi.listDaemonSetForAllNamespaces.bind(k8sAppsApi), { limit: Math.floor(maxMemory / 2048), labelSelector }); // eslint-disable-line max-len
  await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'daemonset',
    (await Promise.all(daemonSets
      .map((def) => redact('daemonset', def))
      .map((redef) => crawler.writeObj(pgpool, 'kubernetes', 'daemonset', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

  debug(`Refreshing statefulsets from ${process.env.KUBERNETES_CONTEXT}`);
  const statefulSets = await fetch('statefulset', k8sAppsApi.listStatefulSetForAllNamespaces.bind(k8sAppsApi), { limit: Math.floor(maxMemory / 2048), labelSelector }); // eslint-disable-line max-len
  await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'statefulset',
    (await Promise.all(statefulSets
      .map((def) => redact('statefulset', def))
      .map((redef) => crawler.writeObj(pgpool, 'kubernetes', 'statefulset', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

  debug(`Refreshing jobs from ${process.env.KUBERNETES_CONTEXT}`);
  const jobs = await fetch('job', k8sBatchApi.listJobForAllNamespaces.bind(k8sAppsApi), { limit: Math.floor(maxMemory / 2048), labelSelector }); // eslint-disable-line max-len
  await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'job',
    (await Promise.all(jobs
      .map((def) => redact('job', def))
      .map((redef) => crawler.writeObj(pgpool, 'kubernetes', 'job', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT })))).map((x) => x.rows).flat()); // eslint-disable-line max-len


  if (process.env.ISTIO === 'true') {
    try {
      debug(`Refreshing virtual services from ${process.env.KUBERNETES_CONTEXT}`);
      const virtualServices = await fetch('virtualservice', k8sCustomApi.listClusterCustomObject.bind(k8sCustomApi, 'networking.istio.io', 'v1alpha3', 'virtualservices'), {
        limit: Math.floor(maxMemory / 2048), labelSelector, group: 'networking.istio.io', version: 'v1alpha3', plural: 'virtualservices',
      }); // eslint-disable-line max-len
      await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'virtualservice',
        (await Promise.all(virtualServices
          .map((redef) => crawler.writeObj(pgpool, 'kubernetes', 'virtualservice', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

      debug(`Refreshing gateways from ${process.env.KUBERNETES_CONTEXT}`);
      const gateways = await fetch('gateway', k8sCustomApi.listClusterCustomObject.bind(k8sCustomApi, 'networking.istio.io', 'v1alpha3', 'gateways'), {
        limit: Math.floor(maxMemory / 2048), labelSelector, group: 'networking.istio.io', version: 'v1alpha3', plural: 'gateways',
      }); // eslint-disable-line max-len
      await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'gateway',
        (await Promise.all(gateways
          .map((redef) => crawler.writeObj(pgpool, 'kubernetes', 'gateway', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

      debug(`Refreshing policies from ${process.env.KUBERNETES_CONTEXT}`);
      const policies = await fetch('policy', k8sCustomApi.listClusterCustomObject.bind(k8sCustomApi, 'authentication.istio.io', 'v1alpha1', 'policies'), {
        limit: Math.floor(maxMemory / 2048), labelSelector, group: 'authentication.istio.io', version: 'v1alpha1', plural: 'policies',
      }); // eslint-disable-line max-len
      await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'policy',
        (await Promise.all(policies
          .map((redef) => crawler.writeObj(pgpool, 'kubernetes', 'policy', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT })))).map((x) => x.rows).flat()); // eslint-disable-line max-len
    } catch (e) {
      debug(`Failed to get istio custom objects in kubernetes: ${e.stack || e.message || e}`);
    }
  }
  if (process.env.CERT_MANAGER === 'true') {
    try {
      debug(`Refreshing certificates from ${process.env.KUBERNETES_CONTEXT}`);
      const certificates = await fetch('certificate', k8sCustomApi.listClusterCustomObject.bind(k8sCustomApi, 'cert-manager.io', 'v1alpha2', 'certificates'), {
        limit: Math.floor(maxMemory / 2048), labelSelector, group: 'cert-manager.io', version: 'v1alpha2', plural: 'certificates',
      }); // eslint-disable-line max-len
      await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'certificate',
        (await Promise.all(certificates
          .map((redef) => crawler.writeObj(pgpool, 'kubernetes', 'certificate', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

      debug(`Refreshing cluster issuers from ${process.env.KUBERNETES_CONTEXT}`);
      const clusterIssuers = await fetch('clusterissuer', k8sCustomApi.listClusterCustomObject.bind(k8sCustomApi, 'cert-manager.io', 'v1alpha2', 'clusterissuers'), {
        limit: Math.floor(maxMemory / 2048), labelSelector, group: 'cert-manager.io', version: 'v1alpha2', plural: 'clusterissuers',
      }); // eslint-disable-line max-len
      await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'clusterissuer',
        (await Promise.all(clusterIssuers
          .map((redef) => crawler.writeObj(pgpool, 'kubernetes', 'clusterissuer', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, context: process.env.KUBERNETES_CONTEXT })))).map((x) => x.rows).flat()); // eslint-disable-line max-len

      debug(`Refreshing issuers from ${process.env.KUBERNETES_CONTEXT}`);
      const issuers = await fetch('issuer', k8sCustomApi.listClusterCustomObject.bind(k8sCustomApi, 'cert-manager.io', 'v1alpha2', 'issuers'), {
        limit: Math.floor(maxMemory / 2048), labelSelector, group: 'cert-manager.io', version: 'v1alpha2', plural: 'issuers',
      }); // eslint-disable-line max-len
      await crawler.writeDeletedObjs(pgpool, 'kubernetes', 'issuer',
        (await Promise.all(issuers
          .map((redef) => crawler.writeObj(pgpool, 'kubernetes', 'issuer', kubeNode(redef), redef, kubeSpec(redef), kubeStatus(redef), kubeMetadata(redef), { name: redef.metadata.name, namespace: redef.metadata.namespace, context: process.env.KUBERNETES_CONTEXT })))).map((x) => x.rows).flat()); // eslint-disable-line max-len
    } catch (e) {
      debug(`Failed to get custom objects in kubernetes: ${e.stack || e.message || e}`);
    }
  }
}

module.exports = {
  init,
  run,
};
