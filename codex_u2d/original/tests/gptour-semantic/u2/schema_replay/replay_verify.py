#!/usr/bin/env python3
"""SQL/RLS verification against the REPLAYED realistic schema (real policies, functions, triggers, Fase 4B/6, catalog scope).

Two channels: psql with `set role` + request.jwt.claims (hosted semantics) and PostgREST HTTP with synthetic HS256 JWTs.
JWTs are generated in memory and never printed. Assertions use exact key sets, not counts alone.
Writes <root>/verify_report.json.
"""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import subprocess
import time
from replay_common import settings, psql, sql
from lab_common import pg_run, local_http

root, meta = settings()
key = (root / 'jwt.secret').read_bytes()
A = 'a0000000-0000-4000-8000-00000000000a'
B = 'b0000000-0000-4000-8000-00000000000b'
C = 'c0000000-0000-4000-8000-00000000000c'
D = 'd0000000-0000-4000-8000-00000000000d'
E = 'e0000000-0000-4000-8000-00000000000e'
cust = lambda i: f'11111111-0000-4000-8000-{i:012d}'
custB = lambda i: f'22222222-0000-4000-8000-{i:012d}'
tab = lambda i: f'33333333-0000-4000-8000-{i:012d}'
results = []


def check(ok, section, label, detail=''):
    results.append({'section': section, 'label': label, 'status': 'PASS' if ok else 'FAIL', 'detail': detail[:200]})
    print(('PASS ' if ok else 'FAIL ') + f'[{section}] {label}' + (f' :: {detail[:160]}' if not ok and detail else ''))


def as_user(uid, role, statement, claims_extra=None, commit=True):
    """Run one statement as PostgREST would (role + claims). Returns (ok, text). commit=False rolls back (probe only)."""
    claims = {'role': role}
    if uid:
        claims['sub'] = uid
    if claims_extra:
        claims.update(claims_extra)
    script = (f"begin; set local role {role}; select set_config('request.jwt.claims', '{json.dumps(claims)}', true);\n"
              f"\\echo __OUT__\n{statement};\n{'commit' if commit else 'rollback'};")
    try:
        out = pg_run(psql(root, meta) + ['-At'], input=script.encode()).stdout.decode()
        return True, out.split('__OUT__\n', 1)[1].strip()
    except subprocess.CalledProcessError as error:
        text = error.stderr.decode(errors='replace')
        return False, text.split('ERROR:', 1)[1].strip().splitlines()[0] if 'ERROR:' in text else text.strip()[-200:]


def ids_as(uid, role, query):
    ok, out = as_user(uid, role, query)
    return set(out.splitlines()) if ok else {'ERROR:' + out}


def jwt(sub=A, role='authenticated', expires=600, secret=key, audience='authenticated', email=None, user_metadata=None):
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b'=')
    now = int(time.time())
    payload = {'sub': sub, 'role': role, 'aud': audience, 'iat': now - 120, 'exp': now + expires}
    if email:
        payload['email'] = email
    if user_metadata is not None:
        payload['user_metadata'] = user_metadata
    header = b64(json.dumps({'alg': 'HS256', 'typ': 'JWT'}, separators=(',', ':')).encode())
    body = b64(json.dumps(payload, separators=(',', ':')).encode())
    content = header + b'.' + body
    return (content + b'.' + b64(hmac.new(secret, content, hashlib.sha256).digest())).decode()


def http(path, token=None, method='GET', body=None):
    status, data = local_http(meta, path, token=token, method=method, body=body)
    try:
        return status, json.loads(data) if data else None
    except ValueError:
        return status, None


# make the suite re-runnable on the same lab: remove only rows created by previous verify runs (synthetic lab data)
sql(root, meta, f"delete from public.gptour_orchestrator_sessions where session_id in ('s1','s2','s3','h1'); delete from public.gptour_orchestrator_access_audit; delete from public.gptour_orchestrator_user_access; delete from public.ai_tours where agent_id = '{A}'")

# ---------------------------------------------------------------- S1 structure
S = 'S1-struttura'
for t, cols in {'gptour_orchestrator_sessions': 'session_id,owner_uid,agent_id,revision,state,created_at,updated_at',
                'gptour_orchestrator_plans': 'plan_id,session_id,owner_uid,revision,plan,created_at',
                'gptour_orchestrator_requests': 'session_id,request_id,owner_uid,response,created_at',
                'gptour_orchestrator_user_access': 'user_id,enabled,note,updated_at,updated_by',
                'gptour_orchestrator_access_audit': 'id,user_id,enabled,previous_enabled,action,reason,changed_by,changed_at'}.items():
    got = sql(root, meta, f"select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='{t}'")
    check(got == cols, S, f'{t}: colonne Fase 4B/6 esatte', got)
