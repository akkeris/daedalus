const express = require('express');
const oauth = require('./oauth');
const pgdb = require('./postgresql.databases.js');
const { grab } = require('./common.js');

async function init(pgpool, bus, app) {
  if (process.env.UI) {
    app.get('/', (req, res) => res.redirect('/ui/'));
    app.use(express.static('./plugins/ui/public/'));
    app.all('/ui/*', oauth.check);
    app.get('/ui/', async (req, res, next) => grab('./views/index.html', req, res, next,
      await pgpool.query('select * from metadata.objects')));
    app.get('/oauth/callback', oauth.callback);
    await pgdb(pgpool, bus, app);
  }
}

async function run(/* pgpool, bus, app */) {
  // do nothing
}


module.exports = {
  run,
  init,
};
