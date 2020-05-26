const {
  grab, findUses, findUsedBy, findMetaData, findChanges, isFavorite,
  usersAndWatchers, addExpressAnnotationsAndLabelRoutes,
} = require('./common.js');

module.exports = async function addExpressRoutes(pgpool, bus, app) {
  app.param('postgresql_database_id', async (req, res, next) => {
    const { rows: databases } = await pgpool.query('select * from postgresql.databases where (database::varchar(128) = $1 or name::varchar(128) = $1)', [req.params.postgresql_database_id]);
    if (databases.length !== 1) {
      delete req.params.postgresql_database_id;
      res.sendStatus(404);
      return;
    }
    req.params.postgresql_database = databases[0]; // eslint-disable-line prefer-destructuring
    req.params.postgresql_database_id = databases[0].database;
    req.params.node = databases[0]; // eslint-disable-line prefer-destructuring
    req.params.node.node = req.params.node.database;
    req.params.node.node_log = req.params.node.database_log;
    next();
  });
  app.get('/ui/postgresql/databases/:postgresql_database_id', async (req, res, next) => {
    const { rows: roles } = await pgpool.query('select * from postgresql.roles where database_log = $1', [req.params.node.database_log]);
    const { rows: tables } = await pgpool.query('select * from postgresql.tables where database_log = $1', [req.params.node.database_log]);
    const { rows: columns } = await pgpool.query('select * from postgresql.columns where database_log = $1', [req.params.node.database_log]);
    const { rows: indexes } = await pgpool.query('select * from postgresql.indexes where database_log = $1', [req.params.node.database_log]);
    const { rows: constraints } = await pgpool.query('select * from postgresql.constraints where database_log = $1', [req.params.node.database_log]);
    const { rows: databaseStatistics } = await pgpool.query('select * from postgresql.database_statistics where database_log = $1', [req.params.node.database_log]);
    const { rows: tableStatistics } = await pgpool.query('select * from postgresql.table_statistics where database_log = $1', [req.params.node.database_log]);
    const { node } = req.params.node;
    const node_log = req.params.node.database_log; // eslint-disable-line camelcase
    const data = {
      node,
      node_log,
      ...req.params.postgresql_database,
      tables,
      columns,
      indexes,
      constraints,
      databaseStatistics,
      tableStatistics,
      roles,
      ...(await findMetaData(pgpool, node)),
      changes: (await findChanges(pgpool, node)),
      usedBy: await findUsedBy(pgpool, node_log),
      uses: await findUses(pgpool, node_log),
      users: await usersAndWatchers(pgpool, node),
      favorite: req.session.profile ? await isFavorite(pgpool, node, req.session.profile.user) : null, // eslint-disable-line max-len
    };

    grab('./views/postgresql.databases.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'postgresql/databases', 'postgresql_database_id');
};