rls = sql(root, meta, "select string_agg(relname||'='||relrowsecurity::text, ',' order by relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and relname like 'gptour_orchestrator_%'")
check(rls == 'gptour_orchestrator_access_audit=true,gptour_orchestrator_plans=true,gptour_orchestrator_requests=true,gptour_orchestrator_sessions=true,gptour_orchestrator_user_access=true', S, 'RLS abilitata su tutte le 5 tabelle gptour_orchestrator_*', rls)
grants = sql(root, meta, "select string_agg(table_name||':'||privs, ' ' order by table_name) from (select table_name, string_agg(privilege_type, '/' order by privilege_type) privs from information_schema.role_table_grants where grantee='authenticated' and table_schema='public' and table_name like 'gptour_orchestrator_%' group by table_name) g")
check(grants == 'gptour_orchestrator_plans:INSERT/SELECT gptour_orchestrator_requests:INSERT/SELECT/UPDATE gptour_orchestrator_sessions:INSERT/SELECT/UPDATE', S, 'privilegi authenticated minimi Fase 4B (nessun DELETE), nessuno su Fase 6', grants)
anon_g = sql(root, meta, "select count(*) from information_schema.role_table_grants where grantee='anon' and table_schema='public' and table_name like 'gptour_%'")
check(anon_g == '0', S, 'anon senza privilegi su tabelle gptour_*', anon_g)
fns = sql(root, meta, "select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('gptour_orchestrator_my_access','gptour_orchestrator_access_list','gptour_orchestrator_set_access','gptour_orchestrator_bulk_access','gptour_orchestrator_is_active_admin','gptour_orchestrator_supported_roles','ai_tour_scope_candidates','ai_tour_catalog_area','save_gptour_scoped_batch','save_tours_batch','ai_tour_free_tabaccherie','ai_tour_registry_availability')")
check(fns == 'ai_tour_catalog_area,ai_tour_free_tabaccherie,ai_tour_registry_availability,ai_tour_scope_candidates,gptour_orchestrator_access_list,gptour_orchestrator_bulk_access,gptour_orchestrator_is_active_admin,gptour_orchestrator_my_access,gptour_orchestrator_set_access,gptour_orchestrator_supported_roles,save_gptour_scoped_batch,save_tours_batch', S, 'RPC Fase 6 + catalog scope + save_tours_batch presenti', fns)
priv = sql(root, meta, "select string_agg(c.relname||':'||c.relkind::text, ',' order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='aitour_private' and c.relkind in ('v','r')")
check(priv == 'geocoder_gate:r,new_points:v,registry_cards:v', S, 'schema aitour_private: viste registry_cards/new_points e geocoder_gate', priv)
check(sql(root, meta, "select has_schema_privilege('authenticated','aitour_private','USAGE')::text") == 'false', S, 'authenticated senza USAGE su aitour_private (solo SECURITY DEFINER)')
sd = sql(root, meta, "select coalesce(string_agg(n.nspname||'.'||p.proname, ',' order by 1),'') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosecdef and ((n.nspname='public' and (p.proname like 'gptour_%' or p.proname like 'ai_tour_%' or p.proname like 'save_%tour%')) or n.nspname='aitour_private') and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))")
check(sd == '', S, 'SECURITY DEFINER del perimetro GPTour tutte con search_path fissato', sd)
exe = sql(root, meta, "select string_agg(p.proname||':'||has_function_privilege('anon', p.oid, 'EXECUTE')::text||'/'||has_function_privilege('authenticated', p.oid, 'EXECUTE')::text, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('ai_tour_scope_candidates','ai_tour_catalog_area','save_gptour_scoped_batch','gptour_orchestrator_my_access','gptour_orchestrator_set_access')")
check(exe == 'ai_tour_catalog_area:false/true,ai_tour_scope_candidates:false/true,gptour_orchestrator_my_access:false/true,gptour_orchestrator_set_access:false/true,save_gptour_scoped_batch:false/true', S, 'EXECUTE: authenticated sì, anon no', exe)
sem = sql(root, meta, "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','v','m') and (c.relname like 'gptour_semantic%' or n.nspname like 'gptour_semantic%')") + '/' + sql(root, meta, "select count(*) from pg_proc where proname like 'gptour_semantic%'")
check(sem in ('0/0', '5/27'), S, 'namespace gptour_semantic_*: libero (0/0, prima di U2-b) oppure esattamente l’inventario della migration U2-b rev.2 (5 tabelle / 27 funzioni)', sem)
roles = sql(root, meta, "select string_agg(rolname||':'||rolsuper::text||'/'||rolbypassrls::text, ',' order by rolname) from pg_roles where rolname in ('anon','authenticated','authenticator','service_role')")
check(roles == 'anon:false/false,authenticated:false/false,authenticator:false/false,service_role:false/true', S, 'ruoli PostgREST: nessun superuser; solo service_role bypassa RLS (come hosted)', roles)
core = sql(root, meta, "select string_agg(tablename||'='||n, ',' order by tablename) from (select tablename, count(*) n from pg_policies where schemaname='public' and tablename in ('customers','profiles','tabaccherie','agent_zones','ai_tour_settings','appointments','orders') group by tablename) x")
check(all(k in core for k in ('customers=', 'profiles=', 'tabaccherie=', 'agent_zones=', 'ai_tour_settings=', 'appointments=', 'orders=')), S, 'policy reali (snapshot 2026-03-24 + migrazioni) presenti su tutte le tabelle CRM del perimetro', core)
fk6 = sql(root, meta, "select count(*) from pg_constraint where conname='gptour_orchestrator_user_access_user_id_fkey'")
check(fk6 == '1', S, 'FK Fase 6 user_access.user_id -> auth.users(id) ricostruita', fk6)
trg = sql(root, meta, "select count(*) from information_schema.triggers where event_object_table in ('customers','profiles','orders','tabaccherie','appointments','agent_zones')")
check(int(trg) >= 25, S, f'trigger reali attivi sulle tabelle CRM del perimetro ({trg})', trg)

