const assert = require('assert');
const pg = require('pg');
const fs = require('fs');
const debug = require('debug')('daedalus:postgresql');

async function init(pgpool) {
  debug('Initializing postgresql plugin...');
  await pgpool.query(fs.readFileSync('./plugins/postgresql/create.sql').toString());
}

function findColumnId(columns, database, catalog, schema, table, name) {
  return columns.filter((column) => column.database === database
    && column.catalog === catalog
    && column.schema === schema
    && column.table === table
    && column.name === name)[0];
}

function findTableOrViewId(tables, views, database, catalog, schema, name) {
  return tables.filter((table) => table.database === database
    && table.catalog === catalog
    && table.schema === schema
    && table.name === name)
    .concat(views.filter((view) => view.database === database
      && view.catalog === catalog
      && view.schema === schema
      && view.name === name))[0];
}

// TODO: Listen for changes via triggers and channels
// https://www.postgresql.org/docs/9.1/sql-notify.html

async function writeTablesViewsAndColumns(pgpool, database) {
  assert.ok(database, 'A database parameter was not provided!');
  if (!database.database || !database.port || !database.name) {
    console.error(`   Error: Unable to process posgres://${database.username}@${database.host}:${database.port}/${database.name} as a required field was not provided.`); // eslint-disable-line no-console
    return;
  }
  debug(`Writing tables, views and columns for posgres://${database.username}@${database.host}:${database.port}/${database.name} database...`); // eslint-disable-line max-len
  /* CRITICAL SECTION
   * Be very careful modifying code below until the end of the critical section,
   * failing to test carefully could result in destructive actions. The code
   * below must elegantly disconnect from the postgres instance during an error.
   * Failing to do so would cause connection leaks.
   */
  const client = new pg.Client({
    user: database.username,
    password: database.password,
    host: database.host,
    database: database.name,
    port: database.port,
    statement_timeout: 3000,
    query_timeout: 3000,
  });
  try {
    await client.connect();

    const tables = (await Promise.all((await client.query(`
      select table_catalog, table_schema, table_name
      from information_schema.tables
      where tables.table_schema <> 'information_schema' and tables.table_schema <> 'pg_catalog' and tables.table_type = 'BASE TABLE'
    `, [])).rows.map((table) => pgpool.query(`
      insert into postgresql.tables_log ("table", database, catalog, schema, name, is_view, definition, deleted)
      values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
      on conflict (database, catalog, schema, name, is_view, definition, deleted)
      do update set observed_on = now()
      returning "table", database, catalog, schema, name
    `, [database.database, table.table_catalog, table.table_schema, table.table_name, false, '', false]))))
      .map((x) => x.rows).flat();

    const views = (await Promise.all((await client.query(`
      select table_catalog, table_schema, table_name, view_definition
      from information_schema.views
      where views.table_schema <> 'information_schema' and views.table_schema <> 'pg_catalog'
    `, [])).rows.map((view) => pgpool.query(`
      insert into postgresql.tables_log ("table", database, catalog, schema, name, is_view, definition, deleted)
      values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
      on conflict (database, catalog, schema, name, is_view, definition, deleted)
      do update set observed_on = now()
      returning "table", database, catalog, schema, name
    `, [database.database, view.table_catalog, view.table_schema, view.table_name, true, view.view_definition || '', false]))))
      .map((x) => x.rows).flat();

    const columns = (await Promise.all((await client.query(`
      select table_catalog, table_schema, table_name, column_name, ordinal_position, column_default, is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable
      from information_schema.columns
      where columns.table_schema <> 'information_schema' and columns.table_schema <> 'pg_catalog'
    `, [])).rows.map((column) => pgpool.query(`
      insert into postgresql.columns_log ("column", database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, deleted)
      values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      on conflict (database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, deleted) 
      do update set observed_on = now()
      returning "column", database, catalog, schema, "table", name
    `, [database.database, column.table_catalog, column.table_schema, findTableOrViewId(tables, views, database.database, column.table_catalog, column.table_schema, column.table_name).table, column.column_name, column.ordinal_position, column.column_default || '', column.is_nullable, column.data_type, column.character_maximum_length || 0, column.character_octet_length || 0, column.numeric_precision || 0, column.numeric_precision_radix || 0, column.numeric_scale || 0, column.datetime_precision || 0, column.is_updatable || true, false]))))
      .map((x) => x.rows).flat();

    // == definition ==
    // TODO: Indexes
    // TODO: User defined data types
    // TODO: Foreign data wrappers, foreign tables, foreign servers
    // == statistics ==
    // TOOD: Table row count
    // TODO: Long running queries
    // TODO: Amount of connections
    // TODO: Amount of space taken (by table? by index? by db?)
    // TODO: Index hit and misses, index usage rate (+99% for effectiveness)
    // TODO: Locks
    // TODO: Vacuum statistics

    // Check for table deletion
    await Promise.all((await pgpool.query('select "table", database, catalog, schema, name, is_view, definition from postgresql.tables where database = $1', [database.database]))
      .rows
      .map(async (tableOrView) => {
        if (!findTableOrViewId(tables, views, database.database, tableOrView.catalog, tableOrView.schema, tableOrView.name)) { // eslint-disable-line max-len
          await pgpool.query(`
            insert into postgresql.tables_log ("table", database, catalog, schema, name, is_view, definition, deleted)
            values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
            on conflict (database, catalog, schema, name, is_view, definition, deleted)
            do update set deleted = true`,
          [tableOrView.database, tableOrView.catalog, tableOrView.schema, tableOrView.name, tableOrView.is_view, tableOrView.definition, true]); // eslint-disable-line max-len
        }
      }));

    // Check for column deletion
    await Promise.all((await pgpool.query('select "column", database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable from postgresql.columns where database = $1', [database.database]))
      .rows
      .map(async (column) => {
        if (!findColumnId(columns, database.database, column.catalog, column.schema, column.table, column.name)) { // eslint-disable-line max-len
          await pgpool.query(`
          insert into postgresql.columns_log ("column", database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, deleted)
          values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          on conflict (database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, deleted) 
          do update set deleted = true`,
          [column.database, column.catalog, column.schema, column.table, column.name, column.position, column.default, column.is_nullable, column.data_type, column.character_maximum_length, column.character_octet_length, column.numeric_precision, column.numeric_precision_radix, column.numeric_scale, column.datetime_precision, column.is_updatable, true]); // eslint-disable-line max-len
        }
      }));
  } catch (e) {
    if (e.message.includes('password authentication failed')) {
      console.error(`  Error: ${e.message}`); // eslint-disable-line no-console
    } else {
      // TODO: Check for db deletion?
      // How do we do this, if the host is unavailalbe we shouldn't assume the db is unavailable,
      // if the password is changed, what should we do? if the database no longer exists should
      // we remove it?
      console.error(e); // eslint-disable-line no-console
    }
  } finally {
    await client.end();
  }
  /* /END critical section */
}

async function run(pgpool) {
  debug('Running postgresql plugin...');
  await Promise.all((await pgpool.query(`
    select 
      databases.database, databases.name, databases.host, databases.port,
      roles.username, roles.password, roles.options
    from 
      postgresql.databases 
      join postgresql.roles on roles.database = databases.database`, []))
    .rows
    .forEach((database) => writeTablesViewsAndColumns(pgpool, database)));
}

module.exports = {
  init,
  run,
};
