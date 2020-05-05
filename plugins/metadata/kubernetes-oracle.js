const debug = require('debug')('daedalus:metadata');
const assert = require('assert');
const security = require('../../common/security.js');


function parseJDBC(value, name, map) {
  const components = (/^jdbc:oracle:thin:(.*)@([A-Za-z0-9\-\.]+):([0-9]*):([A-Za-z0-9\-\.]+)(.*)$/g).exec(value); // eslint-disable-line no-useless-escape
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

async function writeOracleFromConfigMaps(pgpool, bus, type, configMapRecords) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${configMapRecords.length} configMaps for envs that have a oracle string.`);

  const databaseType = (await pgpool.query('select "type" from metadata.node_types where name = \'oracle/databases\'')).rows[0].type;
  const roleType = (await pgpool.query('select "type" from metadata.node_types where name = \'oracle/roles\'')).rows[0].type;
  const configMapType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/config_maps\'')).rows[0].type;

  await Promise.all(configMapRecords.map(async (configMap) => {
    if (configMap.definition.data) {
      await Promise.all(Object.keys(configMap.definition.data).map(async (env) => {
        if (configMap.definition.data[env].startsWith('jdbc:oracle:thin')) {
          try {
            const dbUrl = parseJDBC(configMap.definition.data[env], env, objToArray(configMap.definition.data)); // eslint-disable-line max-len
            const db = await pgpool.query(`
              insert into oracle.databases_log (database, name, host, port, deleted)
              values (uuid_generate_v4(), $1, $2, $3, $4)
              on conflict (name, host, port, deleted) 
              do update set name = $1 
              returning database, host, port, name`,
            [dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '1521' : dbUrl.port, false]);
            assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
            assert.ok(db.rows[0].database, 'Database was not set on return after insertion');
            const role = await pgpool.query(`
              insert into oracle.roles_log (role, database, username, password, options, deleted)
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
              [configMap.config_map, role.rows[0].role]);
          } catch (e) {
            if (e.message.includes('Invalid URL')) {
              bus.emit('kubernetes.config_map.error', [configMap.config_map, 'bad-oracle-url-error', e.message]);
            } else {
              debug(`Error adding link from ${configMap.config_map} to oracle role found inside, due to: ${e.message}`); // eslint-disable-line no-console
            }
          }
        }
      }), []);
    }
  }));

  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select role from oracle.roles)', [roleType]);
}

