do $$
begin

  create schema if not exists urls;
  create extension if not exists "uuid-ossp";

  create table if not exists urls.certificates_log (
    certificate_log uuid not null primary key,
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
  create index if not exists urls_log_certificate on urls.urls_log (certificate);
  create or replace view urls.certificates as
    with ordered_list as ( select
      certificate_log,
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
    select certificate_log, fingerprint_hex_160, fingerprint_hex_256, subject, alternative_names, serial_number, issued, expires, issuer, definition, observed_on from ordered_list where rn=1 and deleted = false;
  comment on view urls.certificates IS E'@name urlsCertificates';

  create table if not exists urls.urls_log (
    url_log uuid not null primary key,
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
  create or replace view urls.urls as
    with ordered_list as ( select
      url_log,
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
    select url_log, protocol, hostname, port, pathname, definition, certificate, observed_on from ordered_list where rn=1 and deleted = false;

end
$$;