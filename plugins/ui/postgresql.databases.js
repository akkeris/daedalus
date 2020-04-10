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
    const { rows: metadata } = await pgpool.query('select * from metadata.objects where id = $1', [req.params.postgresql_database_id]);
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
      with cte_config_maps as (
        select
          'kubernetes.config_maps.svg' as "$icon",
          'kubernetes/config_maps' as "$type",
          kubernetes.config_maps.config_map as id,
          kubernetes.config_maps.namespace || '/' || kubernetes.config_maps.name as name,
          null::uuid as owner,
          null::text as owner_name,
          null as "$owner_type"
        from 
          postgresql.roles 
          join links.from_kubernetes_config_maps_to_postgresql_roles
            on roles.role = from_kubernetes_config_maps_to_postgresql_roles.role
          join kubernetes.config_maps
            on from_kubernetes_config_maps_to_postgresql_roles.config_map = config_maps.config_map
        where
          roles.database = $1
      ), cte_deployments as (
        select
          'kubernetes.deployments.svg' as "$icon",
          'kubernetes/deployments' as "$type",
          kubernetes.deployments.deployment as id,
          kubernetes.deployments.namespace || '/' || kubernetes.deployments.name as name,
          akkeris.apps.app_log as owner,
          akkeris.apps.name as owner_name,
          (case when akkeris.apps.app_log is not null then 'akkeris/apps' else null end) as "$owner_type"
        from 
          postgresql.roles 
          join links.from_kubernetes_deployments_to_postgresql_roles
            on roles.role = from_kubernetes_deployments_to_postgresql_roles.role
          join kubernetes.deployments
            on from_kubernetes_deployments_to_postgresql_roles.deployment = deployments.deployment
          left join links.from_kubernetes_deployments_to_akkeris_apps
            on from_kubernetes_deployments_to_akkeris_apps.deployment = from_kubernetes_deployments_to_postgresql_roles.deployment
          left join akkeris.apps
            on from_kubernetes_deployments_to_akkeris_apps.app_log = akkeris.apps.app_log
        where
          roles.database = $1
      ), cte_deployments_from_config_maps as (
        select
          'kubernetes.deployments.svg' as "$icon",
          'kubernetes/deployments' as "$type",
          kubernetes.deployments.deployment as id,
          kubernetes.deployments.namespace || '/' || kubernetes.deployments.name as name,
          from_kubernetes_config_maps_to_postgresql_roles.config_map as owner,
          kubernetes.config_maps.name as owner_name,
          'kubernetes/config_maps' as "$owner_type"
        from 
          postgresql.roles 
          join links.from_kubernetes_config_maps_to_postgresql_roles 
            on roles.role = from_kubernetes_config_maps_to_postgresql_roles.role
          join links.from_kubernetes_deployments_to_kubernetes_config_maps 
            on from_kubernetes_deployments_to_kubernetes_config_maps.config_map = from_kubernetes_config_maps_to_postgresql_roles.config_map
          join kubernetes.deployments 
            on from_kubernetes_deployments_to_kubernetes_config_maps.deployment = deployments.deployment
          join kubernetes.config_maps
            on from_kubernetes_deployments_to_kubernetes_config_maps.config_map = config_maps.config_map
        where
          roles.database = $1
      ), cte_pods as (
        select
          'kubernetes.pods.svg' as "$icon",
          'kubernetes/pods' as "$type",
          kubernetes.pods.pod as id,
          kubernetes.pods.namespace || '/' || kubernetes.pods.name as name,
          from_kubernetes_pods_to_kubernetes_replicasets.replicaset as owner,
          kubernetes.replicasets.name as owner_name,
          'kubernetes/replicasets' as "$owner_type"
        from 
          postgresql.roles 
          join links.from_kubernetes_pods_to_postgresql_roles
            on roles.role = from_kubernetes_pods_to_postgresql_roles.role
          join kubernetes.pods
            on from_kubernetes_pods_to_postgresql_roles.pod = pods.pod
          join links.from_kubernetes_pods_to_kubernetes_replicasets
            on from_kubernetes_pods_to_kubernetes_replicasets.pod = pods.pod
          join kubernetes.replicasets
            on from_kubernetes_pods_to_kubernetes_replicasets.replicaset = replicasets.replicaset
        where
          roles.database = $1
      ), cte_replicasets as (
        select
          'kubernetes.replicasets.svg' as "$icon",
          'kubernetes/replicasets' as "$type",
          kubernetes.replicasets.replicaset as id,
          kubernetes.replicasets.namespace || '/' || kubernetes.replicasets.name as name,
          from_kubernetes_replicasets_to_kubernetes_deployments.deployment as owner,
          kubernetes.deployments.name as owner_name,
          'kubernetes/deployments' as "$owner_type"
        from 
          postgresql.roles 
          join links.from_kubernetes_replicasets_to_postgresql_roles
            on roles.role = from_kubernetes_replicasets_to_postgresql_roles.role
          join kubernetes.replicasets
            on from_kubernetes_replicasets_to_postgresql_roles.replicaset = replicasets.replicaset
          join links.from_kubernetes_replicasets_to_kubernetes_deployments
            on from_kubernetes_replicasets_to_kubernetes_deployments.replicaset = replicasets.replicaset
          join kubernetes.deployments
            on from_kubernetes_replicasets_to_kubernetes_deployments.deployment = deployments.deployment
          join links.from_kubernetes_pods_to_kubernetes_replicasets
            on from_kubernetes_pods_to_kubernetes_replicasets.replicaset = from_kubernetes_replicasets_to_kubernetes_deployments.replicaset
            --  ^ prevents replicasets without pods from showing up and cluttering ui.
        where
          roles.database = $1
      ), cte_akkeris_apps as (
        select
          'akkeris.apps.svg' as "$icon",
          'akkeris/apps' as "$type",
          akkeris.apps.app_log as id,
          akkeris.apps.name as name,
          null::uuid as owner,
          null::text as owner_name,
          null::text as "$owner_type"
        from
          postgresql.roles 
          join links.from_kubernetes_deployments_to_postgresql_roles
            on roles.role = from_kubernetes_deployments_to_postgresql_roles.role
          join links.from_kubernetes_deployments_to_akkeris_apps
            on from_kubernetes_deployments_to_akkeris_apps.deployment = from_kubernetes_deployments_to_postgresql_roles.deployment
          join akkeris.apps
            on from_kubernetes_deployments_to_akkeris_apps.app_log = akkeris.apps.app_log
        where
          roles.database = $1
      ), cte_akkeris_sites as (
        select
          'akkeris.sites.svg' as "$icon",
          'akkeris/sites' as "$type",
          from_akkeris_apps_to_akkeris_sites.site_log as id,
          'https://' || from_akkeris_apps_to_akkeris_sites.site_name || from_akkeris_apps_to_akkeris_sites.source_path as name,
          from_akkeris_apps_to_akkeris_sites.app_log as owner,
          from_akkeris_apps_to_akkeris_sites.app_name as owner_name,
          'akkeris/apps' as "$owner_type"
        from
          postgresql.roles 
          join links.from_kubernetes_deployments_to_postgresql_roles
            on roles.role = from_kubernetes_deployments_to_postgresql_roles.role
          join links.from_kubernetes_deployments_to_akkeris_apps
            on from_kubernetes_deployments_to_akkeris_apps.deployment = from_kubernetes_deployments_to_postgresql_roles.deployment
          join links.from_akkeris_apps_to_akkeris_sites
            on from_kubernetes_deployments_to_akkeris_apps.app_log = from_akkeris_apps_to_akkeris_sites.app_log
        where
          roles.database = $1
      )
      select * from cte_config_maps
      union
      select * from cte_deployments_from_config_maps
      union
      select * from cte_deployments
      union
      select * from cte_replicasets
      union
      select * from cte_pods
      union
      select * from cte_akkeris_apps
      union
      select * from cte_akkeris_sites
    `, [req.params.postgresql_database_id]);

    let changes = columnChanges.map((x) => ({ ...x, $type: 'column' }))
      .concat(tableChanges.map((x) => ({ ...x, $type: 'table' })))
      .concat(constraintChanges.map((x) => ({ ...x, $type: 'constraint' })))
      .concat(indexChanges.map((x) => ({ ...x, $type: 'index' })))
      .sort((a, b) => (a.observed_on.getTime() < b.observed_on.getTime() ? 1 : -1));

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
      await pgpool.query(`
        insert into metadata.labels_on_postgresql_databases (label, name, value, implicit, database) 
        values (uuid_generate_v4(), $1, $2, false, $3) 
        on conflict (name, value, implicit, database) 
        do update set value = $2`,
      [req.body.name, req.body.value, req.params.postgresql_database_id]);
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}?error=${e.message}#metadata`);
    }
  });
  app.post('/ui/postgresql/databases/:postgresql_database_id/annotations', async (req, res) => {
    try {
      await pgpool.query(`
        insert into metadata.annotations_on_postgresql_databases (annotation, name, value, implicit, database) 
        values (uuid_generate_v4(), $1, $2, false, $3) 
        on conflict (name, implicit, database) 
        do update set value = $2`,
      [req.body.name, req.body.value, req.params.postgresql_database_id]);
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}?error=${e.message}#metadata`);
    }
  });
  app.get('/ui/postgresql/databases/:postgresql_database_id/labels/:label/delete', async (req, res) => {
    try {
      await pgpool.query('delete from metadata.labels_on_postgresql_databases where database = $1 and name = $2',
        [req.params.postgresql_database_id, req.params.label]);
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}?error=${e.message}#metadata`);
    }
  });
  app.get('/ui/postgresql/databases/:postgresql_database_id/annotations/:annotation/delete', async (req, res) => {
    try {
      await pgpool.query('delete from metadata.annotations_on_postgresql_databases where database = $1 and name = $2',
        [req.params.postgresql_database_id, req.params.annotation]);
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/postgresql/databases/${req.params.postgresql_database_id}?error=${e.message}#metadata`);
    }
  });
};
