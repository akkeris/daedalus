const assert = require('assert');
const pg = require('pg');
const fs = require('fs');
const debug = require('debug')('daedalus:postgresql');
const security = require('../../common/security.js');

async function init(pgpool) {
  debug('Initializing postgresql plugin...');
  await pgpool.query(fs.readFileSync('./plugins/postgresql/create.sql').toString());
  debug('Initializing postgresql plugin... done');
}

function findConstraintId(constraints, database, name, type, fromCatalog, fromSchema, fromTable, fromColumn, toCatalog, toSchema, toTable, toColumn) { // eslint-disable-line max-len
  return constraints.filter((constraint) => constraint.database === database
    && constraint.from_catalog === fromCatalog
    && constraint.from_schema === fromSchema
    && constraint.from_table === fromTable
    && constraint.from_column === fromColumn
    && constraint.to_catalog === toCatalog
    && constraint.to_schema === toSchema
    && constraint.to_table === toTable
    && constraint.to_column === toColumn
    && constraint.type === type
    && constraint.name === name)[0];
}

function findIndexId(indexes, database, catalog, schema, table, name) {
  return indexes.filter((index) => index.database === database
    && index.catalog === catalog
    && index.schema === schema
    && index.table === table
    && index.name === name)[0];
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

// TODO: Fix the issue if there's a state flip back to the original state the diff breaks.
// e.g. drop a column and re-add it (exactly how it was). The system can't handle that.
// e.g. change the port of a database to 1 from 5432 then back 5432, breaks.

// TODO: Listen for changes via triggers and channels?
// https://www.postgresql.org/docs/9.1/sql-notify.html

async function writeTablesViewsAndColumns(pgpool, database) {
  assert.ok(database, 'A database parameter was not provided!');
  if (!database.database || !database.port || !database.name) {
    console.error(`  Error: Unable to process posgres://${database.username}@${database.host}:${database.port}/${database.name} as a required field was not provided.`); // eslint-disable-line no-console
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
    statement_timeout: 15000,
    query_timeout: 15000,
  });
  try {
    await client.connect();

    const tables = (await Promise.all((await client.query(`
      select 
        table_catalog, table_schema, table_name
      from 
        information_schema.tables
      where 
        tables.table_schema <> 'information_schema' and 
        tables.table_schema not like 'pg_%' and 
        tables.table_type = 'BASE TABLE'
    `, [])).rows.map((table) => pgpool.query(`
      insert into postgresql.tables_log 
        ("table", database, catalog, schema, name, is_view, definition, deleted)
      values 
        (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
      on conflict (database, catalog, schema, name, is_view, definition, deleted)
      do update set name = $4
      returning "table", database, catalog, schema, name
    `, [database.database, table.table_catalog, table.table_schema, table.table_name, false, '', false]))))
      .map((x) => x.rows).flat();

    const views = (await Promise.all((await client.query(`
      select 
        table_catalog, table_schema, table_name, view_definition
      from information_schema.views
      where 
        views.table_schema <> 'information_schema' and 
        views.table_schema not like 'pg_%'
    `, [])).rows.map((view) => pgpool.query(`
      insert into postgresql.tables_log 
        ("table", database, catalog, schema, name, is_view, definition, deleted)
      values 
        (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
      on conflict (database, catalog, schema, name, is_view, definition, deleted)
      do update set name = $4
      returning "table", database, catalog, schema, name
    `, [database.database, view.table_catalog, view.table_schema, view.table_name, true, view.view_definition || '', false]))))
      .map((x) => x.rows).flat();

    const columns = (await Promise.all((await client.query(`
      select 
        table_catalog, table_schema, table_name, column_name, ordinal_position, column_default, is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable
      from 
        information_schema.columns
      where 
        columns.table_schema <> 'information_schema' and columns.table_schema <> 'pg_catalog'
    `, [])).rows.map((column) => pgpool.query(`
      insert into postgresql.columns_log 
        ("column", database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, deleted)
      values 
        (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      on conflict (database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, deleted) 
      do update set name = $5
      returning "column", database, catalog, schema, "table", name
    `, [database.database, column.table_catalog, column.table_schema, findTableOrViewId(tables, views, database.database, column.table_catalog, column.table_schema, column.table_name).table, column.column_name, column.ordinal_position, column.column_default || '', column.is_nullable, column.data_type, column.character_maximum_length || 0, column.character_octet_length || 0, column.numeric_precision || 0, column.numeric_precision_radix || 0, column.numeric_scale || 0, column.datetime_precision || 0, column.is_updatable || true, false]))))
      .map((x) => x.rows).flat();

    const indexes = (await Promise.all((await client.query(`
      select 
        schemaname, tablename, indexname, tablespace, indexdef
      from 
        pg_catalog.pg_indexes
      where 
        pg_indexes.schemaname <> 'information_schema' and pg_indexes.schemaname <> 'pg_catalog'
    `, [])).rows.map((index) => pgpool.query(`
      insert into postgresql.indexes_log 
        ("index", "table", database, catalog, schema, name, definition, deleted)
      values 
        (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
      on conflict (database, catalog, schema, "table", name, definition, deleted) 
      do update set name = $5
      returning "index", "table", database, catalog, schema, name, definition
    `, [findTableOrViewId(tables, views, database.database, database.name, index.schemaname, index.tablename).table, database.database, database.name, index.schemaname, index.indexname, index.indexdef, false]))))
      .map((x) => x.rows).flat();

    const constraints = (await client.query(`
       with constraints as (
        select 
          constraint_catalog, constraint_schema, constraint_name, unique_constraint_catalog, unique_constraint_schema, unique_constraint_name, '' as "check_clause"
        from information_schema.referential_constraints
        union all
        select 
          constraint_catalog, constraint_schema, constraint_name, constraint_catalog as "unique_constraint_catalog", constraint_schema as "unique_constraint_schema", constraint_name as "unique_constraint_name", check_clause
        from information_schema.check_constraints
      )
      select
        from_table.constraint_name,
        from_table.constraint_type,
        from_table.constraint_catalog as from_catalog,
        from_table.constraint_schema as from_schema,
        from_table.table_name as from_table_name,
        coalesce(from_column_primary_key.column_name, from_column_foriegn_key.column_name) as from_column_name,
        constraints.unique_constraint_catalog as to_catalog,
        constraints.unique_constraint_schema as to_schema,
        to_table.table_name as to_table_name,
        to_column.column_name as to_column_name,
        constraints.check_clause
      from information_schema.table_constraints as from_table
        left join constraints on constraints.constraint_catalog = from_table.constraint_catalog and from_table.constraint_schema = constraints.constraint_schema and from_table.constraint_name = constraints.constraint_name
        left join information_schema.constraint_column_usage as from_column_primary_key on (
           from_column_primary_key.constraint_catalog = from_table.constraint_catalog and
           from_column_primary_key.constraint_schema = from_table.constraint_schema and
           from_column_primary_key.constraint_name = from_table.constraint_name and
           from_table.constraint_type = 'PRIMARY KEY'
        )
        left join information_schema.key_column_usage as from_column_foriegn_key on (
           from_column_foriegn_key.constraint_catalog = from_table.constraint_catalog and
           from_column_foriegn_key.constraint_schema = from_table.constraint_schema and
           from_column_foriegn_key.constraint_name = from_table.constraint_name and
           from_table.constraint_type = 'FOREIGN KEY'
        )
        left join information_schema.table_constraints as to_table on to_table.constraint_catalog = constraints.unique_constraint_catalog and to_table.constraint_schema = constraints.unique_constraint_schema and to_table.constraint_name = constraints.unique_constraint_name
        left join information_schema.constraint_column_usage as to_column on to_column.constraint_catalog = constraints.unique_constraint_catalog and to_column.constraint_schema = constraints.unique_constraint_schema and to_column.constraint_name = constraints.unique_constraint_name
      where
        from_table.constraint_schema not like 'pg_%' and from_table.constraint_schema <> 'information_schema'
    `, [])).rows;

    const primaryKeyConstraints = (await Promise.all(constraints.filter((x) => x.constraint_type === 'PRIMARY KEY').map((constraint) => {
      const tableUUID = findTableOrViewId(tables, views, database.database, constraint.from_catalog, constraint.from_schema, constraint.from_table_name).table; // eslint-disable-line max-len
      assert(tableUUID, `The table UUID was not found for a primary key constraint on catalog: ${constraint.from_catalog} schema: ${constraint.from_schema} table: ${constraint.from_table_name}`);
      const columnUUID = findColumnId(columns, database.database, constraint.from_catalog, constraint.from_schema, tableUUID, constraint.from_column_name).column; // eslint-disable-line max-len
      assert(columnUUID, `The column UUID was not found for a primary key constraint on catalog: ${constraint.from_catalog} schema: ${constraint.from_schema} table: ${constraint.from_table_name} ${constraint.from_column_name}`);
      return pgpool.query(`
        insert into postgresql.constraints_log 
          ("constraint", database, name, type, from_catalog, from_schema, from_table, from_column, deleted)
        values 
          (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (database, name, "type", from_catalog, from_schema, from_table, from_column, deleted) where "type" = 'PRIMARY KEY'
        do update set name = $2
        returning "constraint", database, name, type, from_catalog, from_schema, from_table, from_column, deleted
      `, [database.database, constraint.constraint_name, constraint.constraint_type, constraint.from_catalog, constraint.from_schema, tableUUID, columnUUID, false]);
    }))).map((x) => x.rows).flat();

    const foreignKeyConstraints = (await Promise.all(constraints.filter((x) => x.constraint_type === 'FOREIGN KEY').map((constraint) => {
      const fromTableUUID = findTableOrViewId(tables, views, database.database, constraint.from_catalog, constraint.from_schema, constraint.from_table_name).table; // eslint-disable-line max-len
      const fromColumnUUID = findColumnId(columns, database.database, constraint.from_catalog, constraint.from_schema, fromTableUUID, constraint.from_column_name).column; // eslint-disable-line max-len
      const toTableUUID = findTableOrViewId(tables, views, database.database, constraint.to_catalog, constraint.to_schema, constraint.to_table_name).table; // eslint-disable-line max-len
      const toColumnUUID = findColumnId(columns, database.database, constraint.to_catalog, constraint.to_schema, toTableUUID, constraint.to_column_name).column; // eslint-disable-line max-len
      assert(fromTableUUID, `The table UUID was not found for a foreign key constraint on catalog: ${constraint.from_catalog} schema: ${constraint.from_schema} table: ${constraint.from_table_name}`);
      assert(fromColumnUUID, `The column UUID was not found for a foreign key constraint on catalog: ${constraint.from_catalog} schema: ${constraint.from_schema} table: ${constraint.from_table_name} ${constraint.from_column_name}`);
      assert(toTableUUID, `The table UUID was not found for a foreign key constraint on catalog: ${constraint.to_catalog} schema: ${constraint.to_schema} table: ${constraint.to_table_name}`);
      assert(toColumnUUID, `The column UUID was not found for a foreign key constraint on catalog: ${constraint.to_catalog} schema: ${constraint.to_schema} table: ${constraint.to_table_name} ${constraint.to_column_name}`);
      return pgpool.query(`
        insert into postgresql.constraints_log 
          ("constraint", database, name, type, from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted)
        values 
          (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        on conflict (database, name, type, from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted) where "type" = 'FORIEGN KEY'
        do update set name = $2
        returning "constraint", database, name, type, from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted
      `, [database.database, constraint.constraint_name, constraint.constraint_type, constraint.from_catalog, constraint.from_schema, fromTableUUID, fromColumnUUID, constraint.to_catalog, constraint.to_schema, toTableUUID, toColumnUUID, false]);
    }))).map((x) => x.rows).flat();

    const checkConstraints = (await Promise.all(constraints.filter((x) => x.constraint_type === 'CHECK').map((constraint) => {
      const tableUUID = findTableOrViewId(tables, views, database.database, constraint.from_catalog, constraint.from_schema, constraint.from_table_name).table; // eslint-disable-line max-len
      let columnUUID = findColumnId(columns, database, constraint.from_catalog, constraint.from_schema, tableUUID, constraint.from_column_name); // eslint-disable-line max-len
      if (columnUUID) {
        columnUUID = columnUUID.column;
      } else {
        columnUUID = null;
      }
      assert(tableUUID, `The table UUID was not found for a check constraint on catalog: ${constraint.from_catalog} schema: ${constraint.from_schema} table: ${constraint.from_table_name}`);
      return pgpool.query(`
        insert into postgresql.constraints_log 
          ("constraint", database, name, type, from_catalog, from_schema, from_table, from_column, check_clause, deleted)
        values 
          (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (database, name, type, from_catalog, from_schema, from_table, check_clause, deleted) where "type" = 'CHECK'
        do update set name = $2
        returning "constraint", database, name, type, from_catalog, from_schema, from_table, check_clause, deleted
      `, [database.database, constraint.constraint_name, constraint.constraint_type, constraint.from_catalog, constraint.from_schema, tableUUID, columnUUID, constraint.check_clause, false]);
    }))).map((x) => x.rows).flat();

    // Table Estimates
    (await Promise.all((await client.query(`
      select
        pg_class.reltuples::bigint as rows,
        pg_indexes_size(pg_class.oid) AS index_size,
        pg_table_size(pg_class.oid) AS table_size,
        pg_class.relname as table_name,
        pg_stat_user_tables.seq_scan,
        CASE pg_stat_user_tables.idx_scan WHEN 0 THEN 0::float ELSE (pg_stat_user_tables.idx_scan::float / (pg_stat_user_tables.seq_scan + pg_stat_user_tables.idx_scan)::float)::float END percent_of_times_index_used,
        pg_cache_hits.index_hit_rate,
        pg_cache_hits.table_hit_rate,
        pg_namespace.nspname as schema
      from pg_class
        join pg_stat_user_tables on pg_class.oid = pg_stat_user_tables.relid
        join (
          select
            pg_statio_user_indexes.relid,
            sum(pg_statio_user_indexes.idx_blks_hit) / nullif(sum(pg_statio_user_indexes.idx_blks_hit + pg_statio_user_indexes.idx_blks_read),0) AS index_hit_rate,
            sum(pg_statio_user_tables.heap_blks_hit) / nullif(sum(pg_statio_user_tables.heap_blks_hit) + sum(pg_statio_user_tables.heap_blks_read),0) AS table_hit_rate
            from pg_statio_user_indexes join pg_statio_user_tables on pg_statio_user_tables.relid = pg_statio_user_indexes.relid
            group by pg_statio_user_indexes.relid
        ) as pg_cache_hits on pg_class.oid = pg_cache_hits.relid
        join pg_namespace on
          pg_class.relnamespace = pg_namespace.oid and
          pg_class.reltype <> 0 and
          pg_class.relkind = 'r' and
          pg_namespace.nspname not like 'pg_%' and
          pg_namespace.nspname <> 'information_schema'
    `, [])).rows.map((estimate) => pgpool.query(`
      insert into postgresql.table_statistics_log 
        ("table_statistic", database, catalog, schema, "table", row_amount_estimate, index_size, table_size, sequential_scans, percent_of_times_index_used, index_hit_rate, table_hit_rate, deleted)
      values
        (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      on conflict do nothing
    `, [database.database, database.name, estimate.schema, findTableOrViewId(tables, views, database.database, database.name, estimate.schema, estimate.table_name).table, estimate.rows, estimate.index_size, estimate.table_size, estimate.seq_scan, estimate.percent_of_times_index_used, estimate.index_hit_rate || 0, estimate.table_hit_rate || 0, false]))));

    // Database Connection Statistics
    (await Promise.all((await client.query(`
      select 
        max_connections, 
        used_connections, 
        reserved_connections, 
        max_connections - used_connections - reserved_connections as available_connections 
      from 
        (select (count(*) - 1) used_connections from pg_stat_activity where datname = $1) a, 
        (select setting::int reserved_connections from pg_settings where name=$$superuser_reserved_connections$$) b, 
        (select setting::int max_connections from pg_settings where name=$$max_connections$$) c
    `, [database.name])).rows.map((estimate) => pgpool.query(`
      insert into postgresql.database_statistics_log
        ("database_statistic", database, max_connections, used_connections, reserved_connections, available_connections, deleted)
      values
        (uuid_generate_v4(), $1, $2, $3, $4, $5, $6)
      on conflict do nothing
    `, [database.database, estimate.max_connections, estimate.used_connections, estimate.reserved_connections, estimate.available_connections, false]))));

    // TODO: This is not tracking changes to the config, it should.
    //       Probably should be its own log table.
    const config = (await client.query('show all')).rows.reduce((acc, x) => ({ ...acc, [x.name]: { value: x.setting, description: x.description } }), {});
    await pgpool.query('update postgresql.databases_log set config = $2 where database = $1',
      [database.database, config]);

    // TODO: User defined data types, Foreign data wrappers, foreign tables, foreign servers
    // TODO: Long running queries, Locks, Vacuum statistics, pg_settings?

    // Check for table deletion
    await Promise.all((await pgpool.query('select "table", database, catalog, schema, name, is_view, definition from postgresql.tables where database = $1', [database.database]))
      .rows
      .map(async (tableOrView) => {
        if (!findTableOrViewId(tables, views, database.database, tableOrView.catalog, tableOrView.schema, tableOrView.name)) { // eslint-disable-line max-len
          await pgpool.query(`
            insert into postgresql.tables_log 
              ("table", database, catalog, schema, name, is_view, definition, deleted)
            values 
              (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
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
          insert into postgresql.columns_log 
            ("column", database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, deleted)
          values 
            (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          on conflict (database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, deleted) 
          do update set deleted = true`,
          [column.database, column.catalog, column.schema, column.table, column.name, column.position, column.default, column.is_nullable, column.data_type, column.character_maximum_length, column.character_octet_length, column.numeric_precision, column.numeric_precision_radix, column.numeric_scale, column.datetime_precision, column.is_updatable, true]); // eslint-disable-line max-len
        }
      }));

    // Check for index deletion
    await Promise.all((await pgpool.query('select "index", database, catalog, schema, "table", name, definition from postgresql.indexes where database = $1', [database.database]))
      .rows
      .map(async (index) => {
        if (!findIndexId(indexes, database.database, index.catalog, index.schema, index.table, index.name)) { // eslint-disable-line max-len
          await pgpool.query(`
          insert into postgresql.indexes_log 
            ("index", database, catalog, schema, "table", name, definition, deleted)
          values 
            (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
          on conflict (database, catalog, schema, "table", name, definition, deleted) 
          do update set deleted = true`,
          [database.database, index.catalog, index.schema, index.table, index.name, index.definition, true]); // eslint-disable-line max-len
        }
      }));

    // Check for primary key deletion
    await Promise.all((await pgpool.query('select "constraint", database, name, type, from_catalog, from_schema, from_table, from_column from postgresql.constraints where database = $1 and type = \'PRIMARY KEY\'', [database.database]))
      .rows
      .map(async (constraint) => {
        if (!findConstraintId(primaryKeyConstraints, database.database, constraint.name, constraint.type, constraint.from_catalog, constraint.from_schema, constraint.from_table, constraint.from_column)) { // eslint-disable-line max-len
          await pgpool.query(`
          insert into postgresql.constraints_log 
            ("constraint", database, name, "type", from_catalog, from_schema, from_table, from_column, deleted)
          values 
            (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8)
          on conflict (database, name, "type", from_catalog, from_schema, from_table, from_column, deleted) where "type" = 'PRIMARY KEY'
          do update set deleted = true`,
          [database.database, constraint.name, constraint.type, constraint.from_catalog, constraint.from_schema, constraint.from_table, constraint.from_column, true]); // eslint-disable-line max-len
        }
      }));

    // Check for foreign key deletion
    await Promise.all((await pgpool.query('select "constraint", database, name, type, from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column from postgresql.constraints where database = $1 and type = \'FOREIGN KEY\'', [database.database]))
      .rows
      .map(async (constraint) => {
        if (!findConstraintId(foreignKeyConstraints, database.database, constraint.name, constraint.type, constraint.from_catalog, constraint.from_schema, constraint.from_table, constraint.from_column, constraint.to_catalog, constraint.to_schema, constraint.to_table, constraint.to_column)) { // eslint-disable-line max-len
          await pgpool.query(`
          insert into postgresql.constraints_log 
            ("constraint", database, name, "type", from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted) 
          values 
            (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          on conflict (database, name, "type", from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted) where "type" = 'FOREIGN KEY'
          do update set deleted = true`,
          [database.database, constraint.name, constraint.type, constraint.from_catalog, constraint.from_schema, constraint.from_table, constraint.from_column, constraint.to_catalog, constraint.to_schema, constraint.to_table, constraint.to_column, true]); // eslint-disable-line max-len
        }
      }));

    // Check for check constraint deletion
    await Promise.all((await pgpool.query('select "constraint", database, name, type, from_catalog, from_schema, from_table, from_column, check_clause from postgresql.constraints where database = $1 and type = \'CHECK\'', [database.database]))
      .rows
      .map(async (constraint) => {
        if (!findConstraintId(checkConstraints, database.database, constraint.name, constraint.type, constraint.from_catalog, constraint.from_schema, constraint.from_table, constraint.from_column, constraint.to_catalog, constraint.to_schema, constraint.to_table, constraint.to_column)) { // eslint-disable-line max-len
          await pgpool.query(`
          insert into postgresql.constraints_log 
            ("constraint", database, name, "type", from_catalog, from_schema, from_table, from_column, check_clause, deleted) 
          values 
            (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
          on conflict (database, name, "type", from_catalog, from_schema, from_table, check_clause, deleted) where "type" = 'CHECK'
          do update set deleted = true`,
          [database.database, constraint.name, constraint.type, constraint.from_catalog, constraint.from_schema, constraint.from_table, constraint.from_column, constraint.check_clause, true]); // eslint-disable-line max-len
        }
      }));
  } catch (e) {
    if (e.message.includes('password authentication failed')) {
      console.error(`  Error: ${e.message}`); // eslint-disable-line no-console
    } else {
      // This could get here because of a timeout
      //
      // TODO: Check for db deletion?
      // How do we do this, if the host is unavailalbe we shouldn't assume the db is unavailable,
      // if the password is changed, what should we do? if the database no longer exists should
      // we remove it?
      console.log(`=== Error posgres://${database.username}@${database.host}:${database.port}/${database.name}`); // eslint-disable-line no-console
      console.error(e); // eslint-disable-line no-console
      console.log(`=== Error posgres://${database.username}@${database.host}:${database.port}/${database.name}`); // eslint-disable-line no-console
    }
  } finally {
    debug(`Done writing tables, views and columns for posgres://${database.username}@${database.host}:${database.port}/${database.name} database...`); // eslint-disable-line max-len
    await client.end();
  }
  /* /END critical section */
}

async function run(pgpool) {
  debug('Running postgresql plugin...');
  await pgpool.query(fs.readFileSync('./plugins/postgresql/create.sql').toString());
  if (process.env.POSTGRESQL !== 'true') {
    return;
  }
  (await Promise.all((await pgpool.query(`
    select 
      databases.database, databases.name, databases.host, databases.port,
      roles.username, roles.password, roles.options
    from 
      postgresql.databases 
      join postgresql.roles on roles.database = databases.database`, []))
    .rows
    .map((database) => ({ ...database, password: security.decryptValue(process.env.SECRET, database.password).toString('utf8') }))
    .map((database) => writeTablesViewsAndColumns(pgpool, database))));
}

module.exports = {
  init,
  run,
};
