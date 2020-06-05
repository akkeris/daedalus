const AWS = require('aws-sdk');
const assert = require('assert');
const fs = require('fs');
const debug = require('debug')('daedalus:aws');
const crawler = require('../../common/crawler.js');

// todo: aws ec2s -> kubernetes.nodes ?
// todo: aws rds -> kubernetes.deployments, etc etc

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

async function fetch(func, returnProperty, uniqueIdProperty, nameProperty, start, region) { // eslint-disable-line max-len
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
    assert.ok(resp[returnProperty], `The return property ${returnProperty} was not found.`);

    objs = objs.concat(resp[returnProperty]);
    await crawler.wait(10 * 1000); // eslint-disable-line no-await-in-loop
    marker = resp.Marker;
  } while (marker);
  return objs.map((item) => [`aws.${region}.${uniqueIdProperty}.${item[uniqueIdProperty]}`, item, {} /* spec */, findStatus(item), {} /* metadata */, { name: item[nameProperty] }]);
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
    debug(`Pulling db clusters from AWS RDS ${rds.config.region}...`);
    const clusters = await fetch(rds.describeDBClusters.bind(rds), 'DBClusters', 'DBClusterArn', 'DBClusterIdentifier', false, rds.config.region); // eslint-disable-line no-await-in-loop
    await crawler.writeDeletedObjs(pgpool, 'aws', 'rds_db_cluster', // eslint-disable-line no-await-in-loop
      (await Promise.all(clusters.map((x) => crawler.writeObj(pgpool, 'aws', 'rds_db_cluster', ...x)))).map((x) => x.rows).flat()); // eslint-disable-line no-await-in-loop
    debug(`Pulling db instances from AWS RDS ${rds.config.region}...`);
    const instances = await fetch(rds.describeDBInstances.bind(rds), 'DBInstances', 'DBInstanceArn', 'DBInstanceIdentifier', false, rds.config.region); // eslint-disable-line no-await-in-loop
    await crawler.writeDeletedObjs(pgpool, 'aws', 'rds_db_instance', // eslint-disable-line no-await-in-loop
      (await Promise.all(instances.map((x) => crawler.writeObj(pgpool, 'aws', 'rds_db_instance', ...x)))).map((x) => x.rows).flat()); // eslint-disable-line no-await-in-loop
    debug(`Pulling db subnet groups from AWS RDS ${rds.config.region}...`);
    const subnetGroups = await fetch(rds.describeDBSubnetGroups.bind(rds), 'DBSubnetGroups', 'DBSubnetGroupArn', 'DBSubnetGroupName', false, rds.config.region); // eslint-disable-line no-await-in-loop
    await crawler.writeDeletedObjs(pgpool, 'aws', 'rds_db_subnet_group', // eslint-disable-line no-await-in-loop
      (await Promise.all(subnetGroups.map((x) => crawler.writeObj(pgpool, 'aws', 'rds_db_subnet_group', ...x)))).map((x) => x.rows).flat()); // eslint-disable-line no-await-in-loop
    debug(`Pulling db security groups from AWS RDS ${rds.config.region}...`);
    const securityGroups = await fetch(rds.describeDBSecurityGroups.bind(rds), 'DBSecurityGroups', 'DBSecurityGroupArn', 'DBSecurityGroupName', false, rds.config.region); // eslint-disable-line no-await-in-loop
    await crawler.writeDeletedObjs(pgpool, 'aws', 'rds_db_security_group', // eslint-disable-line no-await-in-loop
      (await Promise.all(securityGroups.map((x) => crawler.writeObj(pgpool, 'aws', 'rds_db_security_group', ...x)))).map((x) => x.rows).flat()); // eslint-disable-line no-await-in-loop
    debug(`Pulling db parameter groups from AWS RDS ${rds.config.region}...`);
    const parameterGroups = await fetch(rds.describeDBParameterGroups.bind(rds), 'DBParameterGroups', 'DBParameterGroupArn', 'DBParameterGroupName', false, rds.config.region); // eslint-disable-line no-await-in-loop
    await crawler.writeDeletedObjs(pgpool, 'aws', 'rds_db_parameter_group', // eslint-disable-line no-await-in-loop
      (await Promise.all(parameterGroups.map((x) => crawler.writeObj(pgpool, 'aws', 'rds_db_parameter_group', ...x)))).map((x) => x.rows).flat()); // eslint-disable-line no-await-in-loop
    debug(`Pulling db snapshots from AWS RDS ${rds.config.region}...`);
    const dbSnapshots = await fetch(rds.describeDBSnapshots.bind(rds), 'DBSnapshots', 'DBSnapshotIdentifier', 'DBSnapshotIdentifier', false, rds.config.region); // eslint-disable-line no-await-in-loop
    await crawler.writeDeletedObjs(pgpool, 'aws', 'rds_db_snapshot', // eslint-disable-line no-await-in-loop
      (await Promise.all(dbSnapshots.map((x) => crawler.writeObj(pgpool, 'aws', 'rds_db_snapshot', ...x)))).map((x) => x.rows).flat()); // eslint-disable-line no-await-in-loop
    debug(`Pulling db events from AWS RDS ${rds.config.region}...`);
    const events = await fetch(rds.describeEvents.bind(rds), 'Events', 'SourceArn', 'SourceIdentifier', true, rds.config.region); // eslint-disable-line no-await-in-loop
    await crawler.writeDeletedObjs(pgpool, 'aws', 'rds_event', // eslint-disable-line no-await-in-loop
      (await Promise.all(events.map((x) => crawler.writeObj(pgpool, 'aws', 'rds_event', ...x)))).map((x) => x.rows).flat()); // eslint-disable-line no-await-in-loop
    debug(`Pulling db certificates from AWS RDS ${rds.config.region}...`);
    const certificates = await fetch(rds.describeCertificates.bind(rds), 'Certificates', 'CertificateArn', 'CertificateIdentifier', false, rds.config.region); // eslint-disable-line no-await-in-loop
    await crawler.writeDeletedObjs(pgpool, 'aws', 'rds_certificate', // eslint-disable-line no-await-in-loop
      (await Promise.all(certificates.map((x) => crawler.writeObj(pgpool, 'aws', 'rds_certificate', ...x)))).map((x) => x.rows).flat()); // eslint-disable-line no-await-in-loop
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
    debug(`Pulling es clusters from AWS RDS ${es.config.region}...`);
    const clusters = await fetch(es.describeCacheClusters.bind(es), 'CacheClusters', 'CacheClusterId', 'CacheClusterId', false, es.config.region); // eslint-disable-line no-await-in-loop
    await crawler.writeDeletedObjs(pgpool, 'aws', 'es_cluster', // eslint-disable-line no-await-in-loop
      (await Promise.all(clusters.map((x) => crawler.writeObj(pgpool, 'aws', 'es_cluster', ...x)))).map((x) => x.rows).flat()); // eslint-disable-line no-await-in-loop
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
  await crawler.createTableDefinition(pgpool, 'aws', 'rds_db_cluster', { name: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'aws', 'rds_db_instance', { name: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'aws', 'rds_db_subnet_group', { name: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'aws', 'rds_db_security_group', { name: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'aws', 'rds_db_parameter_group', { name: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'aws', 'rds_db_snapshot', { name: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'aws', 'rds_certificate', { name: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'aws', 'rds_event', { name: { type: 'text' } });
  await crawler.createTableDefinition(pgpool, 'aws', 'es_cluster', { name: { type: 'text' } });
  debug('Initializing aws plugin... done');
}

module.exports = {
  run,
  init,
};
