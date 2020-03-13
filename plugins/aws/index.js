const AWS = require('aws-sdk');
const fs = require('fs');
const debug = require('debug')('daedalus:aws');

async function run(pgpool) {
  let rdsClients = [];
  if(process.env.AWS_RDS_SECRET_KEY && process.env.AWS_RDS_ACCESS_KEY && process.env.AWS_RDS_REGIONS) {
    rdsClients = rdsClients.concat(process.env.AWS_RDS_REGIONS.split(",").map((x) => x.toLowerCase()).map((region) => 
      new AWS.RDS({accessKeyId:process.env.AWS_RDS_ACCESS_KEY, secretAccesskey:process.env.AWS_RDS_SECRET_KEY, region})));
  } else if (process.env.AWS_RDS_REGIONS) {
    rdsClients = rdsClients.concat(process.env.AWS_RDS_REGIONS.split(",").map((x) => x.toLowerCase()).map((region) => 
      new AWS.RDS({region})));
  } else {
    return;
  }
  
  const existingDbClusters = (await pgpool.query(`select * from aws.rds_db_clusters`)).rows;
  const existingDbInstances = (await pgpool.query(`select * from aws.rds_db_instances`)).rows;
  const existingDbParameterGroups = (await pgpool.query(`select * from aws.rds_db_parameter_groups`)).rows;
  const existingEvents = (await pgpool.query(`select * from aws.rds_events`)).rows;
  const existingDbSnapshots = (await pgpool.query(`select * from aws.rds_db_snapshots`)).rows;
  const existingCertificates = (await pgpool.query(`select * from aws.rds_certificates`)).rows;
  const existingDbSubnetGroups = (await pgpool.query(`select * from aws.rds_db_subnet_groups`)).rows;
  const existingDbSecurityGroups = (await pgpool.query(`select * from aws.rds_db_security_groups`)).rows;

  await Promise.all(rdsClients.map(async (rds) => {      
    let marker = void(0);

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeDBClusters-property
    debug(`Pulling DB Clusters from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    let dbClusters = [];
    do {
      let resp = await rds.describeDBClusters({Marker:marker}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      dbClusters = dbClusters.concat((await Promise.all(resp.DBClusters.map(async (db) => {
        await pgpool.query(`
          insert into aws.rds_db_clusters_log (db_cluster_arn, engine, status, name, definition)
          select $1::varchar(128), $2, $3, $4, $5::jsonb
          where not exists (
            select hash from (
              select
                rds_db_clusters_log.db_cluster_arn,
                rds_db_clusters_log.hash,
                row_number() over (partition by rds_db_clusters_log.db_cluster_arn order by rds_db_clusters_log.observed_on desc) as rn
              from 
                aws.rds_db_clusters_log
            ) b 
            where b.rn=1 and 
            b.hash=encode(digest($5::text,'sha1'),'hex') and 
            b.db_cluster_arn=$1::varchar(128)
          )
          returning *
        `, [db.DBClusterArn, db.Engine, db.Status, db.DBClusterIdentifier, db]);
        return {db_cluster_arn:db.DBClusterArn};
      }))));
      marker = resp.Marker;
    } while (marker);

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeDBInstances-property
    debug(`Pulling DB Instances from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    let dbInstances = [];
    do {
      let resp = await rds.describeDBInstances({Marker:marker}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      dbInstances = dbInstances.concat((await Promise.all(resp.DBInstances.map(async (db) => {
        await pgpool.query(`
          insert into aws.rds_db_instances_log (db_instance_arn, engine, status, name, definition)
          select $1::varchar(128), $2, $3, $4, $5::jsonb
          where not exists (
            select hash from (
              select 
                rds_db_instances_log.db_instance_arn,
                rds_db_instances_log.hash,
                row_number() over (partition by rds_db_instances_log.db_instance_arn order by rds_db_instances_log.observed_on desc) as rn
              from 
                aws.rds_db_instances_log
            ) b 
            where b.rn=1 and 
            b.hash=encode(digest($5::text,'sha1'),'hex') and 
            b.db_instance_arn=$1::varchar(128)
          )
        `, [db.DBInstanceArn, db.Engine, db.DBInstanceStatus, db.DBInstanceIdentifier, db]);
        return {db_instance_arn:db.DBInstanceArn};
      }))));
      marker = resp.Marker;
    } while (marker);

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeDBParameterGroups-property
    debug(`Pulling DB Parameter Groups from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    let dbParameterGroups = [];
    do {
      let resp = await rds.describeDBParameterGroups({Marker:marker}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      dbParameterGroups = dbParameterGroups.concat((await Promise.all(resp.DBParameterGroups.map(async (db) => {
        await pgpool.query(`
          insert into aws.rds_db_parameter_groups_log (db_parameter_group_arn, family, description, name, definition)
          select $1::varchar(128), $2, $3, $4, $5::jsonb
          where not exists (
            select hash from (
              select 
                rds_db_parameter_groups_log.db_parameter_group_arn,
                rds_db_parameter_groups_log.hash,
                row_number() over (partition by rds_db_parameter_groups_log.db_parameter_group_arn order by rds_db_parameter_groups_log.observed_on desc) as rn
              from 
                aws.rds_db_parameter_groups_log
            ) b 
            where b.rn=1 and 
            b.hash=encode(digest($5::text,'sha1'),'hex') and 
            b.db_parameter_group_arn=$1::varchar(128)
          )
        `, [db.DBParameterGroupArn, db.DBParameterGroupFamily, db.Description, db.DBParameterGroupName, db]);
        return {db_parameter_group_arn:db.DBParameterGroupArn};
      }))));
      marker = resp.Marker;
    } while (marker);

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeEvents-property
    debug(`Pulling Events from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    let startTime = new Date();
    startTime.setUTCDate(startTime.getUTCDate() - 1);
    do {
      let resp = await rds.describeEvents({Marker:marker, StartTime:startTime}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      (await Promise.all(resp.Events.map(async (event) => await pgpool.query(`
        insert into aws.rds_events_log (source_identifier, source_type, source_arn, definition)
        select $1::varchar(128), $2::varchar(128), $3::varchar(128), $4::jsonb
        where not exists (
          select hash from (
            select 
              rds_events_log.source_identifier,
              rds_events_log.hash,
              row_number() over (partition by rds_events_log.source_identifier order by rds_events_log.observed_on desc) as rn
            from 
              aws.rds_events_log
          ) b 
          where b.rn=1 and 
          b.hash=encode(digest($4::text,'sha1'),'hex') and 
          b.source_identifier=$1::varchar(128)
        )
      `, [event.SourceIdentifier, event.SourceType, event.SourceArn, event])))
      );
      marker = resp.Marker;
    } while (marker);


    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeDBSnapshots-property
    debug(`Pulling DB Snapshots from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    let dbSnapshots = [];
    do {
      let resp = await rds.describeDBSnapshots({Marker:marker}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      dbSnapshots = dbSnapshots.concat((await Promise.all(resp.DBSnapshots.map(async (event) => {
        await pgpool.query(`
          insert into aws.rds_db_snapshots_log (db_snapshot_identifier, db_instance_identifier, definition)
          select $1::varchar(128), $2::varchar(128), $3::jsonb
          where not exists (
            select hash from (
              select 
                rds_db_snapshots_log.db_snapshot_identifier,
                rds_db_snapshots_log.hash,
                row_number() over (partition by rds_db_snapshots_log.db_snapshot_identifier order by rds_db_snapshots_log.observed_on desc) as rn
              from 
                aws.rds_db_snapshots_log
            ) b 
            where b.rn=1 and 
            b.hash=encode(digest($3::text,'sha1'),'hex') and 
            b.db_snapshot_identifier=$1::varchar(128)
          )
        `, [event.DBSnapshotIdentifier, event.DBInstanceIdentifier, event]);
        return {db_snapshot_identifier:event.DBSnapshotIdentifier};
      }))));
      marker = resp.Marker;
    } while (marker);


    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeCertificates-property
    debug(`Pulling Certificates from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    let certificates = [];
    do {
      let resp = await rds.describeCertificates({Marker:marker}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      certificates = certificates.concat((await Promise.all(resp.Certificates.map(async (event) => {
        await pgpool.query(`
          insert into aws.rds_certificates_log (certificate_identifier, certificate_type, certificate_arn, definition)
          select $1::varchar(128), $2::varchar(128), $3::varchar(128), $4::jsonb
          where not exists (
            select hash from (
              select 
                rds_certificates_log.certificate_identifier,
                rds_certificates_log.certificate_type,
                rds_certificates_log.certificate_arn,
                rds_certificates_log.definition,
                rds_certificates_log.hash,
                row_number() over (partition by rds_certificates_log.certificate_identifier, rds_certificates_log.certificate_arn order by rds_certificates_log.observed_on desc) as rn
              from 
                aws.rds_certificates_log
            ) b 
            where b.rn=1 and 
            b.hash=encode(digest($3::text,'sha1'),'hex') and 
            b.certificate_identifier=$1::varchar(128) and
            b.certificate_arn=$2::varchar(128)
          )
        `, [event.CertificateIdentifier, event.CertificateType, event.CertificateArn, event]);
        return {certificate_arn:event.CertificateArn};
      }))));
      marker = resp.Marker;
    } while (marker);


    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeDBSubnetGroups-property
    debug(`Pulling DB Subnet Groups from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    let dbSubnetGroups = [];
    do {
      let resp = await rds.describeDBSubnetGroups({Marker:marker}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      dbSubnetGroups = dbSubnetGroups.concat((await Promise.all(resp.DBSubnetGroups.map(async (event) => {
        await pgpool.query(`
          insert into aws.rds_db_subnet_groups_log (name, db_subnet_group_arn, definition)
          select $1::varchar(128), $2::varchar(128), $3::jsonb
          where not exists (
            select hash from (
              select 
                rds_db_subnet_groups_log.name,
                rds_db_subnet_groups_log.db_subnet_group_arn,
                rds_db_subnet_groups_log.definition,
                rds_db_subnet_groups_log.hash,
                row_number() over (partition by rds_db_subnet_groups_log.name, rds_db_subnet_groups_log.db_subnet_group_arn order by rds_db_subnet_groups_log.observed_on desc) as rn
              from 
                aws.rds_db_subnet_groups_log
            ) b 
            where b.rn=1 and 
            b.hash=encode(digest($3::text,'sha1'),'hex') and 
            b.db_subnet_group_arn=$2::varchar(128)
          )
        `, [event.DBSubnetGroupName, event.DBSubnetGroupArn, event]);
        return {db_subnet_group_arn:event.DBSubnetGroupArn};
      }))));
      marker = resp.Marker;
    } while (marker);


    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeDBSecurityGroups-property
    debug(`Pulling DB Security Groups from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    let dbSecurityGroups = [];
    do {
      let resp = await rds.describeDBSecurityGroups({Marker:marker}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      dbSecurityGroups = dbSecurityGroups.concat((await Promise.all(resp.DBSecurityGroups.map(async (event) => {
        await pgpool.query(`
          insert into aws.rds_db_security_groups_log (name, db_security_group_arn, definition)
          select $1::varchar(128), $2::varchar(128), $3::jsonb
          where not exists (
            select hash from (
              select 
                rds_db_security_groups_log.name,
                rds_db_security_groups_log.db_security_group_arn,
                rds_db_security_groups_log.definition,
                rds_db_security_groups_log.hash,
                row_number() over (partition by rds_db_security_groups_log.name, rds_db_security_groups_log.db_security_group_arn order by rds_db_security_groups_log.observed_on desc) as rn
              from 
                aws.rds_db_security_groups_log
            ) b 
            where b.rn=1 and 
            b.hash=encode(digest($3::text,'sha1'),'hex') and 
            b.db_security_group_arn=$2::varchar(128)
          )
        `, [event.DBSecurityGroupName, event.DBSecurityGroupArn, event]);
        return {db_security_group_arn:event.DBSecurityGroupArn};
      }))));
      marker = resp.Marker;
    } while (marker);

    // Check for deletions
    debug(`Checking for deletions on AWS RDS ${rds.config.region}...`);
    await Promise.all(existingDbClusters.filter(((x) => !dbClusters.some((y) => x.db_cluster_arn === y.db_cluster_arn))).map((db) => pgpool.query(`
      insert into aws.rds_db_clusters_log (db_cluster_arn, engine, status, name, definition, deleted)
      values ($1::varchar(128), $2, $3, $4, $5::jsonb, $6)`,
      [db.db_cluster_arn, db.engine, db.status, db.name, db.definition, true])));
    await Promise.all(existingDbInstances.filter(((x) => !dbInstances.some((y) => x.db_instance_arn === y.db_instance_arn))).map((db) => pgpool.query(`
      insert into aws.rds_db_instances_log (db_instance_arn, engine, status, name, definition, deleted)
      values ($1::varchar(128), $2, $3, $4, $5::jsonb, $6)`,
      [db.db_instance_arn, db.engine, db.status, db.name, db.definition, true])));
    await Promise.all(existingDbParameterGroups.filter(((x) => !dbParameterGroups.some((y) => x.db_parameter_group_arn === y.db_parameter_group_arn))).map((db) => pgpool.query(`
      insert into aws.rds_db_parameter_groups_log (db_parameter_group_arn, family, description, name, definition, deleted)
      values ($1::varchar(128), $2, $3, $4, $5::jsonb, $6)`,
      [db.db_parameter_group_arn, db.family, db.description, db.name, db.definition, true])));
    await Promise.all(existingDbSnapshots.filter(((x) => !dbSnapshots.some((y) => x.db_snapshot_identifier === y.db_snapshot_identifier))).map((db) => pgpool.query(`
      insert into aws.rds_db_snapshots_log (db_snapshot_identifier, db_instance_identifier, definition, deleted)
      values ($1::varchar(128), $2, $3::jsonb, $4)`,
      [db.db_snapshot_identifier, db.db_instance_identifier, db.definition, true])));
    await Promise.all(existingCertificates.filter(((x) => !certificates.some((y) => x.certificate_arn === y.certificate_arn))).map((db) => pgpool.query(`
      insert into aws.rds_certificates_log (certificate_identifier, certificate_type, certificate_arn, definition, deleted)
      values ($1::varchar(128), $2, $3, $4::jsonb, $5)`,
      [db.certificate_identifier, db.certificate_type, db.certificate_arn, db.definition, true])));
    await Promise.all(existingDbSubnetGroups.filter(((x) => !dbSubnetGroups.some((y) => x.db_subnet_group_arn === y.db_subnet_group_arn))).map((db) => pgpool.query(`
      insert into aws.rds_db_subnet_groups_log (name, db_subnet_group_arn, definition, deleted)
      values ($1::varchar(128), $2, $3::jsonb, $4)`,
      [db.name, db.db_subnet_group_arn, db.definition, true])));
    await Promise.all(existingDbSecurityGroups.filter(((x) => !dbSecurityGroups.some((y) => x.db_security_group_arn === y.db_security_group_arn))).map((db) => pgpool.query(`
      insert into aws.rds_db_security_groups_log (name, db_security_group_arn, definition, deleted)
      values ($1::varchar(128), $2, $3::jsonb, $4)`,
      [db.name, db.db_security_group_arn, db.definition, true])));

    // TODO (maybe): https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describePendingMaintenanceActions-property
    // TODO (maybe): https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeReservedDBInstances-property
    // TODO (maybe): https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeDBProxies-property

  }));

  if(process.env.AWS_EC2_SECRET_KEY && process.env.AWS_EC2_ACCESS_KEY && process.env.AWS_EC2_REGIONS) {
    // TODO: Add EC2 Information
  }
}

async function init(pgpool) {
  debug('Initializing aws plugin...');
  await pgpool.query(fs.readFileSync('./plugins/aws/create.sql').toString());

}

module.exports = {
  run,
  init,
}