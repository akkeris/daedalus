const debug = require('debug')('daedalus:metadata');
const assert = require('assert');
const security = require('../../common/security.js');

async function writePostgresqlFromConfigMaps(pgpool, bus, type, configMapRecords) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${configMapRecords.length} configMaps for envs that have a postgres string.`);

  const databaseType = (await pgpool.query('select "type" from metadata.node_types where name = \'postgresql/databases\'')).rows[0].type;
  const roleType = (await pgpool.query('select "type" from metadata.node_types where name = \'postgresql/roles\'')).rows[0].type;
  const configMapType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/config_maps\'')).rows[0].type;

  await Promise.all(configMapRecords.map(async (configMap) => {
    if (configMap.definition.data) {
      await Promise.all(Object.keys(configMap.definition.data).map(async (env) => {
        if (configMap.definition.data[env].startsWith('postgres://')) {
          try {
            const dbUrl = new URL(configMap.definition.data[env]);
            const db = await pgpool.query(`
              insert into postgresql.databases_log (database, name, host, port, deleted)
              values (uuid_generate_v4(), $1, $2, $3, $4)
              on conflict (name, host, port, deleted) 
              do update set name = $1 
              returning database, host, port, name`,
            [dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '5432' : dbUrl.port, false]);
            assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
            assert.ok(db.rows[0].database, 'Database was not set on return after insertion');
            const role = await pgpool.query(`
              insert into postgresql.roles_log (role, database, username, password, options, deleted)
              values (uuid_generate_v4(), $1, $2, $3, $4, $5)
              on conflict (database, username, (password->>'hash'), deleted) 
              do update set username = $2 
              returning role, username`,
            [db.rows[0].database, dbUrl.username, security.encryptValue(process.env.SECRET, dbUrl.password), dbUrl.search.replace(/\?/, ''), false]);
            assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
            assert.ok(role.rows[0].role, 'Role was not set on return after insertion');
            assert.ok(configMap.config_map, 'configMap.config_map was undefined.');
            assert.ok(configMap.name, 'configMap.name was undefined.');
            assert.ok(configMapType, 'configMapType was undefined.');
            assert.ok(role.rows[0].role, 'role.rows[0].role was undefined.');
            assert.ok(role.rows[0].username, 'role.rows[0].username was undefined.');
            assert.ok(roleType, 'roleType was undefined.');
            assert.ok(db.rows[0].database, 'db.rows[0].database was undefined.');
            db.rows[0].name = db.rows[0].name ? db.rows[0].name : 'unknown';

            assert.ok(databaseType, 'databaseType was undefined.');
            await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do update set name=$2',
              [configMap.config_map, `${configMap.definition.metadata.namespace}/${configMap.name}`, configMapType]);
            await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do update set name=$2',
              [role.rows[0].role, role.rows[0].username, roleType]);
            await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do update set name=$2',
              [db.rows[0].database, `${db.rows[0].host}:${db.rows[0].port}/${db.rows[0].name}`, databaseType]);
            await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
              [db.rows[0].database, role.rows[0].role]);
            await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
              [role.rows[0].role, configMap.config_map]); // TODO: switch these?
          } catch (e) {
            if (e.message.includes('Invalid URL')) {
              bus.emit('kubernetes.config_map.error', [configMap.config_map, 'bad-postgresql-url-error', e.message]);
            } else {
              debug(`Error adding link from ${configMap.config_map} to postgresql role found inside, due to: ${e.message}`); // eslint-disable-line no-console
            }
          }
        }
      }), []);
    }
  }));

  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select role from postgresql.roles)', [roleType]);
}

async function writePostgresqlFromReplicaSets(pgpool, bus, type, replicaSetRecords) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${replicaSetRecords.length} replicaset for envs that have a postgres string.`);
  await Promise.all(replicaSetRecords.map(async (replicaSet) => {
    await Promise.all((replicaSet.definition.spec.template.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && env.value.startsWith('postgres://')))
        .map(async (env) => {
          if (env.value) {
            try {
              const dbUrl = new URL(env.value);
              const db = await pgpool.query(`
                insert into postgresql.databases_log (database, name, host, port, deleted)
                values (uuid_generate_v4(), $1, $2, $3, $4)
                on conflict (name, host, port, deleted) 
                do update set name = $1 
                returning database`,
              [dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '5432' : dbUrl.port, false]);
              assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
              assert.ok(db.rows[0].database, 'Database was not set on return after insertion');
              const role = await pgpool.query(`
                insert into postgresql.roles_log (role, database, username, password, options, deleted)
                values (uuid_generate_v4(), $1, $2, $3, $4, $5)
                on conflict (database, username, (password->>'hash'), deleted) 
                do update set username = $2 
                returning role, username`,
              [db.rows[0].database, dbUrl.username, security.encryptValue(process.env.SECRET, dbUrl.password), dbUrl.search.replace(/\?/, ''), false]);
              assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
              assert.ok(role.rows[0].role, 'Role was not set on return after insertion');
            } catch (e) {
              if (e.message.includes('Invalid URL')) {
                bus.emit('kubernetes.replicaset.error', [replicaSet.replicaset, 'bad-postgresql-url-error', e.message]);
              } else {
                debug(`Error adding postgresql entry from replicaset ${replicaSet.replicaset} due to: ${e.message}`); // eslint-disable-line no-console
              }
            }
          }
        }), []));
  }));
}

