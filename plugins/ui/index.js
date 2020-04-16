const express = require('express');
const oauth = require('./oauth');
const postgresqlDatabases = require('./postgresql.databases.js');
const akkerisSites = require('./akkeris.sites.js');
const kubernetesDeployments = require('./kubernetes.deployments.js');
const kubernetesReplicasets = require('./kubernetes.replicasets.js');
const kubernetesPods = require('./kubernetes.pods.js');
const kubernetesConfigMaps = require('./kubernetes.config_maps.js');
const { grab, cursors } = require('./common.js');

async function init(pgpool, bus, app) {
  if (process.env.UI) {
    app.get('/', (req, res) => res.redirect('/ui/'));
    app.use(express.static('./plugins/ui/public/'));
    app.all('/ui/*', oauth.check);
    app.get('/ui/', async (req, res, next) => {
      const cursor = await cursors(req);
      const { rows: [{ count }] } = await pgpool.query(`select count(*) as count from metadata.active_objects ${cursor.filter}`, cursor.params);
      grab('./views/index.html', req, res, next,
        {
          ...(await pgpool.query(`select * from metadata.active_objects ${cursor.sql}`, cursor.params)),
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
    app.get('/oauth/callback', oauth.callback);
    await postgresqlDatabases(pgpool, bus, app);
    await akkerisSites(pgpool, bus, app);
    await kubernetesDeployments(pgpool, bus, app);
    await kubernetesReplicasets(pgpool, bus, app);
    await kubernetesPods(pgpool, bus, app);
    await kubernetesConfigMaps(pgpool, bus, app);
  }
}

async function run(/* pgpool, bus, app */) {
  // do nothing
}


module.exports = {
  run,
  init,
};
