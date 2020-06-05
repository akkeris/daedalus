do $$
begin

  create schema if not exists kubernetes;

  create extension if not exists pgcrypto;
  create extension if not exists "uuid-ossp";


  if exists (select 1 from information_schema.tables where table_schema='metadata' and table_name='node_types') then
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
    insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
      (uuid_generate_v4(), (select "type" from metadata.node_types where name='kubernetes/persistentvolumeclaims' limit 1), '$.metadata.namespace', 'namespace', 'Namespace', 'string', false) on conflict (type, name) do nothing;
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
  end if;
  -- the remaining objects are dynamically created.
end
$$;