do $$
begin

  create schema if not exists kubernetes;

  create extension if not exists pgcrypto;
  create extension if not exists "uuid-ossp";

  create table if not exists kubernetes.persistent_volumes_log (
    persistent_volume uuid not null primary key,
    name varchar(128) not null,
    context varchar(128) not null,
    definition jsonb not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists persistent_volumes_unique on kubernetes.persistent_volumes_log (name, context, ((definition->'metadata')->>'resourceVersion'));
  create index if not exists persistent_volume_observed_on on kubernetes.persistent_volumes_log (name, context, observed_on desc);
  create or replace view kubernetes.persistent_volumes as
    with ordered_list as ( select
      persistent_volume,
      name,
      context,
      definition,
      observed_on,
      row_number() over (partition by name, context order by observed_on desc) as rn
    from kubernetes.persistent_volumes_log where deleted = false) 
    select persistent_volume, name, context, definition, observed_on from ordered_list where rn=1;

  create table if not exists kubernetes.nodes_log (
    node uuid not null primary key,
    name varchar(128) not null,
    context varchar(128) not null,
    definition jsonb not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists nodes_unique on kubernetes.nodes_log (name, context, ((definition->'metadata')->>'resourceVersion'));
  create index if not exists nodes_observed_on on kubernetes.nodes_log (name, context, observed_on desc);
  create or replace view kubernetes.nodes as
    with ordered_list as ( select
      node,
      name,
      context,
      definition,
      observed_on,
      row_number() over (partition by name, context order by observed_on desc) as rn
    from kubernetes.nodes_log where deleted = false) 
    select node, name, context, definition, observed_on from ordered_list where rn=1;

  create table if not exists kubernetes.pods_log (
    pod uuid not null primary key,
    name varchar(128) not null,
    namespace varchar(128) not null,
    context varchar(128) not null,
    definition jsonb not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists pods_unique on kubernetes.pods_log (name, namespace, context, ((definition->'metadata')->>'resourceVersion'));
  create index if not exists pods_observed_on on kubernetes.pods_log (name, namespace, context, observed_on desc);
  create or replace view kubernetes.pods as
    with ordered_list as ( select
      pod,
      name,
      namespace,
      context,
      definition,
      observed_on,
      row_number() over (partition by name, namespace, context order by observed_on desc) as rn
    from kubernetes.pods_log where deleted = false) 
    select pod, name, namespace, context, definition, observed_on from ordered_list where rn=1;

  create table if not exists kubernetes.config_maps_log (
    config_map uuid not null primary key,
    name varchar(128) not null,
    namespace varchar(128) not null,
    context varchar(128) not null,
    definition jsonb not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists config_maps_unique on kubernetes.config_maps_log (name, namespace, context, ((definition->'metadata')->>'resourceVersion'));
  create index if not exists config_maps_observed_on on kubernetes.config_maps_log (name, namespace, context, observed_on desc);
  create or replace view kubernetes.config_maps as
    with ordered_list as ( select
      config_map,
      name,
      namespace,
      context,
      definition,
      observed_on,
      row_number() over (partition by name, namespace, context order by observed_on desc) as rn
    from kubernetes.config_maps_log where deleted = false) 
    select config_map, name, namespace, context, definition, observed_on from ordered_list where rn=1;

  create table if not exists kubernetes.deployments_log (
    deployment uuid not null primary key,
    name varchar(128) not null,
    namespace varchar(128) not null,
    context varchar(128) not null,
    definition jsonb not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists deployments_unique on kubernetes.deployments_log (name, namespace, context, ((definition->'metadata')->>'resourceVersion'));
  create index if not exists deployments_observed_on on kubernetes.deployments_log (name, namespace, context, observed_on desc);
  create or replace view kubernetes.deployments as
    with ordered_list as ( select
      deployment,
      name,
      namespace,
      context,
      definition,
      observed_on,
      row_number() over (partition by name, namespace, context order by observed_on desc) as rn
    from kubernetes.deployments_log where deleted = false) 
    select deployment, name, namespace, context, definition, observed_on from ordered_list where rn=1;

  create table if not exists kubernetes.services_log (
    service uuid not null primary key,
    name varchar(128) not null,
    namespace varchar(128) not null,
    context varchar(128) not null,
    definition jsonb not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists services_unique on kubernetes.services_log (name, namespace, context, ((definition->'metadata')->>'resourceVersion'));
  create index if not exists services_observed_on on kubernetes.services_log (name, namespace, context, observed_on desc);
  create or replace view kubernetes.services as
    with ordered_list as ( select
      service,
      name,
      namespace,
      context,
      definition,
      observed_on,
      row_number() over (partition by name, namespace, context order by observed_on desc) as rn
    from kubernetes.services_log where deleted = false) 
    select service, name, namespace, context, definition, observed_on from ordered_list where rn=1;

  create table if not exists kubernetes.persistent_volume_claims_log (
    persistent_volume_claim uuid not null primary key,
    name varchar(128) not null,
    namespace varchar(128) not null,
    context varchar(128) not null,
    definition jsonb not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists persistent_volume_claims_unique on kubernetes.persistent_volume_claims_log (name, namespace, context, ((definition->'metadata')->>'resourceVersion'));
  create index if not exists persistent_volume_claims_observed_on on kubernetes.persistent_volume_claims_log (name, namespace, context, observed_on desc);
  create or replace view kubernetes.persistent_volume_claims as
    with ordered_list as ( select
      persistent_volume_claim,
      name,
      namespace,
      context,
      definition,
      observed_on,
      row_number() over (partition by name, namespace, context order by observed_on desc) as rn
    from kubernetes.persistent_volume_claims_log where deleted = false) 
    select persistent_volume_claim, name, namespace, context, definition, observed_on from ordered_list where rn=1;

  create table if not exists kubernetes.events_log (
    event uuid not null primary key,
    name varchar(128) not null,
    namespace varchar(128) not null,
    context varchar(128) not null,
    definition jsonb not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists events_unique on kubernetes.events_log (name, namespace, context, ((definition->'metadata')->>'resourceVersion'));
  create index if not exists events_observed_on on kubernetes.events_log (name, namespace, context, observed_on desc);
  create or replace view kubernetes.events as
    with ordered_list as ( select
      event,
      name,
      namespace,
      context,
      definition,
      observed_on,
      row_number() over (partition by name, namespace, context order by observed_on desc) as rn
    from kubernetes.events_log where deleted = false) 
    select event, name, namespace, context, definition, observed_on from ordered_list where rn=1;

end
$$;