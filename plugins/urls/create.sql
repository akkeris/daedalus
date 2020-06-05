do $$
begin

  create schema if not exists urls;
  create extension if not exists "uuid-ossp";


  if exists (select 1 from information_schema.tables where table_schema='metadata' and table_name='node_types') then
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'urls/urls', 'urls.urls.svg', 'fa-link', 'Urls') on conflict (name) do nothing;
    insert into metadata.node_types ("type", name, icon, fa_icon, human_name) values (uuid_generate_v4(), 'urls/certificates', 'urls.certificates.svg', 'fa-certificate', 'Certificates') on conflict (name) do nothing;
    insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
      (uuid_generate_v4(), (select "type" from metadata.node_types where name='urls/certificates' limit 1), '$.expires', 'expires', 'Expires', 'date', true) on conflict (type, name) do nothing;
    insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
      (uuid_generate_v4(), (select "type" from metadata.node_types where name='urls/certificates' limit 1), '$.issued', 'issued', 'Issued', 'date', false) on conflict (type, name) do nothing;
    insert into metadata.node_types_fields (id, "type", jsonpath, name, friendly_name, format, highlighted) values 
      (uuid_generate_v4(), (select "type" from metadata.node_types where name='urls/urls' limit 1), '$.connection.protocol', 'tls_version', 'TLS Version', 'string', true) on conflict (type, name) do nothing;
    
    perform metadata.add_nodes_type('urls/urls', 'select node_types.icon as "icon", node_types.type, urls.url_log as node_log, urls.url as node, urls.protocol || ''//'' || urls.hostname || urls.pathname as name, urls.definition, ''{}''::jsonb as status, urls.observed_on, false as transient from urls.urls, metadata.node_types where node_types.name = ''urls/urls''');
    perform metadata.add_nodes_type('urls/certificates', 'select node_types.icon as "icon", node_types.type, certificates.certificate_log as node_log, certificates.certificate as node, certificates.subject as name, certificates.definition, ''{}''::jsonb as status, certificates.observed_on, false as transient from urls.certificates, metadata.node_types where node_types.name = ''urls/certificates''');

    perform metadata.add_nodes_log_type('urls/urls', 'select node_types.icon as "icon", node_types.type, urls_log.url_log as node_log, urls_log.url as node, urls_log.protocol || ''//'' || urls_log.hostname || urls_log.pathname as name, urls_log.definition, ''{}''::jsonb as status, urls_log.observed_on, false as transient, urls_log.deleted from urls.urls_log, metadata.node_types where node_types.name = ''urls/urls''');
    perform metadata.add_nodes_log_type('urls/certificates', 'select node_types.icon as "icon", node_types.type, certificates_log.certificate_log as node_log, certificates_log.certificate as node, certificates_log.subject as name, certificates_log.definition, ''{}''::jsonb as status, certificates_log.observed_on, false as transient, certificates_log.deleted from urls.certificates_log, metadata.node_types where node_types.name = ''urls/certificates''');
  end if;

  create table if not exists urls.certificates_log (
    certificate_log uuid not null primary key,
    certificate uuid not null,
    fingerprint_hex_160 varchar(40) not null,
    fingerprint_hex_256 varchar(64) not null,
    subject varchar(1024) not null,
    alternative_names text[] not null,
    serial_number varchar(1024) not null,
    issued timestamp with time zone default now(),
    expires timestamp with time zone default now(),
    issuer uuid,
    definition jsonb not null default '{}'::jsonb,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  comment on table urls.certificates_log IS E'@name urlsCertificatesLog';
  create unique index if not exists certificates_unique_ndx on urls.certificates_log (fingerprint_hex_160, fingerprint_hex_256, deleted);
  create index if not exists certificates_observed_on on urls.certificates_log (fingerprint_hex_160, fingerprint_hex_256, observed_on desc);
  create or replace view urls.certificates as
    with ordered_list as ( select
      certificate_log,
      certificate,
      fingerprint_hex_160,
      fingerprint_hex_256,
      subject,
      alternative_names,
      serial_number,
      issued,
      expires,
      issuer,
      definition,
      observed_on,
      deleted,
      row_number() over (partition by fingerprint_hex_160, fingerprint_hex_256 order by observed_on desc) as rn
    from urls.certificates_log)
    select certificate_log, certificate, fingerprint_hex_160, fingerprint_hex_256, subject, alternative_names, serial_number, issued, expires, issuer, definition, observed_on from ordered_list where rn=1 and deleted = false;
  comment on view urls.certificates IS E'@name urlsCertificates';

  create table if not exists urls.urls_log (
    url_log uuid not null primary key,
    url uuid not null,
    protocol varchar(1024) not null,
    hostname varchar(1024) not null,
    port varchar(1024) not null,
    pathname varchar(1024) not null,
    definition jsonb not null default '{}'::jsonb,
    certificate uuid references urls.certificates_log("certificate_log") null,
    observed_on timestamp with time zone default now(),
    deleted boolean not null default false
  );
  create unique index if not exists urls_unique_ndx on urls.urls_log (protocol, hostname, port, pathname, deleted);
  create index if not exists urls_observed_on on urls.urls_log (protocol, hostname, port, pathname, observed_on desc);
  create index if not exists urls_log_certificate on urls.urls_log (certificate);
  create or replace view urls.urls as
    with ordered_list as ( select
      url_log,
      url,
      protocol,
      hostname,
      port,
      pathname,
      definition,
      certificate,
      observed_on,
      deleted,
      row_number() over (partition by protocol, hostname, port, pathname order by observed_on desc) as rn
    from urls.urls_log)
    select url_log, url, protocol, hostname, port, pathname, definition, certificate, observed_on from ordered_list where rn=1 and deleted = false;

end
$$;