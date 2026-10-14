-- U2-b rev.2 — GPTour semantic persistence (PENDING: local lab only, never applied remotely). Idempotent on a fresh DB and over rev.1.
-- Plan rev.3 §U2-b/§5, privilege model rev.2 (docs/gptour-semantic/U2_B_PRIVILEGE_MODEL.md). Fase 4B/6, v7, U1, legacy policies untouched.
-- rev.2: plan identity (plan_id generated before any write, persisted in request/receipt/session/body), backend-only recovery RPC,
--        SQL-built terminal responses as canonical semantic-1.1 TurnResponse (policy mirror verified against errors.ts by the Deno bridge test).
begin;

-- ---------------------------------------------------------------- roles
do $$ begin
  if not exists (select 1 from pg_roles where rolname='gptour_semantic_owner') then
    create role gptour_semantic_owner nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole; end if;
  if not exists (select 1 from pg_roles where rolname='gptour_semantic_backend') then
    create role gptour_semantic_backend nologin noinherit nobypassrls nosuperuser nocreatedb nocreaterole; end if;
end $$;
grant gptour_semantic_backend to authenticator;
grant usage on schema public to gptour_semantic_owner, gptour_semantic_backend;
alter default privileges in schema public revoke all on tables from gptour_semantic_backend, gptour_semantic_owner;
alter default privileges in schema public revoke all on functions from gptour_semantic_backend, gptour_semantic_owner;

-- ---------------------------------------------------------------- tables (owner: gptour_semantic_owner)
create table if not exists public.gptour_semantic_backend_keys (jti text primary key, not_after timestamptz not null, revoked_at timestamptz, note text);
create table if not exists public.gptour_semantic_sessions (
  session_id uuid primary key default gen_random_uuid(),
  owner_uid uuid not null, agent_id uuid not null,
  revision int not null default 0 check (revision >= 0),
  state jsonb not null default '{}'::jsonb, operational jsonb not null default '{}'::jsonb,
  contract_version text not null, engine_version text not null,
  created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
  last_commit_at timestamptz, expires_at timestamptz not null default clock_timestamp() + interval '30 days',
  unique (session_id, owner_uid));
create table if not exists public.gptour_semantic_requests (
  session_id uuid not null, request_id text not null check (length(request_id) between 1 and 128), owner_uid uuid not null,
  payload_hash text not null check (length(payload_hash) = 64),
  status text not null default 'pending' check (status in ('pending','done','expired')),
  base_revision int not null check (base_revision >= 0),
  accepted_at timestamptz not null default clock_timestamp(),
  processing_deadline timestamptz not null, response_expires_at timestamptz not null,
  processing_attempts int not null default 1 check (processing_attempts >= 1),
  lease_token uuid, lease_until timestamptz, next_retry_at timestamptz,
  context jsonb, llm_output jsonb,
  llm_dispatches_reserved int not null default 0 check (llm_dispatches_reserved between 0 and 2),
  http_status int, outcome text, response_body text, final_revision int, last_error_code text, finalized_at timestamptz,
  primary key (session_id, request_id),
  foreign key (session_id, owner_uid) references public.gptour_semantic_sessions (session_id, owner_uid));
create table if not exists public.gptour_semantic_llm_invocations (
  session_id uuid not null, request_id text not null, invocation_id text not null check (length(invocation_id) between 1 and 128),
  ordinal int not null check (ordinal between 1 and 2), reserved_at timestamptz not null default clock_timestamp(),
  dispatch_observed_at timestamptz, outcome text,
  primary key (session_id, request_id, invocation_id), unique (session_id, request_id, ordinal),
  foreign key (session_id, request_id) references public.gptour_semantic_requests (session_id, request_id));
create table if not exists public.gptour_semantic_plans (
  plan_id uuid primary key default gen_random_uuid(),
  session_id uuid not null, owner_uid uuid not null, plan_revision int not null, plan jsonb not null,
  created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null default clock_timestamp() + interval '30 days',
  unique (session_id, plan_revision),
  foreign key (session_id, owner_uid) references public.gptour_semantic_sessions (session_id, owner_uid));
-- rev.2 plan identity: session reference (changes only with a new revision) and write-once request reference (set only at pending->done).
alter table public.gptour_semantic_sessions add column if not exists last_plan_id uuid;
alter table public.gptour_semantic_requests add column if not exists plan_id uuid;
alter table public.gptour_semantic_backend_keys owner to gptour_semantic_owner;
alter table public.gptour_semantic_sessions owner to gptour_semantic_owner;
alter table public.gptour_semantic_requests owner to gptour_semantic_owner;
alter table public.gptour_semantic_llm_invocations owner to gptour_semantic_owner;
alter table public.gptour_semantic_plans owner to gptour_semantic_owner;
alter table public.gptour_semantic_backend_keys enable row level security;
alter table public.gptour_semantic_sessions enable row level security;
alter table public.gptour_semantic_requests enable row level security;
alter table public.gptour_semantic_llm_invocations enable row level security;
alter table public.gptour_semantic_plans enable row level security;
-- NOTE: RLS is deny-all for non-owners; the owner (RPC execution context) bypasses it: protection inside RPCs = explicit checks.

