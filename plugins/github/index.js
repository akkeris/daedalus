const fs = require('fs');
const debug = require('debug')('daedalus:github');
const axios = require('axios');
const crawler = require('../../common/crawler.js');

async function fetch(org, name) {
  const get = axios.create({
    baseURL: 'https://api.github.com',
    timeout: 60 * 1000,
    headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'user-agent': 'daedalus' },
  });
  const params = '?page=1&per_page=100';
  const { data: repo } = await get(`/repos/${org}/${name}${params}`);
  delete repo.temp_clone_token;
  await crawler.wait(100);
  const { data: commits } = await get(`/repos/${org}/${name}/commits${params}`);
  await crawler.wait(100);
  const { data: branches } = await get(`/repos/${org}/${name}/branches${params}`);
  await crawler.wait(100);
  const { data: pulls } = await get(`/repos/${org}/${name}/pulls${params}`);
  await crawler.wait(100);
  const { data: hooks } = await get(`/repos/${org}/${name}/hooks${params}`);
  await crawler.wait(100);
  return {
    repo, commits, branches, pulls, hooks,
  };
}

const repoNode = (def) => def.html_url;
const repoMetadata = (def) => ({
  license: def.license,
  organzation: def.organization,
  name: def.name,
  full_name: def.full_name,
  description: def.description,
  url: def.url,
  topics: def.topics,
  language: def.language,
});
const repoSpec = (def) => ({
  source: def.source,
  parent: def.parent,
  fork: def.fork,
  owner: def.owner,
  id: def.id,
  node_id: def.node_id,
  private: def.private,
  default_branch: def.default_branch,
  has_issues: def.has_issues,
  has_projects: def.has_projects,
  has_wiki: def.has_wiki,
  has_pages: def.has_pages,
  has_downloads: def.has_downloads,
  allow_rebase_merge: def.allow_rebase_merge,
  allow_squash_merge: def.allow_squash_merge,
  allow_merge_commit: def.allow_merge_commit,
  archived: def.archived,
  disabled: def.disabled,
  permissions: def.permissions,
});
const repoStatus = (def) => ({
  forks_count: def.forks_count,
  stargazers_count: def.stargazers_count,
  watchers_count: def.watchers_count,
  network_count: def.network_count,
  size: def.size,
  open_issues_count: def.open_issues_count,
  pushed_at: def.pushed_at,
  created_at: def.created_at,
  updated_at: def.updated_at,
});

const commitNode = (def) => def.html_url;
const commitSpec = (def) => ({
  sha: def.sha,
  node_id: def.node_id,
  commit: def.commit,
  parents: def.parents,
});
const commitStatus = (def) => ({
  commit: {
    comment_count: def.commit.comment_count,
  },
});
const commitMetadata = (def) => ({
  author: def.author,
  committer: def.committer,
});

const branchNode = (repo, def) => `${repo.html_url}/tree/${def.name}`;
const branchSpec = (def) => ({
  commit: def.commit,
  protected: def.protected,
  protection: def.protection,
});
const branchMetadata = (def) => ({
  name: def.name,
});

const pullNode = (def) => def.html_url;
const pullSpec = (def) => ({
  status: def.status,
  state: def.state,
  locked: def.locked,
  active_lock_reason: def.active_lock_reason,
  requested_reviewers: def.requested_reviewers,
  requested_teams: def.requested_teams,
  head: def.head,
  base: def.base,
  draft: def.draft,
});
const pullStatus = (def) => ({
  author_association: def.author_association,
  milestone: def.milestone,
  id: def.id,
});
const pullMetadata = (def) => ({
  title: def.title,
  body: def.body,
  labels: def.labels,
  user: def.user,
  assignee: def.assignee,
  assignees: def.assignees,
});

const hookNode = (repo, def) => `${repo.html_url}/settings/hooks/${def.id}`;
const hookSpec = (def) => ({
  active: def.active,
  events: def.events,
  config: def.config,
});
const hookStatus = (def) => ({
  id: def.id,
  url: def.url,
  test_url: def.test_url,
  ping_url: def.ping_url,
  last_response: def.last_response,
});
const hookMetadata = (def) => ({
  type: def.type,
  name: def.name,
  updated_at: def.updated_at,
  created_at: def.created_at,
});

