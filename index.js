const EventEmitter = require('events');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const pg = require('pg');
const express = require('express');
const session = require('express-session');
const PGSession = require('connect-pg-simple')(session);
const parser = require('body-parser');
const debug = require('debug')('daedalus:index');

const bus = new EventEmitter();
const app = express();

assert.ok(process.env.DATABASE_URL,
  'A postgres database connection string must be provided as the environment DATABASE_URL');
assert.ok(process.env.SECRET && process.env.SECRET.length === 192 / 8,
  'No secret or an invalid secret was passed in. Set env SECRET to be a 24 long character.');
assert.ok(process.env.HASH_SECRET,
  'The environment variable HASH_SECRET was not provided.');
assert.ok(process.env.HASH_SECRET !== process.env.SECRET,
  'Do not set the HASH_SECRET to the same value as SECRET.');

const pgpool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 40 });
const plugins = fs.readdirSync('./plugins')
  .sort((a, b) => (a < b ? -1 : 1))
  .filter((p) => !path.basename(p).startsWith('.'))
  .map((plugin) => require(`./${path.join('plugins', plugin, 'index.js')}`)); // eslint-disable-line import/no-dynamic-require,global-require

async function init() {
  debug('Initializing express...');

  await pgpool.query(fs.readFileSync('./create.sql').toString());

  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = process.env.HASH_SECRET;
  }
  const sessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'daedalus',
    store: new PGSession(), // by default will look for DATABASE_URL
  };
  app.set('trust proxy', 1);
  app.use(session(sessionOptions));
  app.use(parser.json());
  app.use(parser.urlencoded({ extended: true }));

  debug('Initializing plugins...');
  /* This must be done syncronously to avoid deadlocks in DDL chagnes,
   * do not put this in a map with Promise.all */
  for (const plugin of plugins) { // eslint-disable-line no-restricted-syntax
    await plugin.init(pgpool, bus, app); // eslint-disable-line no-await-in-loop
  }
  debug(`Starting http port at ${process.env.PORT || 9000}`);
  app.listen(process.env.PORT || 9000, '0.0.0.0', (err) => {
    if (err) {
      console.error(err); // eslint-disable-line no-console
      if (pgpool) {
        pgpool.end(() => process.exit(1));
      } else {
        process.exit(1);
      }
    }
    debug('http services started.');
  });
}

// TODO: Support cron rules from exported plugins, for a "run" frequency.

async function run() {
  debug('Running plugins...');
  await Promise.all(plugins.map((plugin) => plugin.run(pgpool, bus, app)));
  setTimeout(run, 1000 * 60 * 5);
}

function fatal(e) {
  if (pgpool) {
    console.error(e); // eslint-disable-line no-console
    pgpool.end(() => process.exit(1));
  } else {
    console.error(e); // eslint-disable-line no-console
    process.exit(1);
  }
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