-- ---------------------------------------------------------------- invariants (triggers, enforced for every role incl. service_role)
create or replace function public.gptour_semantic_tg_sessions() returns trigger language plpgsql as $$
begin
  if new.owner_uid <> old.owner_uid or new.agent_id <> old.agent_id or new.created_at <> old.created_at then raise exception 'session identity immutable' using errcode = 'U2W02'; end if;
  if new.revision not in (old.revision, old.revision + 1) then raise exception 'revision advances by exactly 1' using errcode = 'U2W08'; end if;
  if new.revision = old.revision and (new.state <> old.state or new.operational <> old.operational or new.last_plan_id is distinct from old.last_plan_id) then raise exception 'state changes only with a new revision' using errcode = 'U2W08'; end if;
  return new;
end $$;
create or replace function public.gptour_semantic_tg_requests() returns trigger language plpgsql as $$
declare terminal boolean := new.status in ('done','expired');
begin
  if new.owner_uid <> old.owner_uid or new.payload_hash <> old.payload_hash or new.base_revision <> old.base_revision
     or new.accepted_at <> old.accepted_at or new.processing_deadline <> old.processing_deadline or new.response_expires_at <> old.response_expires_at then
    raise exception 'request identity immutable' using errcode = 'U2W02'; end if;
  if old.status <> 'pending' and new.status = 'pending' then raise exception 'status cannot return to pending' using errcode = 'U2W01'; end if;
  if old.status = 'expired' and new.status <> 'expired' then raise exception 'tombstone is final' using errcode = 'U2W01'; end if;
  if new.processing_attempts < old.processing_attempts then raise exception 'processing_attempts monotonic' using errcode = 'U2W03'; end if;
  if new.llm_dispatches_reserved < old.llm_dispatches_reserved then raise exception 'budget monotonic' using errcode = 'U2W03'; end if;
  if old.status <> 'pending' and (new.lease_token is distinct from old.lease_token and new.lease_token is not null) then raise exception 'no lease after finalization' using errcode = 'U2W09'; end if;
  if old.context is null and new.context is not null and old.status <> 'pending' then raise exception 'context after finalization' using errcode = 'U2W04'; end if;
  if old.context is not null and new.context is not null and new.context <> old.context then raise exception 'context is write-once' using errcode = 'U2W04'; end if;
  if old.context is not null and new.context is null and not terminal then raise exception 'context cleared only at finalization' using errcode = 'U2W04'; end if;
  if old.llm_output is null and new.llm_output is not null and old.status <> 'pending' then raise exception 'output after finalization' using errcode = 'U2W05'; end if;
  if old.llm_output is not null and new.llm_output is not null and new.llm_output <> old.llm_output then raise exception 'output is write-once' using errcode = 'U2W05'; end if;
  if old.llm_output is not null and new.llm_output is null and not terminal then raise exception 'output cleared only at finalization' using errcode = 'U2W05'; end if;
  if (old.response_body is null and new.response_body is not null or old.http_status is null and new.http_status is not null) and not (old.status = 'pending' and new.status = 'done') then
    raise exception 'response only at pending->done' using errcode = 'U2W06'; end if;
  if old.response_body is not null and new.response_body is not null and new.response_body <> old.response_body then raise exception 'response is write-once' using errcode = 'U2W06'; end if;
  if old.response_body is not null and new.response_body is null and not (old.status = 'done' and new.status = 'expired' and clock_timestamp() >= old.response_expires_at) then
    raise exception 'response cleared only at expiry tombstone' using errcode = 'U2W06'; end if;
  if old.http_status is not null and new.http_status is distinct from old.http_status then raise exception 'http_status immutable' using errcode = 'U2W06'; end if;
  if old.outcome is not null and new.outcome is distinct from old.outcome then raise exception 'outcome immutable' using errcode = 'U2W06'; end if;
  if old.final_revision is not null and new.final_revision is distinct from old.final_revision then raise exception 'final_revision immutable' using errcode = 'U2W06'; end if;
  if new.status = 'done' and old.status = 'pending' and (new.http_status is null or new.outcome is null) then raise exception 'done requires http_status and outcome' using errcode = 'U2W06'; end if;
  if old.plan_id is null and new.plan_id is not null and not (old.status = 'pending' and new.status = 'done') then raise exception 'plan reference only at pending->done' using errcode = 'U2W06'; end if;
  if old.plan_id is not null and new.plan_id is distinct from old.plan_id then raise exception 'plan reference immutable' using errcode = 'U2W06'; end if;
  return new;
end $$;
create or replace function public.gptour_semantic_tg_invocations() returns trigger language plpgsql as $$
begin
  if new.reserved_at <> old.reserved_at or new.ordinal <> old.ordinal then raise exception 'reservation immutable' using errcode = 'U2W10'; end if;
  return new;
end $$;
create or replace function public.gptour_semantic_tg_plans() returns trigger language plpgsql as $$
begin raise exception 'plans are immutable' using errcode = 'U2W11'; end $$;
-- Physical deletion is reserved to the future maintenance RPC executing as the owner (§5); nobody else, service_role included.
create or replace function public.gptour_semantic_tg_no_delete() returns trigger language plpgsql as $$
begin
  if current_user <> 'gptour_semantic_owner' then raise exception 'deletion only through owner maintenance' using errcode = 'U2W07'; end if;
  return old;
