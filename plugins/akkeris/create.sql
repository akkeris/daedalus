do $$
begin

  create schema if not exists akkeris;


  if exists (select 1 from information_schema.tables where table_schema='metadata' and table_name='node_types') then
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'akkeris/sites', 'akkeris.sites.svg', 'fa-sitemap', 'Akkeris Sites') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'akkeris/routes', 'akkeris.routes.svg', 'fa-cube', 'Akkeris Routes') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'akkeris/apps', 'akkeris.apps.svg', 'fa-microchip', 'Akkeris Apps') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'akkeris/spaces', 'akkeris.spaces.svg', 'fa-cube', 'Akkeris Spaces') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'akkeris/addon_attachments', 'akkeris.addon_attachments.svg', 'fa-cube', 'Akkeris Addon Attachments') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'akkeris/addon_services', 'akkeris.addon_services.svg', 'fa-cube', 'Akkeris Services') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'akkeris/addons', 'akkeris.addons.svg', 'fa-cube', 'Akkeris Addons') on conflict (name) do nothing;
    insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
      (uuid_generate_v4(), (select "type" from metadata.node_types where name='akkeris/sites' limit 1), '$.region.name', 'region', 'Region', 'string', true) on conflict (type, name) do nothing;
  end if;
  -- dynamically created schemas

end
$$;