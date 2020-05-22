const { grab, cursors } = require('./common.js');

async function changes(pgpool, bus, app) {
  app.get('/ui/changes', async (req, res, next) => {
    const cursor = await cursors(req);
    const { rows: [{ count }] } = await pgpool.query(`select count(*) as count from metadata.change_log_cache ${cursor.filter}`, cursor.params);
    grab('./views/changes.html', req, res, next, {
      ...await pgpool.query(`select * from metadata.change_log_cache ${cursor.sql}`, cursor.params),
      cursor: {
        count,
        ...cursor,
        pages: Math.ceil(count / cursor.size),
        template: Object.keys(req.query)
          .filter((x) => x !== 'page')
          .map((x) => `${x}=${req.query[x]}`).join('&'),
      },
    });
  });
}

module.exports = changes;