# ---------------------------------------------------------------- S2 Fase 4B RLS on realistic schema
S = 'S2-Fase4B-RLS'
ok, _ = as_user(A, 'authenticated', f"insert into public.gptour_orchestrator_sessions(session_id,owner_uid,agent_id,revision,state) values ('s1','{A}','{A}',1,'{{}}')")
check(ok, S, 'owner A inserisce sessione')
ok, _ = as_user(A, 'authenticated', f"insert into public.gptour_orchestrator_plans(plan_id,session_id,owner_uid,revision,plan) values ('p1','s1','{A}',1,'{{}}')")
check(ok, S, 'owner A inserisce piano')
ok, out = as_user(A, 'authenticated', f"insert into public.gptour_orchestrator_requests(session_id,request_id,owner_uid,response) values ('s1','r1','{A}','{{\"v\":1}}') on conflict (session_id,request_id) do update set response=excluded.response returning response->>'v'")
check(ok and out == '1', S, 'upsert richiesta (1ª)', out)
ok, out = as_user(A, 'authenticated', f"insert into public.gptour_orchestrator_requests(session_id,request_id,owner_uid,response) values ('s1','r1','{A}','{{\"v\":2}}') on conflict (session_id,request_id) do update set response=excluded.response returning response->>'v'")
check(ok and out == '2', S, 'upsert richiesta (2ª, policy UPDATE)', out)
check(ids_as(B, 'authenticated', 'select session_id from public.gptour_orchestrator_sessions') == set(), S, 'B non vede sessioni di A (set vuoto)')
check(ids_as(B, 'authenticated', 'select plan_id from public.gptour_orchestrator_plans') == set(), S, 'B non vede piani di A')
check(ids_as(A, 'authenticated', 'select session_id from public.gptour_orchestrator_sessions') == {'s1'}, S, 'A vede esattamente {s1}')
as_user(B, 'authenticated', "update public.gptour_orchestrator_sessions set revision=99 where session_id='s1'")
check(ids_as(A, 'authenticated', "select revision::text from public.gptour_orchestrator_sessions where session_id='s1'") == {'1'}, S, 'update di B su sessione altrui: 0 righe, revisione invariata')
ok, out = as_user(B, 'authenticated', f"insert into public.gptour_orchestrator_sessions(session_id,owner_uid,agent_id,revision,state) values ('s2','{A}','{A}',1,'{{}}')")
check(not ok and 'row-level security' in out, S, 'B non inserisce sessione a nome di A (with check)', out)
ok, out = as_user(B, 'authenticated', f"insert into public.gptour_orchestrator_plans(plan_id,session_id,owner_uid,revision,plan) values ('p2','s1','{B}',1,'{{}}')")
check(not ok and 'row-level security' in out, S, 'piano su sessione altrui respinto', out)
ok, out = as_user(A, 'authenticated', "delete from public.gptour_orchestrator_sessions where session_id='s1'")
check(not ok and 'permission denied' in out, S, 'DELETE negato anche al proprietario', out)
ok, out = as_user(A, 'authenticated', "update public.gptour_orchestrator_plans set revision=5 where plan_id='p1'")
check(not ok and 'permission denied' in out, S, 'UPDATE negato su plans (immutabili)', out)
ok, out = as_user(None, 'anon', 'select count(*) from public.gptour_orchestrator_sessions')
check(not ok and 'permission denied' in out, S, 'anon: privilegio negato (non solo RLS)', out)
ok, out = as_user(A, 'authenticated', f"insert into public.gptour_orchestrator_sessions(session_id,owner_uid,agent_id,revision,state) values ('s3','{A}','{B}',0,'{{}}')")
check(ok, S, 'LIMITE Fase 4B: agent_id diverso dal proprietario accettato dalla policy (nessun controllo autorizzativo SQL su agent_id)')

