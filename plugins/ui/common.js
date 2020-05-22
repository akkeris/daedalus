const diff = require('diff');

async function grab(include, req, res, next, data) {
  try {
    require(include)(req, res, next, data); // eslint-disable-line global-require,import/no-dynamic-require,max-len
  } catch (e) {
    console.error(e); // eslint-disable-line no-console
    res.sendStatus(500);
  } finally {
    if (process.env.UI_DROP_CACHE === 'true') {
      Object.keys(require.cache).forEach((x) => {
        if (x.endsWith('.html')) {
          delete require.cache[x];
        }
      });
    }
  }
}

async function cursors(req) {
  let sql = '';
  let filter = '';
  const params = [];
  if (req.query.type) {
    sql += ' where type like $1';
    filter += ' where type like $1';
    params.push(req.query.type);
  }
  if (req.query.labels) {
    if (/(^[A-Za-z0-9]+$)/.test(req.query.labels)) {
      sql += `${params.length === 0 ? ' where' : ' and'} labels->>'${req.query.labels}' is not null`;
      filter += `${params.length === 0 ? ' where' : ' and'} labels->>'${req.query.labels}' is not null`;
    }
  }
  if (req.query.sort === 'name'
      || req.query.sort === 'type'
      || req.query.sort === 'observed_on'
      || req.query.sort === 'labels') {
    sql += ` order by ${req.query.sort}`;
  } else {
    sql += ' order by observed_on desc';
  }
  let size = req.query.size ? parseInt(req.query.size, 10) : 20;
  if (size > 200) {
    size = 200;
  } else if (size < 1) {
    size = 1;
  }
  sql += ` limit ${size}`;
  let page = req.query.page ? parseInt(req.query.page, 10) : 0;
  if (page > 1000000) {
    page = 1000000;
  } else if (page < 1) {
    page = 1;
  }
  sql += ` offset ${(page - 1) * size}`;

  return {
    sql,
    params,
    page,
    size,
    filter,
  };
}

function diffJSON(o, n) {
  if (typeof o === 'string') {
    return diff.diffLines(o, n);
  }
  return diff.diffJson(o, n);
}

async function addExpressAnnotationsAndLabelRoutes(pgpool, app, typeName, param) {
  const { rows: [{ type }] } = await pgpool.query(`select type from metadata.node_types where name='${typeName}'`);
  app.post(`/ui/${typeName}/:${param}/labels`, async (req, res) => {
    try {
      await pgpool.query(`
        insert into metadata.labels (label, name, value, implicit, node, type) 
        values (uuid_generate_v4(), $1, $2, false, $3, $4) 
        on conflict (node, type, name, value, implicit) 
        do update set value = $2`,
      [req.body.name, req.body.value, req.params[param], type]);
      res.redirect(`/ui/${typeName}/${req.params[param]}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/${typeName}/${req.params[param]}?error=${e.message}#metadata`);
    }
  });
  app.post(`/ui/${typeName}/:${param}/annotations`, async (req, res) => {
    try {
      await pgpool.query(`
        insert into metadata.annotations (annotation, name, value, implicit, node, type) 
        values (uuid_generate_v4(), $1, $2, false, $3, $4) 
        on conflict (node, type, name, implicit)
        do update set value = $2`,
      [req.body.name, req.body.value, req.params[param], type]);
      res.redirect(`/ui/${typeName}/${req.params[param]}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/${typeName}/${req.params[param]}?error=${e.message}#metadata`);
    }
  });
  app.get(`/ui/${typeName}/:${param}/labels/:label/delete`, async (req, res) => {
    try {
      await pgpool.query('delete from metadata.labels where node = $1 and name = $2 and type = $3',
        [req.params[param], req.params.label, type]);
      res.redirect(`/ui/${typeName}/${req.params[param]}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/${typeName}/${req.params.postgresql_role_id}?error=${e.message}#metadata`);
    }
  });
  app.get(`/ui/${typeName}/:${param}/annotations/:annotation/delete`, async (req, res) => {
    try {
      await pgpool.query('delete from metadata.annotations where node = $1 and name = $2 and type = $3',
        [req.params[param], req.params.annotation, type]);
      res.redirect(`/ui/${typeName}/${req.params[param]}#metadata`);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      res.redirect(`/ui/${typeName}/${req.params[param]}?error=${e.message}#metadata`);
    }
  });
}

