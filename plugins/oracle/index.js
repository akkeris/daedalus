const assert = require('assert');
const fs = require('fs');
const debug = require('debug')('daedalus:oracle');
const security = require('../../common/security.js');

async function init(pgpool) {
  debug('Initializing oracle plugin...');
  await pgpool.query(fs.readFileSync('./plugins/oracle/create.sql').toString());
  debug('Initializing oracle plugin... done');
}

function findConstraintId(constraints, database, name, type, fromCatalog, fromSchema, fromTable, fromColumn, toCatalog, toSchema, toTable, toColumn) { // eslint-disable-line max-len
  return constraints.filter((constraint) => constraint.database === database
    && database.name === fromCatalog
    && constraint.from_schema === fromSchema
    && constraint.from_table === fromTable
    && constraint.from_column === fromColumn
    && database.name === toCatalog
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

function findForeignServer(foreignServers, database, catalog, owner, name, username, connection) {
  return foreignServers.filter((server) => server.database === database
    && server.catalog === catalog
    && server.owner === owner
    && server.name === name
    && server.username === username
    && server.connection === connection)[0];
}

function hexOrString(buf) {
  try {
    return buf.toString('utf8');
  } catch (e) {
    return buf.toString('hex');
  }
}

// TODO: detect permission changes in roles.

// TODO: Fix the issue if there's a state flip back to the original state the diff breaks.
// e.g. drop a column and re-add it (exactly how it was). The system can't handle that.
// e.g. change the port of a database to 1 from 5432 then back 5432, breaks.

// TODO: Listen for changes via triggers and channels?
// https://www.oracle.org/docs/9.1/sql-notify.html

async function writeTablesViewsAndColumns(pgpool, bus, database) {
  assert.ok(database, 'A database parameter was not provided!');
  assert.ok(database.database, 'A database uuid was not provided!');
  if (!database.name) {
    await pgpool.query('insert into oracle.errors("error", database, "type", message, observed_on) values (uuid_generate_v4(), $1, $2, $3, now()) on conflict (database, "type", message) do update set observed_on = now()',
      [database.database, 'database-name-missing', 'The database name was not defined.']);
    return;
  }
  if (database.host.includes('prod') || database.host.includes('prd') || database.name.includes('prd') || database.name.includes('prod')) {
    debug(`Not scanning ${database.host} as its probably a production database.`);
    return;
  }
  const oracledb = require('oracledb'); // eslint-disable-line global-require
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  let client = null;

  try {
    /* CRITICAL SECTION
     * Be very careful modifying code below until the end of the critical section,
     * failing to test carefully could result in destructive actions. The code
     * below must elegantly disconnect from the postgres instance during an error.
     * Failing to do so would cause connection leaks.
     */
    client = await oracledb.getConnection({
      user: database.username,
      password: database.password,
      connectString: `${database.host}/${database.name}`,
    });
    const tables = (await Promise.all((await client.execute(`
      select 
        distinct 
          sys_context('USERENV', 'CURRENT_SCHEMA') as schemaname, 
          table_name as tablename
          --,cast(substr(dbms_metadata.get_ddl('TABLE', table_name), 0, 4000) as varchar2(4000)) as definition
      from 
        sys.user_tables
    `, [])).rows.map((table) => pgpool.query(`
      insert into oracle.tables_log 
        ("table", database, catalog, schema, name, is_view, definition, hash, deleted)
      values 
        (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, encode(digest($6::text, 'sha1'), 'hex'), $7)
      on conflict (database, catalog, schema, name, is_view, hash, deleted)
      do update set name = $4
      returning "table", database, catalog, schema, name
    `, [database.database, database.name, table.SCHEMANAME, table.TABLENAME, false, '', false]))))
      .map((x) => x.rows).flat();

    const views = (await Promise.all((await client.execute(`
      select 
        sys_context('USERENV', 'CURRENT_SCHEMA') as schemaname, 
        view_name as viewname, 
        dbms_metadata.get_ddl('VIEW', view_name) as definition
      from 
        sys.user_views
    `, [])).rows.map((view) => pgpool.query(`
      insert into oracle.tables_log 
        ("table", database, catalog, schema, name, is_view, definition, hash, deleted)
      values 
        (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, encode(digest($6::text, 'sha1'), 'hex'), $7)
      on conflict (database, catalog, schema, name, is_view, hash, deleted)
      do update set name = $4
      returning "table", database, catalog, schema, name
    `, [database.database, database.name, view.SCHEMANAME, view.VIEWNAME, true, view.DEFINITION || '', false]))))
      .map((x) => x.rows).flat();

    const columns = (await Promise.all((await client.execute(`
      select
        sys_context('USERENV', 'CURRENT_SCHEMA') as table_schema,
        table_name,
        column_name,
        column_id as ordinal_position,
        data_default as column_default,
        nullable as is_nullable,
        data_type,
        char_length as character_maximum_length,
        data_length as character_octet_length,
        data_precision as numeric_precision,
        10 as numeric_precision_radix,
        data_scale as numeric_scale,
        8 as datetime_precision,
        1 as is_updatable
      from
        sys.user_tab_columns
    `, [])).rows.map(async (column) => pgpool.query(`
        insert into oracle.columns_log 
          ("column", database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, deleted)
        values 
          (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        on conflict (database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, deleted) 
        do update set name = $5
        returning "column", database, catalog, schema, "table", name
        `, [database.database, database.name, column.TABLE_SCHEMA, findTableOrViewId(tables, views, database.database, database.name, column.TABLE_SCHEMA, column.TABLE_NAME).table, column.COLUMN_NAME, column.ORDINAL_POSITION, column.COLUMN_DEFAULT || '', column.IS_NULLABLE, column.DATA_TYPE, column.CHARACTER_MAXIMUM_LENGTH || 0, column.CHARACTER_OCTET_LENGTH || 0, column.NUMERIC_PRECISION || 0, column.NUMERIC_PRECISION_RADIX || 0, column.NUMERIC_SCALE || 0, column.DATETIME_PRECISION || 0, column.IS_UPDATABLE || true, false]))))
      .map((x) => x.rows).flat();

    const indexes = (await Promise.all((await client.execute(`
      select
        sys_context('USERENV', 'CURRENT_SCHEMA') as schemaname,
        table_name as tablename,
        index_name as indexname,
        tablespace_name as tablespace,
        dbms_metadata.get_ddl('INDEX', index_name) as indexdef
      from
        sys.user_indexes
    `, [])).rows.map(async (index) => pgpool.query(`
        insert into oracle.indexes_log 
          ("index", "table", database, catalog, schema, name, definition, hash, deleted)
        values 
          (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, encode(digest($6::text, 'sha1'), 'hex'), $7)
        on conflict (database, catalog, schema, "table", name, hash, deleted) 
        do update set name = $5
        returning "index", "table", database, catalog, schema, name, definition
      `, [findTableOrViewId(tables, views, database.database, database.name, index.SCHEMANAME, index.TABLENAME).table, database.database, database.name, index.SCHEMANAME, index.INDEXNAME, index.INDEXDEF, false]))))
      .map((x) => x.rows).flat();

    const constraints = (await client.execute(`
      select 
        f.constraint_name,
        case
          when f.constraint_type = 'P' then 'PRIMARY KEY'
          when f.constraint_type = 'R' then 'FOREIGN KEY'
          when f.constraint_type = 'C' then 'CHECK'
        end as constraint_type,
        f.owner as from_schema,
        f.table_name as from_table_name,
        listagg(fc.column_name, ',') within group (order by fc.position) as from_columns,
        t.owner as to_schema,
        t.table_name as to_table_name,
        listagg(tc.column_name, ',') within group (order by tc.position) as to_columns,
        case
          when f.constraint_type = 'P' then ''
          when f.constraint_type = 'R' then cast(dbms_metadata.get_ddl('REF_CONSTRAINT', f.constraint_name, f.owner) as varchar(1024))
          when f.constraint_type = 'C' then cast(dbms_metadata.get_ddl('CONSTRAINT', f.constraint_name, f.owner) as varchar(1024))
        end as definition
      from 
        user_constraints f
        left join all_cons_columns fc on
          f.constraint_name = fc.constraint_name and
          f.owner = fc.owner and
          f.table_name = fc.table_name
        left join all_constraints t on 
          f.r_constraint_name = t.constraint_name and 
          f.r_owner = t.owner and 
          f.constraint_type = 'R'
        left join all_cons_columns tc on
          t.constraint_name = tc.constraint_name and
          t.owner = tc.owner and
          t.table_name = tc.table_name
      where
        f.constraint_type in ('P', 'R', 'C') and 
        f.constraint_name not like '%/%' and
        f.constraint_name not like '%$%' and
        f.constraint_name not like 'SYS_C%'
      group by
        f.constraint_name,
        f.constraint_type,
        f.owner,
        f.table_name,
        t.owner,
        t.table_name
    `, [])).rows.map((x) => ({
      constraint_name: x.CONSTRAINT_NAME, constraint_type: x.CONSTRAINT_TYPE, from_schema: x.FROM_SCHEMA, from_table_name: x.FROM_TABLE_NAME, from_columns: (x.FROM_COLUMNS || '').split(','), to_schema: x.TO_SCHEMA, to_table_name: x.TO_TABLE_NAME, to_columns: (x.TO_COLUMNS || '').split(','), definition: x.DEFINITION,
    }));

    const primaryKeyConstraints = (await Promise.all(constraints.filter((x) => x.constraint_type === 'PRIMARY KEY').map(async (constraint) => {
      const tableUUID = findTableOrViewId(tables, views, database.database, database.name, constraint.from_schema, constraint.from_table_name).table; // eslint-disable-line max-len
      assert(tableUUID, `The table UUID was not found for a primary key constraint on catalog: ${database.name} schema: ${constraint.from_schema} table: ${constraint.from_table_name}`);
      const columnUUIDs = constraint.from_columns.map((x) => findColumnId(columns, database.database, database.name, constraint.from_schema, tableUUID, x).column); // eslint-disable-line max-len
      assert(columnUUIDs.length > 0,
        `The column UUID was not found for a primary key constraint on catalog: ${database.name} schema: ${constraint.from_schema} table: ${constraint.from_table_name} ${constraint.from_column_name}`);
      return {
        rows: (await Promise.all(columnUUIDs.map((columnUUID) => pgpool.query(`
            insert into oracle.constraints_log 
              ("constraint", database, name, type, from_catalog, from_schema, from_table, from_column, deleted)
            values 
              (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8)
            on conflict (database, name, "type", from_catalog, from_schema, from_table, from_column, deleted) where "type" = 'PRIMARY KEY'
            do update set name = $2
            returning "constraint", database, name, type, from_catalog, from_schema, from_table, from_column, deleted
          `, [database.database, constraint.constraint_name, constraint.constraint_type, database.name, constraint.from_schema, tableUUID, columnUUID, false])))).map((x) => x.rows).flat(),
      };
    }))).map((x) => x.rows).flat();

    const foreignKeyConstraints = (await Promise.all(constraints.filter((x) => x.constraint_type === 'FOREIGN KEY').map(async (constraint) => {
      const fromTableUUID = findTableOrViewId(tables, views, database.database, database.name, constraint.from_schema, constraint.from_table_name).table; // eslint-disable-line max-len
      const fromColumnUUIDs = constraint.from_columns.map((x) => findColumnId(columns, database.database, database.name, constraint.from_schema, fromTableUUID, x).column); // eslint-disable-line max-len
      const toTableUUID = findTableOrViewId(tables, views, database.database, database.name, constraint.to_schema, constraint.to_table_name).table; // eslint-disable-line max-len
      const toColumnUUIDs = constraint.to_columns.map((x) => findColumnId(columns, database.database, database.name, constraint.to_schema, toTableUUID, x).column); // eslint-disable-line max-len
      assert(fromTableUUID, `The table UUID was not found for a foreign key constraint on catalog: ${database.name} schema: ${constraint.from_schema} table: ${constraint.from_table_name}`);
      assert(fromColumnUUIDs.length > 0, `The column UUID was not found for a foreign key constraint on catalog: ${database.name} schema: ${constraint.from_schema} table: ${constraint.from_table_name}`);
      assert(toTableUUID, `The table UUID was not found for a foreign key constraint on catalog: ${database.name} schema: ${constraint.to_schema} table: ${constraint.to_table_name}`);
      assert(toColumnUUIDs.length > 0, `The column UUID was not found for a foreign key constraint on catalog: ${database.name} schema: ${constraint.to_schema} table: ${constraint.to_table_name}`);
      assert(fromColumnUUIDs.length === toColumnUUIDs.length,
        `There wasnt the same from and to columns in the foreign key constraint on catalog: ${database.name} schema: ${constraint.to_schema} table: ${constraint.to_table_name}`);
      return {
        rows: (await Promise.all(fromColumnUUIDs.map((fromColumnUUID, index) => {
          const toColumnUUID = toColumnUUIDs[index];
          return pgpool.query(`
            insert into oracle.constraints_log 
              ("constraint", database, name, type, from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted)
            values 
              (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            on conflict (database, name, type, from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted) where "type" = 'FORIEGN KEY'
            do update set name = $2
            returning "constraint", database, name, type, from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted
          `, [database.database, constraint.constraint_name, constraint.constraint_type, database.name, constraint.from_schema, fromTableUUID, fromColumnUUID, database.name, constraint.to_schema, toTableUUID, toColumnUUID, false]);
        }))).map((x) => x.rows).flat(),
      };
    }))).map((x) => x.rows).flat();

    const checkConstraints = (await Promise.all(constraints.filter((x) => x.constraint_type === 'CHECK').map(async (constraint) => {
      const tableUUID = findTableOrViewId(tables, views, database.database, database.name, constraint.from_schema, constraint.from_table_name).table; // eslint-disable-line max-len
      const columnUUIDs = constraint.from_columns.map((x) => findColumnId(columns, database.database, database.name, constraint.from_schema, tableUUID, x).column); // eslint-disable-line max-len
      assert(tableUUID, `The table UUID was not found for a check constraint on catalog: ${database.name} schema: ${constraint.from_schema} table: ${constraint.from_table_name}`);
      return {
        rows: (await Promise.all(columnUUIDs.map((columnUUID) => pgpool.query(`
            insert into oracle.constraints_log 
              ("constraint", database, name, type, from_catalog, from_schema, from_table, from_column, check_clause, deleted)
            values 
              (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
            on conflict (database, name, type, from_catalog, from_schema, from_table, check_clause, deleted) where "type" = 'CHECK'
            do update set name = $2
            returning "constraint", database, name, type, from_catalog, from_schema, from_table, check_clause, deleted
          `, [database.database, constraint.constraint_name, constraint.constraint_type, database.name, constraint.from_schema, tableUUID, columnUUID, constraint.check_clause, false])))).map((x) => x.rows).flat(),
      };
    }))).map((x) => x.rows).flat();

    // Get foreign servers
    const foreignServers = (await Promise.all((await client.execute(`
      select
        owner,
        db_link,
        username,
        host
      from
        sys.all_db_links
    `, [])).rows.map((foreignServer) => pgpool.query(`
      insert into oracle.foreign_servers_log 
        (foreign_server_log, database, catalog, owner, name, username, connection, deleted)
      values 
        (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
      on conflict (database, catalog, owner, name, username, connection, deleted)
      do update set deleted = false
      returning foreign_server_log, database, catalog, owner, name, username, connection, deleted
    `, [database.database, database.name, foreignServer.OWNER, foreignServer.DB_LINK, foreignServer.USERNAME, foreignServer.HOST, false]))))
      .map((x) => x.rows).flat();

    // Column Statistics
    (await Promise.all((await client.execute(`
      select 
        sys_context('USERENV', 'CURRENT_SCHEMA') as "SCHEMA",
        table_name,
        column_name,
        num_distinct,
        ${process.env.ORACLE_HISTOGRAM === 'true' ? `
        low_value,
        high_value,
        ` : ''}
        density,
        num_nulls,
        num_buckets,
        sample_size,
        avg_col_len
      from
        user_tab_col_statistics where column_name not like 'SYS_%$'
    `, [])).rows.map((estimate) => { // eslint-disable-line array-callback-return,consistent-return
      try {
        const tableUUID = findTableOrViewId(tables, views, database.database, database.name, estimate.SCHEMA, estimate.TABLE_NAME).table; // eslint-disable-line max-len
        const columnUUID = findColumnId(columns, database.database, database.name, estimate.SCHEMA, tableUUID, estimate.COLUMN_NAME).column; // eslint-disable-line max-len
        return pgpool.query(`
        insert into oracle.column_statistics_log 
          ("column_statistic", database, catalog, schema, "table", "column", num_distinct, low_value, high_value, density, num_nulls, num_buckets, sample_size, avg_col_len, deleted)
        values
          (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        on conflict do nothing
      `, [database.database, database.name, estimate.SCHEMA, tableUUID, columnUUID, estimate.NUM_DISTINCT || 0, estimate.LOW_VALUE ? hexOrString(estimate.LOW_VALUE) : '', estimate.HIGH_VALUE ? hexOrString(estimate.HIGH_VALUE) : '', estimate.DENSITY || 0, estimate.NUM_NULLS || 0, estimate.NUM_BUCKETS || 0, estimate.SAMPLE_SIZE || 0, estimate.AVG_COL_LEN || 0, false]);
      } catch (e) {
        debug(`Cannot find column while inserting column statistics for ${database.database} %o`, estimate);
      }
    })));

    // Table Statistics
    (await Promise.all((await client.execute(`
      select 
        sys_context('USERENV', 'CURRENT_SCHEMA') as "SCHEMA", 
        user_tables.table_name, 
        user_tables.num_rows as "ROWS",
        sum(user_tab_statistics.blocks) as "BLOCKS",
        sum(user_tab_statistics.empty_blocks) as "EMPTY_BLOCKS",
        avg(user_tab_statistics.avg_row_len) as "AVG_ROW_LEN",
        sum(user_segments.bytes) as "TABLE_SIZE",
        sum(user_segments_indexes.bytes) as "INDEX_SIZE",
        avg(coalesce(user_ind_statistics.avg_cache_hit_ratio, 0)) as "INDEX_HIT_RATE",
        avg(coalesce(user_tab_statistics.avg_cache_hit_ratio, 0)) as "TABLE_HIT_RATE"
      from 
        sys.user_tables
        left join sys.user_segments on user_segments.segment_type = 'TABLE' and user_segments.segment_name = user_tables.table_name
        left join sys.user_indexes on user_indexes.table_name = user_tables.table_name and user_indexes.tablespace_name = user_tables.tablespace_name
        left join sys.user_segments user_segments_indexes on user_segments_indexes.segment_type = 'INDEX' and user_segments_indexes.segment_name = user_indexes.index_name
        left join user_ind_statistics on user_ind_statistics.table_name = user_indexes.table_name and user_ind_statistics.index_name = user_indexes.index_name
        left join user_tab_statistics on user_tab_statistics.table_name = user_tables.table_name
      group by
        sys_context('USERENV', 'CURRENT_SCHEMA'),
        user_tables.table_name,
        user_tables.num_rows
    `, [])).rows.map((estimate) => pgpool.query(`
      insert into oracle.table_statistics_log 
        ("table_statistic", database, catalog, schema, "table", row_amount_estimate, index_size, table_size, blocks, empty_blocks, avg_row_length, index_hit_rate, table_hit_rate, deleted)
      values
        (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      on conflict do nothing
    `, [database.database, database.name, estimate.SCHEMA, findTableOrViewId(tables, views, database.database, database.name, estimate.SCHEMA, estimate.TABLE_NAME).table, estimate.ROWS || 0, estimate.INDEX_SIZE || 0, estimate.TABLE_SIZE || 0, estimate.BLOCKS || 0, estimate.EMPTY_BLOCKS || 0, estimate.AVG_ROW_LEN || 0, estimate.INDEX_HIT_RATE || 0, estimate.TABLE_HIT_RATE || 0, false]))));

    // Database Connection Statistics
    (await Promise.all((await client.execute(`
      select 
        10000 as max_connections, 
        count(*) as used_connections, 
        0 as reserved_connections, 
        10000 - count(*) as available_connections 
      from v$session_connect_info
    `, [])).rows.map((estimate) => pgpool.query(`
      insert into oracle.database_statistics_log
        ("database_statistic", database, max_connections, used_connections, reserved_connections, available_connections, deleted)
      values
        (uuid_generate_v4(), $1, $2, $3, $4, $5, $6)
      on conflict do nothing
    `, [database.database, estimate.MAX_CONNECTIONS, estimate.USED_CONNECTIONS, estimate.RESERVED_CONNECTIONS, estimate.AVAILABLE_CONNECTIONS, false]))));

    // TODO: This is not tracking changes to the config, it should.
    //       Probably should be its own log table.
    try {
      const config = (await client.execute('select * from v$database', [])).rows[0];
      await pgpool.query('update oracle.databases_log set config = $2 where database = $1',
        [database.database, config]);
    } catch (e) {
      // do nothing if it fails to pull, some users may not have access to this.
    }
    // TODO: User defined data types
    // TODO: Long running queries, Locks?
    // TODO: Index statistics? I can't imagine this exists but, constraint statistics?...

    // Check for table deletion
    await Promise.all((await pgpool.query('select "table", database, catalog, schema, name, is_view, definition from oracle.tables where database = $1', [database.database]))
      .rows
      .map(async (tableOrView) => {
        if (!findTableOrViewId(tables, views, database.database, tableOrView.catalog, tableOrView.schema, tableOrView.name)) { // eslint-disable-line max-len
          await pgpool.query(`
            insert into oracle.tables_log 
              ("table", database, catalog, schema, name, is_view, definition, hash, deleted)
            values 
              (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, encode(digest($6, 'sha1'), 'hex'), $7)
            on conflict (database, catalog, schema, name, is_view, hash, deleted)
            do update set deleted = true`,
          [tableOrView.database, tableOrView.catalog, tableOrView.schema, tableOrView.name, tableOrView.is_view, tableOrView.definition, true]); // eslint-disable-line max-len
        }
      }));

    // Check for column deletion
    await Promise.all((await pgpool.query('select "column", database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable from oracle.columns where database = $1', [database.database]))
      .rows
      .map(async (column) => {
        if (!findColumnId(columns, database.database, column.catalog, column.schema, column.table, column.name)) { // eslint-disable-line max-len
          await pgpool.query(`
          insert into oracle.columns_log 
            ("column", database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, deleted)
          values 
            (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          on conflict (database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, deleted) 
          do update set deleted = true`,
          [column.database, column.catalog, column.schema, column.table, column.name, column.position, column.default, column.is_nullable, column.data_type, column.character_maximum_length, column.character_octet_length, column.numeric_precision, column.numeric_precision_radix, column.numeric_scale, column.datetime_precision, column.is_updatable, true]); // eslint-disable-line max-len
        }
      }));

    // Check for index deletion
    await Promise.all((await pgpool.query('select "index", database, catalog, schema, "table", name, definition from oracle.indexes where database = $1', [database.database]))
      .rows
      .map(async (index) => {
        if (!findIndexId(indexes, database.database, index.catalog, index.schema, index.table, index.name)) { // eslint-disable-line max-len
          await pgpool.query(`
          insert into oracle.indexes_log 
            ("index", database, catalog, schema, "table", name, definition, hash, deleted)
          values 
            (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, encode(digest($6, 'sha1'), 'hex'), $7)
          on conflict (database, catalog, schema, "table", name, hash, deleted) 
          do update set deleted = true`,
          [database.database, index.catalog, index.schema, index.table, index.name, index.definition, true]); // eslint-disable-line max-len
        }
      }));

    // Check for primary key deletion
    await Promise.all((await pgpool.query('select "constraint", database, name, type, from_catalog, from_schema, from_table, from_column from oracle.constraints where database = $1 and type = \'PRIMARY KEY\'', [database.database]))
      .rows
      .map(async (constraint) => {
        if (!findConstraintId(primaryKeyConstraints, database.database, constraint.name, constraint.type, database.name, constraint.from_schema, constraint.from_table, constraint.from_column)) { // eslint-disable-line max-len
          await pgpool.query(`
          insert into oracle.constraints_log 
            ("constraint", database, name, "type", from_catalog, from_schema, from_table, from_column, deleted)
          values 
            (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8)
          on conflict (database, name, "type", from_catalog, from_schema, from_table, from_column, deleted) where "type" = 'PRIMARY KEY'
          do update set deleted = true`,
          [database.database, constraint.name, constraint.type, database.name, constraint.from_schema, constraint.from_table, constraint.from_column, true]); // eslint-disable-line max-len
        }
      }));

    // Check for foreign key deletion
    await Promise.all((await pgpool.query('select "constraint", database, name, type, from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column from oracle.constraints where database = $1 and type = \'FOREIGN KEY\'', [database.database]))
      .rows
      .map(async (constraint) => {
        if (!findConstraintId(foreignKeyConstraints, database.database, constraint.name, constraint.type, database.name, constraint.from_schema, constraint.from_table, constraint.from_column, database.name, constraint.to_schema, constraint.to_table, constraint.to_column)) { // eslint-disable-line max-len
          await pgpool.query(`
          insert into oracle.constraints_log 
            ("constraint", database, name, "type", from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted) 
          values 
            (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          on conflict (database, name, "type", from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted) where "type" = 'FOREIGN KEY'
          do update set deleted = true`,
          [database.database, constraint.name, constraint.type, database.name, constraint.from_schema, constraint.from_table, constraint.from_column, database.name, constraint.to_schema, constraint.to_table, constraint.to_column, true]); // eslint-disable-line max-len
        }
      }));

    // Check for check constraint deletion
    await Promise.all((await pgpool.query('select "constraint", database, name, type, from_catalog, from_schema, from_table, from_column, check_clause from oracle.constraints where database = $1 and type = \'CHECK\'', [database.database]))
      .rows
      .map(async (constraint) => {
        if (!findConstraintId(checkConstraints, database.database, constraint.name, constraint.type, database.name, constraint.from_schema, constraint.from_table, constraint.from_column, database.name, constraint.to_schema, constraint.to_table, constraint.to_column)) { // eslint-disable-line max-len
          await pgpool.query(`
          insert into oracle.constraints_log 
            ("constraint", database, name, "type", from_catalog, from_schema, from_table, from_column, check_clause, deleted) 
          values 
            (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
          on conflict (database, name, "type", from_catalog, from_schema, from_table, check_clause, deleted) where "type" = 'CHECK'
          do update set deleted = true`,
          [database.database, constraint.name, constraint.type, database.name, constraint.from_schema, constraint.from_table, constraint.from_column, constraint.check_clause, true]); // eslint-disable-line max-len
        }
      }));

    // Check for foreign server deletion
    await Promise.all((await pgpool.query('select foreign_server_log, database, catalog, owner, name, username, connection from oracle.foreign_servers_log where database = $1', [database.database]))
      .rows
      .map(async (foreignServer) => {
        if (!findForeignServer(foreignServers, database.database, foreignServer.catalog, foreignServer.owner, foreignServer.name, foreignServer.username, foreignServer.connection)) { // eslint-disable-line max-len
          await pgpool.query(`
          insert into oracle.foreign_servers_log 
            (foreign_server_log, database, catalog, owner, name, username, connection, deleted) 
          values 
            (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7)
          on conflict (database, catalog, owner, name, username, connection, deleted)
          do update set deleted = true`,
          [database.database, foreignServer.catalog, foreignServer.owner, foreignServer.name, foreignServer.username, foreignServer.connection, true]); // eslint-disable-line max-len
        }
      }));
  } catch (e) {
    if (e.message.includes('password authentication failed')) {
      bus.emit('oracle.error', [database.database, 'authentication-failed', e.message]);
    } else if (e.message.includes('getaddrinfo ENOTFOUND')) {
      bus.emit('oracle.error', [database.database, 'host-not-found', e.message]);
    } else if (e.message.includes('connect ETIMEDOUT')) {
      bus.emit('oracle.error', [database.database, 'connection-timeout', e.message]);
    } else if (e.message.includes('no pg_hba.conf entry for host')) {
      bus.emit('oracle.error', [database.database, 'forbidden-by-pg-hba-conf-policy', e.message]);
    } else {
      // TODO: Check for db deletion?
      // How do we do this, if the host is unavailalbe we shouldn't assume the db is unavailable,
      // if the password is changed, what should we do? if the database no longer exists should
      // we remove it?
      debug(`Error examining database uuid ${database.database}: ${e.stack}`); // eslint-disable-line no-console
    }
  } finally {
    if (client) {
      await client.close();
    }
  }
  /* /END critical section */
}

async function run(pgpool, bus) {
  if (process.env.ORACLE !== 'true') {
    return;
  }
  debug('Running oracle plugin...');
  const databases = (await Promise.all((await pgpool.query(`
    select 
      databases.database, databases.name, databases.host, databases.port,
      roles.username, roles.password, roles.options
    from 
      oracle.databases 
      join oracle.roles on roles.database = databases.database`, []))
    .rows
    .filter((database) => database.password && database.password.cipher && database.password.encrypted) // eslint-disable-line max-len
    .map((database) => ({ ...database, password: security.decryptValue(process.env.SECRET, database.password).toString('utf8') }))));

  for (let i = 0; i < databases.length; i += 10) { // eslint-disable-line no-restricted-syntax
    debug(`Examining databases ${Math.round((i / databases.length) * 10000) / 100}% finished.`);
    const pool = [];
    for (let j = 0; j < 10; j++) { // eslint-disable-line no-plusplus
      if (databases[i + j]) {
        pool.push(writeTablesViewsAndColumns(pgpool, bus, databases[i + j]));
      }
    }
    await Promise.all(pool); // eslint-disable-line no-await-in-loop
  }
  debug('Examining databases 100% finished.');
  debug('Beginning re-index...');
  await pgpool.query('reindex index oracle.constraints_observed_on');
  await pgpool.query('reindex index oracle.indexes_observed_on');
  await pgpool.query('reindex index oracle.columns_observed_on');
  await pgpool.query('reindex index oracle.tables_observed_on');
  debug('Re-index finished...');
}

module.exports = {
  init,
  run,
};
