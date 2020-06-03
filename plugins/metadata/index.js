const debug = require('debug')('daedalus:metadata');
const fs = require('fs');

async function run(pgpool) {
  if (process.env.METADATA !== 'true') {
    return;
  }
  debug('Running metadata plugin...');
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

async function init(pgpool) {
  debug('Initializing metadata plugin...');
  await pgpool.query(fs.readFileSync('./plugins/metadata/create.sql').toString());
  debug('Initializing metadata plugin... done');
}

module.exports = {
  name: 'metadata',
  run,
  init,
};
