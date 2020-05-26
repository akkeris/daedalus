do $$
begin

  create schema if not exists metadata;
  create extension if not exists "uuid-ossp";

  -- These tables do not describe users who have access to daedalus
  -- they describe users who have been found in any system including daedalus.

  create table if not exists metadata.people
  (
    person uuid not null primary key,
    name text not null,
    preferred text not null,
    aliases text[] not null default '{}'::text[],
    observed_on timestamp with time zone default now(),
    deleted boolean default false
  );

  create table if not exists metadata.systems
  (
    system uuid not null primary key,
    name text not null,
    url text,
    observed_on timestamp with time zone default now(),
    deleted boolean default false
  );
  create unique index if not exists metadata_systems_name on metadata.systems(name);
  insert into metadata.systems (system, name) values (uuid_generate_v4(), 'daedalus') on conflict (name) do nothing;

  create table if not exists metadata.users
  (
    "user" uuid not null primary key,
    person uuid references metadata.people("person"),
    username text not null,
    name text not null,
    email text not null,
    system uuid references metadata.systems("system"),
    photo_url text not null,
    profile_url text not null,
    observed_on timestamp with time zone default now(),
    deleted boolean default false
  );
  create unique index if not exists metadata_username_system on metadata.users(username, system);
  create index if not exists metadata_users_person on metadata.users("person");
  create index if not exists metadata_users_system on metadata.users("system");

  -- Generic abstraction for object and types

  create table if not exists metadata.node_types (
    type uuid not null primary key,
    name text not null,
    icon text not null,
    fa_icon text not null,
    human_name text not null
  );
  create unique index if not exists metadata_node_types_ndx on metadata.node_types(name);
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/elastic_search', 'aws.es.svg', 'fa-search', 'Amazon Elastic Search') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_certificates', 'aws.rds_certificates.svg', 'fa-certificate', 'Amazon RDS Certificates') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_db_clusters', 'aws.rds_db_clusters.svg', 'fa-database', 'Amazon RDS Database Clusters') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_db_instances', 'aws.rds_db_instances.svg', 'fa-database', 'Amazon RDS Database Instances') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_db_parameter_groups', 'aws.rds_db_parameter_groups.svg', 'fa-cogs', 'Amazon Database Parameter Groups') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_db_security_groups', 'aws.rds_db_security_groups.svg', 'fa-shield', 'Amazon RDS Security Groups') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_db_snapshots', 'aws.rds_db_snapshots.svg', 'fa-archive', 'Amazon RDS Snapshots') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_db_subnet_groups', 'aws.rds_db_subnet_groups.svg', 'fa-plug', 'Amazon Subnet Groups') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_events', 'aws.rds_events.svg', 'fa-cube', 'Amazon RDS Events') on conflict (name) do nothing;

  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'postgresql/databases', 'postgresql.databases.svg', 'fa-cube', 'Postgresql Databases') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'postgresql/tables', 'postgresql.tables.svg', 'fa-cube', 'Postgresql Tables') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'postgresql/columns', 'postgresql.columns.svg', 'fa-cube', 'Postgresql Columns') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'postgresql/constraints', 'postgresql.constraints.svg', 'fa-cube', 'Postgresql Constraints') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'postgresql/foreign_servers', 'postgresql.foreign_servers.svg', 'fa-cube', 'Postgresql Foreign Servers') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'postgresql/indexes', 'postgresql.indexes.svg', 'fa-cube', 'Postgresql Indexes') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'postgresql/roles', 'postgresql.roles.svg', 'fa-cube', 'Postgresql Roles') on conflict (name) do nothing;
  
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'oracle/databases', 'oracle.databases.svg', 'fa-cube', 'Oracle Databases') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'oracle/tables', 'oracle.tables.svg', 'fa-cube', 'Oracle Tables') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'oracle/columns', 'oracle.columns.svg', 'fa-cube', 'Oracle Columns') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'oracle/constraints', 'oracle.constraints.svg', 'fa-cube', 'Oracle Constraints') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'oracle/foreign_servers', 'oracle.foreign_servers.svg', 'fa-cube', 'Oracle Foreign Servers') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'oracle/indexes', 'oracle.indexes.svg', 'fa-cube', 'Oracle Indexes') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'oracle/roles', 'oracle.roles.svg', 'fa-cube', 'Oracle Roles') on conflict (name) do nothing;

  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/configmaps', 'kubernetes.configmaps.svg', 'fa-map', 'Kubernetes Config Maps') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/certificates', 'kubernetes.certificates.svg', 'fa-certificate', 'Certificates') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/daemonsets', 'kubernetes.daemon_sets.svg', 'fa-cube', 'Kubernetes Daemon Sets') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/deployments', 'kubernetes.deployments.svg', 'fa-rocket', 'Kubernetes Deployments') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/events', 'kubernetes.events.svg', 'fa-cube', 'Kubernetes Events') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/gateways', 'kubernetes.gateways.svg', 'fa-cube', 'Istio Gateways') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/ingress', 'kubernetes.ingress.svg', 'fa-cube', 'Kubernetes Ingresses') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/jobs', 'kubernetes.jobs.svg', 'fa-cube', 'Kubernetes Jobs') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/nodes', 'kubernetes.nodes.svg', 'fa-cube', 'Kubernetes Nodes') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/persistentvolumeclaims', 'kubernetes.persistent_volume_claims.svg', 'fa-cube', 'Kubernetes Persistent Volume Claims') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/persistentvolumes', 'kubernetes.persistent_volumes.svg', 'fa-cube', 'Kubernetes Persistent Volumes') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/pods', 'kubernetes.pods.svg', 'fa-server', 'Kubernetes Pods') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/policies', 'kubernetes.policies.svg', 'fa-cube', 'Istio Policies') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/replicasets', 'kubernetes.replicasets.svg', 'fa-clone', 'Kubernetes Replica Sets') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/services', 'kubernetes.services.svg', 'fa-cube', 'Kubernetes Services') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/statefulsets', 'kubernetes.stateful_sets.svg', 'fa-cube', 'Kubernetes Stateful Sets') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/virtualservices', 'kubernetes.virtualservices.svg', 'fa-cube', 'Istio Virtual Services') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/clusterissuers', 'kubernetes.clusterissuers.svg', 'fa-cube', 'Cert Manager Cluster Issuers') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'kubernetes/issuers', 'kubernetes.issuers.svg', 'fa-cube', 'Cert Manager Issuers') on conflict (name) do nothing;

  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'akkeris/sites', 'akkeris.sites.svg', 'fa-sitemap', 'Akkeris Sites') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'akkeris/routes', 'akkeris.routes.svg', 'fa-cube', 'Akkeris Routes') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'akkeris/apps', 'akkeris.apps.svg', 'fa-microchip', 'Akkeris Apps') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'akkeris/spaces', 'akkeris.spaces.svg', 'fa-cube', 'Akkeris Spaces') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'akkeris/addon_attachments', 'akkeris.addon_attachments.svg', 'fa-cube', 'Akkeris Addon Attachments') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'akkeris/addon_services', 'akkeris.addon_services.svg', 'fa-cube', 'Akkeris Services') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'akkeris/addons', 'akkeris.addons.svg', 'fa-cube', 'Akkeris Addons') on conflict (name) do nothing;
  
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'urls/urls', 'urls.urls.svg', 'fa-link', 'Urls') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'urls/certificates', 'urls.certificates.svg', 'fa-certificate', 'Certificates') on conflict (name) do nothing;

  create table if not exists metadata.node_types_fields (
    id uuid not null primary key,
    "type" uuid references metadata.node_types("type"),
    jsonpath text not null,
    name varchar(128) not null,
    friendly_name text not null,
    format text not null, -- can be percent, number, date, boolean, array_length, array_join
    highlighted boolean not null default false
  );
  create unique index if not exists metadata_node_types_fields_unique on metadata.node_types_fields("type", "name");
  create index if not exists metadata_node_types_fields_type on metadata.node_types_fields("type");

  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='urls/certificates' limit 1), '$.expires', 'expires', 'Expires', 'date', true) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='urls/certificates' limit 1), '$.issued', 'issued', 'Issued', 'date', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='urls/urls' limit 1), '$.connection.protocol', 'tls_version', 'TLS Version', 'string', true) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='akkeris/sites' limit 1), '$.region.name', 'region', 'Region', 'string', true) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/certificates' limit 1), '$.status.notAfter', 'expires', 'Expires', 'date', true) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/certificates' limit 1), '$.metadata.creationTimestamp', 'issued', 'Issued', 'date', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/certificates' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/configmaps' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/pods' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/pods' limit 1), '$.spec.containers', 'containers', 'Containers', 'array_length', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/deployments' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/deployments' limit 1), '$.metadata.replicas', 'replicas', 'Replicas', 'number', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/replicasets' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/replicasets' limit 1), '$.spec.replicas', 'replicas', 'Replicas', 'number', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/daemonsets' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/statefulsets' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/services' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/jobs' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/events' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/gateways' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/policies' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/virtualservices' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/ingress' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;
  insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
    (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/persistentvolumeclaims' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;

  create or replace view metadata.nodes_log as
    select node_types.icon as "icon", node_types.type, spaces_log.space_log as node_log, spaces_log.space as node, spaces_log.name, spaces_log.definition, '{}'::jsonb as status, spaces_log.observed_on, false as transient, spaces_log.deleted
        from akkeris.spaces_log, metadata.node_types where node_types.name = 'akkeris/spaces'
    union all
    select node_types.icon as "icon", node_types.type, apps_log.app_log as node_log, apps_log.app as node, apps_log.name, apps_log.definition, '{}'::jsonb as status, apps_log.observed_on, false as transient, deleted
        from akkeris.apps_log, metadata.node_types where node_types.name = 'akkeris/apps'
    union all
    select node_types.icon as "icon", node_types.type, addon_attachments_log.addon_attachment_log as node_log, addon_attachments_log.addon_attachment as node, addon_attachments_log.name, addon_attachments_log.definition, '{}'::jsonb as status, addon_attachments_log.observed_on, false as transient, deleted
        from akkeris.addon_attachments_log, metadata.node_types where node_types.name = 'akkeris/addon_attachments'
    union all
    select node_types.icon as "icon", node_types.type, addon_services_log.addon_service_log as node_log, addon_services_log.addon_service as node, addon_services_log.name, addon_services_log.definition, '{}'::jsonb as status, addon_services_log.observed_on, false as transient, deleted
        from akkeris.addon_services_log, metadata.node_types where node_types.name = 'akkeris/addon_services'
    union all
    select node_types.icon as "icon", node_types.type, addons_log.addon_log as node_log, addons_log.addon as node, addons_log.name, addons_log.definition, '{}'::jsonb as status, addons_log.observed_on, false as transient, deleted
        from akkeris.addons_log, metadata.node_types where node_types.name = 'akkeris/addons'
    union all
    select node_types.icon as "icon", node_types.type, sites_log.site_log as node_log, sites_log.site as node, sites_log.name, sites_log.definition, '{}'::jsonb as status, sites_log.observed_on, false as transient, deleted
        from akkeris.sites_log, metadata.node_types where node_types.name = 'akkeris/sites'
    union all
    select node_types.icon as "icon", node_types.type, routes_log.route_log as node_log, routes_log.route as node, 'https://' || sites_log.name || routes_log.source_path || ' -> ' || rtrim(rtrim(ltrim((apps_log.definition->'web_url')::text, '"'), '"'), '/') || routes_log.target_path as name, routes_log.definition, '{}'::jsonb as status, routes_log.observed_on, false as transient, routes_log.deleted
        from akkeris.routes_log join akkeris.sites_log on routes_log.site_log = sites_log.site_log join akkeris.apps_log on routes_log.app_log = apps_log.app_log, metadata.node_types where node_types.name = 'akkeris/routes'
    union all
    select node_types.icon as "icon", node_types.type, es_clusters_log.node_log, es_clusters_log.node, es_clusters_log.name, es_clusters_log.definition, '{}'::jsonb as status, es_clusters_log.observed_on, false as transient, deleted
        from aws.es_clusters_log, metadata.node_types where node_types.name = 'aws/elastic_search'
    union all
    select node_types.icon as "icon", node_types.type, rds_certificates_log.node_log, rds_certificates_log.node, rds_certificates_log.name as name, rds_certificates_log.definition, '{}'::jsonb as status, rds_certificates_log.observed_on, false as transient, deleted
        from aws.rds_certificates_log, metadata.node_types where node_types.name = 'aws/rds_certificates'
    union all
    select node_types.icon as "icon", node_types.type, rds_db_clusters_log.node_log, rds_db_clusters_log.node, rds_db_clusters_log.name, rds_db_clusters_log.definition, '{}'::jsonb as status, rds_db_clusters_log.observed_on, false as transient, deleted
        from aws.rds_db_clusters_log, metadata.node_types where node_types.name = 'aws/rds_db_clusters'
    union all
    select node_types.icon as "icon", node_types.type, rds_db_instances_log.node_log, rds_db_instances_log.node, rds_db_instances_log.name, rds_db_instances_log.definition, '{}'::jsonb as status, rds_db_instances_log.observed_on, false as transient, deleted
        from aws.rds_db_instances_log, metadata.node_types where node_types.name = 'aws/rds_db_instances'
    union all
    select node_types.icon as "icon", node_types.type, rds_db_parameter_groups_log.node_log, rds_db_parameter_groups_log.node, rds_db_parameter_groups_log.name, rds_db_parameter_groups_log.definition, '{}'::jsonb as status, rds_db_parameter_groups_log.observed_on, false as transient, deleted
        from aws.rds_db_parameter_groups_log, metadata.node_types where node_types.name = 'aws/rds_db_instances'
    union all
    select node_types.icon as "icon", node_types.type, rds_db_security_groups_log.node_log, rds_db_security_groups_log.node, rds_db_security_groups_log.name, rds_db_security_groups_log.definition, '{}'::jsonb as status, rds_db_security_groups_log.observed_on, false as transient, deleted
        from aws.rds_db_security_groups_log, metadata.node_types where node_types.name = 'aws/rds_db_security_groups'
    union all
    select node_types.icon as "icon", node_types.type, rds_db_snapshots_log.node_log, rds_db_snapshots_log.node, rds_db_snapshots_log.name, rds_db_snapshots_log.definition, '{}'::jsonb as status, rds_db_snapshots_log.observed_on, false as transient, deleted
        from aws.rds_db_snapshots_log, metadata.node_types where node_types.name = 'aws/rds_db_snapshots'
    union all
    select node_types.icon as "icon", node_types.type, rds_db_subnet_groups_log.node_log, rds_db_subnet_groups_log.node, rds_db_subnet_groups_log.name, rds_db_subnet_groups_log.definition, '{}'::jsonb as status, rds_db_subnet_groups_log.observed_on, false as transient, deleted
        from aws.rds_db_subnet_groups_log, metadata.node_types where node_types.name = 'aws/rds_db_subnet_groups'
    union all
    select node_types.icon as "icon", node_types.type, rds_events_log.node_log, rds_events_log.node, rds_events_log.name, rds_events_log.definition, '{}'::jsonb as status, rds_events_log.observed_on, false as transient, deleted
        from aws.rds_events_log, metadata.node_types where node_types.name = 'aws/rds_events'
    union all
    select node_types.icon as "icon", node_types.type, certificates_log.node_log, certificates_log.node, certificates_log.name, certificates_log.definition, '{}'::jsonb as status, certificates_log.observed_on, false as transient, deleted
        from kubernetes.certificates_log, metadata.node_types where node_types.name = 'kubernetes/certificates'
    union all
    select node_types.icon as "icon", node_types.type, configmaps_log.node_log, configmaps_log.node, configmaps_log.name, configmaps_log.definition, '{}'::jsonb as status, configmaps_log.observed_on, false as transient, deleted
        from kubernetes.configmaps_log, metadata.node_types where node_types.name = 'kubernetes/configmaps'
    union all
    select node_types.icon as "icon", node_types.type, daemonsets_log.node_log, daemonsets_log.node, daemonsets_log.name, daemonsets_log.definition, '{}'::jsonb as status, daemonsets_log.observed_on, false as transient, deleted
        from kubernetes.daemonsets_log, metadata.node_types where node_types.name = 'kubernetes/daemonsets'
    union all
    select node_types.icon as "icon", node_types.type, deployments_log.node_log, deployments_log.node, deployments_log.name, deployments_log.definition, '{}'::jsonb as status, deployments_log.observed_on, false as transient, deleted
        from kubernetes.deployments_log, metadata.node_types where node_types.name = 'kubernetes/deployments'
    union all
    select node_types.icon as "icon", node_types.type, events_log.node_log, events_log.node, events_log.name, events_log.definition, '{}'::jsonb as status, events_log.observed_on, true as transient, deleted
        from kubernetes.events_log, metadata.node_types where node_types.name = 'kubernetes/events'
    union all
    select node_types.icon as "icon", node_types.type, gateways_log.node_log, gateways_log.node, gateways_log.name, gateways_log.definition, '{}'::jsonb as status, gateways_log.observed_on, false as transient, deleted
        from kubernetes.gateways_log, metadata.node_types where node_types.name = 'kubernetes/gateways'
    union all
    select node_types.icon as "icon", node_types.type, ingress_log.node_log, ingress_log.node, ingress_log.name, ingress_log.definition, '{}'::jsonb as status, ingress_log.observed_on, false as transient, deleted
        from kubernetes.ingress_log, metadata.node_types where node_types.name = 'kubernetes/ingress'
    union all
    select node_types.icon as "icon", node_types.type, jobs_log.node_log, jobs_log.node, jobs_log.name, jobs_log.definition, '{}'::jsonb as status, jobs_log.observed_on, false as transient, deleted
        from kubernetes.jobs_log, metadata.node_types where node_types.name = 'kubernetes/jobs'
    union all
    select node_types.icon as "icon", node_types.type, nodes_log.node_log, nodes_log.node, nodes_log.name, nodes_log.definition, '{}'::jsonb as status, nodes_log.observed_on, false as transient, deleted
        from kubernetes.nodes_log, metadata.node_types where node_types.name = 'kubernetes/nodes'
    union all
    select node_types.icon as "icon", node_types.type, persistentvolumeclaims_log.node_log, persistentvolumeclaims_log.node, persistentvolumeclaims_log.name, persistentvolumeclaims_log.definition, '{}'::jsonb as status, persistentvolumeclaims_log.observed_on, false as transient, deleted
        from kubernetes.persistentvolumeclaims_log, metadata.node_types where node_types.name = 'kubernetes/persistentvolumeclaims'
    union all
    select node_types.icon as "icon", node_types.type, persistentvolumes_log.node_log, persistentvolumes_log.node, persistentvolumes_log.name, persistentvolumes_log.definition, '{}'::jsonb as status, persistentvolumes_log.observed_on, false as transient, deleted
        from kubernetes.persistentvolumes_log, metadata.node_types where node_types.name = 'kubernetes/persistentvolumes'
    union all
    select node_types.icon as "icon", node_types.type, pods_log.node_log, pods_log.node, pods_log.name, pods_log.definition, '{}'::jsonb as status, pods_log.observed_on, true as transient, deleted
        from kubernetes.pods_log, metadata.node_types where node_types.name = 'kubernetes/pods'
    union all
    select node_types.icon as "icon", node_types.type, policies_log.node_log, policies_log.node, policies_log.name, policies_log.definition, '{}'::jsonb as status, policies_log.observed_on, false as transient, deleted
        from kubernetes.policies_log, metadata.node_types where node_types.name = 'kubernetes/policies'
    union all
    select node_types.icon as "icon", node_types.type, replicasets_log.node_log, replicasets_log.node, replicasets_log.name, replicasets_log.definition, '{}'::jsonb as status, replicasets_log.observed_on, true as transient, deleted
        from kubernetes.replicasets_log, metadata.node_types where node_types.name = 'kubernetes/replicasets'
    union all
    select node_types.icon as "icon", node_types.type, services_log.node_log, services_log.node, services_log.name, services_log.definition, '{}'::jsonb as status, services_log.observed_on, false as transient, deleted
        from kubernetes.services_log, metadata.node_types where node_types.name = 'kubernetes/services'
    union all
    select node_types.icon as "icon", node_types.type, statefulsets_log.node_log, statefulsets_log.node, statefulsets_log.name, statefulsets_log.definition, '{}'::jsonb as status, statefulsets_log.observed_on, false as transient, deleted
        from kubernetes.statefulsets_log, metadata.node_types where node_types.name = 'kubernetes/statefulsets'
    union all
    select node_types.icon as "icon", node_types.type, virtualservices_log.node_log, virtualservices_log.node, virtualservices_log.name, virtualservices_log.definition, '{}'::jsonb as status, virtualservices_log.observed_on, false as transient, deleted
        from kubernetes.virtualservices_log, metadata.node_types where node_types.name = 'kubernetes/virtualservices'
    union all
    select node_types.icon as "icon", node_types.type, columns_log.column_log as node_log, columns_log.column as node, columns_log.name, ('{}')::jsonb as definition, '{}'::jsonb as status, columns_log.observed_on, false as transient, deleted
        from oracle.columns_log, metadata.node_types where node_types.name = 'oracle/columns'
    union all
    select node_types.icon as "icon", node_types.type, constraints_log.constraint_log as node_log, constraints_log.constraint as node, constraints_log.name, ('{}')::jsonb as definition, '{}'::jsonb as status, constraints_log.observed_on, false as transient, deleted
        from oracle.constraints_log, metadata.node_types where node_types.name = 'oracle/constraints'
    union all
    select node_types.icon as "icon", node_types.type, databases_log.database_log as node_log, databases_log.database as node, databases_log.host || '/' || databases_log.name as name, databases_log.config as definition, '{}'::jsonb as status, databases_log.observed_on, false as transient, deleted
        from oracle.databases_log, metadata.node_types where node_types.name = 'oracle/databases'
    union all
    select node_types.icon as "icon", node_types.type, foreign_servers_log.foreign_server_log as node_log, foreign_servers_log.foreign_server as node, foreign_servers_log.name, ('{}')::jsonb as definition, '{}'::jsonb as status, foreign_servers_log.observed_on, false as transient, deleted
        from oracle.foreign_servers_log, metadata.node_types where node_types.name = 'oracle/foreign_servers'
    union all
    select node_types.icon as "icon", node_types.type, indexes_log.index_log as node_log, indexes_log.index as node, indexes_log.name, ('{}')::jsonb as definition, '{}'::jsonb as status, indexes_log.observed_on, false as transient, deleted
        from oracle.indexes_log, metadata.node_types where node_types.name = 'oracle/indexes'
    union all
    select node_types.icon as "icon", node_types.type, roles_log.role_log as node_log, roles_log.role as node, roles_log.username as name, ('{}')::jsonb as definition, '{}'::jsonb as status, roles_log.observed_on, false as transient, deleted
        from oracle.roles_log, metadata.node_types where node_types.name = 'oracle/roles'
    union all
    select node_types.icon as "icon", node_types.type, tables_log.table_log as node_log, tables_log.table as node, tables_log.name, ('{}')::jsonb as definition, '{}'::jsonb as status, tables_log.observed_on, false as transient, deleted
        from oracle.tables_log, metadata.node_types where node_types.name = 'oracle/tables'
    union all
    select node_types.icon as "icon", node_types.type, columns_log.column_log as node_log, columns_log.column as node, columns_log.name, ('{}')::jsonb as definition, '{}'::jsonb as status, columns_log.observed_on, false as transient, deleted
        from postgresql.columns_log, metadata.node_types where node_types.name = 'postgresql/columns'
    union all
    select node_types.icon as "icon", node_types.type, constraints_log.constraint_log as node_log, constraints_log.constraint as node, constraints_log.name, ('{}')::jsonb as definition, '{}'::jsonb as status, constraints_log.observed_on, false as transient, deleted
        from postgresql.constraints_log, metadata.node_types where node_types.name = 'postgresql/constraints'
    union all
    select node_types.icon as "icon", node_types.type, databases_log.database_log as node_log, databases_log.database as node, databases_log.host || '/' || databases_log.name as name, databases_log.config as definition, '{}'::jsonb as status, databases_log.observed_on, false as transient, deleted
        from postgresql.databases_log, metadata.node_types where node_types.name = 'postgresql/databases'
    union all
    select node_types.icon as "icon", node_types.type, foreign_servers_log.foreign_server_log as node_log, foreign_servers_log.foreign_server as node, foreign_servers_log.name, ('{}')::jsonb as definition, '{}'::jsonb as status, foreign_servers_log.observed_on, false as transient, deleted
        from postgresql.foreign_servers_log, metadata.node_types where node_types.name = 'postgresql/foreign_servers'
    union all
    select node_types.icon as "icon", node_types.type, indexes_log.index_log as node_log, indexes_log.index as node, indexes_log.name, ('{}')::jsonb as definition, '{}'::jsonb as status, indexes_log.observed_on, false as transient, deleted
        from postgresql.indexes_log, metadata.node_types where node_types.name = 'postgresql/indexes'
    union all
    select node_types.icon as "icon", node_types.type, roles_log.role_log as node_log, roles_log.role as node, roles_log.username as name, ('{}')::jsonb as definition, '{}'::jsonb as status, roles_log.observed_on, false as transient, deleted
        from postgresql.roles_log, metadata.node_types where node_types.name = 'postgresql/roles'
    union all
    select node_types.icon as "icon", node_types.type, tables_log.table_log as node_log, tables_log.table as node, tables_log.name, ('{}')::jsonb as definition, '{}'::jsonb as status, tables_log.observed_on, false as transient, deleted
        from postgresql.tables_log, metadata.node_types where node_types.name = 'postgresql/tables'
    union all
    select node_types.icon as "icon", node_types.type, certificates_log.certificate_log as node_log, certificates_log.certificate as node, certificates_log.subject as name, certificates_log.definition, '{}'::jsonb as status, certificates_log.observed_on, false as transient, deleted
        from urls.certificates_log, metadata.node_types where node_types.name = 'urls/certificates'
    union all
    select node_types.icon as "icon", node_types.type, urls_log.url_log as node_log, urls_log.url as node, urls_log.protocol || '//' || urls_log.hostname || urls_log.pathname as name, urls_log.definition, '{}'::jsonb as status, urls_log.observed_on, false as transient, deleted
        from urls.urls_log, metadata.node_types where node_types.name = 'urls/urls';

  comment on view "metadata"."nodes_log" is E'@name metadataNodesLog';

  create or replace view metadata.nodes as
    select node_types.icon as "icon", node_types.type, spaces.space_log as node_log, spaces.space as node, spaces.name, spaces.definition, '{}'::jsonb as status, spaces.observed_on, false as transient
        from akkeris.spaces, metadata.node_types where node_types.name = 'akkeris/spaces'
    union all
    select node_types.icon as "icon", node_types.type, apps.app_log as node_log, apps.app as node, apps.name, apps.definition, '{}'::jsonb as status, apps.observed_on, false as transient
        from akkeris.apps, metadata.node_types where node_types.name = 'akkeris/apps'
    union all
    select node_types.icon as "icon", node_types.type, addon_attachments.addon_attachment_log as node_log, addon_attachments.addon_attachment as node, addon_attachments.name, addon_attachments.definition, '{}'::jsonb as status, addon_attachments.observed_on, false as transient
        from akkeris.addon_attachments, metadata.node_types where node_types.name = 'akkeris/addon_attachments'
    union all
    select node_types.icon as "icon", node_types.type, addon_services.addon_service_log as node_log, addon_services.addon_service as node, addon_services.name, addon_services.definition, '{}'::jsonb as status, addon_services.observed_on, false as transient
        from akkeris.addon_services, metadata.node_types where node_types.name = 'akkeris/addon_services'
    union all
    select node_types.icon as "icon", node_types.type, addons.addon_log as node_log, addons.addon as node, addons.name, addons.definition, '{}'::jsonb as status, addons.observed_on, false as transient
        from akkeris.addons, metadata.node_types where node_types.name = 'akkeris/addons'
    union all
    select node_types.icon as "icon", node_types.type, sites.site_log as node_log, sites.site as node, sites.name, sites.definition, '{}'::jsonb as status, sites.observed_on, false as transient
        from akkeris.sites, metadata.node_types where node_types.name = 'akkeris/sites'
    union all
    select node_types.icon as "icon", node_types.type, routes.route_log as node_log, routes.route as node, 'https://' || sites.name || routes.source_path || ' -> ' || rtrim(rtrim(ltrim((apps.definition->'web_url')::text, '"'), '"'), '/') || routes.target_path as name, routes.definition, '{}'::jsonb as status, routes.observed_on, false as transient
        from akkeris.routes join akkeris.sites on routes.site_log = sites.site_log join akkeris.apps on routes.app_log = apps.app_log, metadata.node_types where node_types.name = 'akkeris/routes'
    union all
    select node_types.icon as "icon", node_types.type, es_clusters.node_log, es_clusters.node, es_clusters.name, es_clusters.definition, '{}'::jsonb as status, es_clusters.observed_on, false as transient
        from aws.es_clusters, metadata.node_types where node_types.name = 'aws/elastic_search'
    union all
    select node_types.icon as "icon", node_types.type, rds_certificates.node_log, rds_certificates.node, rds_certificates.name as name, rds_certificates.definition, '{}'::jsonb as status, rds_certificates.observed_on, false as transient
        from aws.rds_certificates, metadata.node_types where node_types.name = 'aws/rds_certificates'
    union all
    select node_types.icon as "icon", node_types.type, rds_db_clusters.node_log, rds_db_clusters.node, rds_db_clusters.name, rds_db_clusters.definition, '{}'::jsonb as status, rds_db_clusters.observed_on, false as transient
        from aws.rds_db_clusters, metadata.node_types where node_types.name = 'aws/rds_db_clusters'
    union all
    select node_types.icon as "icon", node_types.type, rds_db_instances.node_log, rds_db_instances.node, rds_db_instances.name, rds_db_instances.definition, '{}'::jsonb as status, rds_db_instances.observed_on, false as transient
        from aws.rds_db_instances, metadata.node_types where node_types.name = 'aws/rds_db_instances'
    union all
    select node_types.icon as "icon", node_types.type, rds_db_parameter_groups.node_log, rds_db_parameter_groups.node, rds_db_parameter_groups.name, rds_db_parameter_groups.definition, '{}'::jsonb as status, rds_db_parameter_groups.observed_on, false as transient
        from aws.rds_db_parameter_groups, metadata.node_types where node_types.name = 'aws/rds_db_instances'
    union all
    select node_types.icon as "icon", node_types.type, rds_db_security_groups.node_log, rds_db_security_groups.node, rds_db_security_groups.name, rds_db_security_groups.definition, '{}'::jsonb as status, rds_db_security_groups.observed_on, false as transient
        from aws.rds_db_security_groups, metadata.node_types where node_types.name = 'aws/rds_db_security_groups'
    union all
    select node_types.icon as "icon", node_types.type, rds_db_snapshots.node_log, rds_db_snapshots.node, rds_db_snapshots.name, rds_db_snapshots.definition, '{}'::jsonb as status, rds_db_snapshots.observed_on, false as transient
        from aws.rds_db_snapshots, metadata.node_types where node_types.name = 'aws/rds_db_snapshots'
    union all
    select node_types.icon as "icon", node_types.type, rds_db_subnet_groups.node_log, rds_db_subnet_groups.node, rds_db_subnet_groups.name, rds_db_subnet_groups.definition, '{}'::jsonb as status, rds_db_subnet_groups.observed_on, false as transient
        from aws.rds_db_subnet_groups, metadata.node_types where node_types.name = 'aws/rds_db_subnet_groups'
    union all
    select node_types.icon as "icon", node_types.type, rds_events.node_log, rds_events.node, rds_events.name, rds_events.definition, '{}'::jsonb as status, rds_events.observed_on, false as transient
        from aws.rds_events, metadata.node_types where node_types.name = 'aws/rds_events'
    union all
    select node_types.icon as "icon", node_types.type, certificates.node_log, certificates.node, certificates.name, certificates.definition, '{}'::jsonb as status, certificates.observed_on, false as transient
        from kubernetes.certificates, metadata.node_types where node_types.name = 'kubernetes/certificates'
    union all
    select node_types.icon as "icon", node_types.type, configmaps.node_log, configmaps.node, configmaps.name, configmaps.definition, '{}'::jsonb as status, configmaps.observed_on, false as transient
        from kubernetes.configmaps, metadata.node_types where node_types.name = 'kubernetes/configmaps'
    union all
    select node_types.icon as "icon", node_types.type, daemonsets.node_log, daemonsets.node, daemonsets.name, daemonsets.definition, '{}'::jsonb as status, daemonsets.observed_on, false as transient
        from kubernetes.daemonsets, metadata.node_types where node_types.name = 'kubernetes/daemonsets'
    union all
    select node_types.icon as "icon", node_types.type, deployments.node_log, deployments.node, deployments.name, deployments.definition, '{}'::jsonb as status, deployments.observed_on, false as transient
        from kubernetes.deployments, metadata.node_types where node_types.name = 'kubernetes/deployments'
    union all
    select node_types.icon as "icon", node_types.type, events.node_log, events.node, events.name, events.definition, '{}'::jsonb as status, events.observed_on, true as transient
        from kubernetes.events, metadata.node_types where node_types.name = 'kubernetes/events'
    union all
    select node_types.icon as "icon", node_types.type, gateways.node_log, gateways.node, gateways.name, gateways.definition, '{}'::jsonb as status, gateways.observed_on, false as transient
        from kubernetes.gateways, metadata.node_types where node_types.name = 'kubernetes/gateways'
    union all
    select node_types.icon as "icon", node_types.type, ingress.node_log, ingress.node, ingress.name, ingress.definition, '{}'::jsonb as status, ingress.observed_on, false as transient
        from kubernetes.ingress, metadata.node_types where node_types.name = 'kubernetes/ingress'
    union all
    select node_types.icon as "icon", node_types.type, jobs.node_log, jobs.node, jobs.name, jobs.definition, '{}'::jsonb as status, jobs.observed_on, false as transient
        from kubernetes.jobs, metadata.node_types where node_types.name = 'kubernetes/jobs'
    union all
    select node_types.icon as "icon", node_types.type, nodes.node_log, nodes.node, nodes.name, nodes.definition, '{}'::jsonb as status, nodes.observed_on, false as transient
        from kubernetes.nodes, metadata.node_types where node_types.name = 'kubernetes/nodes'
    union all
    select node_types.icon as "icon", node_types.type, persistentvolumeclaims.node_log, persistentvolumeclaims.node, persistentvolumeclaims.name, persistentvolumeclaims.definition, '{}'::jsonb as status, persistentvolumeclaims.observed_on, false as transient
        from kubernetes.persistentvolumeclaims, metadata.node_types where node_types.name = 'kubernetes/persistentvolumeclaims'
    union all
    select node_types.icon as "icon", node_types.type, persistentvolumes.node_log, persistentvolumes.node, persistentvolumes.name, persistentvolumes.definition, '{}'::jsonb as status, persistentvolumes.observed_on, false as transient
        from kubernetes.persistentvolumes, metadata.node_types where node_types.name = 'kubernetes/persistentvolumes'
    union all
    select node_types.icon as "icon", node_types.type, pods.node_log, pods.node, pods.name, pods.definition, '{}'::jsonb as status, pods.observed_on, true as transient
        from kubernetes.pods, metadata.node_types where node_types.name = 'kubernetes/pods'
    union all
    select node_types.icon as "icon", node_types.type, policies.node_log, policies.node, policies.name, policies.definition, '{}'::jsonb as status, policies.observed_on, false as transient
        from kubernetes.policies, metadata.node_types where node_types.name = 'kubernetes/policies'
    union all
    select node_types.icon as "icon", node_types.type, replicasets.node_log, replicasets.node, replicasets.name, replicasets.definition, '{}'::jsonb as status, replicasets.observed_on, true as transient
        from kubernetes.replicasets, metadata.node_types where node_types.name = 'kubernetes/replicasets'
    union all
    select node_types.icon as "icon", node_types.type, services.node_log, services.node, services.name, services.definition, '{}'::jsonb as status, services.observed_on, false as transient
        from kubernetes.services, metadata.node_types where node_types.name = 'kubernetes/services'
    union all
    select node_types.icon as "icon", node_types.type, statefulsets.node_log, statefulsets.node, statefulsets.name, statefulsets.definition, '{}'::jsonb as status, statefulsets.observed_on, false as transient
        from kubernetes.statefulsets, metadata.node_types where node_types.name = 'kubernetes/statefulsets'
    union all
    select node_types.icon as "icon", node_types.type, virtualservices.node_log, virtualservices.node, virtualservices.name, virtualservices.definition, '{}'::jsonb as status, virtualservices.observed_on, false as transient
        from kubernetes.virtualservices, metadata.node_types where node_types.name = 'kubernetes/virtualservices'
    union all
    select node_types.icon as "icon", node_types.type, columns.column_log as node_log, columns.column as node, columns.name, ('{}')::jsonb as definition, '{}'::jsonb as status, columns.observed_on, false as transient
        from oracle.columns, metadata.node_types where node_types.name = 'oracle/columns'
    union all
    select node_types.icon as "icon", node_types.type, constraints.constraint_log as node_log, constraints.constraint as node, constraints.name, ('{}')::jsonb as definition, '{}'::jsonb as status, constraints.observed_on, false as transient
        from oracle.constraints, metadata.node_types where node_types.name = 'oracle/constraints'
    union all
    select node_types.icon as "icon", node_types.type, databases.database_log as node_log, databases.database as node, databases.host || '/' || databases.name as name, databases.config as definition, '{}'::jsonb as status, databases.observed_on, false as transient
        from oracle.databases, metadata.node_types where node_types.name = 'oracle/databases'
    union all
    select node_types.icon as "icon", node_types.type, foreign_servers.foreign_server_log as node_log, foreign_servers.foreign_server as node, foreign_servers.name, ('{}')::jsonb as definition, '{}'::jsonb as status, foreign_servers.observed_on, false as transient
        from oracle.foreign_servers, metadata.node_types where node_types.name = 'oracle/foreign_servers'
    union all
    select node_types.icon as "icon", node_types.type, indexes.index_log as node_log, indexes.index as node, indexes.name, ('{}')::jsonb as definition, '{}'::jsonb as status, indexes.observed_on, false as transient
        from oracle.indexes, metadata.node_types where node_types.name = 'oracle/indexes'
    union all
    select node_types.icon as "icon", node_types.type, roles.role_log as node_log, roles.role as node, roles.username as name, ('{}')::jsonb as definition, '{}'::jsonb as status, roles.observed_on, false as transient
        from oracle.roles, metadata.node_types where node_types.name = 'oracle/roles'
    union all
    select node_types.icon as "icon", node_types.type, tables.table_log as node_log, tables.table as node, tables.name, ('{}')::jsonb as definition, '{}'::jsonb as status, tables.observed_on, false as transient
        from oracle.tables, metadata.node_types where node_types.name = 'oracle/tables'
    union all
    select node_types.icon as "icon", node_types.type, columns.column_log as node_log, columns.column as node, columns.name, ('{}')::jsonb as definition, '{}'::jsonb as status, columns.observed_on, false as transient
        from postgresql.columns, metadata.node_types where node_types.name = 'postgresql/columns'
    union all
    select node_types.icon as "icon", node_types.type, constraints.constraint_log as node_log, constraints.constraint as node, constraints.name, ('{}')::jsonb as definition, '{}'::jsonb as status, constraints.observed_on, false as transient
        from postgresql.constraints, metadata.node_types where node_types.name = 'postgresql/constraints'
    union all
    select node_types.icon as "icon", node_types.type, databases.database_log as node_log, databases.database as node, databases.host || '/' || databases.name as name, databases.config as definition, '{}'::jsonb as status, databases.observed_on, false as transient
        from postgresql.databases, metadata.node_types where node_types.name = 'postgresql/databases'
    union all
    select node_types.icon as "icon", node_types.type, foreign_servers.foreign_server_log as node_log, foreign_servers.foreign_server as node, foreign_servers.name, ('{}')::jsonb as definition, '{}'::jsonb as status, foreign_servers.observed_on, false as transient
        from postgresql.foreign_servers, metadata.node_types where node_types.name = 'postgresql/foreign_servers'
    union all
    select node_types.icon as "icon", node_types.type, indexes.index_log as node_log, indexes.index as node, indexes.name, ('{}')::jsonb as definition, '{}'::jsonb as status, indexes.observed_on, false as transient
        from postgresql.indexes, metadata.node_types where node_types.name = 'postgresql/indexes'
    union all
    select node_types.icon as "icon", node_types.type, roles.role_log as node_log, roles.role as node, roles.username as name, ('{}')::jsonb as definition, '{}'::jsonb as status, roles.observed_on, false as transient
        from postgresql.roles, metadata.node_types where node_types.name = 'postgresql/roles'
    union all
    select node_types.icon as "icon", node_types.type, tables.table_log as node_log, tables.table as node, tables.name, ('{}')::jsonb as definition, '{}'::jsonb as status, tables.observed_on, false as transient
        from postgresql.tables, metadata.node_types where node_types.name = 'postgresql/tables'
    union all
    select node_types.icon as "icon", node_types.type, certificates.certificate_log as node_log, certificates.certificate as node, certificates.subject as name, certificates.definition, '{}'::jsonb as status, certificates.observed_on, false as transient
        from urls.certificates, metadata.node_types where node_types.name = 'urls/certificates'
    union all
    select node_types.icon as "icon", node_types.type, urls.url_log as node_log, urls.url as node, urls.protocol || '//' || urls.hostname || urls.pathname as name, urls.definition, '{}'::jsonb as status, urls.observed_on, false as transient
        from urls.urls, metadata.node_types where node_types.name = 'urls/urls';
    comment on view "metadata"."nodes" IS E'@name metadataNodes';

    create materialized view if not exists metadata.nodes_log_cache as
      select * from metadata.nodes_log;
    create unique index if not exists nodes_log_cache_node_log on metadata.nodes_log_cache("node_log");
    create index if not exists nodes_log_cache_node on metadata.nodes_log_cache("node");
    create index if not exists nodes_log_cache_observed_on_desc on metadata.nodes_log_cache("observed_on" desc);
    
    create materialized view if not exists metadata.nodes_cache as
      select * from metadata.nodes;
    create unique index if not exists nodes_cache_node on metadata.nodes_cache("node");
    create index if not exists nodes_cache_observed_on_desc on metadata.nodes_cache("observed_on" desc);

    create materialized view if not exists metadata.change_log_cache as
      select
        nodes_log_cache.icon,
        nodes_log_cache.type,
        nodes_log_cache.node,
        nodes_log_cache.node_log,
        nodes_log_cache.name,
        nodes_log_cache.definition,
        nodes_log_cache.status,
        nodes_log_cache.observed_on,
        nodes_log_cache.transient,
        nodes_log_cache.deleted,
        row_number() over (partition by nodes_log_cache.node, nodes_log_cache.type order by observed_on asc) as row_number,
        first_value(nodes_log_cache.node_log) over (partition by nodes_log_cache.node, nodes_log_cache.type order by observed_on desc) as newest_node_log,
        first_value(nodes_log_cache.deleted) over (partition by nodes_log_cache.node, nodes_log_cache.type order by observed_on desc) as deleted_in_future,
        lag(nodes_log_cache.definition, 1, nodes_log_cache.definition) over (partition by nodes_log_cache.node, nodes_log_cache.type order by observed_on asc) as old_definition,
        node_types.name as node_type
      from
        metadata.nodes_log_cache join
        metadata.node_types on nodes_log_cache.type = node_types.type
      where 
        node_types.name not like '%event%' and -- purposely dont include events or statistics, we can merge it in later.
        node_types.name not like 'oracle/constraints' -- unusually large amount of constraint changes, investigate and remove..
      order by nodes_log_cache.observed_on desc;
  
  create unique index if not exists change_log_cache_node_log on metadata.change_log_cache ("node_log");
  create index if not exists change_log_cache_node on metadata.change_log_cache ("node");
  create index if not exists change_log_cache_node_type on metadata.change_log_cache ("node_type"); 

  create table if not exists metadata.labels (
    label uuid primary key not null,
    node uuid not null, -- abstract reference to another object
    type uuid references metadata.node_types("type"),
    name varchar(128) not null 
      constraint check_name_length check(length(name) > 2) 
      constraint alpha_numeric_name check(name ~* '^[A-Za-z0-9\.\-]+$'),
    value varchar(128) not null
      constraint alpha_numeric_value check(value ~* '^[A-Za-z0-9\.\-]*$'),
    implicit boolean not null default false
  );
  create unique index if not exists metadata_labels_uidx on metadata.labels(node, type, name, value, implicit);
  create index if not exists metadata_labels_type on metadata.labels("type");

  create table if not exists metadata.annotations (
    annotation uuid primary key not null,
    node uuid not null, -- abstract reference to another object
    type uuid references metadata.node_types("type"),
    name varchar(128) not null 
      constraint check_name_length check(length(name) > 2) 
      constraint alpha_numeric_name check(name ~* '^[A-Za-z0-9\.\-]+$'),
    value text not null,
    implicit boolean not null default false
  );
  create unique index if not exists metadata_annotations_uidx on metadata.annotations(node, type, name, implicit);
  create index if not exists metadata_annotations_type on metadata.annotations("type");
  
  -- This view is intended to aggregate up the node, type info and labels/annotations
  -- as a convenience for the UI and other systems. It doesn't actually hold any new information.
  create or replace view metadata.objects as
    select
      nodes_cache.node,
      nodes_cache.name,
      coalesce(name_label.value, nodes_cache.name) as "human_name",
      node_types.name as "type",
      nodes_cache.definition,
      nodes_cache.status,
      nodes_cache.observed_on,
      ('{' || string_agg(to_json(metadata.labels.name) || ':' ||  to_json(metadata.labels.value), ',') || '}')::jsonb as labels,
      ('{' || string_agg(to_json(metadata.annotations.name) || ':' ||  to_json(metadata.annotations.value), ',') || '}')::jsonb as annotations
    from
      metadata.nodes_cache
      join metadata.node_types on nodes_cache.type = node_types.type
      left join metadata.labels on nodes_cache.node = labels.node and nodes_cache.type = labels.type
      left join metadata.labels as name_label on nodes_cache.node = name_label.node and nodes_cache.type = name_label.type and name_label.name = 'name'
      left join metadata.annotations on nodes_cache.node = annotations.node and nodes_cache.type = annotations.type
    group by
      nodes_cache.node,
      nodes_cache.name,
      name_label.value,
      node_types.name,
      nodes_cache.definition,
      nodes_cache.status,
      nodes_cache.observed_on;

  create or replace view metadata.active_objects as
    select
      nodes_cache.node,
      nodes_cache.name,
      coalesce(name_label.value, nodes_cache.name) as "human_name",
      node_types.name as "type",
      nodes_cache.definition,
      nodes_cache.status,
      nodes_cache.observed_on,
      ('{' || string_agg(to_json(metadata.labels.name) || ':' ||  to_json(metadata.labels.value), ',') || '}')::jsonb as labels,
      ('{' || string_agg(to_json(metadata.annotations.name) || ':' ||  to_json(metadata.annotations.value), ',') || '}')::jsonb as annotations
    from
      metadata.nodes_cache
      join metadata.node_types on nodes_cache.type = node_types.type
      left join metadata.labels on nodes_cache.node = labels.node and nodes_cache.type = labels.type
      left join metadata.labels as name_label on nodes_cache.node = name_label.node and nodes_cache.type = name_label.type and name_label.name = 'name'
      left join metadata.annotations on nodes_cache.node = annotations.node and nodes_cache.type = annotations.type
    --where
    --  nodes_cache.transient = false
    group by
      nodes_cache.node,
      nodes_cache.name,
      name_label.value,
      node_types.name,
      nodes_cache.definition,
      nodes_cache.status,
      nodes_cache.observed_on;

  -- Procedures and views for familial relationships in-between nodes
  create table if not exists metadata.families (
    connection uuid not null primary key,
    parent uuid not null,
    child uuid not null,
    observed_on timestamp with time zone default now()
  );
  create index if not exists metadata_families_parent on metadata.families(parent);
  create index if not exists metadata_families_child on metadata.families(child);
  create unique index if not exists families_node_idx on metadata.families(parent, child);

  create or replace function metadata.find_node_relatives(in_node_log uuid)
    returns table (
      parent uuid,
      parent_name text,
      parent_type text,
      parent_icon text,
      child uuid,
      child_name text,
      child_type text,
      child_icon text
    )
  as $c$
    with recursive
      precord(parent, parent_name, parent_type, parent_type_name, parent_icon, child, child_name, child_type, child_type_name, child_icon, path, cycle)
    as (
     select
       parent.node_log as parent,
       parent.name as parent_name,
       parent_type.type as parent_type,
       parent_type.name as parent_type_name,
       parent_type.icon as parent_icon,
       child.node_log as parent,
       child.name as parent_name,
       child_type.type as parent_type,
       child_type.name as parent_type_name,
       child_type.icon as parent_icon,
       case 
        when parent.node_log = in_node_log then array[parent.node_log] 
        when child.node_log = in_node_log then array[child.node_log]
       end as path,
       false as cycle
     from
       metadata.families
         join metadata.nodes_log_cache as parent on families.parent = parent.node_log
         join metadata.node_types as parent_type on parent.type = parent_type.type
         join metadata.nodes_log_cache as child on families.child = child.node_log
         join metadata.node_types as child_type on child.type = child_type.type
     where
       (parent.node_log = in_node_log or child.node_log = in_node_log)

    union all

    select parent, parent_name, parent_type, parent_type_name, parent_icon, child, child_name, child_type, child_type_name, child_icon, path, cycle from (
      select
        parent.node_log as parent,
        parent.name as parent_name,
        parent_type.type as parent_type,
        parent_type.name as parent_type_name,
        parent_type.icon as parent_icon,
        child.node_log as child,
        child.name as child_name,
        child_type.type as child_type,
        child_type.name as child_type_name,
        child_type.icon as child_icon,
        case
          when precord.child = families.parent then precord.path || parent.node_log -- we were found as children of previous record, add our parent as a path
          when precord.parent = families.child then precord.path || child.node_log -- we were found as parents of a previous record, add our child as the path
          when precord.child = families.child and precord.parent != families.parent then precord.path || precord.child -- we came through the parent of the previous record
          when precord.parent = families.parent and precord.child != families.child then precord.path || precord.parent -- we came through a sibling of the previous record
        end as path,
        case
          when precord.child = families.child and precord.parent = families.parent then true -- we came across ourselves.
          when precord.child = families.parent then parent.node_log = ANY(precord.path)  -- we were found as children of previous record, add our parent as a path
          when precord.parent = families.child then child.node_log = ANY(precord.path)  -- we were found as parents of a previous record, add our child as the path
          when precord.child = families.child and precord.parent != families.parent then true -- we came through the parent of the previous record
          when precord.parent = families.parent and precord.child != families.child then true  -- we came through a sibling of the previous record
        end as cycle,
        families.observed_on,
        row_number() over (partition by parent.name, parent_type.type, parent_type.icon, child.name, child_type.type, child_type.icon order by metadata.families.observed_on desc) as rn
      from
        precord
          join metadata.families on (
            precord.child = families.parent or -- finds children
            precord.child = families.child and precord.parent != families.parent or -- finds "married" objects
            precord.parent = families.parent and precord.child != families.child or -- finds "sibling" objects
            precord.parent = families.child -- finds parents
          )
          join metadata.nodes_log_cache as parent on families.parent = parent.node_log
          join metadata.node_types as parent_type on parent.type = parent_type.type
          join metadata.nodes_log_cache as child on families.child = child.node_log
          join metadata.node_types as child_type on child.type = child_type.type
      where
        NOT cycle
    ) a where a.rn = 1
  ) select distinct parent, parent_name, parent_type_name, parent_icon, child, child_name, child_type_name, child_icon from precord
  $c$ language sql;

  create or replace function metadata.find_ancestors_graph(in_node_log uuid)
    returns table (
      parent uuid,
      parent_name text,
      parent_type text,
      parent_icon text,
      child uuid,
      child_name text,
      child_type text,
      child_icon text
    )
  as $c$
    with recursive
      precord(parent, parent_name, parent_type, parent_type_name, parent_icon, child, child_name, child_type, child_type_name, child_icon, path, cycle)
    as (
     select
       parent.node_log as parent,
       parent.name as parent_name,
       parent_type.type as parent_type,
       parent_type.name as parent_type_name,
       parent_type.icon as parent_icon,
       child.node_log as parent,
       child.name as parent_name,
       child_type.type as parent_type,
       child_type.name as parent_type_name,
       child_type.icon as parent_icon,
       array[parent.node_log] path,
       false as cycle
     from
       metadata.families
         join metadata.nodes_log_cache as parent on families.parent = parent.node_log
         join metadata.node_types as parent_type on parent.type = parent_type.type
         join metadata.nodes_log_cache as child on families.child = child.node_log
         join metadata.node_types as child_type on child.type = child_type.type
     where
       (child.node_log = in_node_log)

    union all

    select parent, parent_name, parent_type, parent_type_name, parent_icon, child, child_name, child_type, child_type_name, child_icon, path, cycle from (
      select
        parent.node_log as parent,
        parent.name as parent_name,
        parent_type.type as parent_type,
        parent_type.name as parent_type_name,
        parent_type.icon as parent_icon,
        child.node_log as child,
        child.name as child_name,
        child_type.type as child_type,
        child_type.name as child_type_name,
        child_type.icon as child_icon,
        precord.path || precord.child as path,
        families.parent = ANY(precord.path) as cycle,
        families.observed_on,
        row_number() over (partition by parent.name, parent_type.type, parent_type.icon, child.name, child_type.type, child_type.icon order by metadata.families.observed_on desc) as rn
      from
        precord
          join metadata.families on families.child = precord.parent
          join metadata.nodes_log_cache as parent on families.parent = parent.node_log
          join metadata.node_types as parent_type on parent.type = parent_type.type
          join metadata.nodes_log_cache as child on families.child = child.node_log
          join metadata.node_types as child_type on child.type = child_type.type
      where
        NOT cycle
    ) a where a.rn = 1
  ) select distinct parent, parent_name, parent_type_name, parent_icon, child, child_name, child_type_name, child_icon from precord
  $c$ language sql;

  create or replace function metadata.find_descendants_graph(in_node_log uuid)
    returns table (
      parent uuid,
      parent_name text,
      parent_type text,
      parent_icon text,
      child uuid,
      child_name text,
      child_type text,
      child_icon text
    )
  as $c$
    with recursive
      precord(parent, parent_name, parent_type, parent_type_name, parent_icon, child, child_name, child_type, child_type_name, child_icon, path, cycle)
    as (
     select
       parent.node_log as parent,
       parent.name as parent_name,
       parent_type.type as parent_type,
       parent_type.name as parent_type_name,
       parent_type.icon as parent_icon,
       child.node_log as parent,
       child.name as parent_name,
       child_type.type as parent_type,
       child_type.name as parent_type_name,
       child_type.icon as parent_icon,
       array[child.node_log] path,
       false as cycle
     from
       metadata.families
         join metadata.nodes_log_cache as parent on families.parent = parent.node_log
         join metadata.node_types as parent_type on parent.type = parent_type.type
         join metadata.nodes_log_cache as child on families.child = child.node_log
         join metadata.node_types as child_type on child.type = child_type.type
     where
       (parent.node_log = in_node_log)

    union all

    select parent, parent_name, parent_type, parent_type_name, parent_icon, child, child_name, child_type, child_type_name, child_icon, path, cycle from (
      select
        parent.node_log as parent,
        parent.name as parent_name,
        parent_type.type as parent_type,
        parent_type.name as parent_type_name,
        parent_type.icon as parent_icon,
        child.node_log as child,
        child.name as child_name,
        child_type.type as child_type,
        child_type.name as child_type_name,
        child_type.icon as child_icon,
        precord.path || precord.parent as path,
        families.child = ANY(precord.path) as cycle,
        families.observed_on,
        row_number() over (partition by parent.name, parent_type.type, parent_type.icon, child.name, child_type.type, child_type.icon order by metadata.families.observed_on desc) as rn
      from
        precord
          join metadata.families on families.parent = precord.child
          join metadata.nodes_log_cache as parent on families.parent = parent.node_log
          join metadata.node_types as parent_type on parent.type = parent_type.type
          join metadata.nodes_log_cache as child on families.child = child.node_log
          join metadata.node_types as child_type on child.type = child_type.type
      where
        NOT cycle
    ) a where a.rn = 1
  ) select distinct parent, parent_name, parent_type_name, parent_icon, child, child_name, child_type_name, child_icon from precord
  $c$ language sql;



  create or replace function metadata.find_descendants_graph_with_depth(in_node_log uuid, depth integer)
    returns table (
      parent uuid,
      parent_name text,
      parent_type text,
      parent_icon text,
      child uuid,
      child_name text,
      child_type text,
      child_icon text
    )
  as $c$
    with recursive
      precord(parent, parent_name, parent_type, parent_type_name, parent_icon, child, child_name, child_type, child_type_name, child_icon, path, cycle)
    as (
     select
       parent.node_log as parent,
       parent.name as parent_name,
       parent_type.type as parent_type,
       parent_type.name as parent_type_name,
       parent_type.icon as parent_icon,
       child.node_log as parent,
       child.name as parent_name,
       child_type.type as parent_type,
       child_type.name as parent_type_name,
       child_type.icon as parent_icon,
       array[child.node_log] path,
       case when depth = 0 then true else false end as cycle
     from
       metadata.families
         join metadata.nodes_log_cache as parent on families.parent = parent.node_log
         join metadata.node_types as parent_type on parent.type = parent_type.type
         join metadata.nodes_log_cache as child on families.child = child.node_log
         join metadata.node_types as child_type on child.type = child_type.type
     where
       (parent.node_log = in_node_log)

    union all

    select parent, parent_name, parent_type, parent_type_name, parent_icon, child, child_name, child_type, child_type_name, child_icon, path, cycle from (
      select
        parent.node_log as parent,
        parent.name as parent_name,
        parent_type.type as parent_type,
        parent_type.name as parent_type_name,
        parent_type.icon as parent_icon,
        child.node_log as child,
        child.name as child_name,
        child_type.type as child_type,
        child_type.name as child_type_name,
        child_type.icon as child_icon,
        precord.path || precord.parent as path,
        (families.child = ANY(precord.path) or array_length(precord.path, 1) = depth) as cycle,
        families.observed_on,
        row_number() over (partition by parent.name, parent_type.type, parent_type.icon, child.name, child_type.type, child_type.icon order by metadata.families.observed_on desc) as rn
      from
        precord
          join metadata.families on families.parent = precord.child
          join metadata.nodes_log_cache as parent on families.parent = parent.node_log
          join metadata.node_types as parent_type on parent.type = parent_type.type
          join metadata.nodes_log_cache as child on families.child = child.node_log
          join metadata.node_types as child_type on child.type = child_type.type
      where
        NOT cycle
    ) a where a.rn = 1
  ) select distinct parent, parent_name, parent_type_name, parent_icon, child, child_name, child_type_name, child_icon from precord
  $c$ language sql;


  create or replace function metadata.find_ancestors(in_node_log uuid)
    returns table (
      node_log uuid,
      name text,
      "type" text,
      icon text,
      parents uuid[],
      rank bigint
    )
  as $c$
    with cte as (
      select
        parent,
        parent_name,
        parent_type,
        parent_icon,
        child,
        child_name,
        child_type,
        child_icon
      from
        metadata.find_ancestors_graph(in_node_log)
    )
    select
      node_log,
      name,
      "type",
      icon,
      array_agg(parent) as parents,
      count(*) over (partition by "type") as rank
    from (
      select 
        cte.parent      as node_log,
        cte.parent_name as name,
        cte.parent_type as "type",
        cte.parent_icon as icon,
        cte2.parent
      from cte left join cte as cte2 on cte2.child = cte.parent
      union
      select 
        cte.child      as node_log,
        cte.child_name as name,
        cte.child_type as "type",
        cte.child_icon as icon,
        cte3.parent
      from cte left join cte as cte3 on cte3.child = cte.child
    ) as a
    group by node_log, name, "type", icon
    order by rank desc
  $c$ language sql;

  create or replace function metadata.find_descendants(in_node_log uuid)
    returns table (
      node_log uuid,
      name text,
      "type" text,
      icon text,
      parents uuid[],
      rank bigint
    )
  as $c$
    with cte as (
      select
        parent,
        parent_name,
        parent_type,
        parent_icon,
        child,
        child_name,
        child_type,
        child_icon
      from
        metadata.find_descendants_graph(in_node_log)
    )
    select
      node_log,
      name,
      "type",
      icon,
      array_agg(parent) as parents,
      count(*) over (partition by "type") as rank
    from (
      select 
        cte.parent      as node_log,
        cte.parent_name as name,
        cte.parent_type as "type",
        cte.parent_icon as icon,
        cte2.parent
      from cte left join cte as cte2 on cte2.child = cte.parent
      union
      select 
        cte.child      as node_log,
        cte.child_name as name,
        cte.child_type as "type",
        cte.child_icon as icon,
        cte3.parent
      from cte left join cte as cte3 on cte3.child = cte.child
    ) as a
    group by node_log, name, "type", icon
    order by rank desc
  $c$ language sql;


  create or replace function metadata.find_descendants_with_depth(in_node_log uuid, depth integer)
    returns table (
      node_log uuid,
      name text,
      "type" text,
      icon text,
      parents uuid[],
      rank bigint
    )
  as $c$
    with cte as (
      select
        parent,
        parent_name,
        parent_type,
        parent_icon,
        child,
        child_name,
        child_type,
        child_icon
      from
        metadata.find_descendants_graph_with_depth(in_node_log, depth)
    )
    select
      node_log,
      name,
      "type",
      icon,
      array_agg(parent) as parents,
      count(*) over (partition by "type") as rank
    from (
      select
        cte.parent      as node_log,
        cte.parent_name as name,
        cte.parent_type as "type",
        cte.parent_icon as icon,
        cte2.parent
      from cte left join cte as cte2 on cte2.child = cte.parent
      union
      select
        cte.child      as node_log,
        cte.child_name as name,
        cte.child_type as "type",
        cte.child_icon as icon,
        cte3.parent
      from cte left join cte as cte3 on cte3.child = cte.child
    ) as a
    group by node_log, name, "type", icon
    order by rank desc
  $c$ language sql;

  -- favorites and webhooks
  
  create table if not exists metadata.favorites
  (
    "user" uuid references metadata.users("user"),
    node uuid not null,
    created timestamp with time zone default now()
  );
  create unique index if not exists metadata_favorites_user_node on metadata.favorites("user", node);
  create index if not exists metadata_favorites_nodes on metadata.favorites(node);
end
$$;