# ---------------------------------------------------------------- S3 Fase 6 access RPC
S = 'S3-Fase6-accessi'
ok, out = as_user(A, 'authenticated', 'select * from public.gptour_orchestrator_user_access')
check(not ok and 'permission denied' in out, S, 'authenticated: nessun accesso diretto alla tabella abilitazioni', out)
ok, out = as_user(A, 'authenticated', 'select public.gptour_orchestrator_my_access()')
check(ok and out == 'disabled', S, 'agente attivo senza riga → disabled', out)
ok, out = as_user(A, 'authenticated', f"select * from public.gptour_orchestrator_set_access('{A}', true)")
check(not ok and 'solo amministratori' in out, S, 'agente non può abilitare sé stesso', out)
ok, out = as_user(C, 'authenticated', f"select enabled::text from public.gptour_orchestrator_set_access('{A}', true, 'lab')")
check(ok and out == 'true', S, 'admin attivo abilita A', out)
ok, out = as_user(A, 'authenticated', 'select public.gptour_orchestrator_my_access()')
check(ok and out == 'enabled', S, 'A → enabled', out)
ok, out = as_user(D, 'authenticated', 'select public.gptour_orchestrator_my_access()')
check(ok and out == 'role_unsupported', S, 'ruolo customer → role_unsupported', out)
ok, out = as_user(E, 'authenticated', 'select public.gptour_orchestrator_my_access()')
check(ok and out == 'inactive', S, 'profilo inattivo → inactive', out)
ok, out = as_user(None, 'anon', 'select public.gptour_orchestrator_my_access()')
check(not ok and 'permission denied' in out, S, 'anon: EXECUTE negato su my_access', out)
ok, out = as_user(A, 'authenticated', 'select count(*) from public.gptour_orchestrator_access_list()')
check(not ok and 'solo amministratori' in out, S, 'elenco negato all’agente', out)
ok, out = as_user(C, 'authenticated', 'select count(*) from public.gptour_orchestrator_access_list()')
check(ok and out == '4', S, 'elenco admin: 4 account (cliente portale escluso)', out)
ok, out = as_user(C, 'authenticated', f"select enabled::text from public.gptour_orchestrator_set_access('{A}', false)")
check(ok and out == 'false', S, 'admin revoca A', out)
ok, out = as_user(A, 'authenticated', 'select public.gptour_orchestrator_my_access()')
check(ok and out == 'disabled', S, 'OFF nega davvero → disabled', out)

