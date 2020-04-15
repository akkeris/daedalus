do $$
begin
  -- initializes session tables for connect-pg-simple module
  -- other initialization of tables are done in their respective
  -- plugins, this should only initialize globally used systems 
  -- on daedalus (which is not a lot due to its pluggable nature)

  create table if not exists "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL
  )
  with (oids=false);

  if not exists (select 1 from pg_catalog.pg_indexes where schemaname='public' and tablename='session' and indexname='session_pkey') then
    alter table "session" add constraint "session_pkey" primary key ("sid") not deferrable initially immediate;
  end if;
  
  create index if not exists "IDX_session_expire" ON "session" ("expire");

end
$$;
