const assert = require('assert');
const fs = require('fs');
const pg = require('pg');
const EventEmitter = require('events');
const postgresql = require('../plugins/postgresql');
const security = require('../common/security');


assert.ok(process.env.TEST_DATABASE_URL, 'The TEST_DATABASE_URL postgres:// connection string was not defined.');
const pgpool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 40 });
const connString = new URL(process.env.TEST_DATABASE_URL);
const bus = new EventEmitter();

before(async () => { // eslint-disable-line no-undef
  await pgpool.query('drop schema if exists postgresql cascade');
  await pgpool.query(fs.readFileSync('./create.sql').toString());
  await postgresql.init(pgpool);
});

function testFailed(options) {
  throw new Error(options.map((x) => x.toString()).join(' '));
}

describe('postgresql', async () => { // eslint-disable-line no-undef
  let databaseUUID = null;
  let columnTableUUID = null;
  it('adding a database', async () => { // eslint-disable-line no-undef
    bus.on('postgresql.error', testFailed);
    const { rows: [{ database }] } = await pgpool.query('insert into postgresql.databases_log (database, name, host, port, observed_on, deleted) values (uuid_generate_v4(), $1, $2, $3, now(), false) returning database',
      [connString.pathname.substring(1), connString.hostname, connString.port]);
    await pgpool.query('insert into postgresql.roles_log (role, database, username, password, options, observed_on, deleted) values (uuid_generate_v4(), $1, $2, $3, $4, now(), false)',
      [database, connString.username, security.encryptValue('ABCDEFABCDEFABCDEFABCDEF', connString.password), connString.search.replace(/\?/, '')]);
    await postgresql.exec(pgpool, bus, 'ABCDEFABCDEFABCDEFABCDEF');
    bus.off('postgresql.error', testFailed);
    databaseUUID = database;
  });
  it('checking database view', async () => { // eslint-disable-line no-undef
    const databases = (await pgpool.query('select * from postgresql.databases')).rows;
    assert.equal(databases.length, 1);
    assert.equal(databases[0].database, databaseUUID);
    assert.equal(databases[0].name, connString.pathname.substring(1));
    assert.equal(databases[0].host, connString.hostname);
    assert.equal(databases[0].port, connString.port);
    assert.ok((new Date()).getTime() - databases[0].observed_on.getTime() < 1000 * 10);
    assert.notEqual(JSON.stringify(databases[0].config), '{}');
  });
  it('checking tables view', async () => { // eslint-disable-line no-undef
    const tables = (await pgpool.query('select * from postgresql.tables')).rows;
    assert.equal(tables.length, 20);
    assert.equal(tables.filter((x) => x.schema === 'public').length, 1);
    assert.equal(tables.filter((x) => x.schema === 'postgresql').length, 19);
    assert.equal(tables.filter((x) => x.name === 'tables' && x.is_view && x.definition.includes('tables_log')).length, 1);
    assert.equal(tables.filter((x) => x.name === 'tables_log' && !x.is_view).length, 1);
    assert.equal(tables.filter((x) => x.name === 'tables_log' && !x.is_view).length, 1);
    assert.ok((new Date()).getTime() - tables[0].observed_on.getTime() < 1000 * 10);
    columnTableUUID = tables.filter((x) => x.name === 'columns_log' && !x.is_view)[0].table;
  });
  it('checking column view', async () => { // eslint-disable-line no-undef
    const columns = (await pgpool.query('select * from postgresql.columns')).rows;
    const columnTableColumns = columns.filter((x) => x.table === columnTableUUID && x.database === databaseUUID); // eslint-disable-line max-len
    assert.ok((new Date()).getTime() - columns[0].observed_on.getTime() < 1000 * 10);
    assert.equal(columnTableColumns.length, 19);
  });
  it('checking indexes view', async () => { // eslint-disable-line no-undef
    const indexes = (await pgpool.query('select * from postgresql.indexes')).rows;
    const columnTableIndexes = indexes.filter((x) => x.table === columnTableUUID && x.database === databaseUUID); // eslint-disable-line max-len
    assert.ok((new Date()).getTime() - indexes[0].observed_on.getTime() < 1000 * 10);
    assert.equal(columnTableIndexes.length, 4);
    assert.equal(columnTableIndexes.filter((x) => x.name === 'columns_log_table' && x.definition.includes('CREATE INDEX columns_log_table')).length, 1);
  });
  it('checking constraints view (check)', async () => { // eslint-disable-line no-undef
    const constraints = (await pgpool.query('select * from postgresql.constraints')).rows;
    const tableConstraints = constraints.filter((x) => x.database === databaseUUID && x.from_schema === 'postgresql');
    assert.ok((new Date()).getTime() - constraints[0].observed_on.getTime() < 1000 * 10);
    assert.equal(tableConstraints.filter((x) => x.name === 'databases_log_port_check' && x.type === 'CHECK' && x.check_clause.includes('port > 0')).length, 1);
  });
  it('checking constraints view (primary key)', async () => { // eslint-disable-line no-undef
    const constraints = (await pgpool.query('select * from postgresql.constraints')).rows;
    const tableConstraints = constraints.filter((x) => x.database === databaseUUID && x.from_schema === 'postgresql');
    assert.ok((new Date()).getTime() - constraints[0].observed_on.getTime() < 1000 * 10);
    assert.equal(tableConstraints.filter((x) => x.name === 'columns_log_pkey' && x.type === 'PRIMARY KEY' && x.check_clause === null).length, 1);
  });
  it('checking constraints view (foreign key)', async () => { // eslint-disable-line no-undef
    const constraints = (await pgpool.query('select * from postgresql.constraints')).rows;
    const tableConstraints = constraints.filter((x) => x.database === databaseUUID && x.from_schema === 'postgresql');
    assert.ok((new Date()).getTime() - constraints[0].observed_on.getTime() < 1000 * 10);
    assert.equal(tableConstraints.filter((x) => x.name === 'columns_log_table_fkey' && x.type === 'FORIEGN KEY').length, 1);
  });
});
