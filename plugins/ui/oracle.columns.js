const {
  grab, findUses, findUsedBy, findMetaData, isFavorite, findChanges,
  usersAndWatchers, addExpressAnnotationsAndLabelRoutes,
} = require('./common.js');

module.exports = async function addExpressRoutes(pgpool, bus, app) {
  app.param('oracle_column_id', async (req, res, next) => {
    const { rows: columns } = await pgpool.query('select * from oracle.columns where ("column"::varchar(128) = $1 or name::varchar(128) = $1)', [req.params.oracle_column_id]);
    if (columns.length !== 1) {
      delete req.params.oracle_column_id;
      res.sendStatus(404);
      return;
    }
    req.params.oracle_column = columns[0]; // eslint-disable-line prefer-destructuring
    req.params.oracle_column_id = columns[0].column;
    req.params.node = columns[0]; // eslint-disable-line prefer-destructuring
    req.params.node.node = req.params.node.column;
    req.params.node.node_log = req.params.node.column_log;
    next();
  });
  app.get('/ui/oracle/columns/:oracle_column_id', async (req, res, next) => {
    const { rows: columns } = await pgpool.query('select * from oracle.columns where column_log = $1', [req.params.node.node_log]);
    const { rows: constraints } = await pgpool.query('select * from oracle.constraints where from_column = $1 or to_column = $1', [req.params.node.node_log]);
    const { rows: [statistics] } = await pgpool.query('select * from oracle.column_statistics where column_log = $1', [req.params.node.node_log]);
    const { node } = req.params.node;
    const node_log = req.params.node.database_log; // eslint-disable-line camelcase
    const data = {
      node,
      node_log,
      ...req.params.oracle_column,
      columns,
      constraints,
      statistics,
      ...(await findMetaData(pgpool, node)),
      changes: (await findChanges(pgpool, node)),
      usedBy: await findUsedBy(pgpool, node_log),
      uses: await findUses(pgpool, node_log),
      users: await usersAndWatchers(pgpool, node),
      favorite: req.session.profile ? await isFavorite(pgpool, node, req.session.profile.user) : null, // eslint-disable-line max-len
    };

    grab('./views/oracle.columns.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'oracle/columns', 'oracle_column_id');
};
