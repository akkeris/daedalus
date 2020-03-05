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
  create unique index if not exists databases_unique on postgresql.databases_log (name, host, port);
  create index if not exists databases_observed_on on postgresql.databases_log (name, host, port, observed_on desc);
  create or replace view postgresql.databases as
    with ordered_list as ( select
      database,
      name,
      host,
      port,
      observed_on,
      row_number() over (partition by name, host, port order by observed_on desc) as rn
    from postgresql.databases_log where deleted = false)
    select database, name, host, port, observed_on from ordered_list where rn=1;


  create table if not exists postgresql.roles_log (
    role uuid not null primary key,
    database uuid references postgresql.databases_log("database") not null,
    username varchar(1024) not null,
    password varchar(1024) not null,
    options varchar(2048) not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists roles_unique on postgresql.roles_log (database, username, password);
  create index if not exists roles_observed_on on postgresql.roles_log (database, username, password, observed_on desc);
  create or replace view postgresql.roles as
    with ordered_list as ( select
      database,
      username,
      password,
      options,
      observed_on,
      row_number() over (partition by database, username, password order by observed_on desc) as rn
    from postgresql.roles_log where deleted = false)
    select database, username, password, options, observed_on from ordered_list where rn=1;


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
  create unique index if not exists tables_unique on postgresql.tables_log (database, catalog, schema, name, is_view, definition);
  create index if not exists tables_observed_on on postgresql.tables_log (database, catalog, schema, name, is_view, definition, observed_on desc);
  create or replace view postgresql.tables as
    with ordered_list as ( select
      "table",
      database,
      catalog,
      schema,
      name,
      is_view,
      definition,
      observed_on,
      row_number() over (partition by database, catalog, schema, name, is_view, definition order by observed_on desc) as rn
    from postgresql.tables_log where deleted = false)
    select database, catalog, schema, name, is_view, definition, observed_on from ordered_list where rn=1;


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
  create unique index if not exists columns_unique on postgresql.columns_log (database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable);
  create index if not exists columns_observed_on on postgresql.columns_log (database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, observed_on desc);
  create or replace view postgresql.columns as
    with ordered_list as ( select
      "column",
      database,
      catalog,
      schema,
      "table",
      name,
      position,
      "default",
      is_nullable,
      data_type,
      character_maximum_length,
      character_octet_length,
      numeric_precision,
      numeric_precision_radix,
      numeric_scale,
      datetime_precision,
      is_updatable,
      observed_on,
      row_number() over (partition by database, catalog, schema, "table", name order by observed_on desc) as rn
    from postgresql.columns_log where deleted = false)
    select "column", database, catalog, schema, "table", name, position, "default", is_nullable, data_type, character_maximum_length, character_octet_length, numeric_precision, numeric_precision_radix, numeric_scale, datetime_precision, is_updatable, observed_on from ordered_list where rn=1;
end
$$;