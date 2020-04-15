const { grab } = require('./common.js');

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
    next();
  });
  app.get('/ui/postgresql/databases/:postgresql_database_id', async (req, res, next) => {
    const { rows: metadata } = await pgpool.query('select * from metadata.objects where node = $1', [req.params.postgresql_database_id]);
    const { rows: roles } = await pgpool.query('select * from postgresql.roles where database = $1', [req.params.postgresql_database_id]);
    const { rows: tables } = await pgpool.query('select * from postgresql.tables where database = $1', [req.params.postgresql_database_id]);
    const { rows: columns } = await pgpool.query('select * from postgresql.columns where database = $1', [req.params.postgresql_database_id]);
    const { rows: indexes } = await pgpool.query('select * from postgresql.indexes where database = $1', [req.params.postgresql_database_id]);
    const { rows: constraints } = await pgpool.query('select * from postgresql.constraints where database = $1', [req.params.postgresql_database_id]);
    const { rows: databaseStatistics } = await pgpool.query('select * from postgresql.database_statistics where database = $1', [req.params.postgresql_database_id]);
    const { rows: tableStatistics } = await pgpool.query('select * from postgresql.table_statistics where database = $1', [req.params.postgresql_database_id]);
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
        postgresql.tables_log
      where
        database = $1
      order by
        observed_on desc
    `, [req.params.postgresql_database_id]);

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
        columns_log.database = $1
      order by
        columns_log.observed_on desc
    `, [req.params.postgresql_database_id]);

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
        postgresql.indexes_log
      where
        database = $1
      order by
        observed_on desc
    `, [req.params.postgresql_database_id]);

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
        database = $1 and
        check_clause not like '%IS NOT NULL%'
      order by
        observed_on desc
    `, [req.params.postgresql_database_id]);

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
    `, [req.params.postgresql_database_id]);

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
      ...req.params.postgresql_database,
      ...metadata[0],
      tables,
      columns,
      indexes,
      constraints,
      databaseStatistics,
      tableStatistics,
      tableChanges,
      columnChanges,
      indexChanges,
      constraintChanges,
      changes,
      roles,
      usedBy,
    };

    grab('./views/postgresql.databases.html', req, res, next, data);
  });
  app.post('/ui/postgresql/databases/:postgresql_database_id/labels', async (req, res) => {
    try {
      const { rows: [{ type }] } = await pgpool.query('select type from metadata.node_types where name=\'postgresql/databases\'');
      await pgpool.query(`
        insert into metadata.labels (label, name, value, implicit, node, type) 
        values (uuid_generate_v4(), $1, $2, false, $3, $4) 
        on conflict (node, type, name, value, implicit) 
        do update set value = $2`,
      [req.body.name, req.body.value, req.params.postgresql_database_id, type]);
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}?error=${e.message}#metadata`);
    }
  });
  app.post('/ui/postgresql/databases/:postgresql_database_id/annotations', async (req, res) => {
    try {
      const { rows: [{ type }] } = await pgpool.query('select type from metadata.node_types where name=\'postgresql/databases\'');
      await pgpool.query(`
        insert into metadata.annotations (annotation, name, value, implicit, node, type) 
        values (uuid_generate_v4(), $1, $2, false, $3, $4) 
        on conflict (node, type, name, implicit)
        do update set value = $2`,
      [req.body.name, req.body.value, req.params.postgresql_database_id, type]);
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}?error=${e.message}#metadata`);
    }
  });
  app.get('/ui/postgresql/databases/:postgresql_database_id/labels/:label/delete', async (req, res) => {
    try {
      const { rows: [{ type }] } = await pgpool.query('select type from metadata.node_types where name=\'postgresql/databases\'');
      await pgpool.query('delete from metadata.labels where node = $1 and name = $2 and type = $3',
        [req.params.postgresql_database_id, req.params.label, type]);
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}?error=${e.message}#metadata`);
    }
  });
  app.get('/ui/postgresql/databases/:postgresql_database_id/annotations/:annotation/delete', async (req, res) => {
    try {
      const { rows: [{ type }] } = await pgpool.query('select type from metadata.node_types where name=\'postgresql/databases\'');
      await pgpool.query('delete from metadata.annotations where node = $1 and name = $2 and type = $3',
        [req.params.postgresql_database_id, req.params.annotation, type]);
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}?error=${e.message}#metadata`);
    }
  });
};
