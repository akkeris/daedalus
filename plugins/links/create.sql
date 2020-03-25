do $$
begin

  create schema if not exists links;

  -- check if dependency exists before creating these links
  if (select count(*) from information_schema.schemata where
    schema_name = 'kubernetes' or
    schema_name = 'postgresql'
  ) = 2 then

  if (select count(*) from information_schema.tables where 
    (table_schema = 'postgresql' and table_name = 'roles') or 
    (table_schema = 'kubernetes' and table_name = 'pods') or 
    (table_schema = 'kubernetes' and table_name = 'config_maps') or
    (table_schema = 'kubernetes' and table_name = 'deployments') 
  ) = 4 then

    create table if not exists links.from_kubernetes_pods_to_postgresql_roles_log (
      link uuid not null primary key,
      pod uuid references kubernetes.pods_log("pod") not null,
      role uuid references postgresql.roles_log("role") not null,
      observed_on timestamp with time zone default now(),
      deleted boolean not null default false
    );
    create unique index if not exists from_kubernetes_pods_to_postgresql_roles_log_unique on links.from_kubernetes_pods_to_postgresql_roles_log (pod, role, deleted);
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

  end if;
  end if;
end
$$;