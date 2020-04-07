const express = require('express');
const oauth = require('./oauth');

async function grab(include, req, res, next, data) {
  require(include)(req, res, next, data); // eslint-disable-line global-require,import/no-dynamic-require,max-len
  if (process.env.UI_DROP_CACHE === 'true') {
    Object.keys(require.cache).forEach((x) => {
      if (x.endsWith(include.replace(/\.\//g, ''))) {
        delete require.cache[x];
      }
    });
  }
}

async function init(pgpool, bus, app) {
  if (process.env.UI) {
    app.get('/', (req, res) => res.redirect('/ui/'));
    app.use(express.static('./plugins/ui/public/'));
    app.all('/ui/*', oauth.check);
    app.get('/ui/', async (req, res, next) => grab('./views/index.html', req, res, next,
      await pgpool.query('select * from metadata.objects')));
    app.get('/ui/postgresql/databases/:id', async (req, res, next) => {
      const { rows: databases } = await pgpool.query('select * from postgresql.databases where database = $1', [req.params.id]);
      if (databases.length !== 1) {
        res.send(404);
        return;
      }
      const { rows: metadata } = await pgpool.query('select * from metadata.objects where id = $1', [req.params.id]);
      const { rows: roles } = await pgpool.query('select * from postgresql.roles where database = $1', [req.params.id]);
      const { rows: tables } = await pgpool.query('select * from postgresql.tables where database = $1', [req.params.id]);
      const { rows: columns } = await pgpool.query('select * from postgresql.columns where database = $1', [req.params.id]);
      const { rows: indexes } = await pgpool.query('select * from postgresql.indexes where database = $1', [req.params.id]);
      const { rows: constraints } = await pgpool.query('select * from postgresql.constraints where database = $1', [req.params.id]);
      const { rows: databaseStatistics } = await pgpool.query('select * from postgresql.database_statistics where database = $1', [req.params.id]);
      const { rows: tableStatistics } = await pgpool.query('select * from postgresql.table_statistics where database = $1', [req.params.id]);

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
      `, [req.params.id]);

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
      `, [req.params.id]);

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
      `, [req.params.id]);

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
      `, [req.params.id]);

      const { rows: usedBy } = await pgpool.query(`
        select
          'kubernetes.config_maps.svg' as "$icon",
          'kubernetes/config_maps' as "$type",
          kubernetes.config_maps.namespace || '.' || kubernetes.config_maps.name as name
        from 
          postgresql.roles 
          join links.from_kubernetes_config_maps_to_postgresql_roles on roles.role = from_kubernetes_config_maps_to_postgresql_roles.role
          join kubernetes.config_maps on from_kubernetes_config_maps_to_postgresql_roles.config_map = config_maps.config_map
        where
          roles.database = $1
        union
        select
          'kubernetes.deployments.svg' as "$icon",
          'kubernetes/deployments' as "$type",
          kubernetes.deployments.namespace || '.' || kubernetes.deployments.name as name
        from 
          postgresql.roles 
          join links.from_kubernetes_deployments_to_postgresql_roles on roles.role = from_kubernetes_deployments_to_postgresql_roles.role
          join kubernetes.deployments on from_kubernetes_deployments_to_postgresql_roles.deployment = deployments.deployment
        where
          roles.database = $1
        union
        select
          'kubernetes.pods.svg' as "$icon",
          'kubernetes/pods' as "$type",
          kubernetes.pods.namespace || '.' || kubernetes.pods.name as name
        from 
          postgresql.roles 
          join links.from_kubernetes_pods_to_postgresql_roles on roles.role = from_kubernetes_pods_to_postgresql_roles.role
          join kubernetes.pods on from_kubernetes_pods_to_postgresql_roles.pod = pods.pod
        where
          roles.database = $1
      `, [req.params.id]);

      let changes = columnChanges.map((x) => ({ ...x, $type: 'column' }))
        .concat(tableChanges.map((x) => ({ ...x, $type: 'table' })))
        .concat(constraintChanges.map((x) => ({ ...x, $type: 'constraint' })))
        .concat(indexChanges.map((x) => ({ ...x, $type: 'index' })))
        .sort((a, b) => (a.observed_on.getTime() < b.observed_on.getTime() ? 1 : -1));

      changes = changes.slice(0, changes.length > 200 ? 200 : changes.length);

      const data = {
        ...databases[0],
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
    app.get('/oauth/callback', oauth.callback);
  }
}

async function run(/* pgpool, bus, app */) {
  // do nothing
}


module.exports = {
  run,
  init,
};
