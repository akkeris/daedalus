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
      postgresql.tables
      join postgresql.databases on tables.database = databases.database
  `);
  debug(`Examining ${tables.length} postgresql tables.`);

  const databaseType = (await pgpool.query('select "type" from metadata.node_types where name = \'postgresql/databases\'')).rows[0].type;
  const tableType = (await pgpool.query('select "type" from metadata.node_types where name = \'postgresql/tables\'')).rows[0].type;
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
  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select "table" from postgresql.tables)', [tableType]);
}

async function writePostgresqlColumnsFromTables(pgpool) {
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
      postgresql.columns
        join postgresql.tables on columns.table = tables.table
  `);
  debug(`Examining ${columns.length} postgresql columns.`);

  const columnType = (await pgpool.query('select "type" from metadata.node_types where name = \'postgresql/columns\'')).rows[0].type;

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

  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select "column" from postgresql.columns)', [columnType]);
}

// Finds and links databases that have dblinks between them.
async function writePostgresqlRoleFromDatabases(pgpool) {
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
      postgresql.foreign_servers
      join postgresql.databases on foreign_servers.database = databases.database
  `, []);

  const databaseType = (await pgpool.query('select "type" from metadata.node_types where name = \'postgresql/databases\'')).rows[0].type;
  const roleType = (await pgpool.query('select "type" from metadata.node_types where name = \'postgresql/roles\'')).rows[0].type;

  await Promise.all(foreignServers.map(async (server) => {
    try {
      const { name, host, port } = parseServerOptions(server.connection);
      const { rows: [db] } = await pgpool.query(`
        insert into postgresql.databases_log (database, name, host, port, deleted)
        values (uuid_generate_v4(), $1, $2, $3, $4)
        on conflict (name, host, port, deleted) 
        do update set name = $1 
        returning database, host, port, name
      `, [name, host, port, false]);
      const { rows: roles } = await pgpool.query(`
        select role, database, username from postgresql.roles_log where database = $1 and username = $2
      `, [db.database, server.username]);
      let role = roles[0];
      if (roles.length === 0) {
        const { rows: newRoles } = await pgpool.query(`
          insert into postgresql.roles_log (role, database, username, password, options) values (uuid_generate_v4(), $1, $2, '{}'::jsonb, '{}'::jsonb) returning role, database, username
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

  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select database from postgresql.databases)', [databaseType]);
  await pgpool.query('delete from only metadata.nodes where nodes."type" = $1 and nodes.node not in (select role from postgresql.roles)', [roleType]);
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
