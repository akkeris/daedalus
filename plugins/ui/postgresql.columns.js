const {
  grab, findUses, findUsedBy, findMetaData, isFavorite,
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
    req.params.node = columns[0].column;
    next();
  });
  app.get('/ui/postgresql/columns/:postgresql_column_id', async (req, res, next) => {
    const { rows: columns } = await pgpool.query('select * from postgresql.columns where "column" = $1', [req.params.postgresql_column_id]);
    const { rows: constraints } = await pgpool.query('select * from postgresql.constraints where from_column = $1 or to_column = $1', [req.params.postgresql_column_id]);
    const { rows: columnChanges } = await pgpool.query(`
      select
        'columns' as "$icon",
        columns_log."column",
        columns_log."table",
        tables_log.name as table_name,
        columns_log."schema",
        columns_log."catalog",
        columns_log.name,
        columns_log.position,
        columns_log."default",
        columns_log.is_nullable,
        columns_log.data_type,
        columns_log.character_maximum_length,
        columns_log.character_octet_length,
        columns_log.numeric_precision,
        columns_log.numeric_precision_radix,
        columns_log.numeric_scale,
        columns_log.datetime_precision,
        columns_log.is_updatable,
        columns_log.observed_on,
        columns_log.deleted,
        row_number() over (partition by columns_log.database, columns_log.catalog, columns_log.schema, columns_log.table, columns_log.name order by columns_log.observed_on desc) as rn
      from
        postgresql.columns_log join postgresql.tables_log on columns_log.table = tables_log.table
      where
        columns_log.column = $1
      order by
        columns_log.observed_on desc
    `, [req.params.postgresql_column_id]);

    const { rows: constraintChanges } = await pgpool.query(`
      select
        'check' as "$icon",
        database,
        from_schema as schema,
        name,
        type,
        from_catalog,
        from_schema,
        from_table,
        from_column,
        to_catalog,
        to_schema,
        to_table,
        to_column,
        check_clause,
        observed_on,
        deleted,
        row_number() over (partition by database, from_catalog, from_schema, from_table, name order by observed_on desc) as rn
      from
        postgresql.constraints_log
      where
        from_column = $1 or to_column = $1 and
        check_clause not like '%IS NOT NULL%'
      order by
        observed_on desc
    `, [req.params.postgresql_column_id]);

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
        "column" = $1
    `, [req.params.postgresql_column_id]);

    let changes = columnChanges.map((x) => ({ ...x, $type: 'column' }))
      .concat(constraintChanges.map((x) => ({ ...x, $type: 'constraint' })))
      .sort((a, b) => (a.observed_on.getTime() < b.observed_on.getTime() ? 1 : -1))
      .map((x) => ({ ...x, name: `${x.schema}.${x.table_name ? `${x.table_name}.` : ''}${x.name}` }));

    // TODO: Pagination
    changes = changes.slice(0, changes.length > 200 ? 200 : changes.length);

    const data = {
      ...req.params.postgresql_column,
      ...(await findMetaData(pgpool, req.params.postgresql_column_id)),
      columns,
      constraints,
      columnChanges,
      constraintChanges,
      changes,
      usedBy: await findUsedBy(pgpool, req.params.postgresql_column_id),
      uses: await findUses(pgpool, req.params.postgresql_column_id),
      users: await usersAndWatchers(pgpool, req.params.postgresql_column_id),
      statistics,
      favorite: req.session.profile ? await isFavorite(pgpool, req.params.node, req.session.profile.user) : null, // eslint-disable-line max-len
    };

    grab('./views/postgresql.columns.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'postgresql/columns', 'postgresql_column_id');
};
