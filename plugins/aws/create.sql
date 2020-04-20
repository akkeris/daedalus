do $$
begin

  create schema if not exists "aws";
  create extension if not exists "uuid-ossp";

  create or replace function aws.calc_hash() returns trigger as $calc_hash$
    begin
      new.hash := encode(digest(new.definition::text, 'sha1'), 'hex');
      return new;
    end;
  $calc_hash$ language plpgsql;

  create table if not exists aws.rds_db_instances_log (
    rds_db_instance_log uuid not null primary key default uuid_generate_v4(),
    db_instance_arn varchar(128) not null,
    engine varchar(128) not null,
    status varchar(128) not null,
    name varchar(128) not null,
    definition jsonb not null,
    hash varchar(128),
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );

  drop trigger if exists aws_rds_db_instances_log_hash on aws.rds_db_instances_log;
  create trigger aws_rds_db_instances_log_hash
    before insert or update on aws.rds_db_instances_log
    for each row execute function aws.calc_hash();

  create or replace view aws.rds_db_instances as
    with ordered_list as ( select
      db_instance_arn,
      engine,
      status,
      name,
      definition,
      hash,
      observed_on,
      deleted,
      row_number() over (partition by db_instance_arn order by observed_on desc) as rn
    from aws.rds_db_instances_log)
    select db_instance_arn, engine, status, name, definition, observed_on from ordered_list where rn=1 and deleted = false;


  create table if not exists aws.rds_db_clusters_log (
    rds_db_cluster_log uuid not null primary key default uuid_generate_v4(),
    db_cluster_arn varchar(128) not null,
    engine varchar(128) not null,
    status varchar(128) not null,
    name varchar(128) not null,
    definition jsonb not null,
    hash varchar(128),
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );

  drop trigger if exists aws_rds_db_clusters_log_hash on aws.rds_db_clusters_log;
  create trigger aws_rds_db_clusters_log_hash
    before insert or update on aws.rds_db_clusters_log
    for each row execute function aws.calc_hash();

  create or replace view aws.rds_db_clusters as
    with ordered_list as ( select
      db_cluster_arn,
      engine,
      status,
      name,
      definition,
      hash,
      observed_on,
      deleted,
      row_number() over (partition by db_cluster_arn order by observed_on desc) as rn
    from aws.rds_db_clusters_log)
    select db_cluster_arn, engine, status, name, definition, observed_on from ordered_list where rn=1 and deleted = false;


  create table if not exists aws.es_clusters_log (
    es_cluster_log uuid not null primary key default uuid_generate_v4(),
    engine varchar(128) not null,
    status varchar(128) not null,
    name varchar(128) not null,
    definition jsonb not null,
    hash varchar(128),
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );

  drop trigger if exists aws_es_clusters_log_hash on aws.es_clusters_log;
  create trigger aws_es_clusters_log_hash
    before insert or update on aws.es_clusters_log
    for each row execute function aws.calc_hash();

  create or replace view aws.es_clusters as
    with ordered_list as (
      select
        engine,
        status,
        name,
        definition,
        hash,
        observed_on,
        deleted,
        row_number() over (partition by name order by observed_on desc) as rn
      from aws.es_clusters_log
    )
    select engine, status, name, definition, observed_on from ordered_list where rn=1 and deleted = false;


  create table if not exists aws.rds_events_log (
    rds_events_log uuid not null primary key default uuid_generate_v4(),
    source_identifier varchar(128) not null,
    source_type varchar(128) not null,
    source_arn varchar(128) not null,
    definition jsonb not null,
    hash varchar(128),
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );

  drop trigger if exists aws_rds_events_log_hash on aws.rds_events_log;
  create trigger aws_rds_events_log_hash
    before insert or update on aws.rds_events_log
    for each row execute function aws.calc_hash();

  create or replace view aws.rds_events as
    with ordered_list as ( 
      select
        source_identifier,
        source_type,
        source_arn,
        definition,
        hash,
        observed_on,
        deleted,
        row_number() over (partition by source_identifier order by observed_on desc) as rn
      from aws.rds_events_log
    )
    select source_identifier, source_type, source_arn, definition, observed_on from ordered_list where rn=1 and deleted = false;



  create table if not exists aws.rds_db_parameter_groups_log (
    rds_db_parameter_groups_log uuid not null primary key default uuid_generate_v4(),
    db_parameter_group_arn varchar(128) not null,
    family varchar(128) not null,
    description text not null default '',
    name varchar(128) not null,
    definition jsonb not null,
    hash varchar(128),
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );

  drop trigger if exists aws_rds_db_parameter_groups_log_hash on aws.rds_db_parameter_groups_log;
  create trigger aws_rds_db_parameter_groups_log_hash
    before insert or update on aws.rds_db_parameter_groups_log
    for each row execute function aws.calc_hash();

  create or replace view aws.rds_db_parameter_groups as
    with ordered_list as ( select
      db_parameter_group_arn,
      family,
      description,
      name,
      definition,
      hash,
      observed_on,
      deleted,
      row_number() over (partition by db_parameter_group_arn order by observed_on desc) as rn
    from aws.rds_db_parameter_groups_log)
    select db_parameter_group_arn, family, description, name, definition, observed_on from ordered_list where rn=1 and deleted = false;



  create table if not exists aws.rds_db_snapshots_log (
    rds_db_snapshot_log uuid not null primary key default uuid_generate_v4(),
    db_snapshot_identifier varchar(128) not null,
    db_instance_identifier varchar(128) not null,
    definition jsonb not null,
    hash varchar(128),
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  drop trigger if exists aws_rds_db_snapshots_log_hash on aws.rds_db_snapshots_log;
  create trigger aws_rds_db_snapshots_log_hash
    before insert or update on aws.rds_db_snapshots_log
    for each row execute function aws.calc_hash();

  create or replace view aws.rds_db_snapshots as
    with ordered_list as ( select
      db_snapshot_identifier,
      db_instance_identifier,
      definition,
      hash,
      observed_on,
      deleted,
      row_number() over (partition by db_snapshot_identifier order by observed_on desc) as rn
    from aws.rds_db_snapshots_log)
    select db_snapshot_identifier, db_instance_identifier, definition, observed_on from ordered_list where rn=1 and deleted = false;



  create table if not exists aws.rds_certificates_log (
    rds_certificate_log uuid not null primary key default uuid_generate_v4(),
    certificate_identifier varchar(128) not null,
    certificate_type varchar(128) not null,
    certificate_arn varchar(128) not null,
    definition jsonb not null,
    hash varchar(128),
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  drop trigger if exists aws_rds_certificates_log_hash on aws.rds_certificates_log;
  create trigger aws_rds_certificates_log_hash
    before insert or update on aws.rds_certificates_log
    for each row execute function aws.calc_hash();

  create or replace view aws.rds_certificates as
    with ordered_list as ( select
      certificate_identifier,
      certificate_type,
      certificate_arn,
      definition,
      hash,
      observed_on,
      deleted,
      row_number() over (partition by certificate_identifier, certificate_arn order by observed_on desc) as rn
    from aws.rds_certificates_log)
    select certificate_identifier, certificate_type, certificate_arn, definition, observed_on from ordered_list where rn=1 and deleted = false;


  create table if not exists aws.rds_db_subnet_groups_log (
    rds_db_subnet_group_log uuid not null primary key default uuid_generate_v4(),
    name varchar(128) not null,
    db_subnet_group_arn varchar(128) not null,
    definition jsonb not null,
    hash varchar(128),
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  drop trigger if exists aws_rds_db_subnet_groups_log_hash on aws.rds_db_subnet_groups_log;
  create trigger aws_rds_db_subnet_groups_log_hash
    before insert or update on aws.rds_db_subnet_groups_log
    for each row execute function aws.calc_hash();

  create or replace view aws.rds_db_subnet_groups as
    with ordered_list as ( select
      name,
      db_subnet_group_arn,
      definition,
      hash,
      observed_on,
      deleted,
      row_number() over (partition by db_subnet_group_arn order by observed_on desc) as rn
    from aws.rds_db_subnet_groups_log)
    select name, db_subnet_group_arn, definition, observed_on from ordered_list where rn=1 and deleted = false;


  create table if not exists aws.rds_db_security_groups_log (
    rds_db_security_group_log uuid not null primary key default uuid_generate_v4(),
    name varchar(128) not null,
    db_security_group_arn varchar(128) not null,
    definition jsonb not null,
    hash varchar(128),
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  drop trigger if exists aws_rds_db_security_groups_log_hash on aws.rds_db_security_groups_log;
  create trigger aws_rds_db_security_groups_log_hash
    before insert or update on aws.rds_db_security_groups_log
    for each row execute function aws.calc_hash();

  create or replace view aws.rds_db_security_groups as
    with ordered_list as ( select
      name,
      db_security_group_arn,
      definition,
      hash,
      observed_on,
      deleted,
      row_number() over (partition by db_security_group_arn order by observed_on desc) as rn
    from aws.rds_db_security_groups_log)
    select name, db_security_group_arn, definition, observed_on from ordered_list where rn=1 and deleted = false;
end
$$;