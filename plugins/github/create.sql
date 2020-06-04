do $$
begin

  create schema if not exists "github";
  create extension if not exists "uuid-ossp";
  
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'github/repos', 'github.svg', 'fa-github', 'Repos') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'github/commits', 'github.svg', 'fa-github', 'Commits') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'github/branches', 'github.svg', 'fa-github', 'Branches') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'github/pulls', 'github.svg', 'fa-github', 'Pull Requests') on conflict (name) do nothing;
  insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'github/hooks', 'github.svg', 'fa-github', 'Webhooks') on conflict (name) do nothing;

  perform metadata.add_nodes_type('github/repos', 'select node_types.icon as "icon", node_types.type, repos.node_log as node_log, repos.node as node, repos.name, repos.definition, repos.status, repos.observed_on, false as transient from github.repos, metadata.node_types where node_types.name = ''github/repos''');
  perform metadata.add_nodes_type('github/commits', 'select node_types.icon as "icon", node_types.type, commits.node_log as node_log, commits.node as node, commits.sha as name, commits.definition, commits.status, commits.observed_on, false as transient from github.commits, metadata.node_types where node_types.name = ''github/commits''');
  perform metadata.add_nodes_type('github/branches', 'select node_types.icon as "icon", node_types.type, branches.node_log as node_log, branches.node as node, branches.name, branches.definition, branches.status, branches.observed_on, false as transient from github.branches, metadata.node_types where node_types.name = ''github/branches''');
  perform metadata.add_nodes_type('github/pulls', 'select node_types.icon as "icon", node_types.type, pulls.node_log as node_log, pulls.node as node, pulls.name, pulls.definition, pulls.status, pulls.observed_on, false as transient from github.pulls, metadata.node_types where node_types.name = ''github/pulls''');
  perform metadata.add_nodes_type('github/hooks', 'select node_types.icon as "icon", node_types.type, hooks.node_log as node_log, hooks.node as node, hooks.name, hooks.definition, hooks.status, hooks.observed_on, false as transient from github.hooks, metadata.node_types where node_types.name = ''github/hooks''');

  -- this is dynamically created

end
$$;