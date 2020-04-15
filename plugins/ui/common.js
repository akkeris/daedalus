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

module.exports = {
  grab,
  cursors,
};
