const { grab, addExpressAnnotationsAndLabelRoutes } = require('./common.js');

module.exports = async function addExpressRoutes(pgpool, bus, app) {
  app.param('oracle_table_id', async (req, res, next) => {
    const { rows: tables } = await pgpool.query('select * from oracle.tables where ("table"::varchar(128) = $1 or name::varchar(128) = $1)', [req.params.oracle_table_id]);
    if (tables.length !== 1) {
      delete req.params.oracle_table_id;
      res.sendStatus(404);
      return;
    }
    req.params.oracle_table = tables[0]; // eslint-disable-line prefer-destructuring
    req.params.oracle_table_id = tables[0].table;
    next();
  });
  app.get('/ui/oracle/tables/:oracle_table_id', async (req, res, next) => {
    const { rows: metadata } = await pgpool.query('select * from metadata.objects where node = $1', [req.params.oracle_table_id]);
    const { rows: tables } = await pgpool.query('select * from oracle.tables where "table" = $1', [req.params.oracle_table_id]);
    const { rows: columns } = await pgpool.query('select * from oracle.columns where "table" = $1', [req.params.oracle_table_id]);
    const { rows: indexes } = await pgpool.query('select * from oracle.indexes where "table" = $1', [req.params.oracle_table_id]);
    const { rows: constraints } = await pgpool.query('select * from oracle.constraints where from_table = $1 or to_table = $1', [req.params.oracle_table_id]);
    const { rows: tableStatistics } = await pgpool.query('select * from oracle.table_statistics where "table" = $1', [req.params.oracle_table_id]);
    const { rows: tableChanges } = await pgpool.query(`
      select
        'table' as "$icon",
        "table",
        database,
        catalog,
        schema,
        name,
        is_view,
        deleted,
        observed_on,
        row_number() over (partition by database, catalog, schema, name, is_view order by tables_log.observed_on asc) as rn
      from
        oracle.tables_log
      where
        "table" = $1
      order by
        observed_on desc
    `, [req.params.oracle_table_id]);

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
        oracle.columns_log join oracle.tables_log on columns_log.table = tables_log.table
      where
        columns_log.table = $1
      order by
        columns_log.observed_on desc
    `, [req.params.oracle_table_id]);

    const { rows: indexChanges } = await pgpool.query(`
      select
        'search' as "$icon",
        index,
        database,
        catalog,
        schema,
        "table",
        name,
        definition,
        observed_on,
        deleted,
        row_number() over (partition by database, catalog, schema, "table", name order by observed_on desc) as rn
      from
        oracle.indexes_log
      where
        "table" = $1
      order by
        observed_on desc
    `, [req.params.oracle_table_id]);

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
        oracle.constraints_log
      where
        from_table = $1 or to_table = $1 and
        check_clause not like '%IS NOT NULL%'
      order by
        observed_on desc
    `, [req.params.oracle_table_id]);

    const { rows: usedBy } = await pgpool.query(`
      select 
        child_icon as "$icon",
        child_type as "$type",
        child as id,
        child_name as name,
        parent as owner,
        parent_name as owner_name,
        parent_type as "$owner_type",
        parent_icon as "$owner_icon"
      from 
        metadata.find_node_relatives($1)
    `, [req.params.oracle_table_id]);

    let changes = columnChanges.map((x) => ({ ...x, $type: 'column' }))
      .concat(tableChanges.map((x) => ({ ...x, $type: 'table' })))
      .concat(constraintChanges.map((x) => ({ ...x, $type: 'constraint' })))
      .concat(indexChanges.map((x) => ({ ...x, $type: 'index' })))
      .sort((a, b) => (a.observed_on.getTime() < b.observed_on.getTime() ? 1 : -1))
      .map((x) => ({ ...x, name: `${x.schema}.${x.table_name ? `${x.table_name}.` : ''}${x.name}` }))
      .filter((x) => x.$type !== 'constraint');

    // TODO: Pagination
    changes = changes.slice(0, changes.length > 200 ? 200 : changes.length);

    const data = {
      ...req.params.oracle_table,
      ...metadata[0],
      tables,
      columns,
      indexes,
      constraints,
      tableStatistics,
      tableChanges,
      columnChanges,
      indexChanges,
      constraintChanges,
      changes,
      usedBy,
    };

    grab('./views/oracle.tables.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'oracle/tables', 'oracle_table_id');
};
