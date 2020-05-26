const {
  grab, findUses, findUsedBy, findMetaData, isFavorite, findChanges,
  usersAndWatchers, addExpressAnnotationsAndLabelRoutes,
} = require('./common.js');

module.exports = async function addExpressRoutes(pgpool, bus, app) {
  app.param('postgresql_column_id', async (req, res, next) => {
    const { rows: columns } = await pgpool.query('select * from postgresql.columns where ("column"::varchar(128) = $1 or name::varchar(128) = $1)', [req.params.postgresql_column_id]);
    if (columns.length !== 1) {
      delete req.params.postgresql_column_id;
      res.sendStatus(404);
      return;
    }
    req.params.postgresql_column = columns[0]; // eslint-disable-line prefer-destructuring
    req.params.postgresql_column_id = columns[0].column;
    req.params.node = columns[0]; // eslint-disable-line prefer-destructuring
    req.params.node.node = req.params.node.column;
    req.params.node.node_log = req.params.node.column_log;
    next();
  });
  app.get('/ui/postgresql/columns/:postgresql_column_id', async (req, res, next) => {
    const { rows: columns } = await pgpool.query('select * from postgresql.columns where "column" = $1', [req.params.postgresql_column_id]);
    const { rows: constraints } = await pgpool.query('select * from postgresql.constraints where from_column = $1 or to_column = $1', [req.params.postgresql_column_id]);
    const { rows: [statistics] } = await pgpool.query(`
      select
        inherited,
        null_frac,
        avg_width,
        n_distinct,
        most_common_vals,
        most_common_freqs,
        histogram_bounds,
        correlation,
        most_common_elems,
        most_common_elem_freqs,
        elem_count_histogram
      from
        postgresql.column_statistics
      where
        column_log = $1
    `, [req.params.node.node_log]);
    const { node } = req.params.node;
    const { node_log } = req.params.node; // eslint-disable-line camelcase
    const data = {
      node,
      node_log,
      ...req.params.postgresql_column,
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

    grab('./views/postgresql.columns.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'postgresql/columns', 'postgresql_column_id');
};
