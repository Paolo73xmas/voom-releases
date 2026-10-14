-- ROLE-MODEL PROBE (lab only). NOT the U2-b migration: no gptour_semantic_* object is created.
-- Proves: caller check inside SECURITY DEFINER under PostgREST; EXECUTE revoked from PUBLIC; minimal grants for the
-- authorization helper; backend role without CRM access; per-token revocation (jti allowlist) and membership revocation;
-- write-once triggers distinguished from permission denied. Everything is dropped by probe_down.sql.
begin;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='gptour_semantic_owner') then
    create role gptour_semantic_owner nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole;
  end if;
  if not exists (select 1 from pg_roles where rolname='gptour_semantic_backend') then
    create role gptour_semantic_backend nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole;
  end if;
  if not exists (select 1 from pg_roles where rolname='u2_probe_writer') then
    create role u2_probe_writer nologin noinherit nobypassrls nosuperuser;  -- LAB ONLY: holds UPDATE to prove the trigger
  end if;
end $$;
grant gptour_semantic_backend to authenticator;
grant usage on schema public to gptour_semantic_owner, gptour_semantic_backend;
-- NO default-privilege inheritance for these roles: grants are explicit and minimal.
alter default privileges in schema public revoke all on tables from gptour_semantic_backend, gptour_semantic_owner;
alter default privileges in schema public revoke all on functions from gptour_semantic_backend, gptour_semantic_owner;

create schema if not exists u2_role_probe authorization gptour_semantic_owner;
revoke all on schema u2_role_probe from public;

set local role gptour_semantic_owner;
create table if not exists u2_role_probe.requests (
  session_id uuid not null, request_id text not null, owner_uid uuid not null,
  status text not null default 'pending' check (status in ('pending','done','expired')),
  context jsonb, llm_output jsonb, response_body text, http_status int,
  response_expires_at timestamptz not null default clock_timestamp() + interval '7 days',
  llm_dispatches_reserved int not null default 0,
  primary key (session_id, request_id)
);
alter table u2_role_probe.requests enable row level security;   -- deny-all for everyone except the OWNER (see note below)
-- NOTE: the table owner bypasses RLS unless FORCE ROW LEVEL SECURITY; inside owner-run SECURITY DEFINER functions
-- RLS is therefore NOT a barrier: protection relies on explicit ownership/authorization/expiry checks in the function body.

create table if not exists u2_role_probe.backend_keys (jti text primary key, not_after timestamptz not null, revoked_at timestamptz);

create or replace function u2_role_probe.enforce_write_once() returns trigger language plpgsql as $$
declare terminal boolean := new.status in ('done','expired');
begin
  if old.status <> 'pending' and new.status = 'pending' then raise exception 'status cannot return to pending' using errcode = 'U2W01'; end if;
  if old.status = 'expired' and new.status <> 'expired' then raise exception 'tombstone is final' using errcode = 'U2W01'; end if;
  if new.owner_uid <> old.owner_uid then raise exception 'owner immutable' using errcode = 'U2W02'; end if;
  if new.llm_dispatches_reserved < old.llm_dispatches_reserved or new.llm_dispatches_reserved > 2 then raise exception 'budget monotonic, max 2' using errcode = 'U2W03'; end if;
  -- context / llm_output: NULL->value only while pending; value->other value never; value->NULL only when terminal
  if old.context is null and new.context is not null and old.status <> 'pending' then raise exception 'context after finalization' using errcode = 'U2W04'; end if;
  if old.context is not null and new.context is not null and new.context <> old.context then raise exception 'context is write-once' using errcode = 'U2W04'; end if;
  if old.context is not null and new.context is null and not terminal then raise exception 'context cleared only at finalization' using errcode = 'U2W04'; end if;
  if old.llm_output is null and new.llm_output is not null and old.status <> 'pending' then raise exception 'output after finalization' using errcode = 'U2W05'; end if;
  if old.llm_output is not null and new.llm_output is not null and new.llm_output <> old.llm_output then raise exception 'output is write-once' using errcode = 'U2W05'; end if;
  if old.llm_output is not null and new.llm_output is null and not terminal then raise exception 'output cleared only at finalization' using errcode = 'U2W05'; end if;
  -- response: NULL->value only with pending->done; never replaced; cleared only done->expired after response_expires_at
  if old.response_body is null and new.response_body is not null and not (old.status = 'pending' and new.status = 'done') then raise exception 'response only at pending->done' using errcode = 'U2W06'; end if;
  if old.response_body is not null and new.response_body is not null and new.response_body <> old.response_body then raise exception 'response is write-once' using errcode = 'U2W06'; end if;
  if old.response_body is not null and new.response_body is null and not (old.status = 'done' and new.status = 'expired' and clock_timestamp() >= old.response_expires_at) then raise exception 'response cleared only at expiry tombstone' using errcode = 'U2W06'; end if;
  if new.http_status is distinct from old.http_status and old.http_status is not null then raise exception 'http_status immutable' using errcode = 'U2W06'; end if;
  return new;
