const debug = require('debug')('daedalus:links');
const fs = require('fs');
const kp = require('./kubernetes-postgresql.js');

async function run(pgpool, bus) {
  await pgpool.query(fs.readFileSync('./plugins/links/create.sql').toString());
  await kp.run(pgpool, bus);
}

// todo: deployments -> pods,
// todo: deployments -> configmaps
// todo: pods -> configmaps,
// todo: akkeris apps -> deployments
// todo: akkeris apps -> postgresql roles
// todo: akkeris sites -> apps -> deployments -> postgresql roles
// todo: akkeris apps -> akkeris apps (based on configuration)
// todo: akkeris apps -> akkeris sites -> akkeris apps (based on configuration)
// todo: deployments -> services (based on configuration)

async function init(pgpool, bus) {
  debug('Initializing links plugin...');
  await pgpool.query(fs.readFileSync('./plugins/links/create.sql').toString());
  await kp.init(pgpool, bus);
}

module.exports = {
  run,
  init,
};
