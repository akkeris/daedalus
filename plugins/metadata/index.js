const debug = require('debug')('daedalus:metadata');
const fs = require('fs');
const kp = require('./kubernetes-postgresql.js');
const kk = require('./kubernetes-kubernetes.js');
const ka = require('./kubernetes-akkeris.js');
const aa = require('./akkeris-akkeris.js');
const pp = require('./postgresql-postgresql.js');
const ko = require('./kubernetes-oracle.js');
const oo = require('./oracle-oracle.js');

async function run(pgpool, bus) {
  if (process.env.METADATA !== 'true') {
    return;
  }
  debug('Running metadata plugin...');
  await kp.run(pgpool, bus);
  await kk.run(pgpool, bus);
  await ka.run(pgpool, bus);
  await aa.run(pgpool, bus);
  await pp.run(pgpool, bus);
  await ko.run(pgpool, bus);
  await oo.run(pgpool, bus);
  debug('Refreshing nodes_log cache...');
  await pgpool.query('refresh materialized view concurrently metadata.nodes_log_cache');
  debug('Refreshing nodes cache...');
  await pgpool.query('refresh materialized view concurrently metadata.nodes_cache');
  debug('Refreshing change log cache...');
  await pgpool.query('refresh materialized view concurrently metadata.change_log_cache');
  debug('Re-indexing parent familial relationships...');
  await pgpool.query('reindex index metadata.metadata_families_parent');
  debug('Re-indexing child familial relationships...');
  await pgpool.query('reindex index metadata.metadata_families_child');
  debug('Re-indexing parent-child familial relationships...');
  await pgpool.query('reindex index metadata.families_node_idx');
}

// todo: pod -> configmap
// todo: replicaset -> configmap
// todo: akkeris apps -> akkeris apps (based on configuration)
// todo: akkeris apps -> akkeris sites (based on configuration)
// todo: akkeris apps -> services (based on configuration)
// todo: deployments -> services (based on configuration)
// todo: nodes -> pods
// todo: aws ec2s -> nodes ?

async function init(pgpool, bus) {
  debug('Initializing metadata plugin...');
  await pgpool.query(fs.readFileSync('./plugins/metadata/create.sql').toString());
  await kp.init(pgpool, bus);
  await kk.init(pgpool, bus);
  await ka.init(pgpool, bus);
  await aa.init(pgpool, bus);
  await pp.init(pgpool, bus);
  await ko.init(pgpool, bus);
  await oo.init(pgpool, bus);
  debug('Initializing metadata plugin... done');
}

module.exports = {
  name: 'metadata',
  run,
  init,
};
