do $$
begin

  create schema if not exists postgresql;
  create extension if not exists pgcrypto;
  create extension if not exists "uuid-ossp";


  create table if not exists postgresql.databases_log (
    database_log uuid not null primary key,
    database uuid not null,
    name varchar(128) not null,
    host varchar(1024) not null,
    port int not null CHECK(port > 0),
    config jsonb not null default '{}'::jsonb,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );

  create table if not exists postgresql.errors (
    error uuid not null primary key, 
    database_log uuid not null references postgresql.databases_log("database_log"),
    "type" varchar(128) not null,
    message varchar(128) not null,
    observed_on timestamp with time zone default now()
  );
  create unique index if not exists error_message on postgresql.errors (database_log, "type", message);
  comment on table "postgresql"."errors" IS E'@name postgresqlErrors';

  create unique index if not exists databases_unique on postgresql.databases_log (name, host, port, deleted);
  create index if not exists databases_observed_on on postgresql.databases_log (name, host, port, observed_on desc);
  create or replace view postgresql.databases as
    with ordered_list as ( select
      database_log,
      database,
      name,
      host,
      port,
      config,
      observed_on,
      deleted,
      row_number() over (partition by name, host, port order by observed_on desc) as rn
    from postgresql.databases_log)
    select database_log, database, name, host, port, config, observed_on from ordered_list where rn=1 and deleted = false;
  comment on view "postgresql"."databases" IS E'@name postgresqlDatabases';
  comment on table "postgresql"."databases_log" IS E'@name postgresqlDatabasesLog';

  create table if not exists postgresql.roles_log (
    role_log uuid not null primary key,
    role uuid not null,
    database_log uuid references postgresql.databases_log("database_log") not null,
    username varchar(1024) not null,
    password jsonb not null,
    options varchar(2048) not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists roles_unique on postgresql.roles_log (database_log, username, (password->>'hash'), deleted);
  create index if not exists roles_observed_on on postgresql.roles_log (database_log, username, (password->>'hash'), observed_on desc);
  create or replace view postgresql.roles as
    with ordered_list as ( select
      roles_log.role_log,
      roles_log.role,
      roles_log.database_log,
      roles_log.username,
      roles_log.password,
      roles_log.options,
      roles_log.observed_on,
      roles_log.deleted as roles_deleted,
      databases_log.deleted as databases_deleted,
      row_number() over (partition by roles_log.database_log, roles_log.username, (roles_log.password->>'hash') order by roles_log.observed_on desc) as rn
    from postgresql.roles_log join postgresql.databases_log on roles_log.database_log = databases_log.database_log)
    select role_log, role, database_log, username, password, options, observed_on from ordered_list where rn=1 and roles_deleted = false and databases_deleted = false;
  comment on view "postgresql"."roles" IS E'@name postgresqlRoles';
  comment on table "postgresql"."roles_log" IS E'@name postgresqlRolesLog';

  create table if not exists postgresql.tables_log (
    table_log uuid not null primary key,
    "table" uuid not null,
    database_log uuid references postgresql.databases_log("database_log") not null,
    catalog varchar(1024) not null,
    schema varchar(1024) not null,
    name varchar(1024) not null,
    is_view boolean not null default false,
    is_foreign boolean not null default false,
    hash varchar(128) not null,
    definition text not null default '',
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );

  -- migration
  if not exists (select 1 from information_schema.columns where table_schema='postgresql' and table_name='tables_log' and column_name='hash') then
    drop index postgresql.tables_unique;
    drop index postgresql.tables_observed_on;
    alter table postgresql.tables_log add column hash varchar(128) not null default '';
    update postgresql.tables_log set hash = encode(digest(definition::text, 'sha1'), 'hex');
    alter table postgresql.tables_log alter column hash set not null;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='postgresql' and table_name='tables_log' and column_name='is_foreign') then
    drop view postgresql.tables;
    alter table postgresql.tables_log add column is_foreign boolean not null default false;
  end if;

  create unique index if not exists tables_unique on postgresql.tables_log (database_log, catalog, schema, name, is_view, hash, deleted);
  create index if not exists tables_observed_on on postgresql.tables_log (database_log, catalog, schema, name, is_view, hash, observed_on desc);
  create or replace view postgresql.tables as
    with ordered_list as ( select
      tables_log.table_log,
      tables_log.table,
      tables_log.database_log,
      tables_log.catalog,
      tables_log.schema,
      tables_log.name,
      tables_log.is_view,
      tables_log.is_foreign,
      tables_log.definition,
      tables_log.observed_on,
      tables_log.deleted as tables_deleted,
      databases_log.deleted as databases_deleted,
      row_number() over (partition by tables_log.database_log, tables_log.catalog, tables_log.schema, tables_log.name, tables_log.is_view order by tables_log.observed_on desc) as rn
    from postgresql.tables_log join postgresql.databases_log on tables_log.database_log = databases_log.database_log)
    select table_log, "table", database_log, catalog, schema, name, is_view, is_foreign, definition, observed_on from ordered_list where rn=1 and tables_deleted = false and databases_deleted = false;
    comment on view "postgresql"."tables" IS E'@name postgresqlTables';
    comment on table "postgresql"."tables_log" IS E'@name postgresqlTablesLog';

  create table if not exists postgresql.columns_log (
    column_log uuid not null primary key,
    "column" uuid not null,
    database_log uuid references postgresql.databases_log("database_log") not null,
    catalog varchar(1024) not null,
    schema varchar(1024) not null,
    table_log uuid references postgresql.tables_log(table_log) not null,
    name varchar(1024) not null,
    position int not null,
    "default" varchar(1024),
    is_nullable boolean not null,
    data_type varchar(1024) not null,
    character_maximum_length int not null default 0,
    character_octet_length int not null default 0,
    numeric_precision int not null default 0,
    numeric_precision_radix int not null default 0,
    numeric_scale int not null default 0,
    datetime_precision int not null default 0,
    is_updatable boolean not null default true,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists columns_unique on postgresql.columns_log (database_log, catalog, schema, table_log, name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, deleted);
  create index if not exists columns_observed_on on postgresql.columns_log (database_log, catalog, schema, table_log, name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, observed_on desc);
  create index if not exists columns_log_table on postgresql.columns_log (table_log);
  create or replace view postgresql.columns as
    with ordered_list as ( 
      select
        columns_log.column_log,
        columns_log.column,
        columns_log.database_log,
        columns_log.catalog,
        columns_log.schema,
        columns_log.table_log,
        columns_log.name,
        columns_log.position,
        columns_log.default,
        columns_log.is_nullable,
        columns_log.data_type,
        columns_log.character_maximum_length,
        columns_log.character_octet_length,
        columns_log.numeric_precision,
        columns_log.numeric_precision_radix,
        columns_log.numeric_scale,
        columns_log.datetime_precision,
        columns_log.is_updatable,
        columns_log.observed_on,
        columns_log.deleted as columns_deleted,
        tables_log.deleted as tables_deleted,
        databases_log.deleted as databases_deleted,
        row_number() over (partition by columns_log.database_log, columns_log.catalog, columns_log.schema, columns_log.table_log, columns_log.name order by columns_log.observed_on desc) as rn
      from postgresql.columns_log 
        join postgresql.tables_log on columns_log.table_log = tables_log.table_log 
        join postgresql.databases_log on columns_log.database_log = databases_log.database_log
    )
    select column_log, "column", database_log, catalog, schema, table_log, name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, observed_on from ordered_list where rn=1 and databases_deleted = false and tables_deleted = false and columns_deleted = false;
  comment on view "postgresql"."columns" is E'@name postgresqlColumns';
  comment on table "postgresql"."columns_log" IS E'@name postgresqlColumnsLogs';

  create table if not exists postgresql.indexes_log (
    index_log uuid not null primary key,
    "index" uuid not null,
    database_log uuid references postgresql.databases_log("database_log") not null,
    catalog varchar(1024) not null,
    schema varchar(1024) not null,
    table_log uuid references postgresql.tables_log(table_log) not null,
    name varchar(1024) not null,
    definition text not null default '',
    hash varchar(128) not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  
  -- migration
  if not exists (select 1 from information_schema.columns where table_schema='postgresql' and table_name='indexes_log' and column_name='hash') then
    drop index postgresql.indexes_unique;
    drop index postgresql.indexes_observed_on;
    alter table postgresql.indexes_log add column hash varchar(128);
    update postgresql.indexes_log set hash = encode(digest(definition::text, 'sha1'), 'hex');
    alter table postgresql.indexes_log alter column hash set not null;
  end if;

  create unique index if not exists indexes_unique on postgresql.indexes_log (database_log, catalog, schema, table_log, name, hash, deleted);
  create index if not exists indexes_observed_on on postgresql.indexes_log (database_log, catalog, schema, table_log, name, hash, observed_on desc);
  create index if not exists indexes_log_table on postgresql.indexes_log (table_log);
  create or replace view postgresql.indexes as
    with ordered_list as ( 
      select
        indexes_log.index_log,
        indexes_log.index,
        indexes_log.database_log,
        indexes_log.catalog,
        indexes_log.schema,
        indexes_log.table_log,
        indexes_log.name,
        indexes_log.definition,
        indexes_log.observed_on,
        indexes_log.deleted as indexes_deleted,
        tables_log.deleted as tables_deleted,
        databases_log.deleted as databases_deleted,
        row_number() over (partition by indexes_log.database_log, indexes_log.catalog, indexes_log.schema, indexes_log.table_log, indexes_log.name, indexes_log.definition order by indexes_log.observed_on desc) as rn
      from postgresql.indexes_log 
        join postgresql.tables_log on indexes_log.table_log = tables_log.table_log 
        join postgresql.databases_log on indexes_log.database_log = databases_log.database_log
    )
    select index_log, "index", database_log, catalog, schema, table_log, name, definition, observed_on 
    from ordered_list 
    where rn=1 and indexes_deleted = false and tables_deleted = false and databases_deleted = false;
  comment on view "postgresql"."indexes" IS E'@name postgresqlIndexes';
  comment on table "postgresql"."indexes_log" IS E'@name postgresqlIndexesLog';

  create table if not exists postgresql.constraints_log (
    constraint_log uuid not null primary key,
    "constraint" uuid not null,
    database_log uuid references postgresql.databases_log("database_log") not null,
    name varchar(1024) not null,
    "type" varchar(1024) not null,
    from_catalog varchar(1024) not null,
    from_schema varchar(1024) not null,
    from_table uuid references postgresql.tables_log(table_log) not null,
    from_column uuid references postgresql.columns_log(column_log),
    to_catalog varchar(1024),
    to_schema varchar(1024),
    to_table uuid references postgresql.tables_log(table_log),
    to_column uuid references postgresql.columns_log(column_log),
    check_clause text,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );

  create unique index if not exists constraints_pkey_unique on postgresql.constraints_log (database_log, name, "type", from_catalog, from_schema, from_table, from_column, deleted) where "type" = 'PRIMARY KEY';
  create unique index if not exists constraints_fkey_unique on postgresql.constraints_log (database_log, name, "type", from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted) where "type" = 'FOREIGN KEY';
  create unique index if not exists constraints_check_unique on postgresql.constraints_log (database_log, name, "type", from_catalog, from_schema, from_table, check_clause, deleted) where "type" = 'CHECK';
  create unique index if not exists constraints_unique on postgresql.constraints_log (database_log, name, "type", from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted);
  create index if not exists constraints_log_from_column on postgresql.constraints_log (from_column);
  create index if not exists constraints_log_to_column on postgresql.constraints_log (to_column);
  create index if not exists constraints_log_from_table on postgresql.constraints_log (from_table);
  create index if not exists constraints_log_to_table on postgresql.constraints_log (to_table);
  create index if not exists constraints_log_type_database on postgresql.constraints_log (type, database_log);
  create index if not exists constraints_observed_on on postgresql.constraints_log (database_log, name, "type", from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, check_clause, observed_on desc nulls last);

  create or replace view postgresql.constraints as
    with ordered_list as ( 
      select
        constraints_log.constraint_log,
        constraints_log.constraint,
        constraints_log.database_log,
        constraints_log.name,
        constraints_log.type,
        constraints_log.from_catalog,
        constraints_log.from_schema,
        constraints_log.from_table,
        constraints_log.from_column,
        constraints_log.to_catalog,
        constraints_log.to_schema,
        constraints_log.to_table,
        constraints_log.to_column,
        constraints_log.check_clause,
        constraints_log.observed_on,
        constraints_log.deleted as constraints_deleted,
        to_tables_log.deleted as to_tables_deleted,
        from_tables_log.deleted as from_tables_deleted,
        to_columns_log.deleted as to_columns_deleted,
        from_columns_log.deleted as from_columns_deleted,
        databases_log.deleted as databases_deleted,
        row_number() over (partition by constraints_log.database_log, constraints_log.name, constraints_log.type, constraints_log.from_catalog, constraints_log.from_schema, constraints_log.from_table, constraints_log.from_column, constraints_log.to_catalog, constraints_log.to_schema, constraints_log.to_table, constraints_log.to_column, constraints_log.check_clause order by constraints_log.observed_on desc) as rn
      from postgresql.constraints_log
        left join postgresql.tables_log from_tables_log on constraints_log.from_table = from_tables_log.table_log
        left join postgresql.tables_log to_tables_log on constraints_log.to_table = to_tables_log.table_log
        left join postgresql.columns_log from_columns_log on constraints_log.from_column = from_columns_log.column_log
        left join postgresql.columns_log to_columns_log on constraints_log.to_column = to_columns_log.column_log
        left join postgresql.databases_log on constraints_log.database_log = databases_log.database_log
    )
    select constraint_log, "constraint", database_log, name, "type", from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, check_clause, observed_on
    from ordered_list
    where rn=1 and
      constraints_deleted = false and
      (to_tables_deleted = false or to_tables_deleted is null) and
      from_tables_deleted = false and
      (to_columns_deleted = false or to_columns_deleted is null) and
      (from_columns_deleted = false or from_columns_deleted is null) and
      databases_deleted = false;
  comment on view "postgresql"."constraints" IS E'@name postgresqlConstraints';
  comment on table "postgresql"."constraints_log" IS E'@name postgresqlConstraintsLog';

  create table if not exists postgresql.foreign_tables_log (
    foreign_table_log uuid not null primary key,
    foreign_table uuid not null,
    database_log uuid references postgresql.databases_log("database_log") not null,
    catalog varchar(1024) not null,
    schema varchar(1024) not null,
    table_log uuid references postgresql.tables_log(table_log) not null,
    foreign_schema_name varchar(1024) not null,
    foreign_table_name varchar(1024) not null,
    foreign_database_name varchar(1024) not null,
    foreign_database_host varchar(1024) not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );

  create unique index if not exists foreign_tables_unique on postgresql.foreign_tables_log (database_log, catalog, schema, table_log, foreign_schema_name, foreign_table_name, foreign_database_name, foreign_database_host, deleted);
  create index if not exists foreign_tables_observed_on on postgresql.foreign_tables_log (database_log, catalog, schema, table_log, foreign_schema_name, foreign_table_name, foreign_database_name, foreign_database_host, observed_on desc);
  create index if not exists foreign_tables_log_table on postgresql.foreign_tables_log (table_log);
  create or replace view postgresql.foreign_tables as
    with ordered_list as ( 
      select
        foreign_tables_log.foreign_table_log,
        foreign_tables_log.foreign_table,
        foreign_tables_log.database_log,
        foreign_tables_log.catalog,
        foreign_tables_log.schema,
        foreign_tables_log.table_log,
        foreign_tables_log.foreign_schema_name,
        foreign_tables_log.foreign_table_name,
        foreign_tables_log.foreign_database_name,
        foreign_tables_log.foreign_database_host,
        foreign_tables_log.observed_on,
        foreign_tables_log.deleted as foreign_tables_deleted,
        tables_log.deleted as tables_deleted,
        databases_log.deleted as databases_deleted,
        row_number() over (partition by foreign_tables_log.database_log, foreign_tables_log.catalog, foreign_tables_log.schema, foreign_tables_log.table_log, foreign_tables_log.foreign_schema_name, foreign_tables_log.foreign_table_name, foreign_tables_log.foreign_database_name, foreign_tables_log.foreign_database_host order by foreign_tables_log.observed_on desc) as rn
      from postgresql.foreign_tables_log 
        join postgresql.tables_log on foreign_tables_log.table_log = tables_log.table_log 
        join postgresql.databases_log on foreign_tables_log.database_log = databases_log.database_log
    )
    select foreign_table_log, foreign_table, database_log, catalog, schema, table_log, foreign_schema_name, foreign_table_name, foreign_database_name, foreign_database_host, observed_on 
    from ordered_list 
    where rn=1 and foreign_tables_deleted = false and tables_deleted = false and databases_deleted = false;
  comment on view "postgresql"."foreign_tables" IS E'@name postgresqlForeignTables';
  comment on table "postgresql"."foreign_tables_log" IS E'@name postgresqlForeignTablesLog';

  create table if not exists postgresql.foreign_servers_log (
    foreign_server_log uuid not null primary key,
    foreign_server uuid not null,
    database_log uuid references postgresql.databases_log("database_log") not null,
    catalog varchar(1024) not null,
    owner varchar(1024) not null,
    name varchar(1024) not null,
    username varchar(1024) not null,
    connection varchar(1024) not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists foreign_servers_log_unique on postgresql.foreign_servers_log (database_log, catalog, owner, name, username, connection, deleted);
  create index if not exists foreign_servers_log_deleted on postgresql.foreign_servers_log ("database_log");
  create or replace view postgresql.foreign_servers as
    with ordered_list as ( 
      select
        foreign_servers_log.foreign_server_log,
        foreign_servers_log.foreign_server,
        foreign_servers_log.database_log,
        foreign_servers_log.catalog,
        foreign_servers_log.owner,
        foreign_servers_log.name,
        foreign_servers_log.username,
        foreign_servers_log.connection,
        foreign_servers_log.observed_on,
        foreign_servers_log.deleted as foreign_server_deleted,
        databases_log.deleted as database_deleted,
        row_number() over (partition by foreign_servers_log.database_log, foreign_servers_log.catalog, foreign_servers_log.owner, foreign_servers_log.name, foreign_servers_log.username, foreign_servers_log.connection order by foreign_servers_log.observed_on desc) as rn
      from postgresql.foreign_servers_log
        join postgresql.databases_log on foreign_servers_log.database_log = databases_log.database_log)
    select foreign_server_log, foreign_server, database_log, catalog, owner, name, username, connection, observed_on
    from ordered_list
    where rn=1 and foreign_server_deleted = false and database_deleted = false;
  comment on view "postgresql"."foreign_servers" IS E'@name postgresqlForeignServers';
  comment on table "postgresql"."foreign_servers_log" IS E'@name postgresqlForeignServersLog';

  create table if not exists postgresql.column_statistics_log (
    "column_statistic" uuid not null primary key, 
    database_log uuid references postgresql.databases_log("database_log") not null,
    catalog varchar(1024) not null, 
    schema varchar(1024) not null, 
    table_log uuid references postgresql.tables_log(table_log) not null, 
    column_log uuid references postgresql.columns_log(column_log) not null,
    inherited boolean not null,
    null_frac real not null,
    avg_width integer not null,
    n_distinct real not null,
    most_common_vals text[],
    most_common_freqs real[], 
    histogram_bounds text[],
    correlation real,
    most_common_elems text[],
    most_common_elem_freqs text[],
    elem_count_histogram real[],
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  comment on table "postgresql"."column_statistics_log" IS E'@name postgresqlColumnStatisticsLog';
  create unique index if not exists column_statistics_pkey_unique on postgresql.column_statistics_log (database_log, catalog, schema, table_log, column_log, inherited, null_frac, avg_width, n_distinct, deleted);
  create index if not exists column_statistics_log_table on postgresql.column_statistics_log (table_log);
  create index if not exists column_statistics_log_column on postgresql.column_statistics_log (column_log);
  create or replace view postgresql.column_statistics as
    with ordered_list as ( 
      select
        column_statistics_log.column_statistic,
        column_statistics_log.database_log,
        column_statistics_log.catalog,
        column_statistics_log.schema,
        column_statistics_log.table_log,
        column_statistics_log.column_log,
        column_statistics_log.inherited,
        column_statistics_log.null_frac,
        column_statistics_log.avg_width,
        column_statistics_log.n_distinct,
        column_statistics_log.most_common_vals,
        column_statistics_log.most_common_freqs,
        column_statistics_log.histogram_bounds,
        column_statistics_log.correlation,
        column_statistics_log.most_common_elems,
        column_statistics_log.most_common_elem_freqs,
        column_statistics_log.elem_count_histogram,
        column_statistics_log.observed_on,
        column_statistics_log.deleted as rows_deleted,
        tables_log.deleted as tables_deleted,
        columns_log.deleted as columns_deleted,
        row_number() over (partition by column_statistics_log.database_log, column_statistics_log.catalog, column_statistics_log.schema, column_statistics_log.table_log, column_statistics_log.column_log order by column_statistics_log.observed_on desc) as rn
      from postgresql.column_statistics_log
        join postgresql.tables_log on column_statistics_log.table_log = tables_log.table_log
        join postgresql.columns_log on column_statistics_log.column_log = columns_log.column_log) 
    select "column_statistic", database_log, catalog, schema, table_log, column_log, inherited, null_frac, avg_width, n_distinct, most_common_vals, most_common_freqs, histogram_bounds, correlation, most_common_elems, most_common_elem_freqs, elem_count_histogram, observed_on 
    from ordered_list 
    where rn=1 and rows_deleted = false and tables_deleted = false and columns_deleted = false;
  comment on view "postgresql"."column_statistics" IS E'@name postgresqlColumnStatistics';

  create table if not exists postgresql.table_statistics_log (
    "table_statistic" uuid not null primary key, 
    database_log uuid references postgresql.databases_log("database_log") not null,
    catalog varchar(1024) not null, 
    schema varchar(1024) not null, 
    table_log uuid references postgresql.tables_log(table_log) not null, 
    row_amount_estimate bigint not null, 
    index_size bigint not null, 
    table_size bigint not null,
    sequential_scans bigint not null,
    percent_of_times_index_used float not null,
    index_hit_rate float not null,
    table_hit_rate float not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  -- migration
  if not exists (select 1 from information_schema.columns where table_name='table_statistics_log' and column_name='row_amount_estimate' and data_type='bigint') then
    drop view postgresql.table_statistics;
    alter table postgresql.table_statistics_log alter column row_amount_estimate set data type bigint;
    alter table postgresql.table_statistics_log alter column index_size set data type bigint;
    alter table postgresql.table_statistics_log alter column table_size set data type bigint;
    alter table postgresql.table_statistics_log alter column sequential_scans set data type bigint;
  end if;
  create unique index if not exists table_statistics_pkey_unique on postgresql.table_statistics_log (database_log, catalog, schema, table_log, row_amount_estimate, sequential_scans, percent_of_times_index_used, index_hit_rate, table_hit_rate, deleted);
  create index if not exists table_statistics_log_table on postgresql.table_statistics_log (table_log);
  create or replace view postgresql.table_statistics as
    with ordered_list as ( 
      select
        table_statistics_log.table_statistic,
        table_statistics_log.database_log,
        table_statistics_log.catalog,
        table_statistics_log.schema,
        table_statistics_log.table_log,
        table_statistics_log.row_amount_estimate,
        table_statistics_log.sequential_scans,
        table_statistics_log.percent_of_times_index_used,
        table_statistics_log.index_size,
        table_statistics_log.table_size,
        table_statistics_log.index_hit_rate,
        table_statistics_log.table_hit_rate,
        table_statistics_log.observed_on,
        table_statistics_log.deleted as rows_deleted,
        tables_log.deleted as tables_deleted,
        row_number() over (partition by table_statistics_log.database_log, table_statistics_log.catalog, table_statistics_log.schema, table_statistics_log.table_log  order by table_statistics_log.observed_on desc) as rn
      from postgresql.table_statistics_log
        join postgresql.tables_log on table_statistics_log.table_log = tables_log.table_log) 
    select "table_statistic", database_log, catalog, schema, table_log, row_amount_estimate, sequential_scans, percent_of_times_index_used, index_size, table_size, index_hit_rate, table_hit_rate, observed_on 
    from ordered_list 
    where rn=1 and rows_deleted = false and tables_deleted = false;
  comment on view "postgresql"."table_statistics" IS E'@name postgresqlTableStatistics';
  comment on table "postgresql"."table_statistics_log" IS E'@name postgresqlTableStatisticsLog';


  create table if not exists postgresql.database_statistics_log (
    "database_statistic" uuid not null primary key, 
    database_log uuid references postgresql.databases_log("database_log") not null,
    max_connections int not null, 
    used_connections int not null, 
    reserved_connections int not null, 
    available_connections int not null, 
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists database_statistics_pkey_unique on postgresql.database_statistics_log (database_log, max_connections, used_connections, reserved_connections, available_connections, deleted);
  create or replace view postgresql.database_statistics as
    with ordered_list as ( 
      select
        database_statistics_log.database_statistic,
        database_statistics_log.database_log,
        database_statistics_log.max_connections,
        database_statistics_log.used_connections,
        database_statistics_log.reserved_connections,
        database_statistics_log.available_connections,
        (database_statistics_log.used_connections::float / database_statistics_log.available_connections::float) as percent_of_max_connections,
        database_statistics_log.observed_on,
        database_statistics_log.deleted as database_statistic_deleted,
        row_number() over (partition by database_statistics_log.database_log order by database_statistics_log.observed_on desc) as rn
      from postgresql.database_statistics_log) 
    select "database_statistic", database_log, max_connections, used_connections, reserved_connections, available_connections, percent_of_max_connections, observed_on 
    from ordered_list 
    where rn=1 and database_statistic_deleted = false;

  comment on view "postgresql"."database_statistics" IS E'@name postgresqlDatabaseStatistics';
  comment on table "postgresql"."database_statistics_log" IS E'@name postgresqlDatabaseStatisticsLog';
  
end
$$;