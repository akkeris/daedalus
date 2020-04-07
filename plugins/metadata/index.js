const debug = require('debug')('daedalus:metadata');
const fs = require('fs');

async function run() {
  debug('Running metadata plugin...');
}
async function init(pgpool) {
  debug('Initializing metadata plugin...');
  await pgpool.query(fs.readFileSync('./plugins/metadata/create.sql').toString());
  debug('Initializing metadata plugin... done');
}

module.exports = {
  run,
  init,
};