end $$;
drop trigger if exists gptour_semantic_sessions_guard on public.gptour_semantic_sessions;
create trigger gptour_semantic_sessions_guard before update on public.gptour_semantic_sessions for each row execute function public.gptour_semantic_tg_sessions();
drop trigger if exists gptour_semantic_requests_guard on public.gptour_semantic_requests;
create trigger gptour_semantic_requests_guard before update on public.gptour_semantic_requests for each row execute function public.gptour_semantic_tg_requests();
drop trigger if exists gptour_semantic_invocations_guard on public.gptour_semantic_llm_invocations;
create trigger gptour_semantic_invocations_guard before update on public.gptour_semantic_llm_invocations for each row execute function public.gptour_semantic_tg_invocations();
drop trigger if exists gptour_semantic_plans_guard on public.gptour_semantic_plans;
create trigger gptour_semantic_plans_guard before update on public.gptour_semantic_plans for each row execute function public.gptour_semantic_tg_plans();
do $$ declare t text; begin
  foreach t in array array['gptour_semantic_sessions','gptour_semantic_requests','gptour_semantic_llm_invocations','gptour_semantic_plans','gptour_semantic_backend_keys'] loop
    execute format('drop trigger if exists gptour_semantic_no_delete on public.%I', t);
    execute format('create trigger gptour_semantic_no_delete before delete on public.%I for each row execute function public.gptour_semantic_tg_no_delete()', t);
  end loop; end $$;

-- ---------------------------------------------------------------- caller check and authorization helper
create or replace function public.gptour_semantic_assert_backend() returns void language plpgsql security definer set search_path = '' as $$
declare claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb; k record;
begin
  if claims->>'role' is distinct from 'gptour_semantic_backend' or current_setting('role', true) is distinct from 'gptour_semantic_backend' then
    raise exception 'backend credential required' using errcode = '42501'; end if;
  select * into k from public.gptour_semantic_backend_keys b where b.jti = claims->>'jti';
  if k.jti is null or k.revoked_at is not null or clock_timestamp() >= k.not_after then raise exception 'backend key unknown, revoked or expired' using errcode = '42501'; end if;
