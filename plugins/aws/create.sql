do $$
begin

  create schema if not exists "aws";
  create extension if not exists "uuid-ossp";


  if exists (select 1 from information_schema.tables where table_schema='metadata' and table_name='node_types') then
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/elastic_search', 'aws.es.svg', 'fa-search', 'Amazon Elastic Search') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_certificates', 'aws.rds_certificates.svg', 'fa-certificate', 'Amazon RDS Certificates') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_db_clusters', 'aws.rds_db_clusters.svg', 'fa-database', 'Amazon RDS Database Clusters') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_db_instances', 'aws.rds_db_instances.svg', 'fa-database', 'Amazon RDS Database Instances') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_db_parameter_groups', 'aws.rds_db_parameter_groups.svg', 'fa-cogs', 'Amazon Database Parameter Groups') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_db_security_groups', 'aws.rds_db_security_groups.svg', 'fa-shield', 'Amazon RDS Security Groups') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_db_snapshots', 'aws.rds_db_snapshots.svg', 'fa-archive', 'Amazon RDS Snapshots') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_db_subnet_groups', 'aws.rds_db_subnet_groups.svg', 'fa-plug', 'Amazon Subnet Groups') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'aws/rds_events', 'aws.rds_events.svg', 'fa-cube', 'Amazon RDS Events') on conflict (name) do nothing;
  end if;
  -- this is dynamically created

end
$$;