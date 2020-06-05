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


  create table if not exists metadata.nodes_log_example_schema (
    icon text,
    "type" uuid,
    node_log uuid,
    node uuid,
    name text,
    definition jsonb,
    status jsonb,
    observed_on timestamptz,
    deleted boolean
  );
  create table if not exists metadata.nodes_example_schema (
    icon text,
    "type" uuid,
    node_log uuid,
    node uuid,
    name text,
    definition jsonb,
    status jsonb,
    observed_on timestamptz
  );

  if not exists (select 1 from information_schema.views where table_schema='metadata' and table_name='nodes') then
    create or replace view  metadata.nodes as
      select * from metadata.nodes_example_schema;
  end if;
  if not exists (select 1 from information_schema.views where table_schema='metadata' and table_name='nodes_log') then
    create or replace view metadata.nodes_log as
      select * from metadata.nodes_log_example_schema;
  end if;

  create or replace function metadata.add_nodes_type(name text, sql text)
    returns boolean as $d$
    declare def text;
    begin
      if not exists (select 1 from pg_catalog.pg_views where pg_views.schemaname = 'metadata' and viewname = 'nodes') then
        execute 'create or replace view metadata.nodes as ' || sql;
      else
        if not exists (select 1 from pg_catalog.pg_views where pg_views.schemaname = 'metadata' and viewname = 'nodes' and definition like ('%' || name || '%')) then
          select (rtrim(definition, ';') || ' union all ' || sql) into def from pg_catalog.pg_views where pg_views.schemaname = 'metadata' and viewname = 'nodes';
          execute 'create or replace view metadata.nodes as ' || def;
        end if;
      end if;
      execute 'comment on view "metadata"."nodes" is E''@name metadataNodes''';
      return true;
    end;
    $d$ language plpgsql;

  create or replace function metadata.add_nodes_log_type(name text, sql text)
    returns boolean as $d$
    declare def text;
    begin
      if not exists (select 1 from pg_catalog.pg_views where pg_views.schemaname = 'metadata' and viewname = 'nodes_log') then
        execute 'create or replace view metadata.nodes_log as ' || sql;
      else
        if not exists (select 1 from pg_catalog.pg_views where pg_views.schemaname = 'metadata' and viewname = 'nodes_log' and definition like ('%' || name || '%')) then
          select (rtrim(definition, ';') || ' union all ' || sql) into def from pg_catalog.pg_views where pg_views.schemaname = 'metadata' and viewname = 'nodes_log';
          execute 'create or replace view metadata.nodes_log as ' || def;
        end if;
      end if;
      execute 'comment on view "metadata"."nodes_log" is E''@name metadataNodesLog''';
      return true;
    end;
    $d$ language plpgsql;

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
  
  if not exists (select 1 from information_schema.columns where table_schema='metadata' and table_name='objects' and column_name='node_log') then
    drop view if exists metadata.objects;
  end if;

  create or replace view metadata.objects as
    select
      nodes_cache.node_log,
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
      nodes_cache.node_log,
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