end $$;
-- Owned by the migration role (owner of profiles/user_access): explicit-uid authorization incl. Fase 6 kill-switch.
create or replace function public.gptour_semantic_is_authorized(p_uid uuid, p_agent_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select p_uid is not null and p_agent_id is not null and exists (
    select 1 from public.profiles p where p.id = p_uid and p.is_active and p.role in ('agent','admin','admincustom','supervisor')
      and (p_agent_id = p_uid or p.role in ('admin','admincustom')))
    and coalesce((select a.enabled from public.gptour_orchestrator_user_access a where a.user_id = p_uid), false)
$$;

-- ---------------------------------------------------------------- RPC (owner: gptour_semantic_owner; EXECUTE: backend only)
create or replace function public.gptour_semantic_create_session(p_caller_uid uuid, p_agent_id uuid, p_contract_version text, p_engine_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.gptour_semantic_sessions;
begin
  perform public.gptour_semantic_assert_backend();
  if not public.gptour_semantic_is_authorized(p_caller_uid, p_agent_id) then raise exception 'agent not authorized' using errcode = 'PT403'; end if;
  insert into public.gptour_semantic_sessions (owner_uid, agent_id, contract_version, engine_version) values (p_caller_uid, p_agent_id, p_contract_version, p_engine_version) returning * into s;
  return jsonb_build_object('sessionId', s.session_id, 'agentId', s.agent_id, 'revision', s.revision, 'expiresAt', public.gptour_semantic_ts(s.expires_at));
end $$;

-- Locks the session (lock order: session -> request), enforces ownership, current authorization and logical expiry.
create or replace function public.gptour_semantic_lock_session(p_caller_uid uuid, p_session_id uuid) returns public.gptour_semantic_sessions
language plpgsql security definer set search_path = '' as $$
declare s public.gptour_semantic_sessions; now_ts timestamptz;
begin
  select * into s from public.gptour_semantic_sessions where session_id = p_session_id for update;
  now_ts := clock_timestamp();
  if s.session_id is null or s.owner_uid <> p_caller_uid or not public.gptour_semantic_is_authorized(p_caller_uid, s.agent_id) then raise exception 'not found' using errcode = 'PT404'; end if;
  if now_ts >= s.expires_at or (s.last_commit_at is null and now_ts >= s.created_at + interval '24 hours'
       and not exists (select 1 from public.gptour_semantic_requests r where r.session_id = s.session_id)) then
    raise exception 'session expired' using errcode = 'PT410'; end if;
  return s;
end $$;

-- Contract timestamps (semantic-1.1 `isTimestamp`): UTC, milliseconds, 'Z'.
create or replace function public.gptour_semantic_ts(t timestamptz) returns text language sql immutable set search_path = '' as $$
  select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;
-- Mirror of ERROR_POLICIES (gptour-semantic-transport/errors.ts) for the ONLY codes the SQL layer emits by itself;
-- equality with errors.ts is asserted by tests/gptour-semantic/u2/u2b/contract_bridge.unit.ts (Deno). Other codes stay handler-owned.
create or replace function public.gptour_semantic_error_policy(p_code text) returns jsonb language sql immutable set search_path = '' as $$
  select case p_code
    when 'processing_expired' then jsonb_build_object('httpStatus', 503, 'outcome', 'committed', 'retryableSameRequest', false, 'nextAction', 'get_state_and_confirm', 'userConfirmation', true)
    when 'revision_conflict'  then jsonb_build_object('httpStatus', 409, 'outcome', 'committed', 'retryableSameRequest', false, 'nextAction', 'get_state_and_confirm', 'userConfirmation', true)
  end $$;
-- Canonical TurnResponse for SQL-built terminal outcomes: no result/gate/plan, commit metadata from the accepted request.
create or replace function public.gptour_semantic_terminal_turn(r public.gptour_semantic_requests, s public.gptour_semantic_sessions, p_code text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare pol jsonb := public.gptour_semantic_error_policy(p_code);
begin
  if pol is null then raise exception 'no SQL policy for %', p_code using errcode = 'U2W12'; end if;
  return jsonb_build_object('operation', 'turn', 'contractVersion', s.contract_version, 'engineVersion', s.engine_version, 'sessionId', s.session_id, 'requestId', r.request_id,
    'sessionRevision', s.revision, 'outcome', pol->>'outcome', 'errorCode', p_code, 'retryableSameRequest', (pol->>'retryableSameRequest')::boolean, 'nextAction', pol->>'nextAction',
    'retryAfterMs', null, 'acceptedAt', public.gptour_semantic_ts(r.accepted_at), 'responseExpiresAt', public.gptour_semantic_ts(r.response_expires_at),
    'result', null, 'gate', null, 'plan', null, 'openQuestions', '[]'::jsonb, 'openQuestionCount', 0, 'notApplied', '[]'::jsonb, 'dataQuality', null);
end $$;
-- Handler-built terminal body: must already be a semantic-1.1 TurnResponse for THIS session/request; identity, revision and
-- commit metadata are stamped from the persisted rows so the stored response can be returned to the client as-is on replay.
create or replace function public.gptour_semantic_align_body(p_body jsonb, r public.gptour_semantic_requests, s public.gptour_semantic_sessions, p_revision int) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare b jsonb := p_body;
begin
  if b is null or jsonb_typeof(b) <> 'object' or b->>'operation' is distinct from 'turn' or b->>'contractVersion' is distinct from s.contract_version
     or b->>'sessionId' is distinct from s.session_id::text or b->>'requestId' is distinct from r.request_id
     or b->>'outcome' is null or b->>'outcome' = 'not_accepted' or not (b ? 'errorCode') or not (b ? 'nextAction') or not (b ? 'retryableSameRequest') then
    raise exception 'body not aligned with the semantic contract for this request' using errcode = 'PT422'; end if;
  b := b || jsonb_build_object('engineVersion', s.engine_version, 'sessionRevision', p_revision,
    'acceptedAt', public.gptour_semantic_ts(r.accepted_at), 'responseExpiresAt', public.gptour_semantic_ts(r.response_expires_at));
  if jsonb_typeof(b->'result') = 'object' then
    b := jsonb_set(jsonb_set(jsonb_set(b, '{result,revision}', to_jsonb(p_revision)), '{result,sessionId}', to_jsonb(s.session_id::text)), '{result,requestId}', to_jsonb(r.request_id)); end if;
  return b;
end $$;

create or replace function public.gptour_semantic_receipt(r public.gptour_semantic_requests) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('requestId', r.request_id, 'status', r.status, 'httpStatus', r.http_status, 'requestOutcome', r.outcome, 'body', r.response_body,
    'baseRevision', r.base_revision, 'finalRevision', r.final_revision, 'planId', r.plan_id, 'acceptedAt', public.gptour_semantic_ts(r.accepted_at),
    'processingDeadline', public.gptour_semantic_ts(r.processing_deadline), 'responseExpiresAt', public.gptour_semantic_ts(r.response_expires_at), 'llmDispatchesReserved', r.llm_dispatches_reserved)
$$;

create or replace function public.gptour_semantic_claim(p_caller_uid uuid, p_session_id uuid, p_request_id text, p_payload_hash text, p_expected_revision int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.gptour_semantic_sessions; r public.gptour_semantic_requests; now_ts timestamptz; tok uuid;
begin
  perform public.gptour_semantic_assert_backend();
  s := public.gptour_semantic_lock_session(p_caller_uid, p_session_id);
  select * into r from public.gptour_semantic_requests where session_id = p_session_id and request_id = p_request_id for update;
  now_ts := clock_timestamp();
  if r.session_id is null then
    tok := gen_random_uuid();
    insert into public.gptour_semantic_requests (session_id, request_id, owner_uid, payload_hash, base_revision, accepted_at, processing_deadline, response_expires_at, lease_token, lease_until)
      values (p_session_id, p_request_id, p_caller_uid, p_payload_hash, p_expected_revision, now_ts, now_ts + interval '5 minutes', now_ts + interval '7 days', tok, now_ts + interval '45 seconds') returning * into r;
    return jsonb_build_object('outcome', 'new', 'token', tok, 'currentRevision', s.revision) || public.gptour_semantic_receipt(r);
  end if;
  if r.payload_hash <> p_payload_hash then return jsonb_build_object('outcome', 'reused', 'currentRevision', s.revision) || public.gptour_semantic_receipt(r); end if;
  if r.status = 'expired' or now_ts >= r.response_expires_at then
    if r.status = 'done' then update public.gptour_semantic_requests set status = 'expired', response_body = null where session_id = r.session_id and request_id = r.request_id returning * into r; end if;
    return jsonb_build_object('outcome', 'expired', 'currentRevision', s.revision) || public.gptour_semantic_receipt(r);
  end if;
  if r.status = 'done' then return jsonb_build_object('outcome', 'cached', 'currentRevision', s.revision) || public.gptour_semantic_receipt(r); end if;
  if now_ts >= r.processing_deadline then
    update public.gptour_semantic_requests set status = 'done', http_status = 503, outcome = 'processing_expired', response_body = public.gptour_semantic_terminal_turn(r, s, 'processing_expired')::text,
      final_revision = s.revision, finalized_at = now_ts, lease_token = null, lease_until = null, next_retry_at = null, context = null, llm_output = null, last_error_code = 'processing_expired'
      where session_id = r.session_id and request_id = r.request_id returning * into r;
    return jsonb_build_object('outcome', 'deadline_finalized', 'currentRevision', s.revision) || public.gptour_semantic_receipt(r);
  end if;
  if (r.lease_until is not null and r.lease_until > now_ts) or (r.next_retry_at is not null and r.next_retry_at > now_ts) then
    return jsonb_build_object('outcome', 'in_progress', 'currentRevision', s.revision,
      'retryAfterMs', greatest(250, (extract(epoch from greatest(coalesce(r.lease_until, now_ts), coalesce(r.next_retry_at, now_ts)) - now_ts) * 1000)::int)) || public.gptour_semantic_receipt(r);
  end if;
  tok := gen_random_uuid();
  update public.gptour_semantic_requests set lease_token = tok, lease_until = now_ts + interval '45 seconds', next_retry_at = null, processing_attempts = processing_attempts + 1
    where session_id = r.session_id and request_id = r.request_id returning * into r;
  return jsonb_build_object('outcome', 'takeover', 'token', tok, 'currentRevision', s.revision, 'processingAttempts', r.processing_attempts) || public.gptour_semantic_receipt(r);
end $$;

-- Fencing: pending request, current token, live lease, deadline not reached. Returns the locked row.
create or replace function public.gptour_semantic_lock_fenced(p_caller_uid uuid, p_session_id uuid, p_request_id text, p_token uuid) returns public.gptour_semantic_requests
language plpgsql security definer set search_path = '' as $$
declare r public.gptour_semantic_requests; now_ts timestamptz;
begin
  perform public.gptour_semantic_lock_session(p_caller_uid, p_session_id);
  select * into r from public.gptour_semantic_requests where session_id = p_session_id and request_id = p_request_id for update;
  now_ts := clock_timestamp();
  if r.session_id is null then raise exception 'not found' using errcode = 'PT404'; end if;
  if r.status <> 'pending' then raise exception 'request already finalized' using errcode = 'PT409'; end if;
  if p_token is null or r.lease_token is distinct from p_token then raise exception 'stale or unknown token' using errcode = 'PT409'; end if;
  if r.lease_until is null or now_ts >= r.lease_until or now_ts >= r.processing_deadline then raise exception 'lease or deadline expired' using errcode = 'PT409'; end if;
  return r;
end $$;

create or replace function public.gptour_semantic_renew_lease(p_caller_uid uuid, p_session_id uuid, p_request_id text, p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.gptour_semantic_requests;
begin
  perform public.gptour_semantic_assert_backend();
  r := public.gptour_semantic_lock_fenced(p_caller_uid, p_session_id, p_request_id, p_token);
  update public.gptour_semantic_requests set lease_until = least(clock_timestamp() + interval '45 seconds', r.processing_deadline) where session_id = r.session_id and request_id = r.request_id returning * into r;
  return jsonb_build_object('ok', true, 'leaseUntil', r.lease_until, 'processingDeadline', r.processing_deadline);
end $$;

create or replace function public.gptour_semantic_store_context(p_caller_uid uuid, p_session_id uuid, p_request_id text, p_token uuid, p_context jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.gptour_semantic_requests;
begin
  perform public.gptour_semantic_assert_backend();
  r := public.gptour_semantic_lock_fenced(p_caller_uid, p_session_id, p_request_id, p_token);
  if r.context is not null then return jsonb_build_object('ok', true, 'alreadyStored', true); end if;
  if p_context is null then raise exception 'context required' using errcode = 'PT422'; end if;
  update public.gptour_semantic_requests set context = p_context where session_id = r.session_id and request_id = r.request_id;
  return jsonb_build_object('ok', true, 'alreadyStored', false);
end $$;

create or replace function public.gptour_semantic_begin_llm(p_caller_uid uuid, p_session_id uuid, p_request_id text, p_token uuid, p_invocation_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.gptour_semantic_requests;
begin
  perform public.gptour_semantic_assert_backend();
  r := public.gptour_semantic_lock_fenced(p_caller_uid, p_session_id, p_request_id, p_token);
  if r.context is null then raise exception 'context must be stored before any reservation' using errcode = 'PT409'; end if;
  if exists (select 1 from public.gptour_semantic_llm_invocations i where i.session_id = r.session_id and i.request_id = r.request_id and i.invocation_id = p_invocation_id) then
    return jsonb_build_object('mayDispatch', false, 'alreadyReserved', true, 'reserved', r.llm_dispatches_reserved); end if;
  if r.llm_output is not null then return jsonb_build_object('mayDispatch', false, 'outputStored', true, 'reserved', r.llm_dispatches_reserved); end if;
  if r.llm_dispatches_reserved >= 2 then return jsonb_build_object('mayDispatch', false, 'budgetExhausted', true, 'reserved', r.llm_dispatches_reserved); end if;
  insert into public.gptour_semantic_llm_invocations (session_id, request_id, invocation_id, ordinal) values (r.session_id, r.request_id, p_invocation_id, r.llm_dispatches_reserved + 1);
  update public.gptour_semantic_requests set llm_dispatches_reserved = llm_dispatches_reserved + 1 where session_id = r.session_id and request_id = r.request_id returning * into r;
  return jsonb_build_object('mayDispatch', true, 'alreadyReserved', false, 'reserved', r.llm_dispatches_reserved);
end $$;

create or replace function public.gptour_semantic_store_llm(p_caller_uid uuid, p_session_id uuid, p_request_id text, p_token uuid, p_invocation_id text, p_output jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.gptour_semantic_requests;
begin
  perform public.gptour_semantic_assert_backend();
  r := public.gptour_semantic_lock_fenced(p_caller_uid, p_session_id, p_request_id, p_token);
  if not exists (select 1 from public.gptour_semantic_llm_invocations i where i.session_id = r.session_id and i.request_id = r.request_id and i.invocation_id = p_invocation_id) then
    raise exception 'output without reservation' using errcode = 'PT409'; end if;
  if r.llm_output is not null then return jsonb_build_object('ok', true, 'alreadyStored', true); end if;
  if p_output is null then raise exception 'output required' using errcode = 'PT422'; end if;
  update public.gptour_semantic_requests set llm_output = p_output where session_id = r.session_id and request_id = r.request_id;
  update public.gptour_semantic_llm_invocations set dispatch_observed_at = coalesce(dispatch_observed_at, clock_timestamp()), outcome = 'stored' where session_id = r.session_id and request_id = r.request_id and invocation_id = p_invocation_id;
  return jsonb_build_object('ok', true, 'alreadyStored', false);
end $$;

-- One applicative transition per accepted request; final conflict committed as a 409 receipt (returned, not raised).
-- rev.2: plan_id generated BEFORE any write and stamped into body.plan.planId, plans.plan_id, requests.plan_id, sessions.last_plan_id/operational.
-- Write order: session UPDATE -> plan INSERT -> request finalization; all-or-nothing (T06 verified with a lab-injected fault after the session UPDATE).
drop function if exists public.gptour_semantic_commit_success(uuid,uuid,text,uuid,jsonb,jsonb,jsonb,int,text,text);
create or replace function public.gptour_semantic_commit_success(p_caller_uid uuid, p_session_id uuid, p_request_id text, p_token uuid, p_new_state jsonb, p_operational jsonb, p_plan jsonb, p_body jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.gptour_semantic_sessions; r public.gptour_semantic_requests; now_ts timestamptz; pid uuid; new_rev int; body jsonb; plan jsonb;
begin
  perform public.gptour_semantic_assert_backend();
  r := public.gptour_semantic_lock_fenced(p_caller_uid, p_session_id, p_request_id, p_token);
  select * into s from public.gptour_semantic_sessions where session_id = p_session_id;  -- already locked FOR UPDATE by lock_fenced -> lock_session
  now_ts := clock_timestamp();
  if s.revision <> r.base_revision then
    update public.gptour_semantic_requests set status = 'done', http_status = 409, outcome = 'revision_conflict', response_body = public.gptour_semantic_terminal_turn(r, s, 'revision_conflict')::text,
      final_revision = s.revision, finalized_at = now_ts, lease_token = null, lease_until = null, next_retry_at = null, context = null, llm_output = null
      where session_id = r.session_id and request_id = r.request_id returning * into r;
    return jsonb_build_object('outcome', 'revision_conflict', 'revision', s.revision) || public.gptour_semantic_receipt(r);
  end if;
  if p_new_state is null then raise exception 'state required' using errcode = 'PT422'; end if;
  new_rev := s.revision + 1;
  body := public.gptour_semantic_align_body(p_body, r, s, new_rev);
  if body->>'outcome' <> 'committed' or body->>'errorCode' is not null then raise exception 'commit_success requires a committed body without errorCode' using errcode = 'PT422'; end if;
  if p_plan is not null then
    if jsonb_typeof(p_plan) <> 'object' or body->>'gate' is distinct from 'planned' then raise exception 'plan requires gate planned' using errcode = 'PT422'; end if;
    pid := gen_random_uuid();
    plan := p_plan || jsonb_build_object('planId', pid::text, 'sessionId', s.session_id::text, 'sessionRevision', new_rev);
    body := body || jsonb_build_object('plan', plan);
  elsif jsonb_typeof(body->'plan') = 'object' or body->>'gate' = 'planned' then
    raise exception 'a plan in the body must be persisted through p_plan' using errcode = 'PT422';
  end if;
  update public.gptour_semantic_sessions set revision = new_rev, state = p_new_state,
    operational = coalesce(p_operational, operational) || case when pid is null then '{}'::jsonb else jsonb_build_object('lastPlanId', pid::text, 'planRevision', new_rev) end,
    last_plan_id = coalesce(pid, last_plan_id), updated_at = now_ts, last_commit_at = now_ts, expires_at = now_ts + interval '30 days' where session_id = s.session_id returning * into s;
  if pid is not null then
    insert into public.gptour_semantic_plans (plan_id, session_id, owner_uid, plan_revision, plan, expires_at) values (pid, s.session_id, s.owner_uid, new_rev, plan, least(now_ts + interval '30 days', s.expires_at));
  end if;
  update public.gptour_semantic_requests set status = 'done', http_status = 200, outcome = 'committed', response_body = body::text, final_revision = new_rev, plan_id = pid,
    finalized_at = now_ts, lease_token = null, lease_until = null, next_retry_at = null, context = null, llm_output = null
    where session_id = r.session_id and request_id = r.request_id returning * into r;
  return jsonb_build_object('outcome', 'committed', 'revision', new_rev, 'planId', pid) || public.gptour_semantic_receipt(r);
end $$;

-- Request-only terminal error: body is a handler-built TurnResponse (policy stays handler-owned); identity/metadata stamped from the rows.
drop function if exists public.gptour_semantic_finish_error(uuid,uuid,text,uuid,int,text,text,text);
create or replace function public.gptour_semantic_finish_error(p_caller_uid uuid, p_session_id uuid, p_request_id text, p_token uuid, p_http_status int, p_body jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.gptour_semantic_sessions; r public.gptour_semantic_requests; body jsonb;
begin
  perform public.gptour_semantic_assert_backend();
  r := public.gptour_semantic_lock_fenced(p_caller_uid, p_session_id, p_request_id, p_token);
  select * into s from public.gptour_semantic_sessions where session_id = p_session_id;
  if p_http_status is null or p_http_status not between 400 and 599 then raise exception 'error http status required' using errcode = 'PT422'; end if;
  body := public.gptour_semantic_align_body(p_body, r, s, s.revision);
  if body->>'errorCode' is null or coalesce(body->'gate', 'null'::jsonb) <> 'null'::jsonb or coalesce(body->'plan', 'null'::jsonb) <> 'null'::jsonb
     or (jsonb_typeof(body->'result') = 'object' and body->'result'->>'status' is distinct from 'error') then
    raise exception 'finish_error requires an errorCode without gate/plan' using errcode = 'PT422'; end if;
  update public.gptour_semantic_requests set status = 'done', http_status = p_http_status, outcome = body->>'errorCode', response_body = body::text, last_error_code = body->>'errorCode', final_revision = s.revision,
    finalized_at = clock_timestamp(), lease_token = null, lease_until = null, next_retry_at = null, context = null, llm_output = null
    where session_id = r.session_id and request_id = r.request_id returning * into r;
  return jsonb_build_object('outcome', 'finished_error') || public.gptour_semantic_receipt(r);
end $$;

-- Backend-only internal recovery for the CURRENT lease holder (ownership, authorization, token, lease and deadline re-verified):
-- returns the persisted interpretive context and LLM output so a takeover never re-dispatches. Distinct from public projections.
create or replace function public.gptour_semantic_recover_work(p_caller_uid uuid, p_session_id uuid, p_request_id text, p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.gptour_semantic_requests;
begin
  perform public.gptour_semantic_assert_backend();
  r := public.gptour_semantic_lock_fenced(p_caller_uid, p_session_id, p_request_id, p_token);
  return jsonb_build_object('requestId', r.request_id, 'baseRevision', r.base_revision, 'processingAttempts', r.processing_attempts,
    'processingDeadline', public.gptour_semantic_ts(r.processing_deadline), 'leaseUntil', public.gptour_semantic_ts(r.lease_until),
    'llmDispatchesReserved', r.llm_dispatches_reserved, 'context', r.context, 'llmOutput', r.llm_output,
    'invocations', coalesce((select jsonb_agg(jsonb_build_object('invocationId', i.invocation_id, 'ordinal', i.ordinal, 'outcome', i.outcome) order by i.ordinal)
      from public.gptour_semantic_llm_invocations i where i.session_id = r.session_id and i.request_id = r.request_id), '[]'::jsonb));
end $$;

create or replace function public.gptour_semantic_release_recoverable(p_caller_uid uuid, p_session_id uuid, p_request_id text, p_token uuid, p_error_code text, p_retry_after_ms int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.gptour_semantic_requests;
begin
  perform public.gptour_semantic_assert_backend();
  r := public.gptour_semantic_lock_fenced(p_caller_uid, p_session_id, p_request_id, p_token);
  -- backoff is a server value bounded by the processing deadline (never a client-controlled or unbounded delay)
  update public.gptour_semantic_requests set lease_until = clock_timestamp(),
    next_retry_at = least(clock_timestamp() + make_interval(secs => least(greatest(coalesce(p_retry_after_ms, 0), 0), 60000) / 1000.0), r.processing_deadline), last_error_code = p_error_code
    where session_id = r.session_id and request_id = r.request_id returning * into r;
  return jsonb_build_object('ok', true, 'nextRetryAt', r.next_retry_at, 'status', r.status);
end $$;

-- Public-contract projections (backend only): never lease/context/output/hash; current authorization and expiry applied.
create or replace function public.gptour_semantic_get_state(p_caller_uid uuid, p_session_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.gptour_semantic_sessions;
begin
  perform public.gptour_semantic_assert_backend();
  s := public.gptour_semantic_lock_session(p_caller_uid, p_session_id);
  return jsonb_build_object('sessionId', s.session_id, 'agentId', s.agent_id, 'revision', s.revision, 'state', s.state, 'operational', s.operational, 'lastPlanId', s.last_plan_id,
    'contractVersion', s.contract_version, 'expiresAt', public.gptour_semantic_ts(s.expires_at), 'lastCommitAt', public.gptour_semantic_ts(s.last_commit_at));
end $$;
create or replace function public.gptour_semantic_get_request(p_caller_uid uuid, p_session_id uuid, p_request_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.gptour_semantic_requests;
begin
  perform public.gptour_semantic_assert_backend();
  perform public.gptour_semantic_lock_session(p_caller_uid, p_session_id);
  select * into r from public.gptour_semantic_requests where session_id = p_session_id and request_id = p_request_id;
  if r.session_id is null then raise exception 'not found' using errcode = 'PT404'; end if;
  if r.status = 'expired' or clock_timestamp() >= r.response_expires_at then raise exception 'request expired' using errcode = 'PT410'; end if;
  return public.gptour_semantic_receipt(r);
end $$;
create or replace function public.gptour_semantic_get_plan(p_caller_uid uuid, p_plan_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.gptour_semantic_plans;
begin
  perform public.gptour_semantic_assert_backend();
  select * into p from public.gptour_semantic_plans where plan_id = p_plan_id;
  if p.plan_id is null or p.owner_uid <> p_caller_uid then raise exception 'not found' using errcode = 'PT404'; end if;
  perform public.gptour_semantic_lock_session(p_caller_uid, p.session_id);
  if clock_timestamp() >= p.expires_at then raise exception 'plan expired' using errcode = 'PT410'; end if;
  return jsonb_build_object('planId', p.plan_id, 'sessionId', p.session_id, 'planRevision', p.plan_revision, 'plan', p.plan, 'createdAt', public.gptour_semantic_ts(p.created_at), 'expiresAt', public.gptour_semantic_ts(p.expires_at));
end $$;

-- ---------------------------------------------------------------- ownership and privileges
do $$ declare f text; begin
  foreach f in array array['gptour_semantic_tg_sessions()','gptour_semantic_tg_requests()','gptour_semantic_tg_invocations()','gptour_semantic_tg_plans()','gptour_semantic_tg_no_delete()',
    'gptour_semantic_assert_backend()','gptour_semantic_create_session(uuid,uuid,text,text)','gptour_semantic_lock_session(uuid,uuid)','gptour_semantic_receipt(public.gptour_semantic_requests)',
    'gptour_semantic_ts(timestamptz)','gptour_semantic_error_policy(text)','gptour_semantic_terminal_turn(public.gptour_semantic_requests,public.gptour_semantic_sessions,text)',
    'gptour_semantic_align_body(jsonb,public.gptour_semantic_requests,public.gptour_semantic_sessions,int)',
    'gptour_semantic_claim(uuid,uuid,text,text,int)','gptour_semantic_lock_fenced(uuid,uuid,text,uuid)','gptour_semantic_renew_lease(uuid,uuid,text,uuid)',
    'gptour_semantic_store_context(uuid,uuid,text,uuid,jsonb)','gptour_semantic_begin_llm(uuid,uuid,text,uuid,text)','gptour_semantic_store_llm(uuid,uuid,text,uuid,text,jsonb)',
    'gptour_semantic_commit_success(uuid,uuid,text,uuid,jsonb,jsonb,jsonb,jsonb)','gptour_semantic_finish_error(uuid,uuid,text,uuid,int,jsonb)','gptour_semantic_recover_work(uuid,uuid,text,uuid)',
    'gptour_semantic_release_recoverable(uuid,uuid,text,uuid,text,int)','gptour_semantic_get_state(uuid,uuid)','gptour_semantic_get_request(uuid,uuid,text)','gptour_semantic_get_plan(uuid,uuid)'] loop
    execute format('alter function public.%s owner to gptour_semantic_owner', f);
    execute format('revoke all on function public.%s from public, anon, authenticated, service_role, gptour_semantic_backend', f);
  end loop;
  foreach f in array array['gptour_semantic_create_session(uuid,uuid,text,text)','gptour_semantic_claim(uuid,uuid,text,text,int)','gptour_semantic_renew_lease(uuid,uuid,text,uuid)',
    'gptour_semantic_store_context(uuid,uuid,text,uuid,jsonb)','gptour_semantic_begin_llm(uuid,uuid,text,uuid,text)','gptour_semantic_store_llm(uuid,uuid,text,uuid,text,jsonb)',
    'gptour_semantic_commit_success(uuid,uuid,text,uuid,jsonb,jsonb,jsonb,jsonb)','gptour_semantic_finish_error(uuid,uuid,text,uuid,int,jsonb)','gptour_semantic_recover_work(uuid,uuid,text,uuid)',
    'gptour_semantic_release_recoverable(uuid,uuid,text,uuid,text,int)','gptour_semantic_get_state(uuid,uuid)','gptour_semantic_get_request(uuid,uuid,text)','gptour_semantic_get_plan(uuid,uuid)'] loop
    execute format('grant execute on function public.%s to gptour_semantic_backend', f);
  end loop;
end $$;
revoke all on function public.gptour_semantic_is_authorized(uuid,uuid) from public, anon, authenticated, service_role, gptour_semantic_backend;
grant execute on function public.gptour_semantic_is_authorized(uuid,uuid) to gptour_semantic_owner;
revoke all on public.gptour_semantic_sessions, public.gptour_semantic_requests, public.gptour_semantic_llm_invocations, public.gptour_semantic_plans, public.gptour_semantic_backend_keys
  from public, anon, authenticated, service_role, gptour_semantic_backend;
commit;
notify pgrst, 'reload schema';
