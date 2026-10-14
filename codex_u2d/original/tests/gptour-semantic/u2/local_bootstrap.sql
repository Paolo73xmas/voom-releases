-- LOCAL SYNTHETIC LAB ONLY. Not a VOOM/Supabase migration. No U2-b tables/RPCs.
begin;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='u2_authenticator') then
    create role u2_authenticator login noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
grant anon, authenticated to u2_authenticator;
create schema if not exists auth;
create schema if not exists u2_lab;
create table if not exists auth.users (id uuid primary key);
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222') on conflict do nothing;
create or replace function auth.uid() returns uuid language sql stable security invoker
set search_path = pg_catalog as $$ select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid $$;
revoke all on schema auth from public;
revoke all on auth.users from public, anon, authenticated;
revoke all on function auth.uid() from public;
grant usage on schema auth, u2_lab to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create table if not exists u2_lab.owner_probe (id integer primary key, owner_uid uuid not null references auth.users(id), label text not null);
alter table u2_lab.owner_probe enable row level security;
alter table u2_lab.owner_probe force row level security;
drop policy if exists own_read on u2_lab.owner_probe;
drop policy if exists own_insert on u2_lab.owner_probe;
drop policy if exists own_update on u2_lab.owner_probe;
create policy own_read on u2_lab.owner_probe for select to authenticated using (owner_uid=auth.uid());
create policy own_insert on u2_lab.owner_probe for insert to authenticated with check(owner_uid=auth.uid());
create policy own_update on u2_lab.owner_probe for update to authenticated using(owner_uid=auth.uid()) with check(owner_uid=auth.uid());
revoke all on u2_lab.owner_probe from public, anon, authenticated;
grant select on u2_lab.owner_probe to anon;
grant select,insert,update on u2_lab.owner_probe to authenticated;
insert into u2_lab.owner_probe values
  (1,'11111111-1111-4111-8111-111111111111','synthetic-A'),
  (2,'22222222-2222-4222-8222-222222222222','synthetic-B') on conflict(id) do nothing;
commit;