#!/usr/bin/env python3
"""Role-model probe verification (lab only, synthetic credentials). Requires probe.sql applied on the replay lab.
Proves caller check under PostgREST, PUBLIC/anon/authenticated/service_role denial, role memberships, owner-RLS note,
authorization-helper privileges, backend without CRM access, per-key and membership revocation, and
'permission denied' vs 'trigger rejection' distinction. Writes <root>/role_probe_report.json."""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from replay_common import settings, sql  # noqa: E402
import replay_verify_lib as lib  # noqa: E402

root, meta = settings()
A, B = lib.A, lib.B
S1 = '0f0f0f0f-0000-4000-8000-000000000001'
results = []


def check(ok, section, label, detail=''):
    results.append({'section': section, 'label': label, 'status': 'PASS' if ok else 'FAIL', 'detail': str(detail)[:200]})
    print(('PASS ' if ok else 'FAIL ') + f'[{section}] {label}' + (f' :: {str(detail)[:160]}' if not ok else ''))


backend = lambda jti='lab-key-1', **kw: lib.jwt(sub=None, role='gptour_semantic_backend', extra={'jti': jti}, **kw)
http, as_user = lib.http, lib.as_user

# cleanup previous runs
sql(root, meta, f"truncate u2_role_probe.requests; update u2_role_probe.backend_keys set revoked_at = null where jti = 'lab-key-1'; "
               f"insert into public.gptour_orchestrator_user_access(user_id, enabled, updated_by) values ('{A}', true, '{lib.C}') on conflict (user_id) do update set enabled = true")

# ---------------------------------------------------------------- R1 roles and grants
S = 'R1-ruoli-grant'
m = sql(root, meta, "select string_agg(r.rolname||'->'||m.rolname, ',' order by 1) from pg_auth_members am join pg_roles r on r.oid=am.roleid join pg_roles m on m.oid=am.member where r.rolname in ('gptour_semantic_backend','gptour_semantic_owner','anon','authenticated','service_role')")
check(set(m.split(',')) == {'anon->authenticator', 'authenticated->authenticator', 'gptour_semantic_backend->authenticator', 'service_role->authenticator'}, S, 'appartenenze: backend/anon/authenticated/service_role solo membri di authenticator; owner senza membri', m)
attrs = sql(root, meta, "select string_agg(rolname||':'||rolsuper::text||rolbypassrls::text||rolcanlogin::text||rolinherit::text, ',' order by rolname) from pg_roles where rolname in ('gptour_semantic_backend','gptour_semantic_owner')")
check(attrs == 'gptour_semantic_backend:falsefalsefalsefalse,gptour_semantic_owner:falsefalsefalsefalse', S, 'backend/owner: no superuser, no bypassrls, no login, noinherit', attrs)
pub = sql(root, meta, "select string_agg(p.proname||':'||has_function_privilege('anon',p.oid,'EXECUTE')::text||has_function_privilege('authenticated',p.oid,'EXECUTE')::text||has_function_privilege('service_role',p.oid,'EXECUTE')::text||has_function_privilege('gptour_semantic_backend',p.oid,'EXECUTE')::text, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname like 'u2_role_probe_%' or n.nspname='u2_role_probe'")
check(pub == 'assert_backend_caller:falsefalsefalsefalse,enforce_write_once:falsefalsefalsefalse,no_delete:falsefalsefalsefalse,u2_role_probe_internal:falsefalsefalsetrue,u2_role_probe_is_authorized:falsefalsefalsefalse,u2_role_probe_is_authorized_ownerrole:falsefalsefalsefalse,u2_role_probe_read:falsefalsefalsetrue', S, 'EXECUTE: anon/authenticated/service_role mai; backend solo su internal e read; helper solo owner', pub)
acl = sql(root, meta, "select coalesce(string_agg(grantee||':'||privilege_type, ',' order by 1),'') from information_schema.role_table_grants where table_schema='u2_role_probe' and table_name='requests' and grantee not in ('gptour_semantic_owner')")
check(set(acl.split(',')) == {'u2_probe_writer:DELETE', 'u2_probe_writer:SELECT', 'u2_probe_writer:UPDATE'}, S, 'tabella interna: nessun privilegio per PUBLIC/anon/authenticated/service_role/backend (solo il ruolo writer di LABORATORIO)', acl)
pubacl = sql(root, meta, "select count(*) from (select unnest(relacl) a from pg_class where oid='u2_role_probe.requests'::regclass) x where a::text like '=%'") + '/' + sql(root, meta, "select count(*) from (select unnest(p.proacl) a from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname like 'u2_role_probe_%' or n.nspname='u2_role_probe') x where a::text like '=%'")
check(pubacl == '0/0', S, 'nessuna voce PUBLIC (\"=\") nelle ACL della tabella e delle funzioni della sonda', pubacl)
own = sql(root, meta, "select relrowsecurity::text||'/'||relforcerowsecurity::text from pg_class where oid = 'u2_role_probe.requests'::regclass")
check(own == 'true/false', S, 'DOCUMENTATO: RLS abilitata ma NON forzata → il proprietario (e le RPC che eseguono come owner) la superano; la protezione nelle RPC sono i controlli espliciti', own)
ok, out = as_user(None, 'gptour_semantic_owner', 'select count(*) from u2_role_probe.requests')
check(ok and out == '0', S, 'prova: il ruolo owner legge la tabella senza policy (bypass da proprietà), conferma della nota precedente', out)

