-- LOCAL ENVIRONMENT SHIM (declared): minimal stand-in for hosted Supabase platform objects.
-- Not a VOOM migration. Provides roles, extensions, auth schema and auth.* helpers that hosted migrations assume.
begin;
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists postgis;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticator') then
    create role authenticator login noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb,
  raw_app_meta_data jsonb,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now()
);
-- Hosted semantics: claims from request.jwt.claims (PostgREST >= 12) or legacy request.jwt.claim.sub (psql tests).
create or replace function auth.uid() returns uuid language sql stable set search_path = pg_catalog as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')
  )::uuid
$$;
create or replace function auth.role() returns text language sql stable set search_path = pg_catalog as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '')
  )
$$;
create or replace function auth.jwt() returns jsonb language sql stable set search_path = pg_catalog as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.email() returns text language sql stable set search_path = pg_catalog as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'email', '')
$$;
revoke all on schema auth from public;
revoke all on auth.users from public, anon, authenticated;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role(), auth.jwt(), auth.email() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to service_role;
-- Hosted default privileges for PostgREST roles on the public schema (Supabase grants these on every table/function).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
commit;