async function writePostgresqlFromPods(pgpool, bus, type, podRecords) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${podRecords.length} pods for envs that have a postgres string.`);

  const databaseType = (await pgpool.query('select "type" from metadata.node_types where name = \'postgresql/databases\'')).rows[0].type;
  const roleType = (await pgpool.query('select "type" from metadata.node_types where name = \'postgresql/roles\'')).rows[0].type;
  const podType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/pods\'')).rows[0].type;

  await Promise.all(podRecords.map(async (pod) => {
    await Promise.all((pod.definition.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && env.value.startsWith('postgres://')))
        .map(async (env) => {
          if (env.value) {
            try {
              const dbUrl = new URL(env.value);
              const db = await pgpool.query(`
                insert into postgresql.databases_log (database, name, host, port, deleted)
                values (uuid_generate_v4(), $1, $2, $3, $4)
                on conflict (name, host, port, deleted) 
                do update set name = $1 
                returning database, name, host, port`,
              [dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '5432' : dbUrl.port, false]);
              assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
              assert.ok(db.rows[0].database, 'Database was not set on return after insertion');
              const role = await pgpool.query(`
                insert into postgresql.roles_log (role, database, username, password, options, deleted)
                values (uuid_generate_v4(), $1, $2, $3, $4, $5)
                on conflict (database, username, (password->>'hash'), deleted) 
                do update set username = $2 
                returning role, username`,
              [db.rows[0].database, dbUrl.username, security.encryptValue(process.env.SECRET, dbUrl.password), dbUrl.search.replace(/\?/, ''), false]);
              assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
              assert.ok(role.rows[0].role, 'Role was not set on return after insertion');
              assert.ok(pod.pod, 'pod.pod was undefined.');
              assert.ok(pod.name, 'pod.name was undefined.');
              assert.ok(podType, 'podType was undefined.');
              assert.ok(role.rows[0].role, 'role.rows[0].role was undefined.');
              assert.ok(role.rows[0].username, 'role.rows[0].username was undefined.');
              assert.ok(roleType, 'roleType was undefined.');
              assert.ok(db.rows[0].database, 'db.rows[0].database was undefined.');
              db.rows[0].name = db.rows[0].name ? db.rows[0].name : 'unknown';
              assert.ok(databaseType, 'databaseType was undefined.');
              await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do update set name = $2',
                [pod.pod, `${pod.definition.metadata.namespace}/${pod.name}`, podType]);
              await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do update set name = $2',
                [db.rows[0].database, `${db.rows[0].host}:${db.rows[0].port}/${db.rows[0].name}`, databaseType]);
              await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do update set name = $2',
                [role.rows[0].role, role.rows[0].username, roleType]);
              await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                [db.rows[0].database, role.rows[0].role]);
              await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                [role.rows[0].role, pod.pod]);
            } catch (e) {
              if (e.message.includes('Invalid URL')) {
                bus.emit('kubernetes.pod.error', [pod.pod, 'bad-postgresql-url-error', e.message]);
              } else {
                debug(`Error adding postgresql entry from pod ${pod.pod} due to: ${e.message}`); // eslint-disable-line no-console
              }
            }
          }
        }), []));
  }));

  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select database from postgresql.databases)', [databaseType]);
}

async function writePostgresqlFromDeployments(pgpool, bus, type, deploymentRecords) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${deploymentRecords.length} deployment for envs that have a postgres string.`);

  const databaseType = (await pgpool.query('select "type" from metadata.node_types where name = \'postgresql/databases\'')).rows[0].type;
  const roleType = (await pgpool.query('select "type" from metadata.node_types where name = \'postgresql/roles\'')).rows[0].type;
  const deploymentType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/deployments\'')).rows[0].type;

  await Promise.all(deploymentRecords.map(async (deployment) => {
    await Promise.all((deployment.definition.spec.template.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && env.value.startsWith('postgres://')))
        .map(async (env) => {
          if (env.value) {
            try {
              const dbUrl = new URL(env.value);
              const db = await pgpool.query(`
                insert into postgresql.databases_log (database, name, host, port, deleted)
                values (uuid_generate_v4(), $1, $2, $3, $4)
                on conflict (name, host, port, deleted) 
                do update set name = $1 
                returning database, name, host, port`,
              [dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '5432' : dbUrl.port, false]);
              assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
              assert.ok(db.rows[0].database, 'Database was not set on return after insertion');
              const role = await pgpool.query(`
                insert into postgresql.roles_log (role, database, username, password, options, deleted)
                values (uuid_generate_v4(), $1, $2, $3, $4, $5)
                on conflict (database, username, (password->>'hash'), deleted) 
                do update set username = $2 
                returning role, username`,
              [db.rows[0].database, dbUrl.username, security.encryptValue(process.env.SECRET, dbUrl.password), dbUrl.search.replace(/\?/, ''), false]);
              assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
              assert.ok(role.rows[0].role, 'Role was not set on return after insertion');
              db.rows[0].name = db.rows[0].name ? db.rows[0].name : 'unknown';
              assert.ok(databaseType, 'databaseType was undefined.');
              await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do update set name = $2',
                [deployment.deployment, `${deployment.definition.metadata.namespace}/${deployment.name}`, deploymentType]);
              await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do update set name = $2',
                [db.rows[0].database, `${db.rows[0].host}:${db.rows[0].port}/${db.rows[0].name}`, databaseType]);
              await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do nothing',
                [role.rows[0].role, role.rows[0].username, roleType]);
              await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                [db.rows[0].database, role.rows[0].role]);
              await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                [role.rows[0].role, deployment.deployment]); // TODO: Switch these?
            } catch (e) {
              if (e.message.includes('Invalid URL')) {
                bus.emit('kubernetes.deployment.error', [deployment.deployment, 'bad-postgresql-url-error', e.message]);
              } else {
                debug(`Error adding postgresql entry from deployment ${deployment.deployment} due to: ${e.message}`); // eslint-disable-line no-console
              }
            }
          }
        }), []));
  }));

  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select database from postgresql.databases)', [databaseType]);
}

async function init(pgpool, bus) {
  bus.on('kubernetes.pod', writePostgresqlFromPods.bind(null, pgpool, bus));
  bus.on('kubernetes.config_map', writePostgresqlFromConfigMaps.bind(null, pgpool, bus));
  bus.on('kubernetes.deployment', writePostgresqlFromDeployments.bind(null, pgpool, bus));
  bus.on('kubernetes.replicaset', writePostgresqlFromReplicaSets.bind(null, pgpool, bus));
}

async function run(pgpool) { // eslint-disable-line no-unused-vars
  // TODO: Answer This: How do we know a database no longer exists?
  // Should we remove roles based on what was found in configmaps, pods, deployments?
  // what happens if someone manually adds a database to the databases table? this will
  // automatically remove it... This is a philosophical question, how can we really know
  // if a database no longer exists?  I'm not convinced we have a realiable source of truth,
  // we can for sure say we found it, and we can for sure say our automated systems did not
  // find it a second pass around, but we cannot say that its fully removed, even if we cant
  // connect to it, without a source of truth.
}

module.exports = {
  run,
  init,
};