# ---------------------------------------------------------------- R2 caller check under PostgREST
S = 'R2-caller-check-PostgREST'
st, body = http('/rpc/u2_role_probe_internal', token=backend(), method='POST', body={'p_caller_uid': A, 'p_session_id': S1, 'p_request_id': 'r1', 'p_action': 'insert'})
check(st == 200 and body == {'ok': True}, S, 'backend (jwt role + SET ROLE + jti valido) → ammesso', f'{st} {body}')
for label, tok in [('authenticated proprietario A', lib.jwt(A)), ('authenticated con user_metadata.role=admin', lib.jwt(A, user_metadata={'role': 'admin'})), ('anon', None)]:
    st, body = http('/rpc/u2_role_probe_internal', token=tok, method='POST', body={'p_caller_uid': A, 'p_session_id': S1, 'p_request_id': 'r2', 'p_action': 'insert'})
    check(st in (401, 403) and (body or {}).get('code') in ('42501', 'PGRST301', 'PGRST302', None), S, f'{label} → respinto {st} (nessun EXECUTE)', f'{st} {body}')
st, body = http('/rpc/u2_role_probe_internal', token=lib.jwt(A, role='service_role'), method='POST', body={'p_caller_uid': A, 'p_session_id': S1, 'p_request_id': 'r2', 'p_action': 'insert'})
check(st == 403 and body.get('code') == '42501', S, 'service_role via PostgREST → 403 42501 (EXECUTE revocato anche a service_role)', f'{st} {body}')
check(sql(root, meta, "select count(*) from u2_role_probe.requests") == '1', S, 'solo la riga del backend esiste (r1); nessun insert dai respinti')
ok, out = as_user(None, 'authenticated', f"select public.u2_role_probe_internal('{A}','{S1}','r3','insert')", {'role': 'gptour_semantic_backend', 'jti': 'lab-key-1'})
check(not ok and 'permission denied' in out, S, 'claims falsificati (role backend nel JWT) ma SET ROLE authenticated → permission denied (grant), prima ancora del controllo interno', out)
ok, out = as_user(None, 'gptour_semantic_backend', f"select public.u2_role_probe_internal('{A}','{S1}','r3','insert')", {'role': 'authenticated', 'sub': A})
check(not ok and 'backend credential required (jwt role)' in out, S, 'SET ROLE backend ma claims senza role backend → respinto dal controllo interno (secondo segnale)', out)
st, body = http('/rpc/u2_role_probe_internal', token=backend(jti='lab-key-expired'), method='POST', body={'p_caller_uid': A, 'p_session_id': S1, 'p_request_id': 'r3', 'p_action': 'insert'})
check(st == 403 and 'expired' in body.get('message', ''), S, 'chiave backend con jti scaduto (not_after) → 403', f'{st} {body}')
st, body = http('/rpc/u2_role_probe_internal', token=backend(jti='lab-key-unknown'), method='POST', body={'p_caller_uid': A, 'p_session_id': S1, 'p_request_id': 'r3', 'p_action': 'insert'})
check(st == 403, S, 'jti sconosciuto → 403', f'{st} {body}')
st, body = http('/rpc/u2_role_probe_internal', token=lib.jwt(sub=None, role='gptour_semantic_backend'), method='POST', body={'p_caller_uid': A, 'p_session_id': S1, 'p_request_id': 'r3', 'p_action': 'insert'})
check(st == 403, S, 'JWT backend senza jti → 403', f'{st} {body}')