# ---------------------------------------------------------------- S4 catalog scope (real RPC on real policies/triggers)
S = 'S4-catalog-scope'
area = f"select x from jsonb_array_elements((public.ai_tour_catalog_area('{A}','Milano'))->'rows') x"
ok, out = as_user(A, 'authenticated', f"select r->>'registered'||'/'||(r->>'inside')||'/'||(r->>'otherAgent')||'/'||(r->>'eligible')||'/'||(r->>'hasTerritory') from public.ai_tour_catalog_area('{A}','Milano') r")
check(ok and out == '6/5/1/10/true', S, 'ai_tour_catalog_area(A, Milano): registered 6, inside 5, otherAgent 1, eligible 10, territorio sì', out)
rows = ids_as(A, 'authenticated', f"select coalesce('tab:'||(x->>'id'), 'cust:'||(x->>'customer_id')) from jsonb_array_elements((public.ai_tour_catalog_area('{A}','Milano'))->'rows') x")
expected = {f'tab:{tab(i)}' for i in (1, 2, 3, 4)} | {f'cust:{cust(i)}' for i in (2, 3, 4, 5, 6, 7)}
check(rows == expected, S, 'insieme ESATTO delle chiavi: tab 1-4 + cust 2-7 (esclusi: 5 di B, 6 chiusa, 7 senza gps, 8 Monza; cust 1 via registro, 8 disabilitato, 9/10 fuori territorio)', str(sorted(rows ^ expected))[:200])
np = ids_as(A, 'authenticated', f"select x->>'id' from jsonb_array_elements((public.ai_tour_catalog_area('{A}','Milano'))->'rows') x where (x->>'new_point')::boolean")
check(np == {tab(1), tab(2), tab(3)}, S, 'new_point esattamente i registri liberi 1,2,3 (stato NULL trattato come non visitato)', str(np))
ok, out = as_user(A, 'authenticated', f"select public.ai_tour_catalog_area('{B}','Monza')")
check(not ok and 'Agente non autorizzato' in out, S, 'A chiede il catalogo di B → 42501', out)
ok, out = as_user(D, 'authenticated', f"select public.ai_tour_catalog_area('{D}','Milano')")
check(not ok and 'Agente non autorizzato' in out, S, 'ruolo customer → Agente non autorizzato (42501)', out)
ok, out = as_user(E, 'authenticated', f"select public.ai_tour_catalog_area('{E}','Milano')")
check(not ok and 'Accesso non autorizzato' in out, S, 'profilo inattivo → negato', out)
ok, out = as_user(None, 'anon', f"select public.ai_tour_catalog_area('{A}','Milano')")
check(not ok and 'permission denied' in out, S, 'anon → EXECUTE negato', out)
ok, out = as_user(C, 'authenticated', f"select r->>'eligible' from public.ai_tour_catalog_area('{A}','Milano') r")
check(ok and out == '10', S, 'admin può interrogare il catalogo di A (stesso esito)', out)
ok, out = as_user(B, 'authenticated', f"select r->>'registered'||'/'||(r->>'eligible') from public.ai_tour_catalog_area('{B}','Monza') r")
check(ok and out == '1/4', S, 'B su Monza: 1 registro + 3 clienti = 4 eligible', out)
cands = json.dumps([
    {'key': 'ok_tab1', 'tabaccheria_id': tab(1)}, {'key': 'foreign_tab5', 'tabaccheria_id': tab(5)},
    {'key': 'closed_tab6', 'tabaccheria_id': tab(6)}, {'key': 'nogps_tab7', 'tabaccheria_id': tab(7)},
    {'key': 'outside_cust9', 'customer_id': cust(9)}, {'key': 'disabled_cust8', 'customer_id': cust(8)},
    {'key': 'missing', 'customer_id': '99999999-0000-4000-8000-000000000099'},
    {'key': 'identity_mismatch', 'customer_id': cust(1), 'tabaccheria_id': tab(2)},
    {'key': 'ok_linked', 'customer_id': cust(1), 'tabaccheria_id': tab(4)},
    {'key': 'ok_cust2', 'customer_id': cust(2)}, {'key': 'otheragent_custB', 'customer_id': custB(1)}])
ok, out = as_user(A, 'authenticated', f"select (r->'allowedKeys')::text||'||'||(r->'excluded')::text from public.ai_tour_scope_candidates('{A}', '{cands}'::jsonb) r")
allowed = set(json.loads(out.split('||', 1)[0])) if ok else set()
excluded = json.loads(out.split('||', 1)[1]) if ok else {}
check(ok and allowed == {'ok_tab1', 'ok_linked', 'ok_cust2'} and excluded == {'otherAgent': 2, 'disabled': 2, 'coordinates': 1, 'outsideTerritory': 1, 'missing': 1, 'identity': 1}, S, 'ai_tour_scope_candidates: allowed {ok_tab1, ok_linked, ok_cust2}; esclusi otherAgent2 disabled2 coordinates1 outsideTerritory1 missing1 identity1', out)
ok, out = as_user(A, 'authenticated', f"select r->'allowedKeys' from public.ai_tour_scope_candidates('{A}', '{cands}'::jsonb, true) r")
check(ok and json.loads(out) == [], S, 'p_lock=true: candidati senza planned_lat/lng tutti esclusi (allowedKeys vuoto)', out)
plan = json.dumps([{'tour': {'agent_id': A, 'tour_date': time.strftime('%Y-%m-%d'), 'title': 'lab'}, 'stops': [{'tabaccheria_id': tab(5), 'latitude': 45.455, 'longitude': 9.175}]}])
ok, out = as_user(A, 'authenticated', f"select public.save_gptour_scoped_batch('{plan}'::jsonb)")
check(not ok and 'fuori territorio o appartenenti ad altri agenti' in out, S, 'save_gptour_scoped_batch con punto di B → 42501, nessun salvataggio', out)
ok, out = as_user(B, 'authenticated', f"select public.save_gptour_scoped_batch('{plan}'::jsonb)")
check(not ok and 'non autorizzato' in out, S, 'B tenta di salvare un piano per A → negato (authorized_agent)', out)

