const {
  grab, findUses, findUsedBy, findMetaData, isFavorite, findChanges,
  usersAndWatchers, addExpressAnnotationsAndLabelRoutes,
} = require('./common.js');

module.exports = async function addExpressRoutes(pgpool, bus, app) {
  app.param('oracle_database_id', async (req, res, next) => {
    const { rows: databases } = await pgpool.query('select * from oracle.databases where (database::varchar(128) = $1 or name::varchar(128) = $1)', [req.params.oracle_database_id]);
    if (databases.length !== 1) {
      delete req.params.oracle_database_id;
      res.sendStatus(404);
      return;
    }
    req.params.oracle_database = databases[0]; // eslint-disable-line prefer-destructuring
    req.params.oracle_database_id = databases[0].database;
    req.params.node = databases[0]; // eslint-disable-line prefer-destructuring
    req.params.node.node = req.params.node.database;
    req.params.node.node_log = req.params.node.database_log;
    next();
  });
  app.get('/ui/oracle/databases/:oracle_database_id', async (req, res, next) => {
    const { rows: roles } = await pgpool.query('select * from oracle.roles where database_log = $1', [req.params.node.node_log]);
    const { rows: tables } = await pgpool.query('select * from oracle.tables where database_log = $1', [req.params.node.node_log]);
    const { rows: columns } = await pgpool.query('select * from oracle.columns where database_log = $1', [req.params.node.node_log]);
    const { rows: indexes } = await pgpool.query('select * from oracle.indexes where database_log = $1', [req.params.node.node_log]);
    const { rows: constraints } = await pgpool.query('select * from oracle.constraints where database_log = $1', [req.params.node.node_log]);
    const { rows: databaseStatistics } = await pgpool.query('select * from oracle.database_statistics where database_log = $1', [req.params.node.node_log]);
    const { rows: tableStatistics } = await pgpool.query('select * from oracle.table_statistics where database_log = $1', [req.params.node.node_log]);
    const { node } = req.params.node;
    const node_log = req.params.node.database_log; // eslint-disable-line camelcase
    const data = {
      node,
      node_log,
      ...req.params.oracle_database,
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

    grab('./views/oracle.databases.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'oracle/databases', 'oracle_database_id');
};
