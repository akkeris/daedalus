const debug = require('debug')('daedalus:metadata');

function parseOracleTNS(connection) {
  const host = connection.match(/\(HOST=([A-Za-z0-9.-]+)\)/);
  const port = connection.match(/\(PORT=([0-9]+)\)/);
  const service = connection.match(/\(SERVICE_NAME=([A-Za-z0-9.-]+)\)/);
  if (host && port && service) {
    return { host: host[1], port: port[1], name: service[1] };
  }
  return null;
}

async function writeOracleTablesFromDatabases(pgpool) {
  const { rows: tables } = await pgpool.query(`
    select
      tables."table",
      tables.database,
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
      oracle.tables
      join oracle.databases on tables.database = databases.database
  `);
  debug(`Examining ${tables.length} oracle tables.`);

  const databaseType = (await pgpool.query('select "type" from metadata.node_types where name = \'oracle/databases\'')).rows[0].type;
  const tableType = (await pgpool.query('select "type" from metadata.node_types where name = \'oracle/tables\'')).rows[0].type;
  await Promise.all(tables.map(async (table) => {
    try {
      await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do nothing',
        [table.database, `${table.dbhost}:${table.dbport}/${table.dbname}`, databaseType]);
      await pgpool.query('insert into metadata.nodes (node, name, type, definition) values ($1, $2, $3, $4) on conflict (node) do nothing',
        [table.table, `${table.catalog}.${table.schema}.${table.name} ${table.is_view ? '(view)' : ''}`, tableType, { ddl: table.definition }]);
      await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
        [table.database, table.table]);
    } catch (e) {
      debug(`Unable to link table ${table.table} to database ${table.database} due to: ${e.message}`);
    }
  }));
  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select "table" from oracle.tables)', [tableType]);
}

async function writeOracleColumnsFromTables(pgpool) {
  const { rows: columns } = await pgpool.query(`
    select
      columns."column",
      columns."table",
      tables.name as table_name,
      columns.database,
      columns.catalog,
      columns.schema,
      columns.name,
      columns.data_type as definition,
      columns.observed_on
    from
      oracle.columns
        join oracle.tables on columns.table = tables.table
  `);
  debug(`Examining ${columns.length} oracle columns.`);

  const columnType = (await pgpool.query('select "type" from metadata.node_types where name = \'oracle/columns\'')).rows[0].type;

  await Promise.all(columns.map(async (column) => {
    try {
      await pgpool.query('insert into metadata.nodes (node, name, type, definition) values ($1, $2, $3, $4) on conflict (node) do nothing',
        [column.column, `${column.catalog}.${column.schema}.${column.table_name}.${column.name}`, columnType, { type: column.definition }]);
      await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
        [column.table, column.column]);
    } catch (e) {
      debug(`Unable to link column ${column.column} and table ${column.table} due to: ${e.message}`);
    }
  }));

  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select "column" from oracle.columns)', [columnType]);
}

// Finds and links databases that have dblinks between them.
async function writeOracleRoleFromDatabases(pgpool) {
  const { rows: foreignServers } = await pgpool.query(`
    select
      foreign_servers.foreign_server_log,
      foreign_servers.database,
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
      oracle.foreign_servers
      join oracle.databases on foreign_servers.database = databases.database
  `, []);

  const databaseType = (await pgpool.query('select "type" from metadata.node_types where name = \'oracle/databases\'')).rows[0].type;
  const roleType = (await pgpool.query('select "type" from metadata.node_types where name = \'oracle/roles\'')).rows[0].type;

  await Promise.all(foreignServers.map(async (server) => {
    try {
      const { name, host, port } = parseOracleTNS(server.connection);
      const { rows: [db] } = await pgpool.query(`
        insert into oracle.databases_log (database, name, host, port, deleted)
        values (uuid_generate_v4(), $1, $2, $3, $4)
        on conflict (name, host, port, deleted) 
        do update set name = $1 
        returning database, host, port, name
      `, [name, host, port, false]);
      const { rows: roles } = await pgpool.query(`
        select role, database, username from oracle.roles_log where database = $1 and username = $2
      `, [db.database, server.username]);
      let role = roles[0];
      if (roles.length === 0) {
        const { rows: newRoles } = await pgpool.query(`
          insert into oracle.roles_log (role, database, username, password, options) values (uuid_generate_v4(), $1, $2, '{}'::jsonb, '{}'::jsonb) returning role, database, username
        `, [db.database, server.username]);
        role = newRoles[0]; // eslint-disable-line prefer-destructuring
      }
      await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do nothing',
        [role.role, role.username, roleType]);
      await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do nothing',
        [server.database, `${server.from_host}:${server.from_port}/${server.from_name}`, databaseType]);
      await pgpool.query('insert into metadata.nodes (node, name, type) values ($1, $2, $3) on conflict (node) do nothing',
        [db.database, `${db.host}:${db.port}/${db.name}`, databaseType]);
      await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
        [server.database, role.role]);
      await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing',
        [role.role, db.database]);
    } catch (e) {
      debug(`Unable to link database ${server.database} and foreign server ${server.foreign_server_log} due to: ${e.message}`);
    }
  }));

  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select database from oracle.databases)', [databaseType]);
  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select role from oracle.roles)', [roleType]);
}

async function init() {} // eslint-disable-line no-empty-function

async function run(pgpool) {
  await writeOracleRoleFromDatabases(pgpool);
  await writeOracleTablesFromDatabases(pgpool);
  await writeOracleColumnsFromTables(pgpool);
}

module.exports = {
  run,
  init,
};