# ---------------------------------------------------------------- S5 CRM read path with REAL policies (what a U2 adapter does with the user JWT)
S = 'S5-CRM-RLS-reali'
ids = ids_as(A, 'authenticated', 'select id from public.customers')
check(ids == {cust(i) for i in range(1, 11)}, S, 'customers: A vede esattamente i propri 10 (inclusi disabilitato/fuori zona: filtro applicativo, non RLS)', str(sorted(ids ^ {cust(i) for i in range(1, 11)}))[:120])
ids = ids_as(B, 'authenticated', 'select id from public.customers')
check(ids == {custB(i) for i in (1, 2, 3)}, S, 'customers: B vede esattamente i propri 3', str(ids)[:120])
ids = ids_as(None, 'anon', 'select id from public.customers')
check(ids == set(), S, 'customers: anon → nessuna riga (privilegio hosted presente, RLS senza policy anon)', str(ids)[:120])
ids = ids_as(C, 'authenticated', 'select id from public.customers')
check(len(ids) == 13 and not any(x.startswith('ERROR') for x in ids), S, 'customers: admin vede tutti i 13', str(len(ids)))
ids = ids_as(A, 'authenticated', 'select id from public.tabaccherie')
check(ids == {tab(i) for i in range(1, 9)}, S, 'tabaccherie: registro leggibile per intero dagli agenti (policy reale select authenticated)', str(len(ids)))
ids = ids_as(A, 'authenticated', 'select id from public.agent_zones')
check(ids == {'aa000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-000000000002'}, S, 'agent_zones: A vede solo le proprie 2 zone', str(ids)[:120])
ids = ids_as(A, 'authenticated', 'select agent_id from public.ai_tour_settings')
check(ids == {A}, S, 'ai_tour_settings: A vede solo le proprie impostazioni', str(ids)[:120])
ids = ids_as(A, 'authenticated', 'select id from public.appointments')
check(ids == {'55555555-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000002'}, S, 'appointments: A vede solo i propri 2', str(ids)[:120])
ids = ids_as(A, 'authenticated', 'select id from public.orders')
check(ids == {f'44444444-0000-4000-8000-{i:012d}' for i in (1, 2, 3)}, S, 'orders: A vede solo i propri 3', str(ids)[:120])
ids = ids_as(A, 'authenticated', 'select id from public.profiles')
check(A in ids and not any(x.startswith('ERROR') for x in ids), S, f'profiles: A legge almeno il proprio profilo (visibili {len(ids)})', str(len(ids)))
ok, out = as_user(A, 'authenticated', f"update public.customers set business_name='hack' where id='{custB(1)}' returning id")
check(ok and out == '', S, 'A non modifica un cliente di B (0 righe)', out)
check(ids_as(B, 'authenticated', f"select business_name from public.customers where id='{custB(1)}'") == {'Tabacchi Sintetico MB 1'}, S, 'cliente di B invariato')
ok, out = as_user(A, 'authenticated', f"delete from public.customers where id='{custB(1)}' returning id")
check((ok and out == '') or (not ok and ('permission denied' in out or 'row-level' in out)), S, 'A non elimina un cliente di B', out)
ok, out = as_user(A, 'authenticated', f"update public.agent_zones set agent_id='{A}' where id='bb000000-0000-4000-8000-000000000001' returning id")
check(ok and out == '', S, 'A non si appropria della zona di B (UPDATE 0 righe)', out)
ok, out = as_user(A, 'authenticated', f"insert into public.ai_tours (agent_id, tour_date, start_time, end_time, tour_type) values ('{B}', current_date, '08:00', '18:00', 'mista') returning id")
check(not ok and 'row-level security' in out, S, 'A non crea tour a nome di B (policy ai_tours_own)', out)
ok, out = as_user(A, 'authenticated', f"insert into public.ai_tours (agent_id, tour_date, start_time, end_time, tour_type) values ('{A}', current_date, '08:00', '18:00', 'mista') returning id")
check(ok and len(out) == 36, S, 'A crea un tour proprio (bozza tecnica locale) → consentito', out)
ok, out = as_user(B, 'authenticated', 'select count(*) from public.ai_tours')
check(ok and out == '0', S, 'B non vede i tour di A', out)
ok, out = as_user(A, 'authenticated', f"select count(*) from public.profiles")
check(ok and out == '1', S, 'profiles: l’agente legge SOLO il proprio profilo (policy admin basate su user_metadata del JWT, non su profiles.role)', out)
ok, out = as_user(A, 'authenticated', f"update public.profiles set role='admin' where id='{A}' returning role")
check(not ok and 'Solo un admin' in out, S, 'A non può auto-promuoversi admin (trigger reale prevent_profile_privilege_escalation)', out)

