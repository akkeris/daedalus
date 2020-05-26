do $$
begin

  create schema if not exists kubernetes;

  create extension if not exists pgcrypto;
  create extension if not exists "uuid-ossp";

  -- the remaining objects are dynamically created.
end
$$;