# ---------------------------------------------------------------- R3 revocation of the dedicated credential
S = 'R3-revoca-credenziale'
sql(root, meta, "update u2_role_probe.backend_keys set revoked_at = clock_timestamp() where jti = 'lab-key-1'")
st, body = http('/rpc/u2_role_probe_read', token=backend(), method='POST', body={'p_caller_uid': A, 'p_session_id': S1, 'p_request_id': 'r1'})
check(st == 403 and 'revoked' in body.get('message', ''), S, 'revoca per jti (allowlist) → il token ancora valido crittograficamente è respinto subito', f'{st} {body}')
sql(root, meta, "update u2_role_probe.backend_keys set revoked_at = null where jti = 'lab-key-1'")
st, _ = http('/rpc/u2_role_probe_read', token=backend(), method='POST', body={'p_caller_uid': A, 'p_session_id': S1, 'p_request_id': 'r1'})
check(st == 200, S, 'ripristino allowlist → ammesso', st)
sql(root, meta, "revoke gptour_semantic_backend from authenticator")
st, body = http('/rpc/u2_role_probe_read', token=backend(), method='POST', body={'p_caller_uid': A, 'p_session_id': S1, 'p_request_id': 'r1'})
check(st in (401, 403) and st != 200, S, 'revoca dell’appartenenza a authenticator → PostgREST non può assumere il ruolo: tutti i token backend inutilizzabili', f'{st} {body}')
sql(root, meta, "grant gptour_semantic_backend to authenticator")
st, _ = http('/rpc/u2_role_probe_read', token=backend(), method='POST', body={'p_caller_uid': A, 'p_session_id': S1, 'p_request_id': 'r1'})
check(st == 200, S, 'ripristino appartenenza → ammesso', st)
st, _ = http('/rpc/u2_role_probe_read', token=backend(expires=-60), method='POST', body={'p_caller_uid': A, 'p_session_id': S1, 'p_request_id': 'r1'})
check(st == 401, S, 'exp JWT scaduto → 401 (ma un token precedente non viene invalidato da un nuovo exp: per questo esiste la allowlist jti)', st)

