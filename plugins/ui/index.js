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
const search = require('./search.js');
const changes = require('./changes.js');
const {
  cursors, grab, findUses, findUsedBy, findMetaData, findChanges, findNodeFields, isFavorite,
  usersAndWatchers, addExpressAnnotationsAndLabelRoutes, getFavorites,
} = require('./common.js');

async function init(pgpool, bus, app) {
  if (process.env.UI !== 'true') {
    return;
  }
  app.get('/', (req, res) => res.redirect('/ui/'));
  app.use(express.static('./plugins/ui/public/'));
  app.all('/ui/*', oauth.check);
  app.get(['/ui/', '/ui/index.html'], async (req, res, next) => {
    grab('./views/index.html', req, res, next, {
      labels: (await pgpool.query('select name from metadata.labels where name != \'name\' group by name order by count(*) desc')).rows,
      favorites: req.session.profile ? (await getFavorites(pgpool, req.session.profile.user)) : [],
    });
  });
  app.get(['/ui/browse/', '/ui/browse.html'], async (req, res, next) => {
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
  app.param('node', async (req, res, next) => {
    const { rows: nodes } = await pgpool.query('select nodes_cache.*, node_types.name as type_name, node_types.fa_icon, node_types.icon, node_types.human_name as type_human_name from metadata.nodes_cache join metadata.node_types on nodes_cache.type = node_types.type where nodes_cache.node = $1', [req.params.node]);
    if (nodes.length !== 1) {
      delete req.params.node;
      res.sendStatus(404);
      return;
    }
    const { node, node_log } = nodes[0]; // eslint-disable-line camelcase
    req.params.node = {
      ...(nodes[0]),
      ...(await findMetaData(pgpool, node)),
      changes: (await findChanges(pgpool, node)),
      usedBy: await findUsedBy(pgpool, node_log),
      uses: await findUses(pgpool, node_log),
      users: await usersAndWatchers(pgpool, node),
      fields: await findNodeFields(pgpool, node_log),
      favorite: req.session.profile ? await isFavorite(pgpool, node, req.session.profile.user) : null, // eslint-disable-line max-len
    };
    next();
  });
  app.param('node_log', async (req, res, next) => {
    const { rows: nodes } = await pgpool.query('select nodes_log_cache.*, node_types.name as type_name, node_types.fa_icon, node_types.icon, node_types.human_name as type_human_name from metadata.nodes_log_cache join metadata.node_types on nodes_log_cache.type = node_types.type where nodes_log_cache.node_log = $1', [req.params.node_log]);
    if (nodes.length !== 1) {
      delete req.params.node_log;
      res.sendStatus(404);
      return;
    }
    const { node, node_log } = nodes[0]; // eslint-disable-line camelcase
    req.params.node = {
      ...(nodes[0]),
      ...(await findMetaData(pgpool, node)),
      changes: (await findChanges(pgpool, node)),
      usedBy: await findUsedBy(pgpool, node_log),
      uses: await findUses(pgpool, node_log),
      users: await usersAndWatchers(pgpool, node),
      fields: await findNodeFields(pgpool, node_log),
      favorite: req.session.profile ? await isFavorite(pgpool, node, req.session.profile.user) : null, // eslint-disable-line max-len
    };
    next();
  });
  app.post('/ui/favorites/:node', async (req, res) => {
    if (req.session.profile) {
      if (await isFavorite(pgpool, req.params.node.node, req.session.profile.user)) {
        await pgpool.query('delete from metadata.favorites where "user" = $1 and node = $2',
          [req.session.profile.user, req.params.node.node]);
      } else {
        await pgpool.query('insert into metadata.favorites ("user", node) values ($1, $2) on conflict do nothing;',
          [req.session.profile.user, req.params.node.node]);
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
  app.get(['/ui/search/', '/ui/search.html'], searchUI);

  await postgresqlDatabases(pgpool, bus, app);
  await postgresqlRoles(pgpool, bus, app);
  await postgresqlTables(pgpool, bus, app);
  await postgresqlColumns(pgpool, bus, app);
  await oracleDatabases(pgpool, bus, app);
  await oracleRoles(pgpool, bus, app);
  await oracleTables(pgpool, bus, app);
  await oracleColumns(pgpool, bus, app);

  // Automatically manage aws, akkeris and kubernetes node pages.
  setTimeout(async () => {
    (await pgpool.query('select * from metadata.node_types where name like \'aws/%\' or name like \'kubernetes/%\' or name like \'akkeris/%\' or name like \'urls/%\''))
      .rows
      .forEach((type) => {
        addExpressAnnotationsAndLabelRoutes(pgpool, app, type.name, 'id');
        app.get(`/ui/${type.name}/:node`, async (req, res, next) => grab('./views/generic.node.html', req, res, next, type));
      });
  }, 1000);
  await changes(pgpool, bus, app);
  debug('initialized');
}

async function run(/* pgpool, bus, app */) {
  // do nothing
}


module.exports = {
  run,
  init,
};
