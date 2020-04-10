do $$
begin

  create schema if not exists links;

  -- check if dependency exists before creating these links
  if (select count(*) from information_schema.schemata where
    schema_name = 'kubernetes' or
    schema_name = 'postgresql' or
    schema_name = 'akkeris'
  ) = 3 then

  if (select count(*) from information_schema.tables where 
    (table_schema = 'postgresql' and table_name = 'roles') or 
    (table_schema = 'kubernetes' and table_name = 'pods') or 
    (table_schema = 'kubernetes' and table_name = 'config_maps') or
    (table_schema = 'kubernetes' and table_name = 'deployments') or
    (table_schema = 'akkeris' and table_name = 'apps')
  ) = 5 then

    -- postgresql links
    create table if not exists links.from_kubernetes_pods_to_postgresql_roles_log (
      link uuid not null primary key,
      pod uuid references kubernetes.pods_log("pod") not null,
      role uuid references postgresql.roles_log("role") not null,
      observed_on timestamp with time zone default now(),
      deleted boolean not null default false
    );
    create unique index if not exists from_kubernetes_pods_to_postgresql_roles_log_unique on links.from_kubernetes_pods_to_postgresql_roles_log (pod, role, deleted);
    create index if not exists from_kubernetes_pods_to_postgresql_roles_log_role on links.from_kubernetes_pods_to_postgresql_roles_log (role);
    create or replace view links.from_kubernetes_pods_to_postgresql_roles as
      with ordered_list as (
        select
          links.from_kubernetes_pods_to_postgresql_roles_log.link,
          links.from_kubernetes_pods_to_postgresql_roles_log.pod,
          links.from_kubernetes_pods_to_postgresql_roles_log.role,
          links.from_kubernetes_pods_to_postgresql_roles_log.observed_on,
          links.from_kubernetes_pods_to_postgresql_roles_log.deleted,
          row_number() over (partition by links.from_kubernetes_pods_to_postgresql_roles_log.pod, links.from_kubernetes_pods_to_postgresql_roles_log.role order by links.from_kubernetes_pods_to_postgresql_roles_log.observed_on desc) as rn
        from links.from_kubernetes_pods_to_postgresql_roles_log
        join kubernetes.pods on kubernetes.pods.pod = links.from_kubernetes_pods_to_postgresql_roles_log.pod
        join postgresql.roles on postgresql.roles.role = links.from_kubernetes_pods_to_postgresql_roles_log.role
      )
      select link, pod, role, observed_on from ordered_list where rn=1 and deleted = false;


    create table if not exists links.from_kubernetes_deployments_to_postgresql_roles_log (
      link uuid not null primary key,
      deployment uuid references kubernetes.deployments_log("deployment") not null,
      role uuid references postgresql.roles_log("role") not null,
      observed_on timestamp with time zone default now(),
      deleted boolean not null default false
    );
    create unique index if not exists from_kubernetes_deployments_to_postgresql_roles_log_unique on links.from_kubernetes_deployments_to_postgresql_roles_log (deployment, role, deleted);
    create index if not exists from_kubernetes_deployments_to_postgresql_roles_log_role on links.from_kubernetes_deployments_to_postgresql_roles_log (role);
    create or replace view links.from_kubernetes_deployments_to_postgresql_roles as
      with ordered_list as (
        select
          links.from_kubernetes_deployments_to_postgresql_roles_log.link,
          links.from_kubernetes_deployments_to_postgresql_roles_log.deployment,
          links.from_kubernetes_deployments_to_postgresql_roles_log.role,
          links.from_kubernetes_deployments_to_postgresql_roles_log.observed_on,
          links.from_kubernetes_deployments_to_postgresql_roles_log.deleted,
          row_number() over (partition by links.from_kubernetes_deployments_to_postgresql_roles_log.deployment, links.from_kubernetes_deployments_to_postgresql_roles_log.role order by links.from_kubernetes_deployments_to_postgresql_roles_log.observed_on desc) as rn
        from links.from_kubernetes_deployments_to_postgresql_roles_log
        join kubernetes.deployments on kubernetes.deployments.deployment = links.from_kubernetes_deployments_to_postgresql_roles_log.deployment
        join postgresql.roles on postgresql.roles.role = links.from_kubernetes_deployments_to_postgresql_roles_log.role
      )
      select link, deployment, role, observed_on from ordered_list where rn=1 and deleted = false;


    create table if not exists links.from_kubernetes_config_maps_to_postgresql_roles_log (
      link uuid not null primary key,
      config_map uuid references kubernetes.config_maps_log("config_map") not null,
      role uuid references postgresql.roles_log("role") not null,
      observed_on timestamp with time zone default now(),
      deleted boolean not null default false
    );
    create unique index if not exists from_kubernetes_config_maps_to_postgresql_roles_log_unqiue on links.from_kubernetes_config_maps_to_postgresql_roles_log (config_map, role, deleted);
    create index if not exists from_kubernetes_config_maps_to_postgresql_roles_log_role on links.from_kubernetes_config_maps_to_postgresql_roles_log (role);
    create or replace view links.from_kubernetes_config_maps_to_postgresql_roles as
      with ordered_list as ( 
        select
          links.from_kubernetes_config_maps_to_postgresql_roles_log.link,
          links.from_kubernetes_config_maps_to_postgresql_roles_log.config_map,
          links.from_kubernetes_config_maps_to_postgresql_roles_log.role,
          links.from_kubernetes_config_maps_to_postgresql_roles_log.observed_on,
          links.from_kubernetes_config_maps_to_postgresql_roles_log.deleted,
          row_number() over (partition by links.from_kubernetes_config_maps_to_postgresql_roles_log.config_map, links.from_kubernetes_config_maps_to_postgresql_roles_log.role order by links.from_kubernetes_config_maps_to_postgresql_roles_log.observed_on desc) as rn
        from links.from_kubernetes_config_maps_to_postgresql_roles_log
        join kubernetes.config_maps on kubernetes.config_maps.config_map = links.from_kubernetes_config_maps_to_postgresql_roles_log.config_map
        join postgresql.roles on postgresql.roles.role = links.from_kubernetes_config_maps_to_postgresql_roles_log.role
      )
      select link, config_map, role, observed_on from ordered_list where rn=1 and deleted = false;


    create table if not exists links.from_kubernetes_replicasets_to_postgresql_roles_log (
      link uuid not null primary key,
      replicaset uuid references kubernetes.replicasets_log("replicaset") not null,
      role uuid references postgresql.roles_log("role") not null,
      observed_on timestamp with time zone default now(),
      deleted boolean not null default false
    );
    create unique index if not exists from_kubernetes_replicasets_to_postgresql_roles_log_unqiue on links.from_kubernetes_replicasets_to_postgresql_roles_log (replicaset, role, deleted);
    create index if not exists from_kubernetes_replicasets_to_postgresql_roles_log_role on links.from_kubernetes_replicasets_to_postgresql_roles_log (role);
    create or replace view links.from_kubernetes_replicasets_to_postgresql_roles as
      with ordered_list as ( 
        select
          links.from_kubernetes_replicasets_to_postgresql_roles_log.link,
          links.from_kubernetes_replicasets_to_postgresql_roles_log.replicaset,
          links.from_kubernetes_replicasets_to_postgresql_roles_log.role,
          links.from_kubernetes_replicasets_to_postgresql_roles_log.observed_on,
          links.from_kubernetes_replicasets_to_postgresql_roles_log.deleted,
          row_number() over (partition by links.from_kubernetes_replicasets_to_postgresql_roles_log.replicaset, links.from_kubernetes_replicasets_to_postgresql_roles_log.role order by links.from_kubernetes_replicasets_to_postgresql_roles_log.observed_on desc) as rn
        from links.from_kubernetes_replicasets_to_postgresql_roles_log
        join kubernetes.replicasets on kubernetes.replicasets.replicaset = links.from_kubernetes_replicasets_to_postgresql_roles_log.replicaset
        join postgresql.roles on postgresql.roles.role = links.from_kubernetes_replicasets_to_postgresql_roles_log.role
      )
      select link, replicaset, role, observed_on from ordered_list where rn=1 and deleted = false;


    -- kubernetes links
    create table if not exists links.from_kubernetes_pods_to_kubernetes_replicasets_log (
      link uuid not null primary key,
      pod uuid references kubernetes.pods_log("pod") not null,
      replicaset uuid references kubernetes.replicasets_log("replicaset") not null,
      observed_on timestamp with time zone default now(),
      deleted boolean not null default false
    );
    create index if not exists from_kubernetes_pods_to_kubernetes_replicasets_log_replicaset on links.from_kubernetes_pods_to_kubernetes_replicasets_log(replicaset);
    create unique index if not exists from_kubernetes_pods_to_kubernetes_replicasets_log_unqiue on links.from_kubernetes_pods_to_kubernetes_replicasets_log(pod, replicaset, deleted);
    create index if not exists from_kubernetes_pods_to_kubernetes_replicasets_log_pod on links.from_kubernetes_pods_to_kubernetes_replicasets_log (pod);
    create or replace view links.from_kubernetes_pods_to_kubernetes_replicasets as
      with ordered_list as ( 
        select
          links.from_kubernetes_pods_to_kubernetes_replicasets_log.link,
          links.from_kubernetes_pods_to_kubernetes_replicasets_log.pod,
          links.from_kubernetes_pods_to_kubernetes_replicasets_log.replicaset,
          links.from_kubernetes_pods_to_kubernetes_replicasets_log.observed_on,
          links.from_kubernetes_pods_to_kubernetes_replicasets_log.deleted,
          row_number() over (partition by links.from_kubernetes_pods_to_kubernetes_replicasets_log.pod, links.from_kubernetes_pods_to_kubernetes_replicasets_log.replicaset order by links.from_kubernetes_pods_to_kubernetes_replicasets_log.observed_on desc) as rn
        from links.from_kubernetes_pods_to_kubernetes_replicasets_log
        join kubernetes.pods on kubernetes.pods.pod = links.from_kubernetes_pods_to_kubernetes_replicasets_log.pod
        join kubernetes.replicasets on kubernetes.replicasets.replicaset = links.from_kubernetes_pods_to_kubernetes_replicasets_log.replicaset
      )
      select link, pod, replicaset, observed_on from ordered_list where rn=1 and deleted = false;

    create table if not exists links.from_kubernetes_replicasets_to_kubernetes_deployments_log (
      link uuid not null primary key,
      replicaset uuid references kubernetes.replicasets_log("replicaset") not null,
      deployment uuid references kubernetes.deployments_log("deployment") not null,
      observed_on timestamp with time zone default now(),
      deleted boolean not null default false
    );
    create index if not exists from_kubernetes_replicasets_to_kubernetes_deployments_log_replicaset on links.from_kubernetes_replicasets_to_kubernetes_deployments_log(replicaset);
    create unique index if not exists from_kubernetes_replicasets_to_kubernetes_deployments_log_unqiue on links.from_kubernetes_replicasets_to_kubernetes_deployments_log(replicaset, deployment, deleted);
    create index if not exists from_kubernetes_pods_to_kubernetes_replicasets_log_deployment on links.from_kubernetes_replicasets_to_kubernetes_deployments_log (deployment);
    create or replace view links.from_kubernetes_replicasets_to_kubernetes_deployments as
      with ordered_list as ( 
        select
          links.from_kubernetes_replicasets_to_kubernetes_deployments_log.link,
          links.from_kubernetes_replicasets_to_kubernetes_deployments_log.replicaset,
          links.from_kubernetes_replicasets_to_kubernetes_deployments_log.deployment,
          links.from_kubernetes_replicasets_to_kubernetes_deployments_log.observed_on,
          links.from_kubernetes_replicasets_to_kubernetes_deployments_log.deleted,
          row_number() over (partition by links.from_kubernetes_replicasets_to_kubernetes_deployments_log.replicaset, links.from_kubernetes_replicasets_to_kubernetes_deployments_log.deployment order by links.from_kubernetes_replicasets_to_kubernetes_deployments_log.observed_on desc) as rn
        from links.from_kubernetes_replicasets_to_kubernetes_deployments_log
        join kubernetes.deployments on kubernetes.deployments.deployment = links.from_kubernetes_replicasets_to_kubernetes_deployments_log.deployment
        join kubernetes.replicasets on kubernetes.replicasets.replicaset = links.from_kubernetes_replicasets_to_kubernetes_deployments_log.replicaset
      )
      select link, replicaset, deployment, observed_on from ordered_list where rn=1 and deleted = false;

    create table if not exists links.from_kubernetes_deployments_to_kubernetes_config_maps_log (
      link uuid not null primary key,
      deployment uuid references kubernetes.deployments_log("deployment") not null,
      config_map uuid references kubernetes.config_maps_log("config_map") not null,
      observed_on timestamp with time zone default now(),
      deleted boolean not null default false
    );
    create index if not exists from_kubernetes_deployments_to_kubernetes_config_maps_log_config_map on links.from_kubernetes_deployments_to_kubernetes_config_maps_log(config_map);
    create unique index if not exists from_kubernetes_deployments_to_kubernetes_configmaps_log_unqiue on links.from_kubernetes_deployments_to_kubernetes_config_maps_log(deployment, config_map, deleted);
    create index if not exists from_kubernetes_deployments_to_kubernetes_config_maps_log_deployment on links.from_kubernetes_deployments_to_kubernetes_config_maps_log (deployment);
    create or replace view links.from_kubernetes_deployments_to_kubernetes_config_maps as
      with ordered_list as ( 
        select
          links.from_kubernetes_deployments_to_kubernetes_config_maps_log.link,
          links.from_kubernetes_deployments_to_kubernetes_config_maps_log.deployment,
          links.from_kubernetes_deployments_to_kubernetes_config_maps_log.config_map,
          links.from_kubernetes_deployments_to_kubernetes_config_maps_log.observed_on,
          links.from_kubernetes_deployments_to_kubernetes_config_maps_log.deleted,
          row_number() over (partition by links.from_kubernetes_deployments_to_kubernetes_config_maps_log.deployment, links.from_kubernetes_deployments_to_kubernetes_config_maps_log.config_map order by links.from_kubernetes_deployments_to_kubernetes_config_maps_log.observed_on desc) as rn
        from links.from_kubernetes_deployments_to_kubernetes_config_maps_log
        join kubernetes.deployments on kubernetes.deployments.deployment = links.from_kubernetes_deployments_to_kubernetes_config_maps_log.deployment
        join kubernetes.config_maps on kubernetes.config_maps.config_map = links.from_kubernetes_deployments_to_kubernetes_config_maps_log.config_map
      )
      select link, deployment, config_map, observed_on from ordered_list where rn=1 and deleted = false;

    -- akkeris links
    create table if not exists links.from_kubernetes_deployments_to_akkeris_apps_log (
      link uuid not null primary key,
      deployment uuid references kubernetes.deployments_log("deployment") not null,
      app_log uuid references akkeris.apps_log("app_log") not null,
      observed_on timestamp with time zone default now(),
      deleted boolean not null default false
    );
    create index if not exists from_kubernetes_deployments_to_akkeris_apps_log_app on links.from_kubernetes_deployments_to_akkeris_apps_log(app_log);
    create unique index if not exists from_kubernetes_deployments_to_akkeris_apps_log_unqiue on links.from_kubernetes_deployments_to_akkeris_apps_log(deployment, app_log, deleted);
    create index if not exists ffrom_kubernetes_deployments_to_akkeris_apps_log_deployment on links.from_kubernetes_deployments_to_akkeris_apps_log (deployment);
    create or replace view links.from_kubernetes_deployments_to_akkeris_apps as
      with ordered_list as ( 
        select
          links.from_kubernetes_deployments_to_akkeris_apps_log.link,
          links.from_kubernetes_deployments_to_akkeris_apps_log.deployment,
          links.from_kubernetes_deployments_to_akkeris_apps_log.app_log,
          links.from_kubernetes_deployments_to_akkeris_apps_log.observed_on,
          links.from_kubernetes_deployments_to_akkeris_apps_log.deleted,
          row_number() over (partition by links.from_kubernetes_deployments_to_akkeris_apps_log.deployment, links.from_kubernetes_deployments_to_akkeris_apps_log.app_log order by links.from_kubernetes_deployments_to_akkeris_apps_log.observed_on desc) as rn
        from links.from_kubernetes_deployments_to_akkeris_apps_log
        join kubernetes.deployments on kubernetes.deployments.deployment = links.from_kubernetes_deployments_to_akkeris_apps_log.deployment
        join akkeris.apps_log on akkeris.apps_log.app_log = links.from_kubernetes_deployments_to_akkeris_apps_log.app_log
      )
      select link, deployment, app_log, observed_on from ordered_list where rn=1 and deleted = false;

    -- no log is necessary as we can auto-populate the linkages without processing
    create or replace view links.from_akkeris_apps_to_akkeris_sites as
      with ordered_list as ( 
        select
          uuid_generate_v5(uuid_ns_url(), akkeris.routes.site::text || akkeris.routes.app::text) as link,
          akkeris.sites.site_log,
          akkeris.apps.app_log,
          akkeris.routes.target_path,
          akkeris.routes.source_path,
          akkeris.sites.name as site_name,
          akkeris.apps.name as app_name,
          akkeris.routes.observed_on,
          row_number() over (partition by akkeris.sites.site_log, akkeris.apps.app_log order by akkeris.routes.observed_on desc) as rn
        from akkeris.routes
        join akkeris.sites on akkeris.routes.site = akkeris.sites.site
        join akkeris.apps on akkeris.apps.app = akkeris.routes.app
      )
      select link, site_log, app_log, site_name, app_name, target_path, source_path, observed_on from ordered_list where rn=1;

  end if;
  end if;
end
$$;