# ---------------------------------------------------------------- R4 projections and ownership inside RPC
S = 'R4-proiezioni-ownership'
sql(root, meta, f"insert into u2_role_probe.requests(session_id, request_id, owner_uid, status, http_status, response_body) values ('{S1}','done1','{A}','done',200,'{{\"v\":1}}')")
st, body = http('/rpc/u2_role_probe_read', token=backend(), method='POST', body={'p_caller_uid': A, 'p_session_id': S1, 'p_request_id': 'done1'})
check(st == 200 and set(body) == {'status', 'httpStatus', 'body', 'responseExpiresAt'}, S, 'proiezione: insieme ESATTO di chiavi di contratto, nessun lease/context/output', f'{st} {body}')
st, body = http('/rpc/u2_role_probe_read', token=backend(), method='POST', body={'p_caller_uid': B, 'p_session_id': S1, 'p_request_id': 'done1'})
check(st == 404 and body.get('code') == 'PT404', S, 'caller B su request di A → not found non enumerante (controllo esplicito di ownership nella RPC, non RLS)', f'{st} {body}')
sql(root, meta, f"insert into u2_role_probe.requests(session_id, request_id, owner_uid, status, http_status, response_body, response_expires_at) values ('{S1}','old1','{A}','done',200,'x', clock_timestamp() - interval '1 second')")
st, body = http('/rpc/u2_role_probe_read', token=backend(), method='POST', body={'p_caller_uid': A, 'p_session_id': S1, 'p_request_id': 'old1'})
check(st == 404 and (body or {}).get('code') == 'PT404', S, 'response_expires_at raggiunta → not found (scadenza applicata nella lettura)', f'{st} {body}')
sql(root, meta, f"update public.gptour_orchestrator_user_access set enabled = false where user_id = '{A}'")
ok, out = as_user(None, 'gptour_semantic_owner', f"select public.u2_role_probe_is_authorized('{A}','{A}')::text")
check(ok and out == 'false', S, 'helper (owner=postgres): A non abilitato in Fase 6 → false', out)
sql(root, meta, f"update public.gptour_orchestrator_user_access set enabled = true where user_id = '{A}'")
ok, out = as_user(None, 'gptour_semantic_owner', f"select public.u2_role_probe_is_authorized('{A}','{A}')::text||'/'||public.u2_role_probe_is_authorized('{B}','{A}')::text||'/'||public.u2_role_probe_is_authorized('{A}','{B}')::text")
check(ok and out == 'true/false/false', S, 'helper: A abilitato → true; B non abilitato → false; A per agente B → false', out)
ok, out = as_user(None, 'gptour_semantic_owner', f"select public.u2_role_probe_is_authorized_ownerrole('{A}','{A}')::text")
check(ok and out == 'false', S, 'NEGATIVO DIMOSTRATIVO: stesso helper owned da gptour_semantic_owner con soli grant di colonna → false (RLS di profiles applicata al non-proprietario, auth.uid() NULL)', out)
st, body = http('/rpc/u2_role_probe_read', token=backend(), method='POST', body={'p_caller_uid': A, 'p_session_id': S1, 'p_request_id': 'done1'})
check(st == 200, S, 'lettura con autorizzazione attuale valida → 200', st)
sql(root, meta, f"update public.gptour_orchestrator_user_access set enabled = false where user_id = '{A}'")
st, body = http('/rpc/u2_role_probe_read', token=backend(), method='POST', body={'p_caller_uid': A, 'p_session_id': S1, 'p_request_id': 'done1'})
check(st == 404 and (body or {}).get('code') == 'PT404', S, 'accesso revocato (kill-switch Fase 6) → anche il replay della ricevuta è negato', f'{st} {body}')
sql(root, meta, f"delete from public.gptour_orchestrator_user_access where user_id = '{A}'; delete from public.gptour_orchestrator_access_audit where user_id = '{A}'")

# ---------------------------------------------------------------- R5 backend without CRM
S = 'R5-backend-senza-CRM'
for t in ('customers', 'profiles', 'tabaccherie', 'agent_zones', 'gptour_orchestrator_sessions', 'gptour_orchestrator_user_access'):
    ok, out = as_user(None, 'gptour_semantic_backend', f'select count(*) from public.{t}', {'role': 'gptour_semantic_backend', 'jti': 'lab-key-1'})
    check(not ok and 'permission denied' in out, S, f'backend su {t} → permission denied', out)