# ---------------------------------------------------------------- S6 PostgREST HTTP with synthetic JWT
S = 'S6-PostgREST-HTTP'
st, body = http('/gptour_orchestrator_sessions?select=session_id&order=session_id', token=jwt(A))
check(st == 200 and [r['session_id'] for r in body] == ['s1', 's3'], S, 'GET sessioni come A → {s1,s3}', str(st))
st, body = http('/gptour_orchestrator_sessions?select=session_id', token=jwt(B))
check(st == 200 and body == [], S, 'GET sessioni come B → []', str(st))
st, _ = http('/gptour_orchestrator_sessions?select=session_id')
check(st in (401, 403), S, 'GET sessioni anon → negato', str(st))
st, _ = http('/gptour_orchestrator_sessions', token=jwt(B), method='POST', body={'session_id': 'h1', 'owner_uid': A, 'agent_id': A, 'revision': 0, 'state': {}})
check(st == 403, S, 'POST sessione a nome altrui → 403', str(st))
st, _ = http('/gptour_orchestrator_sessions?session_id=eq.s1', token=jwt(A), method='DELETE')
check(st == 403, S, 'DELETE via HTTP → 403', str(st))
st, body = http('/rpc/gptour_orchestrator_my_access', token=jwt(A), method='POST', body={})
check(st == 200 and body == 'disabled', S, 'RPC my_access come A → disabled', f'{st} {body}')
st, _ = http('/rpc/gptour_orchestrator_my_access', method='POST', body={})
check(st in (401, 403), S, 'RPC my_access anon → negato', str(st))
st, body = http('/rpc/ai_tour_catalog_area', token=jwt(A), method='POST', body={'p_agent_id': A, 'p_name': 'Milano'})
check(st == 200 and body and body.get('eligible') == 10, S, 'RPC catalog_area via HTTP come A → eligible 10', str(st))
st, body = http('/rpc/ai_tour_catalog_area', token=jwt(A), method='POST', body={'p_agent_id': B, 'p_name': 'Monza'})
check(st == 403, S, 'RPC catalog_area di B come A → 403 (42501)', str(st))
st, body = http('/customers?select=id&order=id', token=jwt(A))
check(st == 200 and {r['id'] for r in body} == {cust(i) for i in range(1, 11)}, S, 'GET customers come A → set esatto', str(st))
st, body = http('/customers?select=id', token=jwt(D))
check(st == 200 and body == [], S, 'GET customers come ruolo customer → [] (nessuna fuga)', f'{st}')
for label, token in [('scaduto', jwt(expires=-120)), ('firma errata', jwt(secret=b'wrong-secret-not-valid')), ('audience errata', jwt(audience='other'))]:
    st, _ = http('/customers?select=id', token=token)
    check(st == 401, S, f'JWT {label} → 401', str(st))
st, _ = http('/customers?select=id', token=jwt(role='postgres'))
check(st in (400, 401, 403), S, 'escalation di ruolo nel JWT respinta', str(st))
st, _ = http('/rpc/gptour_semantic_claim', token=jwt(A), method='POST', body={})
check(st == 404, S, 'nessuna RPC U2-b esposta (404)', str(st))
st, body = http('/gptour_orchestrator_user_access?select=user_id', token=jwt(A))
check(st == 403 and body and body.get('code') == '42501', S, 'tabella abilitazioni Fase 6 esposta ma negata via HTTP (403, 42501: nessun privilegio diretto)', f'{st} {body}')

