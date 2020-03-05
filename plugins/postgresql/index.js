const assert = require('assert');
const pg = require('pg');
const fs = require('fs');
const debug = require('debug')('daedalus:postgresql');

async function init(pgpool) {
  debug('Initializing postgresql plugin...');
  await pgpool.query(fs.readFileSync('./plugins/postgresql/create.sql').toString());
}

function findTableOrViewId(tables, views, database, catalog, schema, name) {
  return tables.filter((table) => table.database === database && table.catalog === catalog && table.schema === schema && table.name)
    .concat(views.filter((view) => view.database === database && view.catalog === catalog && view.schema === schema && view.name))[0];
}

async function writeTablesViewsAndColumns(pgpool, database) {
  assert.ok(database, 'No database was passed in');
  assert.ok(database.database, 'No database uuid was passed in');
  assert.ok(database.port, 'No database port was passed in');
  assert.ok(database.name, 'No database name was passed in');
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

    let tables = await Promise.all((await client.query(`
      select table_catalog, table_schema, table_name
      from information_schema.tables
      where tables.table_schema <> 'information_schema' and tables.table_schema <> 'pg_catalog' and tables.table_type = 'BASE TABLE'
    `, [])).rows.map((table) => pgpool.query(`
      insert into postgresql.tables_log ("table", database, catalog, schema, name, is_view, definition)
      values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6)
      on conflict (database, catalog, schema, name, is_view, definition)
      do update set observed_on = now()
      returning "table", database, catalog, schema, name
    `, [database.database, table.table_catalog, table.table_schema, table.table_name, false, ''])));

    let views = await Promise.all((await client.query(`
      select table_catalog, table_schema, table_name, view_definition
      from information_schema.views
      where views.table_schema <> 'information_schema' and views.table_schema <> 'pg_catalog'
    `, [])).rows.map((view) => pgpool.query(`
      insert into postgresql.tables_log ("table", database, catalog, schema, name, is_view, definition)
      values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6)
      on conflict (database, catalog, schema, name, is_view, definition)
      do update set observed_on = now()
      returning "table", database, catalog, schema, name
    `, [database.database, view.table_catalog, view.table_schema, view.table_name, true, view.view_definition || ''])));

    await Promise.all((await client.query(`
      select table_catalog, table_schema, table_name, column_name, ordinal_position, column_default, is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable
      from information_schema.columns
      where columns.table_schema <> 'information_schema' and columns.table_schema <> 'pg_catalog'
    `, [])).rows.map((column) => pgpool.query(`
      insert into postgresql.columns_log ("column", database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable)
      values (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      on conflict (database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable) 
      do nothing
    `, [database.database, column.table_catalog, column.table_schema, findTableOrViewId(tables.map((x) => x.rows).flat(), views.map((x) => x.rows).flat(), database.database, column.table_catalog, column.table_schema, column.table_name).table, column.column_name, column.ordinal_position, column.column_default || '', column.is_nullable, column.data_type, column.character_maximum_length || 0, column.character_octet_length || 0, column.numeric_precision || 0, column.numeric_precision_radix || 0, column.numeric_scale || 0, column.datetime_precision || 0, column.is_updatable || true])));

    // TODO: add checks for deletion
    
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
  /* /END critical section */
  return database;
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
    .map((database) => writeTablesViewsAndColumns(pgpool, database)));
}

module.exports = {
  init,
  run,
};