st, body = http('/customers?select=id', token=backend())
check(st in (401, 403), S, 'backend via HTTP su /customers → negato', st)
for fn in ('ai_tour_catalog_area', 'gptour_orchestrator_my_access'):
    ok, out = as_user(None, 'gptour_semantic_backend', f"select public.{fn}('{A}','Milano')" if fn.startswith('ai_') else f'select public.{fn}()', {'role': 'gptour_semantic_backend', 'jti': 'lab-key-1'})
    check(not ok and 'permission denied' in out, S, f'backend su RPC CRM {fn} → permission denied (le letture CRM restano con JWT utente)', out)
ok, out = as_user(None, 'gptour_semantic_backend', 'select count(*) from u2_role_probe.requests', {'role': 'gptour_semantic_backend', 'jti': 'lab-key-1'})
check(not ok and 'permission denied' in out, S, 'backend sulla tabella interna → permission denied (solo RPC)', out)
ok, out = as_user(None, 'gptour_semantic_owner', 'select count(*) from public.customers')
check(not ok and 'permission denied' in out, S, 'owner su customers → permission denied (grant limitati a profiles/user_access, colonne)', out)

# ---------------------------------------------------------------- R6 client cannot write/read internal tables or forge plans
S = 'R6-client-tabelle-interne'
for label, tok in [('authenticated A', lib.jwt(A)), ('service_role', lib.jwt(A, role='service_role'))]:
    st, body = http('/u2_role_probe.requests?select=*', token=tok)
    st2, _ = http('/requests?select=lease_token', token=tok)
    check(st in (401, 403, 404, 406) and st2 in (401, 403, 404), S, f'{label}: GET tabella interna (schema non esposto / nessun grant) → {st}/{st2}', f'{st} {st2}')
ok, out = as_user(A, 'authenticated', f"insert into u2_role_probe.requests(session_id, request_id, owner_uid) values ('{S1}','forged','{A}')")
check(not ok and 'permission denied' in out, S, 'proprietario A: INSERT diretto → permission denied (schema)', out)
ok, out = as_user(A, 'authenticated', f"update u2_role_probe.requests set llm_output = '{{}}' where session_id = '{S1}'")
check(not ok and 'permission denied' in out, S, 'proprietario A: UPDATE diretto di llm_output → permission denied', out)
ok, out = as_user(A, 'service_role', "update u2_role_probe.requests set llm_output = '{}'")
check(not ok and 'permission denied' in out, S, 'service_role: UPDATE diretto → permission denied (privilegio revocato; NON prova il trigger)', out)