async function writeOracleFromReplicaSets(pgpool, bus, type, replicaSetRecords) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${replicaSetRecords.length} replicaset for envs that have a oracle string.`);
  await Promise.all(replicaSetRecords.map(async (replicaSet) => {
    await Promise.all((replicaSet.definition.spec.template.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && env.value.startsWith('jdbc:oracle:thin')))
        .map(async (env) => {
          if (env.value) {
            try {
              const dbUrl = parseJDBC(env.value, env.name, container.env);
              const db = await pgpool.query(`
                insert into oracle.databases_log (database, name, host, port, deleted)
                values (uuid_generate_v4(), $1, $2, $3, $4)
                on conflict (name, host, port, deleted) 
                do update set name = $1 
                returning database`,
              [dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '1521' : dbUrl.port, false]);
              assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
              assert.ok(db.rows[0].database, 'Database was not set on return after insertion');
              const role = await pgpool.query(`
                insert into oracle.roles_log (role, database, username, password, options, deleted)
                values (uuid_generate_v4(), $1, $2, $3, $4, $5)
                on conflict (database, username, (password->>'hash'), deleted) 
                do update set username = $2 
                returning role, username`,
              [db.rows[0].database, dbUrl.username, security.encryptValue(process.env.SECRET, dbUrl.password), dbUrl.search.replace(/\?/, ''), false]);
              assert.ok(role.rows.length > 0, 'Adding a role did not return a role id');
              assert.ok(role.rows[0].role, 'Role was not set on return after insertion');
            } catch (e) {
              if (e.message.includes('Invalid URL')) {
                bus.emit('kubernetes.replicaset.error', [replicaSet.replicaset, 'bad-oracle-url-error', e.message]);
              } else {
                debug(`Error adding oracle entry from replicaset ${replicaSet.replicaset} due to: ${e.message}`); // eslint-disable-line no-console
              }
            }
          }
        }), []));
  }));
}

async function writeOracleFromPods(pgpool, bus, type, podRecords) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${podRecords.length} pods for envs that have a oracle string.`);

  const databaseType = (await pgpool.query('select "type" from metadata.node_types where name = \'oracle/databases\'')).rows[0].type;
  const roleType = (await pgpool.query('select "type" from metadata.node_types where name = \'oracle/roles\'')).rows[0].type;
  const podType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/pods\'')).rows[0].type;

  await Promise.all(podRecords.map(async (pod) => {
    await Promise.all((pod.definition.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && env.value.startsWith('jdbc:oracle:thin')))
        .map(async (env) => {
          if (env.value) {
            try {
              const dbUrl = parseJDBC(env.value, env.name, container.env);
              const db = await pgpool.query(`
                insert into oracle.databases_log (database, name, host, port, deleted)
                values (uuid_generate_v4(), $1, $2, $3, $4)
                on conflict (name, host, port, deleted) 
                do update set name = $1 
                returning database, name, host, port`,
              [dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '1521' : dbUrl.port, false]);
              assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
              assert.ok(db.rows[0].database, 'Database was not set on return after insertion');
              const role = await pgpool.query(`
                insert into oracle.roles_log (role, database, username, password, options, deleted)
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
                [role.rows[0].role, db.rows[0].database]);
              await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                [pod.pod, role.rows[0].role]);
            } catch (e) {
              if (e.message.includes('Invalid URL')) {
                bus.emit('kubernetes.pod.error', [pod.pod, 'bad-oracle-url-error', e.message]);
              } else {
                debug(`Error adding oracle entry from pod ${pod.pod} due to: ${e.message}`); // eslint-disable-line no-console
              }
            }
          }
        }), []));
  }));

  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select database from oracle.databases)', [databaseType]);
}

async function writeOracleFromDeployments(pgpool, bus, type, deploymentRecords) {
  if (type !== 'sync') {
    return;
  }
  debug(`Examining ${deploymentRecords.length} deployment for envs that have a oracle string.`);

  const databaseType = (await pgpool.query('select "type" from metadata.node_types where name = \'oracle/databases\'')).rows[0].type;
  const roleType = (await pgpool.query('select "type" from metadata.node_types where name = \'oracle/roles\'')).rows[0].type;
  const deploymentType = (await pgpool.query('select "type" from metadata.node_types where name = \'kubernetes/deployments\'')).rows[0].type;

  await Promise.all(deploymentRecords.map(async (deployment) => {
    await Promise.all((deployment.definition.spec.template.spec.containers || [])
      .reduce((envs, container) => envs.concat((container.env || []).filter((env) => env.value && env.value.startsWith('jdbc:oracle:thin')))
        .map(async (env) => {
          if (env.value) {
            try {
              const dbUrl = parseJDBC(env.value, env.name, container.env);
              const db = await pgpool.query(`
                insert into oracle.databases_log (database, name, host, port, deleted)
                values (uuid_generate_v4(), $1, $2, $3, $4)
                on conflict (name, host, port, deleted) 
                do update set name = $1 
                returning database, name, host, port`,
              [dbUrl.pathname.replace(/\//, ''), dbUrl.hostname, dbUrl.port === '' ? '1521' : dbUrl.port, false]);
              assert.ok(db.rows.length > 0, 'Adding a database did not return a database id');
              assert.ok(db.rows[0].database, 'Database was not set on return after insertion');
              const role = await pgpool.query(`
                insert into oracle.roles_log (role, database, username, password, options, deleted)
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
                [role.rows[0].role, db.rows[0].database]);
              await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
                [deployment.deployment, role.rows[0].role]);
            } catch (e) {
              if (e.message.includes('Invalid URL')) {
                bus.emit('kubernetes.deployment.error', [deployment.deployment, 'bad-oracle-url-error', e.message]);
              } else {
                debug(`Error adding oracle entry from deployment ${deployment.deployment} due to: ${e.message}`); // eslint-disable-line no-console
              }
            }
          }
        }), []));
  }));

  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select database from oracle.databases)', [databaseType]);
}

async function init(pgpool, bus) {
  bus.on('kubernetes.pod', writeOracleFromPods.bind(null, pgpool, bus));
  bus.on('kubernetes.config_map', writeOracleFromConfigMaps.bind(null, pgpool, bus));
  bus.on('kubernetes.deployment', writeOracleFromDeployments.bind(null, pgpool, bus));
  bus.on('kubernetes.replicaset', writeOracleFromReplicaSets.bind(null, pgpool, bus));
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