end $$;
drop trigger if exists write_once on u2_role_probe.requests;
create trigger write_once before update on u2_role_probe.requests for each row execute function u2_role_probe.enforce_write_once();
create or replace function u2_role_probe.no_delete() returns trigger language plpgsql as $$ begin raise exception 'rows are never deleted by the application' using errcode = 'U2W07'; end $$;
drop trigger if exists no_delete on u2_role_probe.requests;
create trigger no_delete before delete on u2_role_probe.requests for each row execute function u2_role_probe.no_delete();

reset role;
-- Caller check valid in the PostgREST execution context: inside SECURITY DEFINER current_user = owner, session_user = authenticator,
-- while current_setting('role') still reports the role selected by PostgREST (SET LOCAL ROLE) and request.jwt.claims is set by PostgREST
-- after signature verification. Two independent signals + a per-token allowlist (jti).
create or replace function u2_role_probe.assert_backend_caller() returns void language plpgsql security definer set search_path = '' as $$
declare claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
        key record;
begin
  if claims->>'role' is distinct from 'gptour_semantic_backend' then
    raise exception 'backend credential required (jwt role)' using errcode = '42501';
  end if;
  if current_setting('role', true) is distinct from 'gptour_semantic_backend' then
    raise exception 'backend credential required (session role)' using errcode = '42501';
  end if;
  select * into key from u2_role_probe.backend_keys k where k.jti = claims->>'jti';
  if key.jti is null or key.revoked_at is not null or clock_timestamp() >= key.not_after then
    raise exception 'backend key unknown, revoked or expired' using errcode = '42501';
  end if;
end $$;

-- Authorization helper with explicit uid (what gptour_semantic_is_authorized will be).
-- Variant A (demonstrative NEGATIVE): owned by gptour_semantic_owner with column-level SELECT grants only -> profiles RLS still applies to a
-- non-owner and auth.uid() is NULL under the backend credential, so it returns false even for an enabled agent.
create or replace function public.u2_role_probe_is_authorized_ownerrole(p_uid uuid, p_agent_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_uid and p.is_active and p.role in ('agent','admin','admincustom','supervisor')
      and (p_agent_id = p_uid or p.role in ('admin','admincustom'))
  ) and coalesce((select a.enabled from public.gptour_orchestrator_user_access a where a.user_id = p_uid), false)
$$;
-- Variant B (adopted): owned by the migration role (table owner of profiles / user_access, like aitour_private.authorized_agent and
-- gptour_orchestrator_is_active_admin), therefore not subject to their RLS; EXECUTE granted only to gptour_semantic_owner (callers are the RPCs).
create or replace function public.u2_role_probe_is_authorized(p_uid uuid, p_agent_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_uid and p.is_active and p.role in ('agent','admin','admincustom','supervisor')
      and (p_agent_id = p_uid or p.role in ('admin','admincustom'))
  ) and coalesce((select a.enabled from public.gptour_orchestrator_user_access a where a.user_id = p_uid), false)
$$;

