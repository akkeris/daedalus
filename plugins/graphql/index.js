const { postgraphile } = require('postgraphile');
const debug = require('debug')('daedalus:graphql');

async function run() {} // eslint-disable-line no-empty-function

async function init(pgpool, bus, app) {
  debug('Initializing graphql...');
  if (process.env.GRAPHQL_API !== 'true') {
    return;
  }
  let postgrahileOptions = {
    watchPg: true, graphiql: true, enhanceGraphiql: true, dynamicJson: true, ignoreIndexes: false,
  };
  if (process.env.GRAPHQL_POSTGRAPHILE_OPTIONS) {
    postgrahileOptions = JSON.parse(process.env.GRAPHQL_POSTGRAPHILE_OPTIONS);
  }
  const { schemas } = (await pgpool.query(`
    select 
      string_agg(schema_name,',') as schemas 
    from information_schema.schemata 
    where 
      schema_name not like 'pg_%' and 
      schema_name <> 'information_schema' and 
      schema_name not like 'postgraphile_%' and
      schema_name <> 'public'
  `)).rows[0];
  const port = process.env.PORT || 9000;
  debug(`Initializing graphql server for schemas: ${schemas}`);
  app.use(
    postgraphile(
      process.env.DATABASE_URL,
      schemas.split(','),
      postgrahileOptions,
    ),
  );
  debug(`Initializing graphql... done, listening on http://0.0.0.0:${port}/graphiql and http://0.0.0.0:${port}/graphql`);
}

module.exports = {
  run,
  init,
};
