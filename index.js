const EventEmitter = require('events');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const pg = require('pg');
const debug = require('debug')('daedalus:index');

const bus = new EventEmitter();

assert.ok(process.env.DATABASE_URL, 'A postgres database connection string must be provided as the environment DATABASE_URL');
assert.ok(process.env.SECRET && process.env.SECRET.length === 192 / 8,
  'No secret or an invalid secret was passed in. Set env SECRET to be a 24 long character.');
assert.ok(process.env.HASH_SECRET, 'The environment variable HASH_SECRET was not provided.');

const pgpool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const plugins = fs.readdirSync('./plugins')
  .sort((a, b) => (a < b ? -1 : 1))
  .filter((p) => !path.basename(p).startsWith('.'))
  .map((plugin) => require(`./${path.join('plugins', plugin, 'index.js')}`)); // eslint-disable-line import/no-dynamic-require,global-require

async function init() {
  debug('Initializing plugins...');
  await Promise.all(plugins.map((plugin) => plugin.init(pgpool, bus)));
}

// TODO: Support cron rules from exported plugins, for a "run" frequency.

async function run() {
  debug('Running plugins...');
  await Promise.all(plugins.map((plugin) => plugin.run(pgpool, bus)));
  setTimeout(run, 1000 * 60 * 5);
}

function fatal(e) {
  console.error(e); // eslint-disable-line no-console
  process.exit(1);
}

if (require.main === module) {
  process.on('uncaughtException', fatal);
  process.on('unhandledRejection', fatal);
  init().then(run);
}

module.exports = {
  init,
  run,
};
