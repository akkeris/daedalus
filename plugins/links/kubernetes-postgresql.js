const debug = require('debug')('daedalus:links');
const assert = require('assert');
const security = require('../../common/security.js');

async function writePostgresqlFromConfigMaps(pgpool, type, configMapRecords) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${configMapRecords.length} configMaps for envs that have a postgres string.`);
  await Promise.all(configMapRecords.map(async (configMap) => {
    if (configMap.definition.data) {
      await Promise.all(Object.keys(configMap.definition.data).map(async (env) => {
        if (configMap.definition.data[env].startsWith('postgres://')) {
          const dbUrl = new URL(configMap.definition.data[env]);
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
            returning role`,
          [db.rows[0].database, dbUrl.username, security.encryptValue(process.env.SECRET, dbUrl.password), dbUrl.search.replace(/\?/, ''), false]);
          assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
          assert.ok(role.rows[0].role, 'Role was not set on return after insertion');
          await pgpool.query(`
            insert into links.from_kubernetes_config_maps_to_postgresql_roles_log
            (link, config_map, role, observed_on, deleted)
            values (uuid_generate_v4(), $1, $2, now(), false)
            on conflict (config_map, role, deleted)
            do nothing
          `, [configMap.config_map, role.rows[0].role]);
        }
      }), []);
    }
  }));
}

async function writePostgresqlFromPods(pgpool, type, podRecords) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${podRecords.length} pods for envs that have a postgres string.`);
  await Promise.all(podRecords.map(async (pod) => {
    await Promise.all((pod.definition.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && env.value.startsWith('postgres://')))
        .map(async (env) => {
          if (env.value) {
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
              returning role`,
            [db.rows[0].database, dbUrl.username, security.encryptValue(process.env.SECRET, dbUrl.password), dbUrl.search.replace(/\?/, ''), false]);
            assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
            assert.ok(role.rows[0].role, 'Role was not set on return after insertion');
            await pgpool.query(`
              insert into links.from_kubernetes_pods_to_postgresql_roles_log
              (link, pod, role, observed_on, deleted)
              values (uuid_generate_v4(), $1, $2, now(), false)
              on conflict (pod, role, deleted)
              do nothing
            `, [pod.pod, role.rows[0].role]);
          }
        }), []));
  }));
}


async function writePostgresqlFromDeployments(pgpool, type, deploymentRecords) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${deploymentRecords.length} deployment for envs that have a postgres string.`);
  await Promise.all(deploymentRecords.map(async (deployment) => {
    await Promise.all((deployment.definition.spec.template.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && env.value.startsWith('postgres://')))
        .map(async (env) => {
          if (env.value) {
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
              returning role`,
            [db.rows[0].database, dbUrl.username, security.encryptValue(process.env.SECRET, dbUrl.password), dbUrl.search.replace(/\?/, ''), false]);
            assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
            assert.ok(role.rows[0].role, 'Role was not set on return after insertion');
            await pgpool.query(`
              insert into links.from_kubernetes_deployments_to_postgresql_roles_log
              (link, deployment, role, observed_on, deleted)
              values (uuid_generate_v4(), $1, $2, now(), false)
              on conflict (deployment, role, deleted)
              do nothing
            `, [deployment.deployment, role.rows[0].role]);
          }
        }), []));
  }));
}

async function init(pgpool, bus) {
  bus.on('kubernetes.pod', writePostgresqlFromPods.bind(null, pgpool));
  bus.on('kubernetes.config_map', writePostgresqlFromConfigMaps.bind(null, pgpool));
  bus.on('kubernetes.deployment', writePostgresqlFromDeployments.bind(null, pgpool));
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
  /*
  (await pgpool.query(`
    with links as (
      select distinct role from (
        select role from links.from_kubernetes_deployments_to_postgresql_roles
        union
        select role from links.from_kubernetes_pods_to_postgresql_roles
        union
        select role from links.from_kubernetes_config_maps_to_postgresql_roles
      ) a
    )
    select
      roles.role,
      roles.database,
      roles.password,
      roles.username,
      roles.options,
      links.role
    from postgresql.roles
      left join links on roles.role = links.role
    where links.role is null
  `)).rows.map(async (deadlink) => pgpool.query(`
    insert into postgresql.roles_log (role, database, username, password, options, deleted)
    values (uuid_generate_v4(), $1, $2, $3, $4, true)
    on conflict (database, username, (password->>'hash'), deleted)
    do update set username = $2
    returning role
  `, [deadlink.database, deadlink.username, deadlink.password, deadlink.options]));
  */
}

module.exports = {
  run,
  init,
};
