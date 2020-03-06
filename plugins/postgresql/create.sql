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
end
$$;