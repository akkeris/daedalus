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
    sql += ' where type=$1';
    filter += ' where type=$1';
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

module.exports = {
  grab,
  cursors,
  addExpressAnnotationsAndLabelRoutes,
};
