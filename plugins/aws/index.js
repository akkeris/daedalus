const AWS = require('aws-sdk');
const assert = require('assert');
const fs = require('fs');
const debug = require('debug')('daedalus:aws');
const crypto = require('crypto');

async function createDatabaseDefinition(pgpool, plural) {
  const sql = `
    do $$
    begin
      create table if not exists aws.${plural}_log (
        node_log uuid not null primary key,
        node uuid not null,
        name varchar(128) not null,
        region varchar(128) not null,
        definition jsonb not null,
        status jsonb not null,
        hash varchar(64) not null,
        observed_on timestamp with time zone default now(),
        deleted boolean not null default false
      );
      comment on table aws.${plural}_log is E'@name aws${plural.split('_').map((x) => (x.substring(0, 1).toUpperCase() + x.substring(1))).join('')}Log';
      create unique index if not exists ${plural}_changed on aws.${plural}_log (hash, deleted);
      create index if not exists ${plural}_partition_ndx on aws.${plural}_log (name, region, observed_on desc);
      create or replace view aws.${plural} as
        with ordered_list as ( select
          node_log,
          node,
          name,
          region,
          definition,
          status,
          hash,
          observed_on,
          deleted,
          row_number() over (partition by name, region order by observed_on desc) as row_number
        from aws.${plural}_log) 
      select 
        node_log,
        node,
        name,
        region,
        definition,
        status,
        hash,
        observed_on 
      from
        ordered_list 
      where
        row_number = 1 and 
        deleted = false;
      comment on view aws.${plural} is E'@name aws${plural.split('_').map((x) => (x.substring(0, 1).toUpperCase() + x.substring(1))).join('')}';
    end
    $$;
  `;
  await pgpool.query(sql);
}

function getDefinitionHash(item) {
  const i = JSON.parse(JSON.stringify(item));
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(i, null, 2));
  return hash.digest('hex');
}

function findStatus(item) {
  const status = Object.keys(item).filter((x) => x.toLowerCase().includes('status'));
  if (status.length > 0) {
    if (item[status[0]] && (typeof item[status[0]] === 'string' || typeof item[status[0]] === 'number')) {
      return { status: item[status[0]] };
    } if (item[status[0]]) {
      return item[status[0]];
    }
  }
  return {};
}


async function writeDeletedObjs(pgpool, awsType, foundObjs) {
  (await pgpool.query(`select node_log, node, name, region, definition, status, hash from aws.${awsType}`)).rows
    .filter((y) => !foundObjs.some((x) => x.node === y.node && x.region === y.region))
    .map(async (item) => pgpool.query( // eslint-disable-line no-await-in-loop,max-len
      `
      insert into aws.${awsType}_log (node_log, node, name, region, definition, status, hash, deleted)
      values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5, $6, $7)
      on conflict (hash, deleted) 
      do nothing
    `, [item.node, item.name, item.region, item.definition, item.status, item.hash, true],
    ));
}

async function writeObjs(pgpool, awsType, func, returnProperty, uniqueIdProperty, nameProperty, start, region) { // eslint-disable-line max-len
  debug(`Pulling ${awsType} from AWS RDS ${region}...`);
  let marker = void (0); // eslint-disable-line no-void
  const options = {};
  let objs = [];
  if (start) {
    const startTime = new Date();
    startTime.setUTCDate(startTime.getUTCDate() - 1);
    options.StartTime = startTime;
  }
  do {
    const resp = await func({ ...options, Marker: marker }).promise(); // eslint-disable-line no-await-in-loop,max-len
    assert.ok(resp[returnProperty], `The return property ${returnProperty} for ${awsType} was not found.`);
    objs = objs.concat((await Promise.all(resp[returnProperty].map(async (item) => { // eslint-disable-line no-await-in-loop,max-len
      assert.ok(item[uniqueIdProperty], `The unique id property ${uniqueIdProperty} was not found for ${awsType}`);
      assert.ok(item[nameProperty], `The name property ${nameProperty} was not found for ${awsType}`);
      return pgpool.query(`
        insert into aws.${awsType}_log (node_log, node, name, region, definition, status, hash)
        values (uuid_generate_v4(), uuid_generate_v5(uuid_ns_url(), $1), $2, $3, $4, $5, $6)
        on conflict (hash, deleted) 
        do update set name = $2, status = $5
        returning node_log, node, name, region, definition, status, hash, deleted
      `, [`${awsType}.${item[uniqueIdProperty]}`, item[nameProperty], region, item, findStatus(item), getDefinitionHash(item)]);
    }))).map((x) => x.rows).flat());
    await new Promise((res) => setTimeout(res, 10 * 1000)); // eslint-disable-line no-await-in-loop
    marker = resp.Marker;
  } while (marker);
  return objs;
}