# ---------------------------------------------------------------- R7 trigger rejection distinguished from permission denied
S = 'R7-trigger-vs-permission'
W = {'role': 'u2_probe_writer'}
ok, out = as_user(None, 'u2_probe_writer', f"update u2_role_probe.requests set context = '{{\"c\":1}}' where request_id = 'r1' returning status", W)
check(ok and out == 'pending', S, 'writer (LAB): context NULL→valore mentre pending → ammesso (ha UPDATE: il trigger decide)', out)
ok, out = as_user(None, 'u2_probe_writer', "update u2_role_probe.requests set context = '{\"c\":2}' where request_id = 'r1'", W)
check(not ok and 'context is write-once' in out, S, 'writer: context valore→altro valore → RIFIUTO DEL TRIGGER (U2W04), non permission denied', out)
ok, out = as_user(None, 'u2_probe_writer', "update u2_role_probe.requests set context = null where request_id = 'r1'", W)
check(not ok and 'cleared only at finalization' in out, S, 'writer: context→NULL mentre pending → rifiuto trigger', out)
ok, out = as_user(None, 'u2_probe_writer', "update u2_role_probe.requests set llm_output = '{\"o\":1}' where request_id = 'r1' returning status", W)
check(ok and out == 'pending', S, 'writer: llm_output NULL→valore mentre pending → ammesso', out)
ok, out = as_user(None, 'u2_probe_writer', "update u2_role_probe.requests set llm_output = '{\"o\":2}' where request_id = 'r1'", W)
check(not ok and 'output is write-once' in out, S, 'writer: llm_output sostituito → rifiuto trigger (U2W05)', out)
ok, out = as_user(None, 'u2_probe_writer', "update u2_role_probe.requests set response_body = 'early' where request_id = 'r1'", W)
check(not ok and 'response only at pending->done' in out, S, 'writer: response senza transizione pending→done → rifiuto trigger (U2W06)', out)
ok, out = as_user(None, 'u2_probe_writer', "update u2_role_probe.requests set status = 'done', http_status = 200, response_body = 'final', context = null, llm_output = null where request_id = 'r1' returning status", W)
check(ok and out == 'done', S, 'finalizzazione: pending→done con risposta e cancellazione di context/llm_output nello stesso UPDATE → ammessa', out)
ok, out = as_user(None, 'u2_probe_writer', "update u2_role_probe.requests set llm_output = '{\"o\":3}' where request_id = 'r1'", W)
check(not ok and 'output after finalization' in out, S, 'dopo done: llm_output NULL→valore → rifiuto trigger (nessuna sostituzione post-finalizzazione)', out)
ok, out = as_user(None, 'u2_probe_writer', "update u2_role_probe.requests set response_body = 'replaced' where request_id = 'r1'", W)
check(not ok and 'response is write-once' in out, S, 'dopo done: response sostituita → rifiuto trigger', out)
ok, out = as_user(None, 'u2_probe_writer', "update u2_role_probe.requests set response_body = null, status = 'expired' where request_id = 'r1'", W)
check(not ok and 'expiry tombstone' in out, S, 'tombstone prima di response_expires_at → rifiuto trigger', out)
ok, out = as_user(None, 'u2_probe_writer', "update u2_role_probe.requests set response_body = null, status = 'expired' where request_id = 'old1' returning http_status::text", W)
check(ok and out == '200', S, 'tombstone dopo response_expires_at: body→NULL con done→expired → ammesso; http_status conservato', out)
ok, out = as_user(None, 'u2_probe_writer', "update u2_role_probe.requests set status = 'pending' where request_id = 'old1'", W)
check(not ok and ('tombstone is final' in out or 'cannot return to pending' in out), S, 'expired→pending → rifiuto trigger (U2W01)', out)
ok, out = as_user(None, 'u2_probe_writer', "update u2_role_probe.requests set status = 'pending' where request_id = 'r1'", W)
check(not ok and 'cannot return to pending' in out, S, 'done→pending → rifiuto trigger', out)
ok, out = as_user(None, 'u2_probe_writer', "update u2_role_probe.requests set llm_dispatches_reserved = 3 where request_id = 'done1'", W)
check(not ok and 'budget monotonic' in out, S, 'budget >2 → rifiuto trigger (U2W03)', out)
ok, out = as_user(None, 'u2_probe_writer', f"update u2_role_probe.requests set owner_uid = '{B}' where request_id = 'done1'", W)
check(not ok and 'owner immutable' in out, S, 'owner riscritto → rifiuto trigger (U2W02)', out)
ok, out = as_user(None, 'u2_probe_writer', "delete from u2_role_probe.requests where request_id = 'done1'", W)
check(not ok and 'never deleted' in out, S, 'DELETE → rifiuto trigger (U2W07) anche per chi ha il privilegio DELETE', out)
ok, out = as_user(None, 'service_role', "update u2_role_probe.requests set context = '{\"x\":1}' where request_id = 'done1'")
check(not ok and 'permission denied' in out and 'U2W' not in out, S, 'controllo: service_role fallisce per PRIVILEGIO, non per trigger — la prova del trigger è quella del ruolo writer', out)

