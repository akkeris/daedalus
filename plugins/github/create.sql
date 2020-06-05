do $$
begin

  create schema if not exists "github";
  create extension if not exists "uuid-ossp";
  

  if exists (select 1 from information_schema.tables where table_schema='metadata' and table_name='node_types') then
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'github/repos', 'github.svg', 'fa-github', 'Repos') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'github/commits', 'github.svg', 'fa-github', 'Commits') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'github/branches', 'github.svg', 'fa-github', 'Branches') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'github/pulls', 'github.svg', 'fa-github', 'Pull Requests') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'github/hooks', 'github.svg', 'fa-github', 'Webhooks') on conflict (name) do nothing;
  end if;
  -- this is dynamically created

end
$$;