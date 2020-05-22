const {
  grab, findUses, findUsedBy, findMetaData, findChanges, isFavorite,
  usersAndWatchers, addExpressAnnotationsAndLabelRoutes,
} = require('./common.js');

module.exports = async function addExpressRoutes(pgpool, bus, app) {
  app.param('postgresql_table_id', async (req, res, next) => {
    const { rows: tables } = await pgpool.query('select * from postgresql.tables where ("table"::varchar(128) = $1 or name::varchar(128) = $1)', [req.params.postgresql_table_id]);
    if (tables.length !== 1) {
      delete req.params.postgresql_table_id;
      res.sendStatus(404);
      return;
    }
    req.params.postgresql_table = tables[0]; // eslint-disable-line prefer-destructuring
    req.params.postgresql_table_id = tables[0].table;
    req.params.node = tables[0]; // eslint-disable-line prefer-destructuring
    req.params.node.node = tables[0].table;
    req.params.node.node_log = tables[0].table_log;
    next();
  });
  app.get('/ui/postgresql/tables/:postgresql_table_id', async (req, res, next) => {
    const { rows: tables } = await pgpool.query('select * from postgresql.tables where table_log = $1', [req.params.node.table_log]);
    const { rows: columns } = await pgpool.query('select * from postgresql.columns where table_log = $1', [req.params.node.table_log]);
    const { rows: indexes } = await pgpool.query('select * from postgresql.indexes where table_log = $1', [req.params.node.table_log]);
    const { rows: constraints } = await pgpool.query('select * from postgresql.constraints where from_table = $1 or to_table = $1', [req.params.node.table_log]);
    const { rows: tableStatistics } = await pgpool.query('select * from postgresql.table_statistics where table_log = $1', [req.params.node.table_log]);
    const { node } = req.params.node;
    const { node_log } = req.params.node; // eslint-disable-line camelcase
    const data = {
      node,
      node_log,
      ...req.params.postgresql_table,
      tables,
      columns,
      indexes,
      constraints,
      tableStatistics,
      ...(await findMetaData(pgpool, node)),
      changes: (await findChanges(pgpool, node)),
      usedBy: await findUsedBy(pgpool, node_log),
      uses: await findUses(pgpool, node_log),
      users: await usersAndWatchers(pgpool, node),
      favorite: req.session.profile ? await isFavorite(pgpool, node, req.session.profile.user) : null, // eslint-disable-line max-len
    };

    grab('./views/postgresql.tables.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'postgresql/tables', 'postgresql_table_id');
};
