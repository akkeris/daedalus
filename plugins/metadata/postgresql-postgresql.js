const debug = require('debug')('daedalus:metadata');

async function writePostgresqlTablesFromDatabases(pgpool) {
  const { rows: tables } = await pgpool.query(`
    select
      "table",
      database,
      catalog,
      schema,
      name,
      is_view,
      definition,
      observed_on
    from
      postgresql.tables
  `);
  debug(`Examining ${tables.length} postgresql tables.`);

  const tableType = (await pgpool.query('select "type" from metadata.node_types where name = \'postgresql/tables\'')).rows[0].type;
  await Promise.all(tables.map(async (table) => {
    try {
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

async function init() {} // eslint-disable-line no-empty-function

async function run(pgpool) {
  await writePostgresqlTablesFromDatabases(pgpool);
  await writePostgresqlColumnsFromTables(pgpool);
}

module.exports = {
  run,
  init,
};