# ---------------------------------------------------------------- S7 claim user_metadata.role='admin' on an AGENT (local negative probe)
# Distinguishes the behaviour of the RECONSTRUCTED policies (snapshot 2026-03-24, auth.jwt()->user_metadata) from the RPCs that U2 will rely on
# (profiles.role verified in the DB). Lab-only observation; no inference about the hosted database, which was not accessed.
S = 'S7-claim-user_metadata-admin'
UM = {'user_metadata': {'role': 'admin'}}
ok, out = as_user(A, 'authenticated', 'select count(*) from public.profiles', UM)
check(ok and out == '5', S, 'POLICY RICOSTRUITA: agente con claim user_metadata.role=admin legge TUTTI i profili (5) tramite «Admins can view all profiles»', out)
ok, out = as_user(A, 'authenticated', 'select count(*) from public.profiles')
check(ok and out == '1', S, 'controllo: stesso agente senza il claim legge solo il proprio profilo (1)', out)
ok, out = as_user(A, 'authenticated', f"update public.profiles set full_name='probe' where id='{B}' returning id", UM, commit=False)
check(ok and out == B, S, 'POLICY RICOSTRUITA: con il claim l’UPDATE di un campo non autorizzativo su un profilo altrui passa («Admins can update all profiles»; rollback, nessuna modifica)', out)
ok, out = as_user(A, 'authenticated', f"update public.profiles set role='admin' where id='{A}' returning role", UM, commit=False)
check(not ok and 'Solo un admin' in out, S, 'TRIGGER REALE: anche con il claim l’autopromozione è bloccata (has_any_role legge profiles.role)', out)
ok, out = as_user(A, 'authenticated', f"update public.profiles set role='supervisor' where id='{B}' returning id", UM, commit=False)
check(not ok and 'Solo un admin' in out, S, 'TRIGGER REALE: con il claim il campo role di un profilo altrui resta protetto (role/supervisor_id/branch_id/custom_permissions)', out)
ok, out = as_user(A, 'authenticated', f"update public.profiles set is_active=false where id='{B}' returning id", UM, commit=False)
check(ok and out == B, S, 'OSSERVAZIONE POLICY RICOSTRUITA: is_active NON è tra i campi protetti dal trigger; con il claim l’UPDATE su profilo altrui passa (rollback). Da verificare in L3, non dedotto per la produzione', out)
ok, out = as_user(A, 'authenticated', 'select count(*) from public.customers', UM)
check(ok and out == '10', S, 'customers: il claim NON amplia la visibilità (customers_admin_full_access usa profiles.role) → ancora 10', out)
ok, out = as_user(A, 'authenticated', 'select public.gptour_orchestrator_my_access()', UM)
check(ok and out == 'disabled', S, 'RPC Fase 6 my_access: il claim è ignorato → disabled (profiles.role verificato nel DB)', out)
ok, out = as_user(A, 'authenticated', 'select count(*) from public.gptour_orchestrator_access_list()', UM)
check(not ok and 'solo amministratori' in out, S, 'RPC Fase 6 access_list: con il claim resta negata (gptour_orchestrator_is_active_admin su profiles)', out)
ok, out = as_user(A, 'authenticated', f"select * from public.gptour_orchestrator_set_access('{A}', true)", UM)
check(not ok and 'solo amministratori' in out, S, 'RPC Fase 6 set_access: con il claim l’agente non si autoabilita', out)
ok, out = as_user(A, 'authenticated', f"select public.ai_tour_catalog_area('{B}','Monza')", UM)
check(not ok and 'Agente non autorizzato' in out, S, 'RPC catalog scope per l’agente B: con il claim resta 42501 (aitour_private.authorized_agent su profiles)', out)
ok, out = as_user(A, 'authenticated', f"select r->>'eligible' from public.ai_tour_catalog_area('{A}','Milano') r", UM)
check(ok and out == '10', S, 'RPC catalog scope per sé stesso: esito identico (10), il claim non cambia il perimetro', out)
ok, out = as_user(A, 'authenticated', f"select count(*) from public.ai_tours where agent_id='{B}'", UM)
check(ok and out == '0', S, 'ai_tours: il claim non apre i tour di B (ai_tours_own usa has_any_role su profiles)', out)
st, body = http('/profiles?select=id', token=jwt(A, user_metadata={'role': 'admin'}))
check(st == 200 and isinstance(body, list) and len(body) == 5, S, 'HTTP POLICY RICOSTRUITA: GET /profiles con JWT user_metadata.role=admin → 5 righe', f'{st} {len(body) if isinstance(body, list) else body}')
st, body = http('/profiles?select=id', token=jwt(A))
check(st == 200 and isinstance(body, list) and len(body) == 1, S, 'HTTP controllo: GET /profiles senza claim → 1 riga', f'{st}')
st, body = http('/rpc/gptour_orchestrator_my_access', token=jwt(A, user_metadata={'role': 'admin'}), method='POST', body={})
check(st == 200 and body == 'disabled', S, 'HTTP RPC my_access con il claim → disabled', f'{st} {body}')
st, body = http('/rpc/ai_tour_catalog_area', token=jwt(A, user_metadata={'role': 'admin'}), method='POST', body={'p_agent_id': B, 'p_name': 'Monza'})
check(st == 403, S, 'HTTP RPC catalog_area di B con il claim → 403', str(st))
st, body = http('/customers?select=id', token=jwt(A, user_metadata={'role': 'admin'}))
check(st == 200 and isinstance(body, list) and len(body) == 10, S, 'HTTP GET /customers con il claim → ancora 10', f'{st}')

# ---------------------------------------------------------------- summary
passed = sum(r['status'] == 'PASS' for r in results)
report = {'generated_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'checks': len(results), 'pass': passed, 'fail': len(results) - passed, 'results': results}
(root / 'verify_report.json').write_text(json.dumps(report, indent=1))
print(f"REPLAY_VERIFY DONE checks={len(results)} pass={passed} fail={len(results) - passed}; JWT/Auth SYNTHETIC, schema/policy/RPC REAL (replay), data SYNTHETIC")
raise SystemExit(0 if passed == len(results) else 1)
