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

    create table if not exists metadata.labels (
      label uuid primary key not null,
      name varchar(128) not null,
      value varchar(128) not null,
      implicit boolean not null
    );

    create table if not exists metadata.annotations (
      annotation uuid primary key not null,
      name text not null,
      value text not null,
      implicit boolean not null
    );

    create table if not exists metadata.labels_on_postgresql_databases (
      label uuid not null references metadata.labels("label"),
      database uuid not null references postgresql.databases_log("database")
    );
    create index if not exists labels_on_postgresql_databases_label on metadata.labels_on_postgresql_databases("label");
    create index if not exists metadata_labels_on_postgresql_databases_database on metadata.labels_on_postgresql_databases("database");

    create table if not exists metadata.annotations_on_postgresql_databases (
      annotation uuid not null references metadata.annotations("annotation"),
      database uuid not null references postgresql.databases_log("database")
    );
    create index if not exists annotations_on_postgresql_databases_annotation on metadata.annotations_on_postgresql_databases("annotation");
    create index if not exists metadata_annotations_on_postgresql_databases on metadata.annotations_on_postgresql_databases("database");

    create table if not exists metadata.labels_on_postgresql_tables (
      label uuid not null references metadata.labels("label"),
      "table" uuid not null references postgresql.tables_log("table")
    );
    create index if not exists labels_on_postgresql_tables_label on metadata.labels_on_postgresql_tables("label");
    create index if not exists metadta_labels_on_postgresql_tables_table on metadata.labels_on_postgresql_tables("table");

    create table if not exists metadata.annotations_on_postgresql_tables (
      annotation uuid not null references metadata.annotations("annotation"),
      "table" uuid not null references postgresql.tables_log("table")
    );
    create index if not exists annotations_on_postgresql_tables_annotation on metadata.annotations_on_postgresql_tables("annotation");
    create index if not exists metadata_annotations_on_postgresql_tables_table on metadata.annotations_on_postgresql_tables("table");

    create table if not exists metadata.labels_on_postgresql_columns (
      label uuid not null references metadata.labels("label"),
      "column" uuid not null references postgresql.columns_log("column")
    );
    create index if not exists labels_on_postgresql_columns_label on metadata.labels_on_postgresql_columns("label");
    create index if not exists metadata_annotations_on_postgresql_columns on metadata.annotations_on_postgresql_columns("column");

    create table if not exists metadata.annotations_on_postgresql_columns (
      annotation uuid not null references metadata.annotations("annotation"),
      "column" uuid not null references postgresql.columns_log("column")
    );
    create index if not exists annotations_on_postgresql_columns_annotation on metadata.annotations_on_postgresql_columns("annotation");
    create index if not exists metadata_labels_on_postgresql_columns_column on metadata.labels_on_postgresql_columns("column");

    create table if not exists metadata.labels_on_kubernetes_deployments (
      label uuid not null references metadata.labels("label"),
      deployment uuid not null references kubernetes.deployments_log("deployment")
    );
    create index if not exists labels_on_kubernetes_deployments_label on metadata.labels_on_kubernetes_deployments("label");
    create index if not exists metadata_labels_on_kubernetes_deployments_deployment on metadata.labels_on_kubernetes_deployments("deployment");

    create table if not exists metadata.annotations_on_kubernetes_deployments (
      annotation uuid not null references metadata.annotations("annotation"),
      deployment uuid not null references kubernetes.deployments_log("deployment")
    );
    create index if not exists annotations_on_kubernetes_deployments_annotation on metadata.annotations_on_kubernetes_deployments("annotation");
    create index if not exists metadata_annotations_on_kubernetes_deployments_deployment on metadata.annotations_on_kubernetes_deployments("deployment");

    create or replace view metadata.objects as
      with postgres_databases as (
        select
          postgresql.databases_log.database,
          postgresql.databases_log.name,
          postgresql.databases_log.host,
          postgresql.databases_log.port,
          postgresql.databases_log.observed_on,
          postgresql.databases_log.deleted,
          ('{' || string_agg('"' || metadata.labels.name || '":"' ||  metadata.labels.value || '"', ',') || '}')::jsonb as labels,
          ('{' || string_agg('"' || metadata.annotations.name || '":"' ||  metadata.annotations.value || '"', ',') || '}')::jsonb as annotations,
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
          left join metadata.labels on 
            metadata.labels.label = metadata.labels_on_postgresql_databases.label
          left join metadata.annotations_on_postgresql_databases on 
            postgresql.databases_log.database = metadata.annotations_on_postgresql_databases.database
          left join metadata.annotations on 
            metadata.annotations.annotation = metadata.annotations_on_postgresql_databases.annotation
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