-- Internal write RPC (probe of claim/commit shape): backend only, caller asserted, explicit ownership check.
create or replace function public.u2_role_probe_internal(p_caller_uid uuid, p_session_id uuid, p_request_id text, p_action text, p_value jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r u2_role_probe.requests;
begin
  perform u2_role_probe.assert_backend_caller();
  if p_action = 'insert' then
    insert into u2_role_probe.requests(session_id, request_id, owner_uid) values (p_session_id, p_request_id, p_caller_uid);
    return jsonb_build_object('ok', true);
  end if;
  select * into r from u2_role_probe.requests where session_id = p_session_id and request_id = p_request_id for update;
  if r.session_id is null or r.owner_uid <> p_caller_uid then raise exception 'not found' using errcode = 'P0002'; end if;  -- non-enumerating
  if p_action = 'store_output' then update u2_role_probe.requests set llm_output = p_value where session_id = p_session_id and request_id = p_request_id;
  elsif p_action = 'finish' then update u2_role_probe.requests set status = 'done', http_status = 200, response_body = p_value::text, llm_output = null, context = null where session_id = p_session_id and request_id = p_request_id;
  else raise exception 'unknown action' using errcode = '22023'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- Public-contract projection: backend only, no reserved columns, ownership + current authorization + expiry.
create or replace function public.u2_role_probe_read(p_caller_uid uuid, p_session_id uuid, p_request_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r u2_role_probe.requests;
begin
  perform u2_role_probe.assert_backend_caller();
  select * into r from u2_role_probe.requests where session_id = p_session_id and request_id = p_request_id;
  if r.session_id is null or r.owner_uid <> p_caller_uid or not public.u2_role_probe_is_authorized(p_caller_uid, p_caller_uid)
     or clock_timestamp() >= r.response_expires_at then
    raise exception 'not found' using errcode = 'PT404';
  end if;
  return jsonb_build_object('status', r.status, 'httpStatus', r.http_status, 'body', r.response_body, 'responseExpiresAt', r.response_expires_at);
end $$;
alter function u2_role_probe.assert_backend_caller() owner to gptour_semantic_owner;
alter function public.u2_role_probe_internal(uuid,uuid,text,text,jsonb) owner to gptour_semantic_owner;
alter function public.u2_role_probe_read(uuid,uuid,text) owner to gptour_semantic_owner;
alter function public.u2_role_probe_is_authorized_ownerrole(uuid,uuid) owner to gptour_semantic_owner;

-- Privileges: nothing for PUBLIC/anon/authenticated/service_role; EXECUTE only for the backend role; column-level reads for the helper.
revoke all on all tables in schema u2_role_probe from public, anon, authenticated, service_role, gptour_semantic_backend;
revoke all on function public.u2_role_probe_internal(uuid,uuid,text,text,jsonb), public.u2_role_probe_read(uuid,uuid,text), public.u2_role_probe_is_authorized(uuid,uuid), public.u2_role_probe_is_authorized_ownerrole(uuid,uuid), u2_role_probe.assert_backend_caller(), u2_role_probe.enforce_write_once(), u2_role_probe.no_delete() from public, anon, authenticated, service_role, gptour_semantic_backend;  -- PUBLIC gets EXECUTE by default on every new function: revoked explicitly
grant execute on function public.u2_role_probe_internal(uuid,uuid,text,text,jsonb), public.u2_role_probe_read(uuid,uuid,text) to gptour_semantic_backend;
grant execute on function public.u2_role_probe_is_authorized(uuid,uuid), public.u2_role_probe_is_authorized_ownerrole(uuid,uuid) to gptour_semantic_owner;
-- minimal column reads for variant A (shown insufficient because of RLS); the backend role gets NO CRM grant at all
grant select (id, role, is_active) on public.profiles to gptour_semantic_owner;
grant select (user_id, enabled) on public.gptour_orchestrator_user_access to gptour_semantic_owner;
-- LAB ONLY: RLS policy so the writer role reaches the rows and the TRIGGER (not RLS/privileges) is what rejects the write
drop policy if exists lab_writer_all on u2_role_probe.requests;
create policy lab_writer_all on u2_role_probe.requests for all to u2_probe_writer using (true) with check (true);
-- LAB ONLY: a role WITH update privilege, to prove the trigger (never granted in production)
grant usage on schema u2_role_probe to u2_probe_writer;
grant select, update, delete on u2_role_probe.requests to u2_probe_writer;
insert into u2_role_probe.backend_keys(jti, not_after) values ('lab-key-1', clock_timestamp() + interval '1 day'), ('lab-key-expired', clock_timestamp() - interval '1 second') on conflict do nothing;
commit;
notify pgrst, 'reload schema';
