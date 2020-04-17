const debug = require('debug')('daedalus:metadata');
const fs = require('fs');
const kp = require('./kubernetes-postgresql.js');
const kk = require('./kubernetes-kubernetes.js');
const ka = require('./kubernetes-akkeris.js');
const aa = require('./akkeris-akkeris.js');
const pp = require('./postgresql-postgresql.js');

async function run(pgpool, bus) {
  debug('Running metadata plugin...');
  await pgpool.query(fs.readFileSync('./plugins/metadata/create.sql').toString());
  await kp.run(pgpool, bus);
  await kk.run(pgpool, bus);
  await ka.run(pgpool, bus);
  await aa.run(pgpool, bus);
  await pp.run(pgpool, bus);
}

// todo: akkeris apps -> akkeris apps (based on configuration)
// todo: akkeris apps -> akkeris sites (based on configuration)
// todo: akkeris apps -> services (based on configuration)
// todo: deployments -> services (based on configuration)

// TODO: delete old links & nodes?...

async function init(pgpool, bus) {
  debug('Initializing metadata plugin...');
  await pgpool.query(fs.readFileSync('./plugins/metadata/create.sql').toString());
  await kp.init(pgpool, bus);
  await kk.init(pgpool, bus);
  await ka.init(pgpool, bus);
  await aa.init(pgpool, bus);
  await pp.init(pgpool, bus);
  debug('Initializing metadata plugin... done');
}

module.exports = {
  run,
  init,
};