async function run(pgpool) {
  if (process.env.GITHUB !== 'true' || !process.env.GITHUB_TOKEN) {
    return false;
  }
  const { rows: repos } = await pgpool.query('select distinct definition->>\'git_url\' as git_url, apps.node_log from akkeris.apps where definition->>\'git_url\' is not null');
  for (const r of repos) { // eslint-disable-line no-restricted-syntax
    try {
      const url = new URL(r.git_url);
      const [, org, name] = url.pathname.split('/');
      debug('Examining %s %s', org, name);
      const {
        repo, commits, branches, pulls, hooks,
      } = await fetch(org, name); // eslint-disable-line no-await-in-loop
      const repoObj = (await crawler.writeObj(pgpool, 'github', 'repo', repoNode(repo), repo, repoSpec(repo), repoStatus(repo), repoMetadata(repo), { url: repo.html_url, name: repo.full_name })).rows[0]; // eslint-disable-line max-len,no-await-in-loop
      await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing', // eslint-disable-line max-len,no-await-in-loop
        [r.node_log, repoObj.node_log]);
      for (const commit of commits) { // eslint-disable-line no-restricted-syntax
        const columns = { // eslint-disable-line max-len,no-await-in-loop
          url: commit.html_url, sha: commit.sha, message: commit.commit.message, author: commit.commit.author, committer: commit.commit.committer, // eslint-disable-line max-len
        };
        const references = { repo: { url: repo.html_url } };
        const commitObj = (await crawler.writeObj(pgpool, 'github', 'commit', commitNode(commit), commit, commitSpec(commit), commitStatus(commit), commitMetadata(commit), columns, references)).rows[0]; // eslint-disable-line max-len,no-await-in-loop
        await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing', // eslint-disable-line max-len,no-await-in-loop
          [repoObj.node_log, commitObj.node_log]);
      }
      for (const branch of branches) { // eslint-disable-line no-restricted-syntax
        const columns = { name: branch.name };
        const references = { repo: { url: repo.html_url } };
        const branchObj = (await crawler.writeObj(pgpool, 'github', 'branch', branchNode(repo, branch), branch, branchSpec(branch), {}, branchMetadata(branch), columns, references)).rows[0]; // eslint-disable-line max-len,no-await-in-loop
        await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing', // eslint-disable-line max-len,no-await-in-loop
          [repoObj.node_log, branchObj.node_log]);
      }
      for (const pull of pulls) { // eslint-disable-line no-restricted-syntax
        const columns = { url: pull.html_url, name: pull.title };
        const references = { repo: { url: repo.html_url } };
        const pullObj = (await crawler.writeObj(pgpool, 'github', 'pull', pullNode(pull), pull, pullSpec(pull), pullStatus(pull), pullMetadata(pull), columns, references)).rows[0]; // eslint-disable-line max-len,no-await-in-loop
        await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing', // eslint-disable-line max-len,no-await-in-loop
          [repoObj.node_log, pullObj.node_log]);
      }
      for (const hook of hooks) { // eslint-disable-line no-restricted-syntax
        const columns = { url: hook.html_url, name: hook.config.url };
        const references = { repo: { url: repo.html_url } };
        const hookObj = (await crawler.writeObj(pgpool, 'github', 'hook', hookNode(repo, hook), hook, hookSpec(hook), hookStatus(hook), hookMetadata(hook), columns, references)).rows[0]; // eslint-disable-line max-len,no-await-in-loop
        await pgpool.query('insert into metadata.families (connection, parent, child) values (uuid_generate_v4(), $1, $2) on conflict (parent, child) do nothing', // eslint-disable-line max-len,no-await-in-loop
          [repoObj.node_log, hookObj.node_log]);
      }
    } catch (e) {
      if (e.message.includes('code 404')) {
        debug(`Warning: failed to scan repo ${r.git_url} received 404.`);
      } else {
        debug(`Failed to fetch information from repo ${r.git_url}: ${e.stack}`);
      }
    }
  }
  return true;
}

async function init(pgpool) {
  debug('Initializing github plugin...');
  await pgpool.query(fs.readFileSync('./plugins/github/create.sql').toString());
  await crawler.createTableDefinition(pgpool, 'github', 'repo', { url: { type: 'text' }, name: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'github', 'commit', {
    url: { type: 'text' }, sha: { type: 'text' }, message: { type: 'text' }, author: { type: 'jsonb' }, committer: { type: 'jsonb' },
  }, ['repo'], 'sha');
  await crawler.createTableDefinition(pgpool, 'github', 'branch', { name: { type: 'text' } }, ['repo']);
  await crawler.createTableDefinition(pgpool, 'github', 'pull', { url: { type: 'text' }, name: { type: 'text' } }, ['repo']);
  await crawler.createTableDefinition(pgpool, 'github', 'hook', { url: { type: 'text' }, name: { type: 'text' } }, ['repo']);
  debug('Initializing github plugin... done');
}

module.exports = {
  init,
  run,
};