async function isFavorite(pgpool, node, user) {
  const { rows: [{ amount }] } = await pgpool.query('select count(*) as amount from metadata.favorites where node = $1 and "user" = $2',
    [node, user]);
  return amount > 0;
}

async function getFavorites(pgpool, user) {
  const { rows: favorites } = await pgpool.query(`
    select 
      favorites.node,
      nodes_cache.*,
      node_types.name as node_type
    from 
      metadata.favorites 
      join metadata.nodes_cache on favorites.node = nodes_cache.node
      join metadata.node_types on nodes_cache.type = node_types.type
    where favorites.user = $1
  `,
  [user]);
  return favorites;
}

async function usersAndWatchers(pgpool, node) {
  const { rows: users } = await pgpool.query(`
    select
      users.user,
      users.name,
      users.email,
      users.photo_url,
      users.profile_url
    from 
      metadata.favorites
      join metadata.users on favorites.user = users.user
    where
      favorites.node = $1
  `, [node]);
  return users;
}

async function findMetaData(pgpool, node) {
  const { rows: metadata } = await pgpool.query(
    'select * from metadata.objects where node = $1',
    [node],
  );
  return metadata[0];
}

async function findUsedBy(pgpool, node_log) { // eslint-disable-line camelcase
  const { rows: usedBy } = await pgpool.query(`
      select 
        a.child_icon as "$icon",
        a.child_type as "$type",
        a.child as node_log,
        b.node,
        c.node as parent_node,
        a.child_name as name,
        a.parent as owner,
        a.parent_name as owner_name,
        a.parent_type as "$owner_type",
        a.parent_icon as "$owner_icon"
      from 
        metadata.find_ancestors_graph($1) a
        join metadata.nodes_log_cache b on a.child = b.node_log
        join metadata.nodes_log_cache c on a.parent = c.node_log
    `, [node_log]); // eslint-disable-line camelcase
  return usedBy;
}

async function findUses(pgpool, node_log) { // eslint-disable-line camelcase
  let uses = [];
  let depth = 5;
  do {
    uses = (await pgpool.query('select a.*, b.node from metadata.find_descendants_with_depth($1, $2) a join metadata.nodes_log_cache b on a.node_log = b.node_log', // eslint-disable-line no-await-in-loop
      [node_log, depth--])).rows; // eslint-disable-line no-plusplus,camelcase
  } while (uses.length > 500 && depth !== -1);
  return uses;
}

async function findChanges(pgpool, node) {
  return (await pgpool.query(`
    select
      change_log_cache.*,
      node_types.name as type_name,
      node_types.fa_icon,
      node_types.icon,
      node_types.human_name as
      type_human_name
    from 
      metadata.change_log_cache 
        join metadata.node_types on change_log_cache.type = node_types.type
    where
      change_log_cache.node = $1`, [node])).rows;
}

async function findNodeFields(pgpool, node_log) { // eslint-disable-line camelcase
  return (await pgpool.query(`
    select
      jsonb_path_query(nodes.definition, node_types_fields.jsonpath::jsonpath) as value,
      node_types_fields.name,
      node_types_fields.friendly_name,
      node_types_fields.highlighted,
      node_types_fields.format
    from
      metadata.nodes
      join metadata.node_types on nodes.type = node_types.type
      join metadata.node_types_fields on node_types_fields.type = metadata.node_types.type
    where
      nodes.node_log = $1
    `, [node_log])).rows; // eslint-disable-line camelcase
}

module.exports = {
  grab,
  cursors,
  addExpressAnnotationsAndLabelRoutes,
  diffJSON,
  findUses,
  findUsedBy,
  findMetaData,
  findChanges,
  findNodeFields,
  getFavorites,
  isFavorite,
  usersAndWatchers,
};
