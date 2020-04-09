do $$
begin

  create schema if not exists metadata;

  -- check if dependency exists before creating these links
  if (select count(*) from information_schema.schemata where
    schema_name = 'kubernetes' or
    schema_name = 'postgresql' or
    schema_name = 'aws' or
    schema_name = 'akkeris'
  ) = 4 then
  if (select count(*) from information_schema.tables where 
    (table_schema = 'postgresql' and table_name = 'databases_log')
  ) = 1 then

    create table if not exists metadata.labels_on_postgresql_databases (
      label uuid primary key not null,
      name varchar(128) not null 
        constraint check_name_length check(length(name) > 2) 
        constraint alpha_numeric_name check(name ~* '^[A-Za-z0-9\.\-]+$'),
      value varchar(128) not null
        constraint alpha_numeric_value check(value ~* '^[A-Za-z0-9\.\-]*$'),
      implicit boolean not null default false,
      database uuid not null references postgresql.databases_log("database")
    );
    create index if not exists labels_on_postgresql_databases_label on metadata.labels_on_postgresql_databases("label");
    create index if not exists metadata_labels_on_postgresql_databases_database on metadata.labels_on_postgresql_databases("database");
    create unique index if not exists name_value_unique_labels_on_postgresql_databases on metadata.labels_on_postgresql_databases (name, value, implicit, "database");

    create table if not exists metadata.annotations_on_postgresql_databases (
      annotation uuid primary key not null,
      name varchar(128) not null 
        constraint check_name_length check(length(name) > 2) 
        constraint alpha_numeric_name check(name ~* '^[A-Za-z0-9\.\-]+$'),
      value text not null,
      implicit boolean not null default false,
      database uuid not null references postgresql.databases_log("database")
    );
    create index if not exists annotations_on_postgresql_databases_annotation on metadata.annotations_on_postgresql_databases("annotation");
    create index if not exists metadata_annotations_on_postgresql_databases on metadata.annotations_on_postgresql_databases("database");
    create unique index if not exists name_unique_annotations_on_postgresql_databases on metadata.annotations_on_postgresql_databases (name, implicit, "database");

    create table if not exists metadata.labels_on_postgresql_tables (
      label uuid primary key not null,
      name varchar(128) not null 
        constraint check_name_length check(length(name) > 2) 
        constraint alpha_numeric_name check(name ~* '^[A-Za-z0-9\.\-]+$'),
      value varchar(128) not null
        constraint alpha_numeric_value check(value ~* '^[A-Za-z0-9\.\-]*$'),
      implicit boolean not null default false,
      "table" uuid not null references postgresql.tables_log("table")
    );
    create index if not exists labels_on_postgresql_tables_label on metadata.labels_on_postgresql_tables("label");
    create index if not exists metadta_labels_on_postgresql_tables_table on metadata.labels_on_postgresql_tables("table");
    create unique index if not exists name_value_unique_labels_on_postgresql_tables on metadata.labels_on_postgresql_tables (name, value, implicit, "table");

    create table if not exists metadata.annotations_on_postgresql_tables (
      annotation uuid primary key not null,
      name varchar(128) not null 
        constraint check_name_length check(length(name) > 2) 
        constraint alpha_numeric_name check(name ~* '^[A-Za-z0-9\.\-]+$'),
      value text not null,
      implicit boolean not null default false,
      "table" uuid not null references postgresql.tables_log("table")
    );
    create index if not exists annotations_on_postgresql_tables_annotation on metadata.annotations_on_postgresql_tables("annotation");
    create index if not exists metadata_annotations_on_postgresql_tables_table on metadata.annotations_on_postgresql_tables("table");
    create unique index if not exists name_unique_annotations_on_postgresql_tables on metadata.annotations_on_postgresql_tables (name, implicit, "table");

    create table if not exists metadata.labels_on_postgresql_columns (
      label uuid primary key not null,
      name varchar(128) not null 
        constraint check_name_length check(length(name) > 2) 
        constraint alpha_numeric_name check(name ~* '^[A-Za-z0-9\.\-]+$'),
      value varchar(128) not null
        constraint alpha_numeric_value check(value ~* '^[A-Za-z0-9\.\-]*$'),
      implicit boolean not null default false,
      "column" uuid not null references postgresql.columns_log("column")
    );
    create index if not exists labels_on_postgresql_columns_label on metadata.labels_on_postgresql_columns("label");
    create index if not exists metadata_labels_on_postgresql_columns_column on metadata.labels_on_postgresql_columns("column");
    create unique index if not exists name_value_unique_labels_on_postgresql_columns on metadata.labels_on_postgresql_columns (name, value, implicit, "column");

    create table if not exists metadata.annotations_on_postgresql_columns (
      annotation uuid primary key not null,
      name varchar(128) not null 
        constraint check_name_length check(length(name) > 2) 
        constraint alpha_numeric_name check(name ~* '^[A-Za-z0-9\.\-]+$'),
      value text not null,
      implicit boolean not null default false,
      "column" uuid not null references postgresql.columns_log("column")
    );
    create index if not exists annotations_on_postgresql_columns_annotation on metadata.annotations_on_postgresql_columns("annotation");
    create index if not exists labels_on_postgresql_columns_annotation on metadata.annotations_on_postgresql_columns("column");
    create unique index if not exists name_unique_annotations_on_postgresql_columns on metadata.annotations_on_postgresql_columns (name, implicit, "column");

    create table if not exists metadata.labels_on_kubernetes_deployments (
      label uuid primary key not null,
      name varchar(128) not null 
        constraint check_name_length check(length(name) > 2) 
        constraint alpha_numeric_name check(name ~* '^[A-Za-z0-9\.\-]+$'),
      value varchar(128) not null
        constraint alpha_numeric_value check(value ~* '^[A-Za-z0-9\.\-]*$'),
      implicit boolean not null default false,
      deployment uuid not null references kubernetes.deployments_log("deployment")
    );
    create index if not exists labels_on_kubernetes_deployments_label on metadata.labels_on_kubernetes_deployments("label");
    create index if not exists metadata_labels_on_kubernetes_deployments_deployment on metadata.labels_on_kubernetes_deployments("deployment");
    create unique index if not exists name_value_unique_labels_on_kubernetes_deployments on metadata.labels_on_kubernetes_deployments (name, value, implicit, "deployment");

    create table if not exists metadata.annotations_on_kubernetes_deployments (
      annotation uuid primary key not null,
      name varchar(128) not null 
        constraint check_name_length check(length(name) > 2) 
        constraint alpha_numeric_name check(name ~* '^[A-Za-z0-9\.\-]+$'),
      value text not null,
      implicit boolean not null default false,
      deployment uuid not null references kubernetes.deployments_log("deployment")
    );
    create index if not exists annotations_on_kubernetes_deployments_annotation on metadata.annotations_on_kubernetes_deployments("annotation");
    create index if not exists metadata_annotations_on_kubernetes_deployments_deployment on metadata.annotations_on_kubernetes_deployments("deployment");
    create unique index if not exists name_unique_annotations_on_kubernetes_deployments on metadata.annotations_on_kubernetes_deployments (name, implicit, "deployment");

    create or replace view metadata.objects as
      with postgres_databases as (
        select
          postgresql.databases_log.database,
          postgresql.databases_log.name,
          postgresql.databases_log.host,
          postgresql.databases_log.port,
          postgresql.databases_log.observed_on,
          postgresql.databases_log.deleted,
          ('{' || string_agg('"' || metadata.labels_on_postgresql_databases.name || '":"' ||  metadata.labels_on_postgresql_databases.value || '"', ',') || '}')::jsonb as labels,
          ('{' || string_agg('"' || metadata.annotations_on_postgresql_databases.name || '":"' ||  metadata.annotations_on_postgresql_databases.value || '"', ',') || '}')::jsonb as annotations,
          row_number() over (
            partition by 
              postgresql.databases_log.name, 
              postgresql.databases_log.host, 
              postgresql.databases_log.port 
            order by 
              postgresql.databases_log.observed_on desc
          ) as rn
        from postgresql.databases_log
          left join metadata.labels_on_postgresql_databases on 
            postgresql.databases_log.database = metadata.labels_on_postgresql_databases.database
          left join metadata.annotations_on_postgresql_databases on 
            postgresql.databases_log.database = metadata.annotations_on_postgresql_databases.database
        where postgresql.databases_log.name != ''
        group by
          postgresql.databases_log.database,
          postgresql.databases_log.name,
          postgresql.databases_log.host,
          postgresql.databases_log.port,
          postgresql.databases_log.observed_on,
          postgresql.databases_log.deleted
      )
      select
        postgres_databases.database as id,
        'postgresql.databases' as "type",
        postgres_databases.name,
        postgres_databases.host || ':' || postgres_databases.port as definition,
        postgres_databases.observed_on,
        postgres_databases.labels,
        postgres_databases.annotations,
        ('{"connections":' || postgresql.database_statistics.used_connections || 
          ',"max_connections":' || postgresql.database_statistics.max_connections || '}')::jsonb as status
      from postgres_databases 
        left join postgresql.database_statistics 
          on postgresql.database_statistics.database = postgres_databases.database
      where rn=1 and deleted = false;
  end if;
  end if;
end
$$;