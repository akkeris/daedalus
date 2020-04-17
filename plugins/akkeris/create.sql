do $$
begin

  create schema if not exists akkeris;

  create table if not exists akkeris.spaces_log (
    space_log uuid not null primary key,
    space uuid not null,
    name varchar(128) not null,
    definition jsonb not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists spaces_unique on akkeris.spaces_log (space, name, (definition->>'updated_at'), deleted);
  create or replace view akkeris.spaces as
    with ordered_list as ( select
      space_log,
      space,
      name,
      definition,
      observed_on,
      deleted,
      row_number() over (partition by name, space order by observed_on desc) as rn
    from akkeris.spaces_log) 
    select space_log, space, name, definition, observed_on from ordered_list where rn=1 and deleted = false;


  create table if not exists akkeris.apps_log (
    app_log uuid not null primary key,
    app uuid not null,
    name varchar(128) not null,
    space_log uuid references akkeris.spaces_log("space_log") not null,
    definition jsonb not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists apps_unique on akkeris.apps_log (app, name, space_log, (definition->>'updated_at'), deleted);
  create index if not exists apps_log_space_log on akkeris.apps_log (space_log);
  create or replace view akkeris.apps as
    with ordered_list as ( select
      apps_log.app_log,
      apps_log.app,
      apps_log.name,
      spaces_log.space,
      apps_log.definition,
      apps_log.observed_on,
      apps_log.deleted,
      row_number() over (partition by apps_log.name, spaces_log.space order by apps_log.observed_on desc) as rn
    from akkeris.apps_log join akkeris.spaces_log on apps_log.space_log = spaces_log.space_log) 
    select app_log, app, name, space, definition, observed_on from ordered_list where rn=1 and deleted = false;


  create table if not exists akkeris.addon_services_log (
    addon_service_log uuid not null primary key,
    addon_service uuid not null,
    name varchar(128) not null,
    definition jsonb not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists addon_services_unique on akkeris.addon_services_log (addon_service, name, (definition->>'updated_at'), deleted);
  create or replace view akkeris.addon_services as
    with ordered_list as ( select
      addon_service_log,
      addon_service,
      name,
      definition,
      observed_on,
      deleted,
      row_number() over (partition by name, definition order by observed_on desc) as rn
    from akkeris.addon_services_log) 
    select addon_service_log, addon_service, name, definition, observed_on from ordered_list where rn=1 and deleted = false;


  create table if not exists akkeris.addons_log (
    addon_log uuid not null primary key,
    addon uuid not null,
    app_log uuid references akkeris.apps_log("app_log") not null,
    addon_service_log uuid references akkeris.addon_services_log ("addon_service_log")  not null,
    name varchar(128) not null,
    definition jsonb not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists addons_unique on akkeris.addons_log (addon, app_log, addon_service_log, name, (definition->>'updated_at'), deleted);
  create index if not exists akkeris_addons_log_addon_service_log on akkeris.addons_log (addon_service_log);
  create index if not exists akkeris_addons_log_app_log on akkeris.addons_log (app_log);

  create or replace view akkeris.addons as
    with ordered_list as ( select
      addons_log.addon_log,
      addons_log.addon,
      addons_log.name,
      apps_log.app,
      addon_services_log.addon_service,
      addons_log.definition,
      addons_log.observed_on,
      addons_log.deleted as addon_deleted,
      apps_log.deleted as app_deleted,
      addon_services_log.deleted as addon_service_deleted,
      spaces_log.deleted as space_deleted,
      row_number() over (partition by addons_log.addon, addons_log.name, apps_log.app, addon_services_log.addon_service order by addons_log.observed_on desc) as rn
    from akkeris.addons_log 
      join akkeris.addon_services_log on addon_services_log.addon_service_log = addons_log.addon_service_log 
      join akkeris.apps_log on apps_log.app_log = addons_log.app_log 
      join akkeris.spaces_log on spaces_log.space_log = apps_log.space_log) 
    select addon_log, addon, name, app, addon_service, definition, observed_on 
    from ordered_list where rn=1 and addon_deleted = false and app_deleted = false and addon_service_deleted = false and space_deleted = false;


  create table if not exists akkeris.addon_attachments_log (
    addon_attachment_log uuid not null primary key,
    addon_attachment uuid not null,
    addon_log uuid references akkeris.addons_log("addon_log") not null,
    app_log uuid references akkeris.apps_log("app_log") not null,
    addon_service_log uuid references akkeris.addon_services_log ("addon_service_log")  not null,
    name varchar(128) not null,
    definition jsonb not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists addon_attachments_unique on akkeris.addon_attachments_log (addon_attachment, addon_log, app_log, addon_service_log, name, (definition->>'updated_at'), deleted);
  create index if not exists addon_attachments_log_addon_log on akkeris.addon_attachments_log (addon_log);
  create index if not exists addon_attachments_log_app_log on akkeris.addon_attachments_log (app_log);
  create index if not exists addon_attachments_log_addon_service_log on akkeris.addon_attachments_log (addon_service_log);
  create or replace view akkeris.addon_attachments as
    with ordered_list as ( select
      addon_attachments_log.addon_attachment_log,
      addon_attachments_log.addon_attachment,
      addon_attachments_log.name,
      addons_log.addon,
      apps_log.app,
      addon_services_log.addon_service,
      addon_attachments_log.definition,
      addon_attachments_log.observed_on,
      addon_attachments_log.deleted as addon_deleted,
      apps_log.deleted as app_deleted,
      addon_services_log.deleted as addon_service_deleted,
      spaces_log.deleted as space_deleted,
      row_number() over (partition by addon_attachments_log.name, addons_log.addon, addon_attachments_log.name, apps_log.app, addon_services_log.addon_service order by addon_attachments_log.observed_on desc) as rn
    from akkeris.addon_attachments_log 
      join akkeris.addons_log on addons_log.addon_log = addon_attachments_log.addon_log
      join akkeris.addon_services_log on addon_services_log.addon_service_log = addon_attachments_log.addon_service_log 
      join akkeris.apps_log on apps_log.app_log = addon_attachments_log.app_log 
      join akkeris.spaces_log on spaces_log.space_log = apps_log.space_log
    ) 
    select addon_attachment_log, addon_attachment, addon, name, app, addon_service, definition, observed_on 
    from ordered_list where rn=1 and addon_deleted = false and app_deleted = false and addon_service_deleted = false and space_deleted = false;


  create table if not exists akkeris.sites_log (
    site_log uuid not null primary key,
    site uuid not null,
    name varchar(128) not null,
    definition jsonb not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists sites_unique on akkeris.sites_log (site, name, (definition->>'updated_at'), deleted);
  create or replace view akkeris.sites as
    with ordered_list as ( select
      site_log,
      site,
      name,
      definition,
      observed_on,
      deleted,
      row_number() over (partition by name, definition order by observed_on desc) as rn
    from akkeris.sites_log) 
    select site_log, site, name, definition, observed_on from ordered_list where rn=1 and deleted = false;


  create table if not exists akkeris.routes_log (
    route_log uuid not null primary key,
    route uuid not null,
    site_log uuid not null references akkeris.sites_log("site_log"),
    app_log uuid not null references akkeris.apps_log("app_log"),
    source_path text not null,
    target_path text not null,
    definition jsonb not null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists routes_unique on akkeris.routes_log (route, site_log, app_log, (definition->>'updated_at'), deleted);
  create index if not exists routes_log_site_log on akkeris.routes_log (site_log);
  create index if not exists routes_log_app_log on akkeris.routes_log (app_log);
  create or replace view akkeris.routes as
    with ordered_list as ( 
      select
        routes_log.route_log,
        routes_log.route,
        sites_log.site,
        apps_log.app,
        routes_log.source_path,
        routes_log.target_path,
        routes_log.definition,
        routes_log.observed_on,
        routes_log.deleted as routes_deleted,
        sites_log.deleted as sites_deleted,
        row_number() over (partition by sites_log.site, apps_log.app, routes_log.definition order by routes_log.observed_on desc) as rn
      from akkeris.routes_log 
        join akkeris.sites_log on routes_log.site_log = sites_log.site_log
        join akkeris.apps_log on apps_log.app_log = routes_log.app_log
  ) 
  select route_log, route, site, app, source_path, target_path, definition, observed_on from ordered_list where rn=1 and routes_deleted = false and sites_deleted = false;

end
$$;