# ---------------------------------------------------------------- R8 readable extractions + helper and allowlist negatives
S = 'R8-estrazioni-helper-allowlist'
rows = sql(root, meta, "select r.rolname||'|'||m.rolname||'|'||am.admin_option::text from pg_auth_members am join pg_roles r on r.oid=am.roleid join pg_roles m on m.oid=am.member where r.rolname in ('gptour_semantic_backend','gptour_semantic_owner','anon','authenticated','service_role','authenticator','u2_probe_writer') or m.rolname in ('gptour_semantic_backend','gptour_semantic_owner','authenticator','u2_probe_writer') order by r.rolname, m.rolname")
memberships = [dict(zip(('ruolo_concesso', 'membro', 'admin_option'), r.split('|'))) for r in rows.splitlines()]
extraction = {'appartenenze_ruoli': memberships}
check({(x['ruolo_concesso'], x['membro']) for x in memberships} == {('anon', 'authenticator'), ('authenticated', 'authenticator'), ('service_role', 'authenticator'), ('gptour_semantic_backend', 'authenticator')}, S,
      'appartenenze leggibili: authenticator è MEMBRO dei ruoli anon/authenticated/service_role/backend (come hosted); anon/authenticated non sono mai membri di authenticator; owner e writer senza membri', str(memberships))
check(not any(x['ruolo_concesso'] == 'authenticator' for x in memberships), S, 'nessun ruolo ha authenticator come ruolo_concesso (nessuno è membro di authenticator)', str(memberships))
check(all(x['admin_option'] == 'false' for x in memberships), S, 'nessuna appartenenza con ADMIN OPTION', str(memberships))
helper = {}
for fn in ('u2_role_probe_is_authorized', 'u2_role_probe_is_authorized_ownerrole'):
    helper[fn] = {
        'owner': sql(root, meta, f"select pg_get_userbyid(p.proowner) from pg_proc p where p.proname='{fn}'"),
        'security_definer': sql(root, meta, f"select prosecdef::text from pg_proc where proname='{fn}'"),
        'proconfig': sql(root, meta, f"select coalesce(array_to_string(proconfig, ';'),'') from pg_proc where proname='{fn}'"),
        'return_type': sql(root, meta, f"select pg_get_function_result(p.oid) from pg_proc p where p.proname='{fn}'"),
        'arguments': sql(root, meta, f"select pg_get_function_arguments(p.oid) from pg_proc p where p.proname='{fn}'"),
        'acl': sql(root, meta, f"select coalesce(array_to_string(proacl, ';'),'<null>') from pg_proc where proname='{fn}'"),
        'definition': sql(root, meta, f"select pg_get_functiondef(p.oid) from pg_proc p where p.proname='{fn}'"),
    }
extraction['helper'] = helper
h = helper['u2_role_probe_is_authorized']
check(h['owner'] == 'postgres' and h['security_definer'] == 'true' and h['proconfig'] == 'search_path=""' and h['return_type'] == 'boolean' and h['arguments'] == 'p_uid uuid, p_agent_id uuid', S,
      'helper adottato: owner=ruolo migratore, SECURITY DEFINER, search_path vuoto, ritorna SOLO boolean(uuid,uuid)', json.dumps({k: v for k, v in h.items() if k != 'definition'}))
check(set(h['acl'].split(';')) == {'postgres=X/postgres', 'gptour_semantic_owner=X/postgres'}, S,
      'ACL helper: EXECUTE solo owner (+ proprietario postgres); nessun PUBLIC/anon/authenticated/service_role/backend', h['acl'])
ok, out = as_user(None, 'gptour_semantic_backend', f"select public.u2_role_probe_is_authorized('{A}','{A}')", {'role': 'gptour_semantic_backend', 'jti': 'lab-key-1'})
check(not ok and 'permission denied' in out, S, 'NEGATIVO: il ruolo backend non può chiamare l’helper direttamente (psql)', out)
st, body = http('/rpc/u2_role_probe_is_authorized', token=backend(), method='POST', body={'p_uid': A, 'p_agent_id': A})
check(st == 403 and body.get('code') == '42501', S, 'NEGATIVO: helper via PostgREST con credenziale backend → 403 42501', f'{st} {body}')
st, body = http('/rpc/u2_role_probe_is_authorized', token=lib.jwt(A), method='POST', body={'p_uid': A, 'p_agent_id': A})
check(st == 403, S, 'NEGATIVO: helper via PostgREST con JWT utente → 403', st)
for q, label in [('select email from public.profiles limit 1', 'owner: profiles.email (colonna non concessa) → permission denied'),
                 ('select full_name from public.profiles limit 1', 'owner: profiles.full_name → permission denied'),
                 ('select note from public.gptour_orchestrator_user_access limit 1', 'owner: user_access.note → permission denied'),
                 ('select * from public.customers limit 1', 'owner: customers → permission denied'),
                 ('select * from public.appointments limit 1', 'owner: appointments → permission denied')]:
    ok, out = as_user(None, 'gptour_semantic_owner', q)
    check(not ok and 'permission denied' in out, S, label, out)
