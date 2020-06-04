do $$
begin

  create schema if not exists oracle;
  create extension if not exists pgcrypto;
  create extension if not exists "uuid-ossp";

  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'oracle/databases', 'oracle.databases.svg', 'fa-cube', 'Oracle Databases') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'oracle/tables', 'oracle.tables.svg', 'fa-cube', 'Oracle Tables') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'oracle/columns', 'oracle.columns.svg', 'fa-cube', 'Oracle Columns') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'oracle/constraints', 'oracle.constraints.svg', 'fa-cube', 'Oracle Constraints') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'oracle/foreign_servers', 'oracle.foreign_servers.svg', 'fa-cube', 'Oracle Foreign Servers') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'oracle/indexes', 'oracle.indexes.svg', 'fa-cube', 'Oracle Indexes') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'oracle/roles', 'oracle.roles.svg', 'fa-cube', 'Oracle Roles') on conflict (name) do nothing;

  perform metadata.add_nodes_type('oracle/columns', 'select node_types.icon as "icon", node_types.type, columns.column_log as node_log, columns.column as node, columns.name, (''{}'')::jsonb as definition, ''{}''::jsonb as status, columns.observed_on, false as transient from oracle.columns, metadata.node_types where node_types.name = ''oracle/columns''');
  perform metadata.add_nodes_type('oracle/constraints', 'select node_types.icon as "icon", node_types.type, constraints.constraint_log as node_log, constraints.constraint as node, constraints.name, (''{}'')::jsonb as definition, ''{}''::jsonb as status, constraints.observed_on, false as transient from oracle.constraints, metadata.node_types where node_types.name = ''oracle/constraints''');
  perform metadata.add_nodes_type('oracle/databases', 'select node_types.icon as "icon", node_types.type, databases.database_log as node_log, databases.database as node, databases.host || ''/'' || databases.name as name, databases.config as definition, ''{}''::jsonb as status, databases.observed_on, false as transient from oracle.databases, metadata.node_types where node_types.name = ''oracle/databases''');
  perform metadata.add_nodes_type('oracle/foreign_servers', 'select node_types.icon as "icon", node_types.type, foreign_servers.foreign_server_log as node_log, foreign_servers.foreign_server as node, foreign_servers.name, (''{}'')::jsonb as definition, ''{}''::jsonb as status, foreign_servers.observed_on, false as transient from oracle.foreign_servers, metadata.node_types where node_types.name = ''oracle/foreign_servers''');
  perform metadata.add_nodes_type('oracle/indexes', 'select node_types.icon as "icon", node_types.type, indexes.index_log as node_log, indexes.index as node, indexes.name, (''{}'')::jsonb as definition, ''{}''::jsonb as status, indexes.observed_on, false as transient from oracle.indexes, metadata.node_types where node_types.name = ''oracle/indexes''');
  perform metadata.add_nodes_type('oracle/roles', 'select node_types.icon as "icon", node_types.type, roles.role_log as node_log, roles.role as node, roles.username as name, (''{}'')::jsonb as definition, ''{}''::jsonb as status, roles.observed_on, false as transient from oracle.roles, metadata.node_types where node_types.name = ''oracle/roles''');
  perform metadata.add_nodes_type('oracle/tables', 'select node_types.icon as "icon", node_types.type, tables.table_log as node_log, tables.table as node, tables.name, (''{}'')::jsonb as definition, ''{}''::jsonb as status, tables.observed_on, false as transient from oracle.tables, metadata.node_types where node_types.name = ''oracle/tables''');

  perform metadata.add_nodes_log_type('oracle/columns', 'select node_types.icon as "icon", node_types.type, columns_log.column_log as node_log, columns_log.column as node, columns_log.name, (''{}'')::jsonb as definition, ''{}''::jsonb as status, columns_log.observed_on, false as transient, deleted from oracle.columns_log, metadata.node_types where node_types.name = ''oracle/columns''');
  perform metadata.add_nodes_log_type('oracle/constraints', 'select node_types.icon as "icon", node_types.type, constraints_log.constraint_log as node_log, constraints_log.constraint as node, constraints_log.name, (''{}'')::jsonb as definition, ''{}''::jsonb as status, constraints_log.observed_on, false as transient, deleted from oracle.constraints_log, metadata.node_types where node_types.name = ''oracle/constraints''');
  perform metadata.add_nodes_log_type('oracle/databases', 'select node_types.icon as "icon", node_types.type, databases_log.database_log as node_log, databases_log.database as node, databases_log.host || ''/'' || databases_log.name as name, databases_log.config as definition, ''{}''::jsonb as status, databases_log.observed_on, false as transient, deleted from oracle.databases_log, metadata.node_types where node_types.name = ''oracle/databases''');
  perform metadata.add_nodes_log_type('oracle/foreign_servers', 'select node_types.icon as "icon", node_types.type, foreign_servers_log.foreign_server_log as node_log, foreign_servers_log.foreign_server as node, foreign_servers_log.name, (''{}'')::jsonb as definition, ''{}''::jsonb as status, foreign_servers_log.observed_on, false as transient, deleted from oracle.foreign_servers_log, metadata.node_types where node_types.name = ''oracle/foreign_servers''');
  perform metadata.add_nodes_log_type('oracle/indexes', 'select node_types.icon as "icon", node_types.type, indexes_log.index_log as node_log, indexes_log.index as node, indexes_log.name, (''{}'')::jsonb as definition, ''{}''::jsonb as status, indexes_log.observed_on, false as transient, deleted from oracle.indexes_log, metadata.node_types where node_types.name = ''oracle/indexes''');
  perform metadata.add_nodes_log_type('oracle/roles', 'select node_types.icon as "icon", node_types.type, roles_log.role_log as node_log, roles_log.role as node, roles_log.username as name, (''{}'')::jsonb as definition, ''{}''::jsonb as status, roles_log.observed_on, false as transient, deleted from oracle.roles_log, metadata.node_types where node_types.name = ''oracle/roles''');
  perform metadata.add_nodes_log_type('oracle/tables', 'select node_types.icon as "icon", node_types.type, tables_log.table_log as node_log, tables_log.table as node, tables_log.name, (''{}'')::jsonb as definition, ''{}''::jsonb as status, tables_log.observed_on, false as transient, deleted from oracle.tables_log, metadata.node_types where node_types.name = ''oracle/tables''');

  create table if not exists oracle.databases_log (
    database_log uuid not null primary key,
    database uuid not null,
    name varchar(128) not null,
    host varchar(1024) not null,
    port int not null CHECK(port > 0),
    config jsonb not null default '{}'::jsonb,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );

  create table if not exists oracle.errors (
    error uuid not null primary key, 
    database_log uuid not null references oracle.databases_log(database_log),
    "type" varchar(128) not null,
    message varchar(128) not null,
    observed_on timestamp with time zone default now()
  );
  create unique index if not exists error_message on oracle.errors (database_log, "type", message);
  comment on table "oracle"."errors" IS E'@name oracleErrors';

  create unique index if not exists databases_unique on oracle.databases_log (name, host, port, deleted);
  create index if not exists databases_observed_on on oracle.databases_log (name, host, port, observed_on desc);
  create or replace view oracle.databases as
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
    from oracle.databases_log)
    select database_log, database, name, host, port, config, observed_on from ordered_list where rn=1 and deleted = false;
  comment on view "oracle"."databases" IS E'@name oracleDatabases';
  comment on table "oracle"."databases_log" IS E'@name oracleDatabasesLog';

  create table if not exists oracle.roles_log (
    role_log uuid not null primary key,
    role uuid not null,
    database_log uuid references oracle.databases_log(database_log) not null,
    username varchar(1024) not null,
    password jsonb not null,
    options varchar(2048) not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists roles_unique on oracle.roles_log (database_log, username, (password->>'hash'), deleted);
  create index if not exists roles_observed_on on oracle.roles_log (database_log, username, (password->>'hash'), observed_on desc);
  create or replace view oracle.roles as
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
    from oracle.roles_log join oracle.databases_log on roles_log.database_log = databases_log.database_log)
    select role_log, role, database_log, username, password, options, observed_on from ordered_list where rn=1 and roles_deleted = false and databases_deleted = false;
  comment on view "oracle"."roles" IS E'@name oracleRoles';
  comment on table "oracle"."roles_log" IS E'@name oracleRolesLog';

  create table if not exists oracle.tables_log (
    table_log uuid not null primary key,
    "table" uuid not null,
    database_log uuid references oracle.databases_log(database_log) not null,
    catalog varchar(1024) not null,
    schema varchar(1024) not null,
    name varchar(1024) not null,
    is_view boolean not null default false,
    hash varchar(128) not null,
    definition text not null default '',
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );

  -- migration
  if not exists (select 1 from information_schema.columns where table_schema='oracle' and table_name='tables_log' and column_name='hash') then
    drop index oracle.tables_unique;
    drop index oracle.tables_observed_on;
    alter table oracle.tables_log add column hash varchar(128) not null default '';
    update oracle.tables_log set hash = encode(digest(definition::text, 'sha1'), 'hex');
    alter table oracle.tables_log alter column hash set not null;
  end if;

  create unique index if not exists tables_unique on oracle.tables_log (database_log, catalog, schema, name, is_view, hash, deleted);
  create index if not exists tables_observed_on on oracle.tables_log (database_log, catalog, schema, name, is_view, hash, observed_on desc);
  create or replace view oracle.tables as
    with ordered_list as ( select
      tables_log.table_log,
      tables_log.table,
      tables_log.database_log,
      tables_log.catalog,
      tables_log.schema,
      tables_log.name,
      tables_log.is_view,
      tables_log.definition,
      tables_log.observed_on,
      tables_log.deleted as tables_deleted,
      databases_log.deleted as databases_deleted,
      row_number() over (partition by tables_log.database_log, tables_log.catalog, tables_log.schema, tables_log.name, tables_log.is_view order by tables_log.observed_on desc) as rn
    from oracle.tables_log join oracle.databases_log on tables_log.database_log = databases_log.database_log)
    select table_log, "table", database_log, catalog, schema, name, is_view, definition, observed_on from ordered_list where rn=1 and tables_deleted = false and databases_deleted = false;
    comment on view "oracle"."tables" IS E'@name oracleTables';
    comment on table "oracle"."tables_log" IS E'@name oracleTablesLog';

  create table if not exists oracle.columns_log (
    column_log uuid not null primary key,
    "column" uuid not null,
    database_log uuid references oracle.databases_log(database_log) not null,
    catalog varchar(1024) not null,
    schema varchar(1024) not null,
    table_log uuid references oracle.tables_log(table_log) not null,
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
  create unique index if not exists columns_unique on oracle.columns_log (database_log, catalog, schema, table_log, name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, deleted);
  create index if not exists columns_observed_on on oracle.columns_log (database_log, catalog, schema, table_log, name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, observed_on desc);
  create index if not exists columns_log_table on oracle.columns_log (table_log);
  create or replace view oracle.columns as
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
      from oracle.columns_log 
        join oracle.tables_log on columns_log.table_log = tables_log.table_log
        join oracle.databases_log on columns_log.database_log = databases_log.database_log
    )
    select column_log, "column", database_log, catalog, schema, table_log, name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, observed_on from ordered_list where rn=1 and databases_deleted = false and tables_deleted = false and columns_deleted = false;
  comment on view "oracle"."columns" is E'@name oracleColumns';
  comment on table "oracle"."columns_log" IS E'@name oracleColumnsLogs';
 
  create table if not exists oracle.indexes_log (
    index_log uuid not null primary key,
    "index" uuid not null,
    database_log uuid references oracle.databases_log(database_log) not null,
    catalog varchar(1024) not null,
    schema varchar(1024) not null,
    table_log uuid references oracle.tables_log(table_log) not null,
    name varchar(1024) not null,
    definition text not null default '',
    hash varchar(128) not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );

  create unique index if not exists indexes_unique on oracle.indexes_log (database_log, catalog, schema, table_log, name, hash, deleted);
  create index if not exists indexes_observed_on on oracle.indexes_log (database_log, catalog, schema, table_log, name, hash, observed_on desc);
  create index if not exists indexes_log_table on oracle.indexes_log (table_log);
  create or replace view oracle.indexes as
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
      from oracle.indexes_log 
        join oracle.tables_log on indexes_log.table_log = tables_log.table_log
        join oracle.databases_log on indexes_log.database_log = databases_log.database_log
    )
    select index_log, "index", database_log, catalog, schema, table_log, name, definition, observed_on 
    from ordered_list 
    where rn=1 and indexes_deleted = false and tables_deleted = false and databases_deleted = false;
  comment on view "oracle"."indexes" IS E'@name oracleIndexes';
  comment on table "oracle"."indexes_log" IS E'@name oracleIndexesLog';

  create table if not exists oracle.constraints_log (
    constraint_log uuid not null primary key,
    "constraint" uuid not null,
    database_log uuid references oracle.databases_log(database_log) not null,
    name varchar(1024) not null,
    "type" varchar(1024) not null,
    from_catalog varchar(1024) not null,
    from_schema varchar(1024) not null,
    from_table uuid references oracle.tables_log(table_log) not null,
    from_column uuid references oracle.columns_log(column_log),
    to_catalog varchar(1024),
    to_schema varchar(1024),
    to_table uuid references oracle.tables_log(table_log),
    to_column uuid references oracle.columns_log(column_log),
    check_clause text,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );

  create unique index if not exists constraints_pkey_unique on oracle.constraints_log (database_log, name, "type", from_catalog, from_schema, from_table, from_column, deleted) where "type" = 'PRIMARY KEY';
  create unique index if not exists constraints_fkey_unique on oracle.constraints_log (database_log, name, "type", from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted) where "type" = 'FOREIGN KEY';
  create unique index if not exists constraints_check_unique on oracle.constraints_log (database_log, name, "type", from_catalog, from_schema, from_table, check_clause, deleted) where "type" = 'CHECK';
  create unique index if not exists constraints_unique on oracle.constraints_log (database_log, name, "type", from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted);
  create index if not exists constraints_log_from_column on oracle.constraints_log (from_column);
  create index if not exists constraints_log_to_column on oracle.constraints_log (to_column);
  create index if not exists constraints_log_from_table on oracle.constraints_log (from_table);
  create index if not exists constraints_log_to_table on oracle.constraints_log (to_table);
  create index if not exists constraints_log_type_database_log on oracle.constraints_log (type, database_log);
  create index if not exists constraints_observed_on on oracle.constraints_log (database_log, name, "type", from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, check_clause, observed_on desc nulls last);

  create or replace view oracle.constraints as
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
      from oracle.constraints_log
        left join oracle.tables_log from_tables_log on constraints_log.from_table = from_tables_log.table_log
        left join oracle.tables_log to_tables_log on constraints_log.to_table = to_tables_log.table_log
        left join oracle.columns_log from_columns_log on constraints_log.from_column = from_columns_log.column_log
        left join oracle.columns_log to_columns_log on constraints_log.to_column = to_columns_log.column_log
        left join oracle.databases_log on constraints_log.database_log = databases_log.database_log
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
  comment on view "oracle"."constraints" IS E'@name oracleConstraints';
  comment on table "oracle"."constraints_log" IS E'@name oracleConstraintsLog';

  create table if not exists oracle.foreign_servers_log (
    foreign_server_log uuid not null primary key,
    foreign_server uuid not null,
    database_log uuid references oracle.databases_log(database_log) not null,
    catalog varchar(1024) not null,
    owner varchar(1024) not null,
    name varchar(1024) not null,
    username varchar(1024) not null,
    connection varchar(1024) not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists foreign_servers_log_unique on oracle.foreign_servers_log (database_log, catalog, owner, name, username, connection, deleted);
  create index if not exists foreign_servers_log_deleted on oracle.foreign_servers_log (database_log);
  create or replace view oracle.foreign_servers as
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
      from oracle.foreign_servers_log
        join oracle.databases_log on foreign_servers_log.database_log = databases_log.database_log)
    select foreign_server_log, foreign_server, database_log, catalog, owner, name, username, connection, observed_on
    from ordered_list
    where rn=1 and foreign_server_deleted = false and database_deleted = false;
  comment on view "oracle"."foreign_servers" IS E'@name oracleForeignServers';
  comment on table "oracle"."foreign_servers_log" IS E'@name oracleForeignServersLog';

  create table if not exists oracle.column_statistics_log (
    "column_statistic" uuid not null primary key, 
    database_log uuid references oracle.databases_log(database_log) not null,
    catalog varchar(1024) not null, 
    schema varchar(1024) not null, 
    table_log uuid references oracle.tables_log(table_log) not null, 
    column_log uuid references oracle.columns_log(column_log) not null, 
    num_distinct bigint not null,
    low_value text not null,
    high_value text not null,
    density float not null,
    num_nulls bigint not null, 
    num_buckets bigint not null,
    sample_size bigint not null,
    avg_col_len integer not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  comment on table "oracle"."column_statistics_log" IS E'@name oracleColumnStatisticsLog';
  create unique index if not exists column_statistics_pkey_unique on oracle.column_statistics_log (database_log, catalog, schema, table_log, column_log, num_distinct, low_value, high_value, density, num_nulls, sample_size, avg_col_len, deleted);
  create index if not exists column_statistics_log_table on oracle.column_statistics_log (table_log);
  create index if not exists column_statistics_log_column on oracle.column_statistics_log (column_log);
  create or replace view oracle.column_statistics as
    with ordered_list as ( 
      select
        column_statistics_log.column_statistic,
        column_statistics_log.database_log,
        column_statistics_log.catalog,
        column_statistics_log.schema,
        column_statistics_log.table_log,
        column_statistics_log.column_log,
        column_statistics_log.num_distinct,
        column_statistics_log.low_value,
        column_statistics_log.high_value,
        column_statistics_log.density,
        column_statistics_log.num_nulls,
        column_statistics_log.num_buckets,
        column_statistics_log.sample_size,
        column_statistics_log.avg_col_len,
        column_statistics_log.observed_on,
        column_statistics_log.deleted as rows_deleted,
        tables_log.deleted as tables_deleted,
        columns_log.deleted as columns_deleted,
        row_number() over (partition by column_statistics_log.database_log, column_statistics_log.catalog, column_statistics_log.schema, column_statistics_log.table_log, column_statistics_log.column_log order by column_statistics_log.observed_on desc) as rn
      from oracle.column_statistics_log
        join oracle.tables_log on column_statistics_log.table_log = tables_log.table_log
        join oracle.columns_log on column_statistics_log.column_log = columns_log.column_log) 
    select "column_statistic", database_log, catalog, schema, table_log, column_log, num_distinct, low_value, high_value, density, num_nulls, num_buckets, sample_size, avg_col_len, observed_on 
    from ordered_list 
    where rn=1 and rows_deleted = false and tables_deleted = false and columns_deleted = false;
  comment on view "oracle"."column_statistics" IS E'@name oracleColumnStatistics';

  create table if not exists oracle.table_statistics_log (
    "table_statistic" uuid not null primary key, 
    database_log uuid references oracle.databases_log(database_log) not null,
    catalog varchar(1024) not null, 
    schema varchar(1024) not null, 
    table_log uuid references oracle.tables_log(table_log) not null, 
    row_amount_estimate bigint not null, 
    index_size bigint not null, 
    table_size bigint not null,
    blocks bigint not null,
    empty_blocks bigint not null,
    avg_row_length bigint not null,
    index_hit_rate float not null,
    table_hit_rate float not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists table_statistics_pkey_unique on oracle.table_statistics_log (database_log, catalog, schema, table_log, row_amount_estimate, blocks, empty_blocks, avg_row_length, index_hit_rate, table_hit_rate, deleted);
  create index if not exists table_statistics_log_table on oracle.table_statistics_log (table_log);
  create or replace view oracle.table_statistics as
    with ordered_list as ( 
      select
        table_statistics_log.table_statistic,
        table_statistics_log.database_log,
        table_statistics_log.catalog,
        table_statistics_log.schema,
        table_statistics_log.table_log,
        table_statistics_log.row_amount_estimate,
        table_statistics_log.blocks,
        table_statistics_log.empty_blocks,
        table_statistics_log.avg_row_length,
        table_statistics_log.index_size,
        table_statistics_log.table_size,
        table_statistics_log.index_hit_rate,
        table_statistics_log.table_hit_rate,
        table_statistics_log.observed_on,
        table_statistics_log.deleted as rows_deleted,
        tables_log.deleted as tables_deleted,
        row_number() over (partition by table_statistics_log.database_log, table_statistics_log.catalog, table_statistics_log.schema, table_statistics_log.table_log order by table_statistics_log.observed_on desc) as rn
      from oracle.table_statistics_log
        join oracle.tables_log on table_statistics_log.table_log = tables_log.table_log) 
    select "table_statistic", database_log, catalog, schema, table_log, row_amount_estimate, blocks, empty_blocks, avg_row_length, index_size, table_size, index_hit_rate, table_hit_rate, observed_on 
    from ordered_list 
    where rn=1 and rows_deleted = false and tables_deleted = false;
  comment on view "oracle"."table_statistics" IS E'@name oracleTableStatistics';
  comment on table "oracle"."table_statistics_log" IS E'@name oracleTableStatisticsLog';


  create table if not exists oracle.database_statistics_log (
    "database_statistic" uuid not null primary key, 
    database_log uuid references oracle.databases_log(database_log) not null,
    max_connections int not null, 
    used_connections int not null, 
    reserved_connections int not null, 
    available_connections int not null, 
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists database_statistics_pkey_unique on oracle.database_statistics_log (database_log, max_connections, used_connections, reserved_connections, available_connections, deleted);
  create or replace view oracle.database_statistics as
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
      from oracle.database_statistics_log) 
    select "database_statistic", database_log, max_connections, used_connections, reserved_connections, available_connections, percent_of_max_connections, observed_on 
    from ordered_list 
    where rn=1 and database_statistic_deleted = false;

  comment on view "oracle"."database_statistics" IS E'@name oracleDatabaseStatistics';
  comment on table "oracle"."database_statistics_log" IS E'@name oracleDatabaseStatisticsLog';
  
end
$$;