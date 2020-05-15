const express = require('express');
const debug = require('debug')('ui');
const oauth = require('./oauth');
const postgresqlDatabases = require('./postgresql.databases.js');
const postgresqlTables = require('./postgresql.tables.js');
const postgresqlColumns = require('./postgresql.columns.js');
const postgresqlRoles = require('./postgresql.roles.js');
const oracleDatabases = require('./oracle.databases.js');
const oracleTables = require('./oracle.tables.js');
const oracleColumns = require('./oracle.columns.js');
const oracleRoles = require('./oracle.roles.js');
const akkerisSites = require('./akkeris.sites.js');
const akkerisApps = require('./akkeris.apps.js');
const kubernetesDeployments = require('./kubernetes.deployments.js');
const kubernetesReplicasets = require('./kubernetes.replicasets.js');
const kubernetesPods = require('./kubernetes.pods.js');
const kubernetesConfigMaps = require('./kubernetes.config_maps.js');
const urlsUrls = require('./urls.urls.js');
const urlsCertificates = require('./urls.certificates.js');
const { grab, cursors, isFavorite } = require('./common.js');
const search = require('./search.js');

async function init(pgpool, bus, app) {
  if (process.env.UI !== 'true') {
    return;
  }
  app.get('/', (req, res) => res.redirect('/ui/'));
  app.use(express.static('./plugins/ui/public/'));
  app.all('/ui/*', oauth.check);
  app.get(['/ui/', '/ui/index.html'], async (req, res, next) => {
    grab('./views/index.html', req, res, next,
      await pgpool.query('select name from metadata.labels where name != \'name\' group by name order by count(*) desc'));
  });
  app.get('/ui/browse.html', async (req, res, next) => {
    const cursor = await cursors(req);
    const { rows: [{ count }] } = await pgpool.query(`select count(*) as count from metadata.active_objects ${cursor.filter}`, cursor.params);
    grab('./views/browse.html', req, res, next,
      {
        ...(await pgpool.query(`select * from metadata.active_objects ${cursor.sql}`, cursor.params)),
        cursor: {
          count,
          ...cursor,
          pages: Math.ceil(count / cursor.size),
          template: Object.keys(req.query)
            .filter((x) => x !== 'page')
            .map((x) => `${x}=${req.query[x]}`).join('&'),
        },
      });
  });
  app.post('/ui/favorites/:node', async (req, res) => {
    if (req.session.profile) {
      if (await isFavorite(pgpool, req.params.node, req.session.profile.user)) {
        await pgpool.query('delete from metadata.favorites where "user" = $1 and node = $2',
          [req.session.profile.user, req.params.node]);
      } else {
        await pgpool.query('insert into metadata.favorites ("user", node) values ($1, $2) on conflict do nothing;',
          [req.session.profile.user, req.params.node]);
      }
      res.redirect(req.get('referrer') || '/');
    } else {
      res.send('A favorite cannot be added, no users profile is available.');
    }
  });
  app.get('/oauth/callback', oauth.callback.bind(oauth.callback, pgpool));
  const { searchAPI, searchUI } = search(pgpool);
  // this is an API search not a UI search, TODO: add alternate auth instead of session?
  // it's primarily used by the type ahead to give optional results before the user
  // presses enter, however it could be useful to other systems wanting to query without
  // using the graphql.
  app.get('/search', searchAPI);
  // This is shown when the user presses enter on the search it optionally
  // has a node that can be specified which shows results related to the
  // node in question
  app.get('/ui/search', searchUI);

  await postgresqlDatabases(pgpool, bus, app);
  await postgresqlRoles(pgpool, bus, app);
  await postgresqlTables(pgpool, bus, app);
  await postgresqlColumns(pgpool, bus, app);
  await oracleDatabases(pgpool, bus, app);
  await oracleRoles(pgpool, bus, app);
  await oracleTables(pgpool, bus, app);
  await oracleColumns(pgpool, bus, app);
  await akkerisSites(pgpool, bus, app);
  await akkerisApps(pgpool, bus, app);
  await kubernetesDeployments(pgpool, bus, app);
  await kubernetesReplicasets(pgpool, bus, app);
  await kubernetesPods(pgpool, bus, app);
  await kubernetesConfigMaps(pgpool, bus, app);
  await urlsUrls(pgpool, bus, app);
  await urlsCertificates(pgpool, bus, app);
  debug('initialized');
}

async function run(/* pgpool, bus, app */) {
  // do nothing
}


module.exports = {
  run,
  init,
};