ok, out = as_user(None, 'gptour_semantic_owner', "select public.u2_role_probe_is_authorized('00000000-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000000')::text")
check(ok and out == 'false', S, 'owner attraverso l’helper ottiene solo un booleano (uid sconosciuto → false), nessun dato CRM', out)
keys_owner = sql(root, meta, "select pg_get_userbyid(relowner)||'|'||coalesce(array_to_string(relacl, ';'),'<null>') from pg_class where oid='u2_role_probe.backend_keys'::regclass")
extraction['allowlist'] = {'table': 'u2_role_probe.backend_keys', 'owner_and_acl': keys_owner,
                           'gestione': 'solo il ruolo migratore/DBA tramite migration o runbook operativo; nessuna RPC backend scrive la allowlist'}
check(keys_owner.startswith('gptour_semantic_owner|') and 'gptour_semantic_backend' not in keys_owner and 'authenticated' not in keys_owner, S, 'allowlist jti: owner=gptour_semantic_owner, nessun grant a backend/authenticated', keys_owner)
ok, out = as_user(None, 'gptour_semantic_backend', "insert into u2_role_probe.backend_keys(jti, not_after) values ('rogue', clock_timestamp() + interval '1 day')", {'role': 'gptour_semantic_backend', 'jti': 'lab-key-1'})
check(not ok and 'permission denied' in out, S, 'NEGATIVO: il backend non può inserire nuovi jti (psql)', out)
ok, out = as_user(None, 'gptour_semantic_backend', "update u2_role_probe.backend_keys set revoked_at = null", {'role': 'gptour_semantic_backend', 'jti': 'lab-key-1'})
check(not ok and 'permission denied' in out, S, 'NEGATIVO: il backend non può riattivare jti revocati', out)
st, body = http('/u2_role_probe.backend_keys', token=backend(), method='POST', body={'jti': 'rogue', 'not_after': '2099-01-01T00:00:00Z'})
check(st in (401, 403, 404, 406), S, 'NEGATIVO: allowlist non raggiungibile via PostgREST (schema non esposto)', st)
writers = sql(root, meta, "select coalesce(string_agg(p.proname, ','),'') from pg_proc p where p.prosrc ilike '%backend_keys%' and (p.prosrc ilike '%insert into%backend_keys%' or p.prosrc ilike '%update%backend_keys%')")
check(writers == '', S, 'nessuna funzione della sonda scrive la allowlist: il backend non può autorizzarsi nuovi token tramite RPC', writers)
check(sql(root, meta, "select count(*) from u2_role_probe.backend_keys where jti='rogue'") == '0', S, 'nessun jti "rogue" inserito', '')
check(st != 201, S, 'controllo HTTP: nessuna creazione (status ≠ 201)', st)

passed = sum(r['status'] == 'PASS' for r in results)
(root / 'role_probe_report.json').write_text(json.dumps({'generated_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'checks': len(results), 'pass': passed, 'results': results, 'extraction': extraction}, indent=1))
print(f'ROLE_PROBE DONE checks={len(results)} pass={passed} fail={len(results) - passed}; credentials SYNTHETIC (lab secret), no production')
raise SystemExit(0 if passed == len(results) else 1)
