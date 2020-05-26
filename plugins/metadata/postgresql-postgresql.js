const debug = require('debug')('daedalus:metadata');

function parseServerOptions(connection) {
  const db = connection
    .substring(1, connection.length - 1)
    .split(',')
    .map((x) => x.split('='))
    .flat()
    .reduce((acc, val, i, src) => {
      if (i % 2 !== 0) {
        acc[src[i - 1]] = val;
      }
      return acc;
    }, {});
  if (!db.dbname || !(db.host || db.dbhost)) {
    return null;
  }
  return { name: db.dbname || db.name, host: db.host || db.dbhost, port: db.dbport || db.port || '5432' };
}

async function writePostgresqlTablesFromDatabases(pgpool) {
  const { rows: tables } = await pgpool.query(`
    select
      tables.table_log,
      tables.database_log,
      tables.catalog,
      tables.schema,
      tables.name,
      tables.is_view,
      tables.definition,
      tables.observed_on,
      databases.name as dbname,
      databases.host as dbhost,
      databases.port as dbport
    from
      postgresql.tables
      join postgresql.databases on tables.database_log = databases.database_log
  `);
  debug(`Examining ${tables.length} postgresql tables.`);

  await Promise.all(tables.map(async (table) => {
    try {
      await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
        [table.database_log, table.table_log]);
    } catch (e) {
      debug(`Unable to link table ${table.table_log} to database ${table.database} due to: ${e.message}`);
    }
  }));
}

async function writePostgresqlColumnsFromTables(pgpool) {
  const { rows: columns } = await pgpool.query(`
    select
      columns.column_log,
      columns.table_log,
      tables.name as table_name,
      columns.database_log,
      columns.catalog,
      columns.schema,
      columns.name,
      columns.data_type as definition,
      columns.observed_on
    from
      postgresql.columns
        join postgresql.tables on columns.table_log = tables.table_log
  `);
  debug(`Examining ${columns.length} postgresql columns.`);

  await Promise.all(columns.map(async (column) => {
    try {
      await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
        [column.table_log, column.column_log]);
    } catch (e) {
      debug(`Unable to link column ${column.column} and table ${column.table} due to: ${e.message}`);
    }
  }));
}

// Finds and links databases that have dblinks between them.
async function writePostgresqlRoleFromDatabases(pgpool) {
  const { rows: foreignServers } = await pgpool.query(`
    select
      foreign_servers.foreign_server_log,
      foreign_servers.database_log,
      databases.name as from_name,
      databases.host as from_host,
      databases.port as from_port,
      foreign_servers.catalog,
      foreign_servers.owner,
      foreign_servers.name,
      foreign_servers.username,
      foreign_servers.connection,
      foreign_servers.observed_on
    from
      postgresql.foreign_servers
      join postgresql.databases on foreign_servers.database_log = databases.database_log
  `, []);

  await Promise.all(foreignServers.map(async (server) => {
    try {
      const { name, host, port } = parseServerOptions(server.connection);
      const { rows: [db] } = await pgpool.query(`
        insert into postgresql.databases_log (database_log, database, name, host, port, deleted)
        values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5)
        on conflict (name, host, port, deleted) 
        do update set name = $2
        returning database_log, database, host, port, name
      `, [host + port + name, name, host, port, false]);
      const { rows: roles } = await pgpool.query(`
        select role_log, role, database_log, username from postgresql.roles_log where database_log = $1 and username = $2
      `, [db.database_log, server.username]);
      let role = roles[0];
      if (roles.length === 0) {
        const { rows: newRoles } = await pgpool.query(`
          insert into postgresql.roles_log (role_log, role, database_log, username, password, options) 
          values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, '{}'::jsonb, '{}'::jsonb) 
          returning role_log, role, database_log, username
        `, [`${host}.${name}.${server.username}`, db.database_log, server.username]);
        role = newRoles[0]; // eslint-disable-line prefer-destructuring
      }
      await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
        [server.database_log, role.role_log]);
      await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
        [role.role_log, db.database_log]);
    } catch (e) {
      debug(`Unable to link database ${server.database} and foreign server ${server.foreign_server_log} due to: ${e.message}`);
    }
  }));
}


async function init() {} // eslint-disable-line no-empty-function

async function run(pgpool) {
  await writePostgresqlRoleFromDatabases(pgpool);
  await writePostgresqlTablesFromDatabases(pgpool);
  await writePostgresqlColumnsFromTables(pgpool);
}

module.exports = {
  run,
  init,
};
