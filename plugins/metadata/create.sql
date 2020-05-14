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
    icon text not null
  );
  create unique index if not exists metadata_node_types_ndx on metadata.node_types(name, icon);
  insert into metadata.node_types ("type", name, icon) values (uuid_generate_v4(), 'postgresql/databases', 'postgresql.databases.svg') on conflict (name, icon) do nothing;
  insert into metadata.node_types ("type", name, icon) values (uuid_generate_v4(), 'postgresql/tables', 'postgresql.tables.svg') on conflict (name, icon) do nothing;
  insert into metadata.node_types ("type", name, icon) values (uuid_generate_v4(), 'postgresql/columns', 'postgresql.columns.svg') on conflict (name, icon) do nothing;
  insert into metadata.node_types ("type", name, icon) values (uuid_generate_v4(), 'postgresql/roles', 'postgresql.roles.svg') on conflict (name, icon) do nothing;
  insert into metadata.node_types ("type", name, icon) values (uuid_generate_v4(), 'oracle/databases', 'oracle.databases.svg') on conflict (name, icon) do nothing;
  insert into metadata.node_types ("type", name, icon) values (uuid_generate_v4(), 'oracle/tables', 'oracle.tables.svg') on conflict (name, icon) do nothing;
  insert into metadata.node_types ("type", name, icon) values (uuid_generate_v4(), 'oracle/columns', 'oracle.columns.svg') on conflict (name, icon) do nothing;
  insert into metadata.node_types ("type", name, icon) values (uuid_generate_v4(), 'oracle/roles', 'oracle.roles.svg') on conflict (name, icon) do nothing;
  insert into metadata.node_types ("type", name, icon) values (uuid_generate_v4(), 'kubernetes/config_maps', 'kubernetes.config_maps.svg') on conflict (name, icon) do nothing;
  insert into metadata.node_types ("type", name, icon) values (uuid_generate_v4(), 'kubernetes/deployments', 'kubernetes.deployments.svg') on conflict (name, icon) do nothing;
  insert into metadata.node_types ("type", name, icon) values (uuid_generate_v4(), 'kubernetes/replicasets', 'kubernetes.replicasets.svg') on conflict (name, icon) do nothing;
  insert into metadata.node_types ("type", name, icon) values (uuid_generate_v4(), 'kubernetes/pods', 'kubernetes.pods.svg') on conflict (name, icon) do nothing;
  insert into metadata.node_types ("type", name, icon) values (uuid_generate_v4(), 'akkeris/sites', 'akkeris.sites.svg') on conflict (name, icon) do nothing;
  insert into metadata.node_types ("type", name, icon) values (uuid_generate_v4(), 'akkeris/routes', 'akkeris.routes.svg') on conflict (name, icon) do nothing;
  insert into metadata.node_types ("type", name, icon) values (uuid_generate_v4(), 'akkeris/apps', 'akkeris.apps.svg') on conflict (name, icon) do nothing;

  create table if not exists metadata.nodes (
    node uuid not null primary key,
    name text not null,
    "type" uuid references metadata.node_types("type") on delete cascade not null,
    definition jsonb not null default '{}',
    status jsonb not null default '{}',
    observed_on timestamp with time zone not null default now(),
    transient boolean not null default false, -- transient describes a node that only represents a link between two object and temporarily exists.
    deleted boolean not null default false
  );
  create index if not exists metadata_nodes_type on metadata.nodes("type");
  comment on table "metadata"."nodes" is E'@name metadataNodes';
  
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
      nodes.node,
      nodes.name,
      coalesce(name_label.value, nodes.name) as "human_name",
      node_types.name as "type",
      nodes.definition,
      nodes.status,
      nodes.observed_on,
      ('{' || string_agg(to_json(metadata.labels.name) || ':' ||  to_json(metadata.labels.value), ',') || '}')::jsonb as labels,
      ('{' || string_agg(to_json(metadata.annotations.name) || ':' ||  to_json(metadata.annotations.value), ',') || '}')::jsonb as annotations
    from
      metadata.nodes
      join metadata.node_types on nodes.type = node_types.type
      left join metadata.labels on nodes.node = labels.node and nodes.type = labels.type
      left join metadata.labels as name_label on nodes.node = name_label.node and nodes.type = name_label.type and name_label.name = 'name'
      left join metadata.annotations on nodes.node = annotations.node and nodes.type = annotations.type
    group by
      nodes.node,
      nodes.name,
      name_label.value,
      node_types.name,
      nodes.definition,
      nodes.status,
      nodes.observed_on;

  create or replace view metadata.active_objects as
    select
      nodes.node,
      nodes.name,
      coalesce(name_label.value, nodes.name) as "human_name",
      node_types.name as "type",
      nodes.definition,
      nodes.status,
      nodes.observed_on,
      ('{' || string_agg(to_json(metadata.labels.name) || ':' ||  to_json(metadata.labels.value), ',') || '}')::jsonb as labels,
      ('{' || string_agg(to_json(metadata.annotations.name) || ':' ||  to_json(metadata.annotations.value), ',') || '}')::jsonb as annotations
    from
      metadata.nodes
      join metadata.node_types on nodes.type = node_types.type
      left join metadata.labels on nodes.node = labels.node and nodes.type = labels.type
      left join metadata.labels as name_label on nodes.node = name_label.node and nodes.type = name_label.type and name_label.name = 'name'
      left join metadata.annotations on nodes.node = annotations.node and nodes.type = annotations.type
    where
      nodes.transient = false
    group by
      nodes.node,
      nodes.name,
      name_label.value,
      node_types.name,
      nodes.definition,
      nodes.status,
      nodes.observed_on;

  -- Procedures and views for familial relationships in-between nodes
  create table if not exists metadata.families (
    connection uuid not null primary key,
    parent uuid references metadata.nodes("node") on delete cascade not null,
    child uuid references metadata.nodes("node") on delete cascade not null,
    observed_on timestamp with time zone default now()
  );
  create index if not exists metadata_families_parent on metadata.families(parent);
  create index if not exists metadata_families_child on metadata.families(child);
  create unique index if not exists families_node_idx on metadata.families(parent, child);

  create or replace function metadata.find_node_relatives(in_node uuid)
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
       parent.node as parent,
       parent.name as parent_name,
       parent_type.type as parent_type,
       parent_type.name as parent_type_name,
       parent_type.icon as parent_icon,
       child.node as parent,
       child.name as parent_name,
       child_type.type as parent_type,
       child_type.name as parent_type_name,
       child_type.icon as parent_icon,
       case 
        when parent.node = in_node then array[parent.node] 
        when child.node = in_node then array[child.node]
       end as path,
       false as cycle
     from
       metadata.families
         join metadata.nodes as parent on families.parent = parent.node
         join metadata.node_types as parent_type on parent.type = parent_type.type
         join metadata.nodes as child on families.child = child.node
         join metadata.node_types as child_type on child.type = child_type.type
     where
       (parent.node = in_node or child.node = in_node)

    union all

    select parent, parent_name, parent_type, parent_type_name, parent_icon, child, child_name, child_type, child_type_name, child_icon, path, cycle from (
      select
        parent.node as parent,
        parent.name as parent_name,
        parent_type.type as parent_type,
        parent_type.name as parent_type_name,
        parent_type.icon as parent_icon,
        child.node as child,
        child.name as child_name,
        child_type.type as child_type,
        child_type.name as child_type_name,
        child_type.icon as child_icon,
        case
          when precord.child = families.parent then precord.path || parent.node -- we were found as children of previous record, add our parent as a path
          when precord.parent = families.child then precord.path || child.node -- we were found as parents of a previous record, add our child as the path
          when precord.child = families.child and precord.parent != families.parent then precord.path || precord.child -- we came through the parent of the previous record
          when precord.parent = families.parent and precord.child != families.child then precord.path || precord.parent -- we came through a sibling of the previous record
        end as path,
        case
          when precord.child = families.child and precord.parent = families.parent then true -- we came across ourselves.
          when precord.child = families.parent then parent.node = ANY(precord.path)  -- we were found as children of previous record, add our parent as a path
          when precord.parent = families.child then child.node = ANY(precord.path)  -- we were found as parents of a previous record, add our child as the path
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
          join metadata.nodes as parent on families.parent = parent.node
          join metadata.node_types as parent_type on parent.type = parent_type.type
          join metadata.nodes as child on families.child = child.node
          join metadata.node_types as child_type on child.type = child_type.type
      where
        NOT cycle
    ) a where a.rn = 1
  ) select distinct parent, parent_name, parent_type_name, parent_icon, child, child_name, child_type_name, child_icon from precord
  $c$ language sql;

  create or replace function metadata.find_ancestors_graph(in_node uuid)
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
       parent.node as parent,
       parent.name as parent_name,
       parent_type.type as parent_type,
       parent_type.name as parent_type_name,
       parent_type.icon as parent_icon,
       child.node as parent,
       child.name as parent_name,
       child_type.type as parent_type,
       child_type.name as parent_type_name,
       child_type.icon as parent_icon,
       array[parent.node] path,
       false as cycle
     from
       metadata.families
         join metadata.nodes as parent on families.parent = parent.node
         join metadata.node_types as parent_type on parent.type = parent_type.type
         join metadata.nodes as child on families.child = child.node
         join metadata.node_types as child_type on child.type = child_type.type
     where
       (child.node = in_node)

    union all

    select parent, parent_name, parent_type, parent_type_name, parent_icon, child, child_name, child_type, child_type_name, child_icon, path, cycle from (
      select
        parent.node as parent,
        parent.name as parent_name,
        parent_type.type as parent_type,
        parent_type.name as parent_type_name,
        parent_type.icon as parent_icon,
        child.node as child,
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
          join metadata.nodes as parent on families.parent = parent.node
          join metadata.node_types as parent_type on parent.type = parent_type.type
          join metadata.nodes as child on families.child = child.node
          join metadata.node_types as child_type on child.type = child_type.type
      where
        NOT cycle
    ) a where a.rn = 1
  ) select distinct parent, parent_name, parent_type_name, parent_icon, child, child_name, child_type_name, child_icon from precord
  $c$ language sql;

  create or replace function metadata.find_descendants_graph(in_node uuid)
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
       parent.node as parent,
       parent.name as parent_name,
       parent_type.type as parent_type,
       parent_type.name as parent_type_name,
       parent_type.icon as parent_icon,
       child.node as parent,
       child.name as parent_name,
       child_type.type as parent_type,
       child_type.name as parent_type_name,
       child_type.icon as parent_icon,
       array[child.node] path,
       false as cycle
     from
       metadata.families
         join metadata.nodes as parent on families.parent = parent.node
         join metadata.node_types as parent_type on parent.type = parent_type.type
         join metadata.nodes as child on families.child = child.node
         join metadata.node_types as child_type on child.type = child_type.type
     where
       (parent.node = in_node)

    union all

    select parent, parent_name, parent_type, parent_type_name, parent_icon, child, child_name, child_type, child_type_name, child_icon, path, cycle from (
      select
        parent.node as parent,
        parent.name as parent_name,
        parent_type.type as parent_type,
        parent_type.name as parent_type_name,
        parent_type.icon as parent_icon,
        child.node as child,
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
          join metadata.nodes as parent on families.parent = parent.node
          join metadata.node_types as parent_type on parent.type = parent_type.type
          join metadata.nodes as child on families.child = child.node
          join metadata.node_types as child_type on child.type = child_type.type
      where
        NOT cycle
    ) a where a.rn = 1
  ) select distinct parent, parent_name, parent_type_name, parent_icon, child, child_name, child_type_name, child_icon from precord
  $c$ language sql;



  create or replace function metadata.find_descendants_graph_with_depth(in_node uuid, depth integer)
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
       parent.node as parent,
       parent.name as parent_name,
       parent_type.type as parent_type,
       parent_type.name as parent_type_name,
       parent_type.icon as parent_icon,
       child.node as parent,
       child.name as parent_name,
       child_type.type as parent_type,
       child_type.name as parent_type_name,
       child_type.icon as parent_icon,
       array[child.node] path,
       case when depth = 0 then true else false end as cycle
     from
       metadata.families
         join metadata.nodes as parent on families.parent = parent.node
         join metadata.node_types as parent_type on parent.type = parent_type.type
         join metadata.nodes as child on families.child = child.node
         join metadata.node_types as child_type on child.type = child_type.type
     where
       (parent.node = in_node)

    union all

    select parent, parent_name, parent_type, parent_type_name, parent_icon, child, child_name, child_type, child_type_name, child_icon, path, cycle from (
      select
        parent.node as parent,
        parent.name as parent_name,
        parent_type.type as parent_type,
        parent_type.name as parent_type_name,
        parent_type.icon as parent_icon,
        child.node as child,
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
          join metadata.nodes as parent on families.parent = parent.node
          join metadata.node_types as parent_type on parent.type = parent_type.type
          join metadata.nodes as child on families.child = child.node
          join metadata.node_types as child_type on child.type = child_type.type
      where
        NOT cycle
    ) a where a.rn = 1
  ) select distinct parent, parent_name, parent_type_name, parent_icon, child, child_name, child_type_name, child_icon from precord
  $c$ language sql;


  create or replace function metadata.find_ancestors(in_node uuid)
    returns table (
      node uuid,
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
        metadata.find_ancestors_graph(in_node)
    )
    select
      node,
      name,
      "type",
      icon,
      array_agg(parent) as parents,
      count(*) over (partition by "type") as rank
    from (
      select 
        cte.parent      as node,
        cte.parent_name as name,
        cte.parent_type as "type",
        cte.parent_icon as icon,
        cte2.parent
      from cte left join cte as cte2 on cte2.child = cte.parent
      union
      select 
        cte.child      as node,
        cte.child_name as name,
        cte.child_type as "type",
        cte.child_icon as icon,
        cte3.parent
      from cte left join cte as cte3 on cte3.child = cte.child
    ) as a
    group by node, name, "type", icon
    order by rank desc
  $c$ language sql;

  create or replace function metadata.find_descendants(in_node uuid)
    returns table (
      node uuid,
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
        metadata.find_descendants_graph(in_node)
    )
    select
      node,
      name,
      "type",
      icon,
      array_agg(parent) as parents,
      count(*) over (partition by "type") as rank
    from (
      select 
        cte.parent      as node,
        cte.parent_name as name,
        cte.parent_type as "type",
        cte.parent_icon as icon,
        cte2.parent
      from cte left join cte as cte2 on cte2.child = cte.parent
      union
      select 
        cte.child      as node,
        cte.child_name as name,
        cte.child_type as "type",
        cte.child_icon as icon,
        cte3.parent
      from cte left join cte as cte3 on cte3.child = cte.child
    ) as a
    group by node, name, "type", icon
    order by rank desc
  $c$ language sql;


  create or replace function metadata.find_descendants_with_depth(in_node uuid, depth integer)
    returns table (
      node uuid,
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
        metadata.find_descendants_graph_with_depth(in_node, depth)
    )
    select
      node,
      name,
      "type",
      icon,
      array_agg(parent) as parents,
      count(*) over (partition by "type") as rank
    from (
      select 
        cte.parent      as node,
        cte.parent_name as name,
        cte.parent_type as "type",
        cte.parent_icon as icon,
        cte2.parent
      from cte left join cte as cte2 on cte2.child = cte.parent
      union
      select 
        cte.child      as node,
        cte.child_name as name,
        cte.child_type as "type",
        cte.child_icon as icon,
        cte3.parent
      from cte left join cte as cte3 on cte3.child = cte.child
    ) as a
    group by node, name, "type", icon
    order by rank desc
  $c$ language sql;

  -- favorites and webhooks
  
  create table if not exists metadata.favorites
  (
    "user" uuid references metadata.users("user"),
    node uuid references metadata.nodes("node"),
    created timestamp with time zone default now()
  );
  create unique index if not exists metadata_favorites_user_node on metadata.favorites("user", node);
  create index if not exists metadata_favorites_nodes on metadata.favorites(node);
end
$$;