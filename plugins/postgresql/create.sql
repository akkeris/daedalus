do $$
begin

  create schema if not exists postgresql;
  create extension if not exists pgcrypto;
  create extension if not exists "uuid-ossp";


  create table if not exists postgresql.databases_log (
    database uuid not null primary key,
    name varchar(128) not null,
    host varchar(1024) not null,
    port int not null CHECK(port > 0),
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists databases_unique on postgresql.databases_log (name, host, port, deleted);
  create index if not exists databases_observed_on on postgresql.databases_log (name, host, port, observed_on desc);
  create or replace view postgresql.databases as
    with ordered_list as ( select
      database,
      name,
      host,
      port,
      observed_on,
      deleted,
      row_number() over (partition by name, host, port order by observed_on desc) as rn
    from postgresql.databases_log)
    select database, name, host, port, observed_on from ordered_list where rn=1 and deleted = false;


  create table if not exists postgresql.roles_log (
    role uuid not null primary key,
    database uuid references postgresql.databases_log("database") not null,
    username varchar(1024) not null,
    password varchar(1024) not null,
    options varchar(2048) not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists roles_unique on postgresql.roles_log (database, username, password, deleted);
  create index if not exists roles_observed_on on postgresql.roles_log (database, username, password, observed_on desc);
  create or replace view postgresql.roles as
    with ordered_list as ( select
      roles_log.database,
      roles_log.username,
      roles_log.password,
      roles_log.options,
      roles_log.observed_on,
      roles_log.deleted as roles_deleted,
      databases_log.deleted as databases_deleted,
      row_number() over (partition by roles_log.database, roles_log.username, roles_log.password order by roles_log.observed_on desc) as rn
    from postgresql.roles_log join postgresql.databases_log on roles_log.database = databases_log.database)
    select database, username, password, options, observed_on from ordered_list where rn=1 and roles_deleted = false and databases_deleted = false;


  create table if not exists postgresql.tables_log (
    "table" uuid not null primary key,
    database uuid references postgresql.databases_log("database") not null,
    catalog varchar(1024) not null,
    schema varchar(1024) not null,
    name varchar(1024) not null,
    is_view boolean not null default false,
    definition text not null default '',
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists tables_unique on postgresql.tables_log (database, catalog, schema, name, is_view, definition, deleted);
  create index if not exists tables_observed_on on postgresql.tables_log (database, catalog, schema, name, is_view, definition, observed_on desc);
  create or replace view postgresql.tables as
    with ordered_list as ( select
      tables_log.table,
      tables_log.database,
      tables_log.catalog,
      tables_log.schema,
      tables_log.name,
      tables_log.is_view,
      tables_log.definition,
      tables_log.observed_on,
      tables_log.deleted as tables_deleted,
      databases_log.deleted as databases_deleted,
      row_number() over (partition by tables_log.database, tables_log.catalog, tables_log.schema, tables_log.name, tables_log.is_view, tables_log.definition order by tables_log.observed_on desc) as rn
    from postgresql.tables_log join postgresql.databases_log on tables_log.database = databases_log.database)
    select "table", database, catalog, schema, name, is_view, definition, observed_on from ordered_list where rn=1 and tables_deleted = false and databases_deleted = false;


  create table if not exists postgresql.columns_log (
    "column" uuid not null primary key,
    database uuid references postgresql.databases_log("database") not null,
    catalog varchar(1024) not null,
    schema varchar(1024) not null,
    "table" uuid references postgresql.tables_log("table") not null,
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
  create unique index if not exists columns_unique on postgresql.columns_log (database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, deleted);
  create index if not exists columns_observed_on on postgresql.columns_log (database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, observed_on desc);
  create or replace view postgresql.columns as
    with ordered_list as ( select
      columns_log.column,
      columns_log.database,
      columns_log.catalog,
      columns_log.schema,
      columns_log.table,
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
      row_number() over (partition by columns_log.database, columns_log.catalog, columns_log.schema, columns_log.table, columns_log.name order by columns_log.observed_on desc) as rn
    from postgresql.columns_log join postgresql.tables_log on columns_log.table = tables_log.table join postgresql.databases_log on columns_log.database = databases_log.database)
    select "column", database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, observed_on from ordered_list where rn=1 and databases_deleted = false and tables_deleted = false and columns_deleted = false;


  create table if not exists postgresql.indexes_log (
    "index" uuid not null primary key,
    database uuid references postgresql.databases_log("database") not null,
    catalog varchar(1024) not null,
    schema varchar(1024) not null,
    "table" uuid references postgresql.tables_log("table") not null,
    name varchar(1024) not null,
    definition text not null default '',
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists indexes_unique on postgresql.indexes_log (database, catalog, schema, "table", name, definition, deleted);
  create index if not exists indexes_observed_on on postgresql.indexes_log (database, catalog, schema, "table", name, definition, observed_on desc);
  create or replace view postgresql.indexes as
    with ordered_list as ( select
      indexes_log.index,
      indexes_log.database,
      indexes_log.catalog,
      indexes_log.schema,
      indexes_log.table,
      indexes_log.name,
      indexes_log.definition,
      indexes_log.observed_on,
      indexes_log.deleted as indexes_deleted,
      tables_log.deleted as tables_deleted,
      databases_log.deleted as databases_deleted,
      row_number() over (partition by indexes_log.database, indexes_log.catalog, indexes_log.schema, indexes_log.table, indexes_log.name, indexes_log.definition order by indexes_log.observed_on desc) as rn
    from postgresql.indexes_log join postgresql.tables_log on indexes_log.table = tables_log.table join postgresql.databases_log on indexes_log.database = databases_log.database)
    select "index", database, catalog, schema, "table", name, definition, observed_on from ordered_list where rn=1 and indexes_deleted = false and tables_deleted = false and databases_deleted = false;


  create table if not exists postgresql.constraints_log (
    "constraint" uuid not null primary key,
    database uuid references postgresql.databases_log("database") not null,
    name varchar(1024) not null,
    "type" varchar(1024) not null,
    from_catalog varchar(1024) not null,
    from_schema varchar(1024) not null,
    from_table uuid references postgresql.tables_log("table") not null,
    from_column uuid references postgresql.columns_log("column"),
    to_catalog varchar(1024),
    to_schema varchar(1024),
    to_table uuid references postgresql.tables_log("table"),
    to_column uuid references postgresql.columns_log("column"),
    check_clause text,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );

  create unique index if not exists constraints_pkey_unique on postgresql.constraints_log (database, name, "type", from_catalog, from_schema, from_table, from_column, deleted) where "type" = 'PRIMARY KEY';
  create unique index if not exists constraints_fkey_unique on postgresql.constraints_log (database, name, "type", from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted) where "type" = 'FOREIGN KEY';
  create unique index if not exists constraints_check_unique on postgresql.constraints_log (database, name, "type", from_catalog, from_schema, from_table, check_clause, deleted) where "type" = 'CHECK';
  create unique index if not exists constraints_unique on postgresql.constraints_log (database, name, "type", from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, deleted);
  create index if not exists constraints_observed_on on postgresql.constraints_log (database, name, "type", from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, observed_on desc);
  create or replace view postgresql.constraints as
    with ordered_list as ( select
      constraints_log.constraint,
      constraints_log.database,
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
      row_number() over (partition by constraints_log.database, constraints_log.name, constraints_log.type, constraints_log.from_catalog, constraints_log.from_schema, constraints_log.from_table, constraints_log.from_column, constraints_log.to_catalog, constraints_log.to_schema, constraints_log.to_table, constraints_log.to_column, constraints_log.check_clause order by constraints_log.observed_on desc) as rn
    from postgresql.constraints_log
      left join postgresql.tables_log from_tables_log on constraints_log.from_table = from_tables_log.table
      left join postgresql.tables_log to_tables_log on constraints_log.to_table = to_tables_log.table
      left join postgresql.columns_log from_columns_log on constraints_log.from_column = from_columns_log.column
      left join postgresql.columns_log to_columns_log on constraints_log.to_column = to_columns_log.column
      left join postgresql.databases_log on constraints_log.database = databases_log.database)
    select "constraint", database, name, "type", from_catalog, from_schema, from_table, from_column, to_catalog, to_schema, to_table, to_column, check_clause, observed_on
    from ordered_list
    where rn=1 and
      constraints_deleted = false and
      (to_tables_deleted = false or to_tables_deleted is null) and
      from_tables_deleted = false and
      (to_columns_deleted = false or to_columns_deleted is null) and
      (from_columns_deleted = false or from_columns_deleted is null) and
      databases_deleted = false;
end
$$;