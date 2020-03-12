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

  await Promise.all(rdsClients.map(async (rds) => {      
    let marker = void(0);

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeDBClusters-property
    debug(`Pulling DB Clusters from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    do {
      let resp = await rds.describeDBClusters({Marker:marker}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      await Promise.all(resp.DBClusters.map(async (db) => {
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
        `,
        [db.DBClusterArn, db.Engine, db.Status, db.DBClusterIdentifier, db]);
      }));
      marker = resp.Marker;
    } while (marker);

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeDBInstances-property
    debug(`Pulling Database Instances from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    do {
      let resp = await rds.describeDBInstances({Marker:marker}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      await Promise.all(resp.DBInstances.map(async (db) => {
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
        `,
        [db.DBInstanceArn, db.Engine, db.DBInstanceStatus, db.DBInstanceIdentifier, db]);
      }));
      marker = resp.Marker;
    } while (marker);

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeDBParameterGroups-property
    debug(`Pulling DB Parameter Groups from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    do {
      let resp = await rds.describeDBParameterGroups({Marker:marker}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      await Promise.all(resp.DBParameterGroups.map(async (db) => {
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
        `,
        [db.DBParameterGroupArn, db.DBParameterGroupFamily, db.Description, db.DBParameterGroupName, db]);
      }));
      marker = resp.Marker;
    } while (marker);

    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeEvents-property
    debug(`Pulling DB Events from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    let startTime = new Date();
    startTime.setUTCDate(startTime.getUTCDate() - 1);
    do {
      let resp = await rds.describeEvents({Marker:marker, StartTime:startTime}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      await Promise.all(resp.Events.map(async (event) => {
        await pgpool.query(`
          insert into aws.rds_db_events_log (source_identifier, source_type, source_arn, definition)
          select $1::varchar(128), $2::varchar(128), $3::varchar(128), $4::jsonb
          where not exists (
            select hash from (
              select 
                rds_db_events_log.source_identifier,
                rds_db_events_log.hash,
                row_number() over (partition by rds_db_events_log.source_identifier order by rds_db_events_log.observed_on desc) as rn
              from 
                aws.rds_db_events_log
            ) b 
            where b.rn=1 and 
            b.hash=encode(digest($4::text,'sha1'),'hex') and 
            b.source_identifier=$1::varchar(128)
          )
        `,
        [event.SourceIdentifier, event.SourceType, event.SourceArn, event]);
      }));
      marker = resp.Marker;
    } while (marker);


    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeDBSnapshots-property
    debug(`Pulling DB Snapshots from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    do {
      let resp = await rds.describeDBSnapshots({Marker:marker}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      await Promise.all(resp.DBSnapshots.map(async (event) => {
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
        `,
        [event.DBSnapshotIdentifier, event.DBInstanceIdentifier, event]);
      }));
      marker = resp.Marker;
    } while (marker);


    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeCertificates-property
    debug(`Pulling DB Certificates from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    do {
      let resp = await rds.describeCertificates({Marker:marker}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      await Promise.all(resp.Certificates.map(async (event) => {
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
        `,
        [event.CertificateIdentifier, event.CertificateType, event.CertificateArn, event]);
      }));
      marker = resp.Marker;
    } while (marker);


    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeDBSubnetGroups-property
    debug(`Pulling DB Subnet Groups from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    do {
      let resp = await rds.describeDBSubnetGroups({Marker:marker}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      await Promise.all(resp.DBSubnetGroups.map(async (event) => {
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
        `,
        [event.DBSubnetGroupName, event.DBSubnetGroupArn, event]);
      }));
      marker = resp.Marker;
    } while (marker);


    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/RDS.html#describeDBSecurityGroups-property
    debug(`Pulling DB Security Groups from AWS RDS ${rds.config.region}...`);
    marker = void(0);
    do {
      let resp = await rds.describeDBSecurityGroups({Marker:marker}).promise();
      await new Promise((res) => setTimeout(res, 2000));
      await Promise.all(resp.DBSecurityGroups.map(async (event) => {
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
        `,
        [event.DBSecurityGroupName, event.DBSecurityGroupArn, event]);
      }));
      marker = resp.Marker;
    } while (marker);

    // TODO: Add checks for deletion

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