async function runRds(pgpool) {
  let rdsClients = [];
  if (process.env.AWS_RDS_SECRET_KEY
      && process.env.AWS_RDS_ACCESS_KEY
      && process.env.AWS_RDS_REGIONS) {
    rdsClients = rdsClients.concat(process.env.AWS_RDS_REGIONS.split(',')
      .map((x) => x.toLowerCase())
      .map((region) => new AWS.RDS({
        accessKeyId: process.env.AWS_RDS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_RDS_SECRET_KEY,
        region,
      })));
  } else if (process.env.AWS_RDS_REGIONS) {
    rdsClients = rdsClients.concat(process.env.AWS_RDS_REGIONS.split(',')
      .map((x) => x.toLowerCase())
      .map((region) => new AWS.RDS({ region })));
  } else {
    return;
  }

  for (const rds of rdsClients) { // eslint-disable-line no-restricted-syntax
    await writeDeletedObjs(pgpool, 'rds_db_clusters', // eslint-disable-line no-await-in-loop
      await writeObjs(pgpool, 'rds_db_clusters', rds.describeDBClusters.bind(rds), 'DBClusters', 'DBClusterArn', 'DBClusterIdentifier', false, rds.config.region)); // eslint-disable-line no-await-in-loop
    await writeDeletedObjs(pgpool, 'rds_db_instances', // eslint-disable-line no-await-in-loop
      await writeObjs(pgpool, 'rds_db_instances', rds.describeDBInstances.bind(rds), 'DBInstances', 'DBInstanceArn', 'DBInstanceIdentifier', false, rds.config.region)); // eslint-disable-line no-await-in-loop
    await writeDeletedObjs(pgpool, 'rds_db_subnet_groups', // eslint-disable-line no-await-in-loop
      await writeObjs(pgpool, 'rds_db_subnet_groups', rds.describeDBSubnetGroups.bind(rds), 'DBSubnetGroups', 'DBSubnetGroupArn', 'DBSubnetGroupName', false, rds.config.region)); // eslint-disable-line no-await-in-loop
    await writeDeletedObjs(pgpool, 'rds_db_security_groups', // eslint-disable-line no-await-in-loop
      await writeObjs(pgpool, 'rds_db_security_groups', rds.describeDBSecurityGroups.bind(rds), 'DBSecurityGroups', 'DBSecurityGroupArn', 'DBSecurityGroupName', false, rds.config.region)); // eslint-disable-line no-await-in-loop
    await writeDeletedObjs(pgpool, 'rds_db_parameter_groups', // eslint-disable-line no-await-in-loop
      await writeObjs(pgpool, 'rds_db_parameter_groups', rds.describeDBParameterGroups.bind(rds), 'DBParameterGroups', 'DBParameterGroupArn', 'DBParameterGroupName', false, rds.config.region)); // eslint-disable-line no-await-in-loop
    await writeDeletedObjs(pgpool, 'rds_db_snapshots', // eslint-disable-line no-await-in-loop
      await writeObjs(pgpool, 'rds_db_snapshots', rds.describeDBSnapshots.bind(rds), 'DBSnapshots', 'DBSnapshotIdentifier', 'DBSnapshotIdentifier', false, rds.config.region)); // eslint-disable-line no-await-in-loop
    await writeDeletedObjs(pgpool, 'rds_events', // eslint-disable-line no-await-in-loop
      await writeObjs(pgpool, 'rds_events', rds.describeEvents.bind(rds), 'Events', 'SourceArn', 'SourceIdentifier', true, rds.config.region)); // eslint-disable-line no-await-in-loop
    await writeDeletedObjs(pgpool, 'rds_certificates', // eslint-disable-line no-await-in-loop
      await writeObjs(pgpool, 'rds_certificates', rds.describeCertificates.bind(rds), 'Certificates', 'CertificateArn', 'CertificateIdentifier', false, rds.config.region)); // eslint-disable-line no-await-in-loop
  }
}

async function runElastiCache(pgpool) {
  let elastiCacheClients = [];
  if (process.env.AWS_ELASTICACHE_SECRET_KEY
      && process.env.AWS_ELASTICACHE_ACCESS_KEY
      && process.env.AWS_ELASTICACHE_REGIONS) {
    elastiCacheClients = elastiCacheClients.concat(process.env.AWS_ELASTICACHE_REGIONS.split(',')
      .map((x) => x.toLowerCase())
      .map((region) => new AWS.ElastiCache({
        accessKeyId: process.env.AWS_RDS_ACCESS_KEY,
        secretAccesskey: process.env.AWS_RDS_SECRET_KEY,
        region,
      })));
  } else if (process.env.AWS_ELASTICACHE_REGIONS) {
    elastiCacheClients = elastiCacheClients.concat(process.env.AWS_ELASTICACHE_REGIONS.split(',')
      .map((x) => x.toLowerCase())
      .map((region) => new AWS.ElastiCache({ region })));
  } else {
    return;
  }
  for (const es of elastiCacheClients) { // eslint-disable-line no-restricted-syntax
    await writeDeletedObjs(pgpool, 'es_clusters', // eslint-disable-line no-await-in-loop
      await writeObjs(pgpool, 'es_clusters', es.describeCacheClusters.bind(es), 'CacheClusters', 'CacheClusterId', 'CacheClusterId', false, es.config.region)); // eslint-disable-line no-await-in-loop
  }
}

async function run(pgpool) {
  if (process.env.AWS !== 'true') {
    return;
  }
  if (!process.env.AWS_RDS_REGIONS && !process.env.AWS_ELASTICACHE_REGIONS) {
    return;
  }
  debug('Running aws plugin...');
  await new Promise((res) => setTimeout(res, 10 * 1000));
  await runRds(pgpool);
  await runElastiCache(pgpool);
  debug('Running aws plugin... done');
}

async function init(pgpool) {
  debug('Initializing aws plugin...');
  await pgpool.query(fs.readFileSync('./plugins/aws/create.sql').toString());
  await createDatabaseDefinition(pgpool, 'rds_db_clusters');
  await createDatabaseDefinition(pgpool, 'rds_db_instances');
  await createDatabaseDefinition(pgpool, 'rds_db_subnet_groups');
  await createDatabaseDefinition(pgpool, 'rds_db_security_groups');
  await createDatabaseDefinition(pgpool, 'rds_db_parameter_groups');
  await createDatabaseDefinition(pgpool, 'rds_db_snapshots');
  await createDatabaseDefinition(pgpool, 'rds_certificates');
  await createDatabaseDefinition(pgpool, 'rds_events');
  await createDatabaseDefinition(pgpool, 'es_clusters');
  debug('Initializing aws plugin... done');
}

module.exports = {
  run,
  init,
};
