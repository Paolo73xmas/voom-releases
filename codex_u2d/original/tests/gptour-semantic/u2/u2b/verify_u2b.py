#!/usr/bin/env python3
"""U2-b acceptance on the replay lab (synthetic credentials). Requires 01_semantic_migration.sql applied.
Sections: B1 structure/privileges, B2 flow via PostgREST (backend key), B3 negatives on every RPC/table and role,
B4 ownership/authorization/revocation, B5 fencing/lease/deadline, B6 final conflict, B7 concurrency (real parallel
connections), B8 expiry/tombstone/cleanup compatibility, B9 trigger vs privilege vs RLS. Writes <root>/u2b_report.json."""
import concurrent.futures as cf
import json
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'schema_replay'))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from replay_common import settings, sql  # noqa: E402
import replay_verify_lib as lib  # noqa: E402

root, meta = settings()
A, B, C = lib.A, lib.B, lib.C
H1, H2 = 'a' * 64, 'b' * 64
results = []
RPCS = ['create_session', 'claim', 'renew_lease', 'store_context', 'begin_llm', 'store_llm', 'commit_success', 'finish_error', 'release_recoverable', 'recover_work', 'get_state', 'get_request', 'get_plan']
TABLES = ['gptour_semantic_sessions', 'gptour_semantic_requests', 'gptour_semantic_llm_invocations', 'gptour_semantic_plans', 'gptour_semantic_backend_keys']
RECEIPT_KEYS = {'requestId', 'status', 'httpStatus', 'requestOutcome', 'body', 'baseRevision', 'finalRevision', 'planId', 'acceptedAt', 'processingDeadline', 'responseExpiresAt', 'llmDispatchesReserved'}
V = 'semantic-1.1'
ENGINE = 'gptour-semantic-transport/u2-a'
GOLDEN_PLANNED = next(g['response'] for g in json.loads((Path(__file__).resolve().parents[1] / 'transport-goldens.json').read_text()) if g['name'] == 'gate_planned')


def tbody(sid_, rid, gate=None, result=None, plan=None):
    """Minimal handler-side committed TurnResponse (identity/revision/metadata are stamped by SQL)."""
    return {'operation': 'turn', 'contractVersion': V, 'engineVersion': 'handler', 'sessionId': sid_, 'requestId': rid, 'sessionRevision': None, 'outcome': 'committed', 'errorCode': None,
            'retryableSameRequest': False, 'nextAction': 'none', 'retryAfterMs': None, 'acceptedAt': None, 'responseExpiresAt': None, 'result': result, 'gate': gate, 'plan': plan,
            'openQuestions': [], 'openQuestionCount': 0, 'notApplied': [], 'dataQuality': None}


def ebody(sid_, rid, code, outcome, next_action, retryable=False):
    """Handler-side terminal error TurnResponse (policy stays handler-owned; mirrors errorFixture of golden-cases.ts)."""
    return {**tbody(sid_, rid), 'outcome': outcome, 'errorCode': code, 'retryableSameRequest': retryable, 'nextAction': next_action}


def planned_body(sid_, rid):
    g = json.loads(json.dumps(GOLDEN_PLANNED))
    g.update({'sessionId': sid_, 'requestId': rid, 'engineVersion': ENGINE})
    g['result'].update({'sessionId': sid_, 'requestId': rid})
    plan = g.pop('plan')
    g['plan'] = None
    return g, plan


def check(ok, section, label, detail=''):
    results.append({'section': section, 'label': label, 'status': 'PASS' if ok else 'FAIL', 'detail': str(detail)[:220]})
    print(('PASS ' if ok else 'FAIL ') + f'[{section}] {label}' + (f' :: {str(detail)[:180]}' if not ok else ''))


backend = lambda jti='u2b-lab-key', **kw: lib.jwt(sub=None, role='gptour_semantic_backend', extra={'jti': jti}, **kw)
BK = {'role': 'gptour_semantic_backend', 'jti': 'u2b-lab-key'}


ANON = 'ANON'


def rpc(name, body, token=None):
    tok = None if token == ANON else (token or backend())
    return lib.http(f'/rpc/gptour_semantic_{name}', token=tok, method='POST', body=body)


# lab bootstrap: backend key (allowlist managed by the migration role only), Fase 6 access for A (admin C enabled it), clean rows
sql(root, meta, "insert into public.gptour_semantic_backend_keys(jti, not_after, note) values ('u2b-lab-key', clock_timestamp() + interval '1 day', 'lab') on conflict (jti) do update set revoked_at = null, not_after = excluded.not_after")
sql(root, meta, f"insert into public.gptour_orchestrator_user_access(user_id, enabled, updated_by) values ('{A}', true, '{C}'), ('{B}', true, '{C}') on conflict (user_id) do update set enabled = true")
sql(root, meta, "set role gptour_semantic_owner; delete from public.gptour_semantic_plans; delete from public.gptour_semantic_llm_invocations; delete from public.gptour_semantic_requests; delete from public.gptour_semantic_sessions; reset role")

# ---------------------------------------------------------------- B1 structure & privileges
S = 'B1-struttura-privilegi'
own = sql(root, meta, "select string_agg(relname||':'||pg_get_userbyid(relowner)||':'||relrowsecurity::text, ',' order by relname) from pg_class where relname like 'gptour_semantic_%' and relkind='r'")
check(own == ','.join(f'{t}:gptour_semantic_owner:true' for t in sorted(TABLES)), S, '5 tabelle: owner gptour_semantic_owner, RLS abilitata', own)
check(sql(root, meta, "select count(*) from pg_policies where tablename like 'gptour_semantic_%'") == '0', S, 'nessuna policy: deny-all per i non proprietari')
grants = sql(root, meta, "select count(*) from information_schema.role_table_grants where table_name like 'gptour_semantic_%' and grantee <> 'gptour_semantic_owner'")
check(grants == '0', S, 'nessun privilegio di tabella a PUBLIC/anon/authenticated/service_role/backend', grants)
exe = sql(root, meta, "select string_agg(p.proname||':'||has_function_privilege('anon',p.oid,'EXECUTE')::text||has_function_privilege('authenticated',p.oid,'EXECUTE')::text||has_function_privilege('service_role',p.oid,'EXECUTE')::text||has_function_privilege('gptour_semantic_backend',p.oid,'EXECUTE')::text, ',' order by p.proname) from pg_proc p where p.proname like 'gptour_semantic_%'")
expected = {f'gptour_semantic_{r}': 'falsefalsefalsetrue' for r in RPCS}
got = dict(x.split(':') for x in exe.split(','))
check(all(got.get(k) == v for k, v in expected.items()) and all(v == 'falsefalsefalsefalse' for k, v in got.items() if k not in expected) and len(got) == 27, S, 'EXECUTE: 13 RPC solo backend; helper/trigger/lock/receipt/policy/ts/align a nessun ruolo PostgREST (27 funzioni)', exe)
check(sql(root, meta, "select count(*) from (select unnest(proacl) a from pg_proc where proname like 'gptour_semantic_%') x where a::text like '=%'") == '0', S, 'nessuna voce PUBLIC nelle ACL delle funzioni')
sp = sql(root, meta, "select count(*) from pg_proc where proname like 'gptour_semantic_%' and prosecdef and (proconfig is null or not exists (select 1 from unnest(proconfig) c where c like 'search_path=%'))")
check(sp == '0', S, 'tutte le SECURITY DEFINER con search_path fissato', sp)
ownf = sql(root, meta, "select string_agg(distinct pg_get_userbyid(proowner), ',') from pg_proc where proname like 'gptour_semantic_%' and proname <> 'gptour_semantic_is_authorized'")
check(ownf == 'gptour_semantic_owner' and sql(root, meta, "select pg_get_userbyid(proowner) from pg_proc where proname='gptour_semantic_is_authorized'") == 'postgres', S, 'RPC/trigger owned da gptour_semantic_owner; helper owned dal ruolo migratore', ownf)
mem = sql(root, meta, "select string_agg(r.rolname||'|'||m.rolname, ',' order by r.rolname) from pg_auth_members am join pg_roles r on r.oid=am.roleid join pg_roles m on m.oid=am.member where r.rolname in ('gptour_semantic_backend','gptour_semantic_owner') or m.rolname in ('gptour_semantic_backend','gptour_semantic_owner')")
check(mem == 'gptour_semantic_backend|authenticator', S, 'appartenenze: solo gptour_semantic_backend → membro authenticator', mem)
trg = sql(root, meta, "select count(*) from information_schema.triggers where event_object_table like 'gptour_semantic_%'")
check(trg == '9', S, 'trigger: 4 guard UPDATE + 5 no-delete', trg)

# ---------------------------------------------------------------- B2 flow (backend credential via PostgREST)
S = 'B2-flusso'
st, body = rpc('create_session', {'p_caller_uid': A, 'p_agent_id': A, 'p_contract_version': 'semantic-1.1', 'p_engine_version': 'u1-4'})
check(st == 200 and body['revision'] == 0, S, 'create_session → rev 0, id server-generated', f'{st} {body}')
sid = body['sessionId'] if st == 200 else str(uuid.uuid4())
st, c1 = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_payload_hash': H1, 'p_expected_revision': 0})
check(st == 200 and c1['outcome'] == 'new' and c1['baseRevision'] == 0 and c1['llmDispatchesReserved'] == 0, S, 'claim r1 → new, base_revision 0, budget 0', f'{st} {c1}')
tok = c1.get('token')
st, b = rpc('begin_llm', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_token': tok, 'p_invocation_id': 'i1'})
check(st == 409, S, 'begin_llm prima di store_context → PT409 (contesto obbligatorio prima della riserva)', f'{st} {b}')
st, b = rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_token': tok, 'p_context': {'catalog': ['milano'], 'acceptedAt': c1['acceptedAt']}})
check(st == 200 and b['alreadyStored'] is False, S, 'store_context (1ª) → salvato', f'{st} {b}')
st, b = rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_token': tok, 'p_context': {'other': 1}})
check(st == 200 and b['alreadyStored'] is True and sql(root, meta, f"select context->>'catalog' from public.gptour_semantic_requests where request_id='r1' and session_id='{sid}'") == '["milano"]', S, 'store_context (2ª, diverso) → alreadyStored, contenuto originale conservato', f'{st} {b}')
st, b1 = rpc('begin_llm', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_token': tok, 'p_invocation_id': 'i1'})
st2, b2 = rpc('begin_llm', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_token': tok, 'p_invocation_id': 'i1'})
check(b1 == {'mayDispatch': True, 'alreadyReserved': False, 'reserved': 1} and b2 == {'mayDispatch': False, 'alreadyReserved': True, 'reserved': 1}, S, 'begin_llm i1 → mayDispatch una sola volta; replay stessa invocationId → alreadyReserved, nessun incremento', f'{b1} {b2}')
st, b3 = rpc('begin_llm', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_token': tok, 'p_invocation_id': 'i2'})
st, b4 = rpc('begin_llm', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_token': tok, 'p_invocation_id': 'i3'})
check(b3['mayDispatch'] is True and b3['reserved'] == 2 and b4 == {'mayDispatch': False, 'budgetExhausted': True, 'reserved': 2}, S, 'seconda riserva ammessa (2/2); terza rifiutata atomicamente', f'{b3} {b4}')
st, b = rpc('store_llm', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_token': tok, 'p_invocation_id': 'i9', 'p_output': {'x': 1}})
check(st == 409, S, 'store_llm senza riserva corrispondente → PT409', f'{st} {b}')
st, b = rpc('store_llm', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_token': tok, 'p_invocation_id': 'i2', 'p_output': {'criteria': 'v1'}})
check(st == 200 and b['alreadyStored'] is False, S, 'store_llm (i2) → salvato', f'{st} {b}')
st, b = rpc('store_llm', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_token': tok, 'p_invocation_id': 'i1', 'p_output': {'criteria': 'v2'}})
check(st == 200 and b['alreadyStored'] is True and sql(root, meta, f"select llm_output->>'criteria' from public.gptour_semantic_requests where request_id='r1' and session_id='{sid}'") == 'v1', S, 'secondo output → alreadyStored, primo conservato (write-once)', f'{st} {b}')
st, b = rpc('begin_llm', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_token': tok, 'p_invocation_id': 'i4'})
check(b.get('mayDispatch') is False and b.get('outputStored') is True, S, 'output salvato → nessuna nuova riserva (zero invii al provider)', b)
st, r = rpc('renew_lease', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_token': tok})
check(st == 200 and r['ok'] is True and r['leaseUntil'] <= r['processingDeadline'], S, 'renew_lease → esteso entro la deadline', f'{st} {r}')
st, cm = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_token': tok, 'p_new_state': {'criteria': 'v1'}, 'p_operational': {'dep': 'milano'}, 'p_plan': {'stops': ['t1']}, 'p_body': tbody(sid, 'r1', gate='planned')})
check(st == 200 and cm['outcome'] == 'committed' and cm['revision'] == 1 and cm['finalRevision'] == 1 and cm['planId'] and cm['httpStatus'] == 200, S, 'commit_success → committed, rev 1, piano creato, ricevuta done 200', f'{st} {cm}')
plan_id = cm.get('planId')
BODY1 = cm.get('body')
b1j = json.loads(BODY1 or '{}')
check(b1j.get('sessionRevision') == 1 and b1j.get('plan', {}).get('planId') == plan_id and b1j.get('plan', {}).get('sessionRevision') == 1 and b1j.get('acceptedAt') == cm['acceptedAt'] and b1j.get('engineVersion') == 'u1-4', S, 'body persistito: sessionRevision/plan.planId/plan.sessionRevision/acceptedAt/engineVersion stampati dal SQL', b1j.get('plan'))
row = sql(root, meta, f"select status||'|'||coalesce(context::text,'∅')||'|'||coalesce(llm_output::text,'∅')||'|'||coalesce(lease_token::text,'∅')||'|'||llm_dispatches_reserved from public.gptour_semantic_requests where request_id='r1' and session_id='{sid}'")
check(row == 'done|∅|∅|∅|2', S, 'alla finalizzazione context/output/lease azzerati, budget conservato (2)', row)
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_payload_hash': H1, 'p_expected_revision': 0})
check(st == 200 and c['outcome'] == 'cached' and c['body'] == BODY1 and c['httpStatus'] == 200 and c['planId'] == plan_id and 'token' not in c, S, 'replay stesso requestId/hash → cached con body byte-identico e stesso planId, nessun token', c)
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_payload_hash': H2, 'p_expected_revision': 0})
check(st == 200 and c['outcome'] == 'reused' and c['body'] == BODY1, S, 'stesso requestId con hash diverso → reused, richiesta originale intatta', c)
st, g = rpc('get_request', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1'})
check(st == 200 and set(g) == RECEIPT_KEYS, S, 'get_request: insieme ESATTO delle chiavi (nessun lease/context/output/hash)', g)
st, g = rpc('get_state', {'p_caller_uid': A, 'p_session_id': sid})
check(st == 200 and g['revision'] == 1 and g['state'] == {'criteria': 'v1'} and g['lastPlanId'] == plan_id and g['operational'] == {'dep': 'milano', 'lastPlanId': plan_id, 'planRevision': 1} and set(g) == {'sessionId', 'agentId', 'revision', 'state', 'operational', 'lastPlanId', 'contractVersion', 'expiresAt', 'lastCommitAt'}, S, 'get_state: rev 1, stato committato, lastPlanId + operational.lastPlanId/planRevision, chiavi esatte', g)
st, g = rpc('get_plan', {'p_caller_uid': A, 'p_plan_id': plan_id})
check(st == 200 and g['planRevision'] == 1 and g['plan'] == {'stops': ['t1'], 'planId': plan_id, 'sessionId': sid, 'sessionRevision': 1}, S, 'get_plan: planRevision = revisione del commit; plan.planId/sessionId/sessionRevision stampati', g)
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'e1', 'p_payload_hash': H1, 'p_expected_revision': 1})
tok_e = c.get('token')
st, fe = rpc('finish_error', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'e1', 'p_token': tok_e, 'p_http_status': 503, 'p_body': ebody(sid, 'e1', 'llm_unavailable', 'committed', 'confirm_new_turn')})
sess = sql(root, meta, f"select revision||'|'||(select count(*) from public.gptour_semantic_plans where session_id='{sid}') from public.gptour_semantic_sessions where session_id='{sid}'")
check(st == 200 and fe['outcome'] == 'finished_error' and fe['httpStatus'] == 503 and fe['requestOutcome'] == 'llm_unavailable' and json.loads(fe['body'])['sessionRevision'] == 1 and sess == '1|1', S, 'finish_error → solo la request è done 503 (outcome = errorCode del body, sessionRevision stampata); sessione rev 1 e piani invariati (+0)', f'{fe} {sess}')
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rr', 'p_payload_hash': H1, 'p_expected_revision': 1})
tok_rr = c['token']
st, rl = rpc('release_recoverable', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rr', 'p_token': tok_rr, 'p_error_code': 'provider_timeout', 'p_retry_after_ms': 1500})
st2, c2 = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rr', 'p_payload_hash': H1, 'p_expected_revision': 1})
st3, cc = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'cap', 'p_payload_hash': H1, 'p_expected_revision': 1})
st3, rl2 = rpc('release_recoverable', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'cap', 'p_token': cc['token'], 'p_error_code': 'x', 'p_retry_after_ms': 10 ** 9})
capped = sql(root, meta, f"select (next_retry_at <= least(clock_timestamp() + interval '61 seconds', processing_deadline))::text from public.gptour_semantic_requests where request_id='cap' and session_id='{sid}'")
check(st3 == 200 and capped == 'true', S, 'release_recoverable con backoff abnorme (10^9 ms) → next_retry_at limitato a ≤60 s e ≤ deadline (valore server, non controllabile)', f'{rl2} {capped}')
check(rl['status'] == 'pending' and c2['outcome'] == 'in_progress' and 0 < c2['retryAfterMs'] <= 1600, S, 'release_recoverable → pending con next_retry_at; claim immediata → in_progress + retryAfterMs', f'{rl} {c2}')
st, b = rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rr', 'p_token': tok_rr, 'p_context': {'c': 1}})
check(st == 409, S, 'dopo il rilascio il vecchio token non scrive più (lease rilasciato)', f'{st} {b}')

# ---------------------------------------------------------------- B3 negatives on every RPC / table / role
S = 'B3-negativi-RPC-tabelle'
args = {'create_session': {'p_caller_uid': A, 'p_agent_id': A, 'p_contract_version': 'x', 'p_engine_version': 'y'},
        'claim': {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'n1', 'p_payload_hash': H1, 'p_expected_revision': 1},
        'renew_lease': {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rr', 'p_token': tok_rr},
        'store_context': {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rr', 'p_token': tok_rr, 'p_context': {}},
        'begin_llm': {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rr', 'p_token': tok_rr, 'p_invocation_id': 'z'},
        'store_llm': {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rr', 'p_token': tok_rr, 'p_invocation_id': 'z', 'p_output': {}},
        'commit_success': {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rr', 'p_token': tok_rr, 'p_new_state': {}, 'p_operational': None, 'p_plan': {'forged': True}, 'p_body': tbody(sid, 'rr', gate='planned')},
        'finish_error': {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rr', 'p_token': tok_rr, 'p_http_status': 500, 'p_body': ebody(sid, 'rr', 'internal_error', 'committed', 'contact_support')},
        'release_recoverable': {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rr', 'p_token': tok_rr, 'p_error_code': 'x', 'p_retry_after_ms': 1},
        'recover_work': {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rr', 'p_token': tok_rr},
        'get_state': {'p_caller_uid': A, 'p_session_id': sid}, 'get_request': {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1'}, 'get_plan': {'p_caller_uid': A, 'p_plan_id': plan_id}}
before = sql(root, meta, "select md5(string_agg(t::text, '|' order by t::text)) from (select s.session_id, s.revision, s.state from public.gptour_semantic_sessions s) t") + sql(root, meta, "select count(*)::text from public.gptour_semantic_plans")
for label, tok_ in [('proprietario A (authenticated)', lib.jwt(A)), ('A con user_metadata.role=admin', lib.jwt(A, user_metadata={'role': 'admin'})), ('service_role', lib.jwt(A, role='service_role')), ('anon', ANON), ('backend con jti revocato/sconosciuto', backend(jti='nope'))]:
    codes = {}
    for name in RPCS:
        st, body = rpc(name, args[name], token=tok_)
        codes[name] = st
    ok = all(c in (401, 403) for c in codes.values())
    check(ok, S, f'{label}: tutte le 13 RPC respinte (401/403)', codes)
after = sql(root, meta, "select md5(string_agg(t::text, '|' order by t::text)) from (select s.session_id, s.revision, s.state from public.gptour_semantic_sessions s) t") + sql(root, meta, "select count(*)::text from public.gptour_semantic_plans")
check(before == after, S, 'nessuna mutazione di sessioni/piani dai tentativi respinti (hash prima/dopo identico)', f'{before} {after}')
POSTS = {'gptour_semantic_sessions': {'owner_uid': A, 'agent_id': A, 'contract_version': 'x', 'engine_version': 'y'},
         'gptour_semantic_requests': {'session_id': sid, 'request_id': 'forged', 'owner_uid': A, 'payload_hash': H1, 'base_revision': 0, 'processing_deadline': '2099-01-01T00:00:00Z', 'response_expires_at': '2099-01-01T00:00:00Z'},
         'gptour_semantic_llm_invocations': {'session_id': sid, 'request_id': 'rr', 'invocation_id': 'forged', 'ordinal': 1},
         'gptour_semantic_plans': {'session_id': sid, 'owner_uid': A, 'plan_revision': 9, 'plan': {'forged': True}},
         'gptour_semantic_backend_keys': {'jti': 'rogue', 'not_after': '2099-01-01T00:00:00Z'}}
PATCHES = {'gptour_semantic_sessions': {'revision': 99}, 'gptour_semantic_requests': {'status': 'pending'}, 'gptour_semantic_llm_invocations': {'outcome': 'x'},
           'gptour_semantic_plans': {'plan_revision': 9}, 'gptour_semantic_backend_keys': {'revoked_at': None}}
for label, tok_ in [('proprietario A', lib.jwt(A)), ('service_role', lib.jwt(A, role='service_role')), ('backend', backend()), ('anon', None)]:
    codes = {}
    for t in TABLES:
        codes[t + ':GET'] = lib.http(f'/{t}?select=*', token=tok_)[0]
        codes[t + ':POST'] = lib.http(f'/{t}', token=tok_, method='POST', body=POSTS[t])[0]
        key = 'jti' if t.endswith('keys') else 'session_id'
        codes[t + ':PATCH'] = lib.http(f'/{t}?{key}=eq.{"u2b-lab-key" if key == "jti" else sid}', token=tok_, method='PATCH', body=PATCHES[t])[0]
        codes[t + ':DELETE'] = lib.http(f'/{t}?{key}=eq.{"u2b-lab-key" if key == "jti" else sid}', token=tok_, method='DELETE')[0]
    check(all(c in (401, 403) for c in codes.values()), S, f'{label}: GET/POST/PATCH/DELETE su tutte le 5 tabelle respinti', codes)
check(sql(root, meta, f"select revision from public.gptour_semantic_sessions where session_id='{sid}'") == '1' and sql(root, meta, "select count(*) from public.gptour_semantic_backend_keys where jti='rogue'") == '0' and sql(root, meta, "select count(*) from public.gptour_semantic_plans") == '1', S, 'DB invariato dopo i tentativi diretti (rev 1, nessun jti rogue, 1 piano)')
ok, out = lib.as_user(None, 'gptour_semantic_backend', "select count(*) from public.gptour_semantic_requests", BK)
check(not ok and 'permission denied' in out, S, 'backend: SELECT diretto sulle tabelle → permission denied (solo RPC)', out)
ok, out = lib.as_user(None, 'gptour_semantic_backend', f"select public.gptour_semantic_is_authorized('{A}','{A}')", BK)
check(not ok and 'permission denied' in out, S, 'backend: helper di autorizzazione non invocabile direttamente', out)
ok, out = lib.as_user(None, 'gptour_semantic_backend', "insert into public.gptour_semantic_backend_keys(jti, not_after) values ('rogue2', clock_timestamp() + interval '1 day')", BK)
check(not ok and 'permission denied' in out, S, 'backend: non può autorizzarsi nuovi jti', out)
ok, out = lib.as_user(None, 'gptour_semantic_backend', f"select public.gptour_semantic_claim('{A}','{sid}','n2','{H1}',1)", {'role': 'authenticated', 'sub': A, 'jti': 'u2b-lab-key'})
check(not ok and 'backend credential required' in out, S, 'SET ROLE backend ma claims non backend → rifiuto del controllo interno', out)

# ---------------------------------------------------------------- B4 ownership / current authorization / revocation
S = 'B4-ownership-autorizzazione'
st, body = rpc('claim', {'p_caller_uid': B, 'p_session_id': sid, 'p_request_id': 'x', 'p_payload_hash': H1, 'p_expected_revision': 1})
check(st == 404 and body['code'] == 'PT404', S, 'B su sessione di A → 404 non enumerante', f'{st} {body}')
st, body = rpc('get_plan', {'p_caller_uid': B, 'p_plan_id': plan_id})
check(st == 404, S, 'B legge piano di A → 404', st)
st, body = rpc('create_session', {'p_caller_uid': A, 'p_agent_id': B, 'p_contract_version': 'x', 'p_engine_version': 'y'})
check(st == 403 and body['code'] == 'PT403', S, 'A crea sessione per l’agente B → 403 (agent_id vincolato all’autorizzazione, a differenza di Fase 4B)', f'{st} {body}')
st, body = rpc('create_session', {'p_caller_uid': C, 'p_agent_id': A, 'p_contract_version': 'x', 'p_engine_version': 'y'})
check(st == 403, S, 'admin C senza abilitazione Fase 6 → 403 (kill-switch rispettato anche per admin)', f'{st} {body}')
st, body = rpc('create_session', {'p_caller_uid': 'd0000000-0000-4000-8000-00000000000d', 'p_agent_id': 'd0000000-0000-4000-8000-00000000000d', 'p_contract_version': 'x', 'p_engine_version': 'y'})
check(st == 403, S, 'ruolo customer → 403', st)
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rv', 'p_payload_hash': H1, 'p_expected_revision': 1})
tok_rv = c['token']
sql(root, meta, f"update public.gptour_orchestrator_user_access set enabled = false where user_id = '{A}'")
codes = {}
for name, extra in [('store_context', {'p_token': tok_rv, 'p_context': {'c': 1}}), ('begin_llm', {'p_token': tok_rv, 'p_invocation_id': 'q'}), ('commit_success', {'p_token': tok_rv, 'p_new_state': {}, 'p_operational': None, 'p_plan': None, 'p_body': tbody(sid, 'rv')}), ('finish_error', {'p_token': tok_rv, 'p_http_status': 500, 'p_body': ebody(sid, 'rv', 'internal_error', 'committed', 'contact_support')}), ('renew_lease', {'p_token': tok_rv}), ('release_recoverable', {'p_token': tok_rv, 'p_error_code': 'x', 'p_retry_after_ms': 1}), ('recover_work', {'p_token': tok_rv}), ('get_request', {}), ('claim', {'p_payload_hash': H1, 'p_expected_revision': 1})]:
    st, body = rpc(name, {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rv', **extra})
    codes[name] = st
st, body = rpc('get_state', {'p_caller_uid': A, 'p_session_id': sid}); codes['get_state'] = st
st, body = rpc('get_plan', {'p_caller_uid': A, 'p_plan_id': plan_id}); codes['get_plan'] = st
check(all(c == 404 for c in codes.values()), S, 'accesso revocato (Fase 6 OFF): scritture con token valido, recupero interno e letture/replay → tutte 404; stato della request intatto', codes)
check(sql(root, meta, f"select status||'|'||coalesce(context::text,'∅') from public.gptour_semantic_requests where request_id='rv' and session_id='{sid}'") == 'pending|∅', S, 'request rv ancora pending senza contesto dopo i tentativi post-revoca')
sql(root, meta, f"update public.gptour_orchestrator_user_access set enabled = true where user_id = '{A}'")
st, body = rpc('get_state', {'p_caller_uid': A, 'p_session_id': sid})
check(st == 200 and body['revision'] == 1, S, 'riabilitazione → accesso ripristinato, dati storici intatti (rev 1)', st)

def backdate(table, trigger, set_clause, where):
    """TIME SIMULATION ONLY (superuser, lab): backdates an immutable timestamp by disabling the guard trigger inside ONE
    transaction so it is always re-enabled; this stands in for elapsed wall-clock time and is not a path available to any role."""
    sql(root, meta, f"begin; set local role gptour_semantic_owner; alter table public.{table} disable trigger {trigger}; update public.{table} set {set_clause} where {where}; alter table public.{table} enable trigger {trigger}; commit;")
    assert sql(root, meta, f"select tgenabled from pg_trigger where tgname='{trigger}'") == 'O'


# ---------------------------------------------------------------- B5 fencing / lease / deadline
S = 'B5-fencing-lease-deadline'
bad = str(uuid.uuid4())
codes = {n: rpc(n, {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rv', 'p_token': bad, **e})[0] for n, e in [('renew_lease', {}), ('store_context', {'p_context': {}}), ('begin_llm', {'p_invocation_id': 'w'}), ('store_llm', {'p_invocation_id': 'w', 'p_output': {}}), ('commit_success', {'p_new_state': {}, 'p_operational': None, 'p_plan': None, 'p_body': tbody(sid, 'rv')}), ('finish_error', {'p_http_status': 500, 'p_body': ebody(sid, 'rv', 'internal_error', 'committed', 'contact_support')}), ('release_recoverable', {'p_error_code': 'x', 'p_retry_after_ms': 1}), ('recover_work', {})]}
check(all(c == 409 for c in codes.values()), S, 'token sconosciuto su tutte le 8 RPC fenced → 409', codes)
sql(root, meta, f"set role gptour_semantic_owner; update public.gptour_semantic_requests set lease_until = clock_timestamp() - interval '1 second' where request_id='rv' and session_id='{sid}'; reset role")
st, body = rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rv', 'p_token': tok_rv, 'p_context': {'c': 1}})
check(st == 409, S, 'lease scaduto: il token corrente non scrive più → 409', st)
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rv', 'p_payload_hash': H1, 'p_expected_revision': 1})
check(c['outcome'] == 'takeover' and c['processingAttempts'] == 2 and c['token'] != tok_rv and c['baseRevision'] == 1 and c['llmDispatchesReserved'] == 0, S, 'claim → takeover: nuovo token, processing_attempts 2, base_revision/accepted_at/budget conservati', c)
tok_rv2 = c['token']
st, body = rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rv', 'p_token': tok_rv, 'p_context': {'c': 1}})
check(st == 409, S, 'worker A risvegliato con il vecchio token → respinto (T10)', st)
st, body = rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rv', 'p_token': tok_rv2, 'p_context': {'c': 1}})
check(st == 200, S, 'nuovo token scrive', st)
sql(root, meta, f"set role gptour_semantic_owner; update public.gptour_semantic_requests set lease_until = clock_timestamp() - interval '1 second' where request_id='rv' and session_id='{sid}'; reset role")
st, body = rpc('renew_lease', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rv', 'p_token': tok_rv2})
check(st == 409, S, 'renew_lease non resuscita un lease scaduto', st)
backdate('gptour_semantic_requests', 'gptour_semantic_requests_guard', "processing_deadline = clock_timestamp() - interval '1 second'", f"request_id='rv' and session_id='{sid}'")
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rv', 'p_payload_hash': H1, 'p_expected_revision': 1})
check(c['outcome'] == 'deadline_finalized' and c['httpStatus'] == 503 and c['status'] == 'done' and json.loads(c['body'])['errorCode'] == 'processing_expired', S, 'deadline superata: claim finalizza per scadenza → done 503 processing_expired (body TurnResponse canonico), nessuna elaborazione (T38)', c)
st, body = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rv', 'p_token': tok_rv2, 'p_new_state': {'late': 1}, 'p_operational': None, 'p_plan': None, 'p_body': tbody(sid, 'rv')})
check(st == 409 and sql(root, meta, f"select revision from public.gptour_semantic_sessions where session_id='{sid}'") == '1', S, 'successo tardivo con worker vivo → 409, sessione invariata', st)
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'rv', 'p_payload_hash': H1, 'p_expected_revision': 1})
check(c['outcome'] == 'cached' and c['httpStatus'] == 503, S, 'retry → ricevuta 503 conservata, nessuna seconda finalizzazione (T39)', c)

# ---------------------------------------------------------------- B6 final conflict (sequential) and B7 concurrency (parallel connections)
S = 'B6-conflitto-finale'
toks = {}
for rid in ('c1', 'c2'):
    st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': rid, 'p_payload_hash': H1, 'p_expected_revision': 1}); toks[rid] = c['token']
    rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': rid, 'p_token': c['token'], 'p_context': {'c': rid}})
st, w = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'c1', 'p_token': toks['c1'], 'p_new_state': {'criteria': 'v2'}, 'p_operational': None, 'p_plan': {'stops': ['t2']}, 'p_body': tbody(sid, 'c1', gate='planned')})
st, l = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'c2', 'p_token': toks['c2'], 'p_new_state': {'criteria': 'v3'}, 'p_operational': None, 'p_plan': {'stops': ['t3']}, 'p_body': tbody(sid, 'c2', gate='planned')})
check(w['outcome'] == 'committed' and w['revision'] == 2 and l['outcome'] == 'revision_conflict' and l['httpStatus'] == 409 and l['finalRevision'] == 2 and l['status'] == 'done' and l['planId'] is None, S, 'c1 committed rev 2; c2 → revision_conflict committato come ricevuta 409 (ritorno, non eccezione), nessun planId', f'{w} {l}')
lj = json.loads(l['body'])
check(lj['errorCode'] == 'revision_conflict' and lj['outcome'] == 'committed' and lj['nextAction'] == 'get_state_and_confirm' and lj['retryableSameRequest'] is False and lj['sessionRevision'] == 2 and lj['plan'] is None and lj['result'] is None and lj['requestId'] == 'c2', S, 'body del conflitto costruito dal SQL: TurnResponse canonico con policy revision_conflict e sessionRevision osservata', lj)
check(sql(root, meta, f"select revision||'|'||(select count(*) from public.gptour_semantic_plans where session_id='{sid}')||'|'||(select state->>'criteria' from public.gptour_semantic_sessions where session_id='{sid}') from public.gptour_semantic_sessions where session_id='{sid}'") == '2|2|v2', S, 'totale +1, un solo piano nuovo, stato del vincitore', '')
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'c2', 'p_payload_hash': H1, 'p_expected_revision': 1})
check(c['outcome'] == 'cached' and c['httpStatus'] == 409 and c['body'] == l['body'], S, 'replay del perdente → stesso 409 conservato', c)
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'old', 'p_payload_hash': H1, 'p_expected_revision': 0})
rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'old', 'p_token': c['token'], 'p_context': {}})
st, l = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'old', 'p_token': c['token'], 'p_new_state': {'x': 1}, 'p_operational': None, 'p_plan': None, 'p_body': tbody(sid, 'old')})
check(l['outcome'] == 'revision_conflict' and l['finalRevision'] == 2 and sql(root, meta, f"select revision from public.gptour_semantic_sessions where session_id='{sid}'") == '2', S, 'expectedRevision vecchia → 409 committato, +0 (T03)', l)

S = 'B7-concorrenza'
with cf.ThreadPoolExecutor(max_workers=10) as ex:
    raw = list(ex.map(lambda i: rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'par', 'p_payload_hash': H1, 'p_expected_revision': 2}), range(10)))
outs = [(b or {}).get('outcome', st) for st, b in raw]
check(outs.count('new') == 1 and outs.count('in_progress') == 9, S, '10 claim parallele identiche → 1 new, 9 in_progress (T34)', outs)
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'par', 'p_payload_hash': H1, 'p_expected_revision': 2})
tok_par = sql(root, meta, f"select lease_token from public.gptour_semantic_requests where request_id='par' and session_id='{sid}'")
rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'par', 'p_token': tok_par, 'p_context': {}})
with cf.ThreadPoolExecutor(max_workers=5) as ex:
    outs = list(ex.map(lambda i: rpc('begin_llm', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'par', 'p_token': tok_par, 'p_invocation_id': f'p{i}'})[1].get('mayDispatch'), range(5)))
check(outs.count(True) == 2 and sql(root, meta, f"select llm_dispatches_reserved||'|'||(select count(*) from public.gptour_semantic_llm_invocations where request_id='par') from public.gptour_semantic_requests where request_id='par'") == '2|2', S, '5 riserve concorrenti con invocationId diversi → esattamente 2 ammesse, 2 righe invocazione (T13)', outs)
toks = {}
for rid in ('k1', 'k2'):
    st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': rid, 'p_payload_hash': H1, 'p_expected_revision': 2}); toks[rid] = c['token']
    rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': rid, 'p_token': c['token'], 'p_context': {}})
with cf.ThreadPoolExecutor(max_workers=2) as ex:
    outs = list(ex.map(lambda rid: rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': rid, 'p_token': toks[rid], 'p_new_state': {'k': rid}, 'p_operational': None, 'p_plan': {'k': rid}, 'p_body': tbody(sid, rid, gate='planned')})[1].get('outcome'), ('k1', 'k2')))
check(sorted(outs) == ['committed', 'revision_conflict'] and sql(root, meta, f"select revision||'|'||(select count(*) from public.gptour_semantic_plans where session_id='{sid}' and plan_revision=3) from public.gptour_semantic_sessions where session_id='{sid}'") == '3|1', S, 'commit concorrenti alla stessa base → uno committed, uno conflitto; +1 e un solo piano (T04)', outs)
with cf.ThreadPoolExecutor(max_workers=6) as ex:
    bodies = list(ex.map(lambda i: rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'c1', 'p_payload_hash': H1, 'p_expected_revision': 1})[1].get('body'), range(6)))
check(all(b == w['body'] for b in bodies), S, '6 replay paralleli di una request done → body identici (T07/T39)', bodies[:1])

# ---------------------------------------------------------------- B8 expiry / tombstone / cleanup compatibility
S = 'B8-scadenze-tombstone'
backdate('gptour_semantic_requests', 'gptour_semantic_requests_guard', "response_expires_at = clock_timestamp() - interval '1 second'", f"request_id='c1' and session_id='{sid}'")
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'c1', 'p_payload_hash': H1, 'p_expected_revision': 1})
row = sql(root, meta, f"select status||'|'||coalesce(response_body,'∅')||'|'||http_status||'|'||final_revision||'|'||llm_dispatches_reserved from public.gptour_semantic_requests where request_id='c1' and session_id='{sid}'")
check(c['outcome'] == 'expired' and c['body'] is None and row == 'expired|∅|200|2|0', S, 'oltre response_expires_at: claim → expired; tombstone senza body ma con http_status/revisione/contatori (T19/T20)', f'{c} {row}')
st, body = rpc('get_request', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'c1'})
check(st == 410, S, 'get_request su tombstone → 410', st)
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'c1', 'p_payload_hash': H1, 'p_expected_revision': 1})
check(c['outcome'] == 'expired', S, 'retry oltre retention non reinserisce la coppia (tombstone impedisce il riuso)', c)
st, s2 = rpc('create_session', {'p_caller_uid': A, 'p_agent_id': A, 'p_contract_version': 'x', 'p_engine_version': 'y'})
sid2 = s2['sessionId']
backdate('gptour_semantic_sessions', 'gptour_semantic_sessions_guard', "created_at = clock_timestamp() - interval '25 hours'", f"session_id='{sid2}'")
codes = (rpc('claim', {'p_caller_uid': A, 'p_session_id': sid2, 'p_request_id': 'x', 'p_payload_hash': H1, 'p_expected_revision': 0})[0], rpc('get_state', {'p_caller_uid': A, 'p_session_id': sid2})[0])
check(codes == (410, 410), S, 'sessione mai usata oltre 24h → 410 su claim e get_state (T21); nessuna resurrezione', codes)
sql(root, meta, f"set role gptour_semantic_owner; update public.gptour_semantic_sessions set expires_at = clock_timestamp() - interval '1 second' where session_id='{sid}'; reset role")
codes = (rpc('get_state', {'p_caller_uid': A, 'p_session_id': sid})[0], rpc('get_plan', {'p_caller_uid': A, 'p_plan_id': plan_id})[0], rpc('claim', {'p_caller_uid': A, 'p_session_id': sid, 'p_request_id': 'r1', 'p_payload_hash': H1, 'p_expected_revision': 0})[0])
check(codes == (410, 410, 410), S, 'sessione scaduta: stato, piano e replay → 410 (scadenza logica applicata anche senza job)', codes)
st, body = rpc('claim', {'p_caller_uid': A, 'p_session_id': str(uuid.uuid4()), 'p_request_id': 'r1', 'p_payload_hash': H1, 'p_expected_revision': 0})
check(st == 404 and sql(root, meta, "select count(*) from public.gptour_semantic_sessions") == '2', S, 'claim verso sessione inventata → 404, nessuna creazione (T02)', st)
ok, out = lib.as_user(None, 'gptour_semantic_owner', f"delete from public.gptour_semantic_plans where session_id='{sid}' returning plan_id", commit=False)
check(ok and out, S, 'compatibilità pulizia futura: la cancellazione eseguita come owner (futura RPC di manutenzione) è ammessa dai trigger (rollback, nessun job creato)', out[:40])
ok, out = lib.as_user(None, 'service_role', f"delete from public.gptour_semantic_plans where session_id='{sid}'")
check(not ok and 'permission denied' in out, S, 'service_role: DELETE → permission denied (privilegio), tabelle intatte', out)

# ---------------------------------------------------------------- B9 trigger vs privilege vs RLS (lab-only writer role with grants + permissive policy)
S = 'B9-trigger-vs-privilegio-vs-RLS'
sql(root, meta, "do $$ begin if not exists (select 1 from pg_roles where rolname='u2b_lab_writer') then create role u2b_lab_writer nologin; end if; end $$; grant usage on schema public to u2b_lab_writer; grant select, update, delete on public.gptour_semantic_requests, public.gptour_semantic_sessions, public.gptour_semantic_plans, public.gptour_semantic_llm_invocations to u2b_lab_writer")
ok, out = lib.as_user(None, 'u2b_lab_writer', f"update public.gptour_semantic_sessions set revision = 99 where session_id='{sid}' returning revision")
check(ok and out == '', S, 'writer CON privilegio ma senza policy: UPDATE → 0 righe (rifiuto RLS, non trigger)', out)
sql(root, meta, "set role gptour_semantic_owner; create policy lab_writer_s on public.gptour_semantic_sessions for all to u2b_lab_writer using (true) with check (true); create policy lab_writer_r on public.gptour_semantic_requests for all to u2b_lab_writer using (true) with check (true); create policy lab_writer_p on public.gptour_semantic_plans for all to u2b_lab_writer using (true) with check (true); create policy lab_writer_i on public.gptour_semantic_llm_invocations for all to u2b_lab_writer using (true) with check (true); reset role")
W = 'u2b_lab_writer'
cases = [(f"update public.gptour_semantic_sessions set revision = revision + 2 where session_id='{sid}'", 'revision advances by exactly 1', 'sessione: revision +2'),
         (f"update public.gptour_semantic_sessions set state = '{{\"forged\":1}}' where session_id='{sid}'", 'state changes only with a new revision', 'sessione: stato senza nuova revisione'),
         (f"update public.gptour_semantic_sessions set owner_uid = '{B}' where session_id='{sid}'", 'session identity immutable', 'sessione: owner riscritto'),
         (f"update public.gptour_semantic_requests set status = 'pending' where request_id='r1' and session_id='{sid}'", 'cannot return to pending', 'request: done→pending'),
         (f"update public.gptour_semantic_requests set response_body = 'forged' where request_id='rv' and session_id='{sid}'", 'response is write-once', 'request: risposta sostituita'),
         (f"update public.gptour_semantic_requests set llm_output = '{{\"f\":1}}' where request_id='r1' and session_id='{sid}'", 'output after finalization', 'request: output dopo finalizzazione'),
         (f"update public.gptour_semantic_requests set payload_hash = '{H2}' where request_id='r1' and session_id='{sid}'", 'request identity immutable', 'request: hash riscritto'),
         (f"update public.gptour_semantic_requests set llm_dispatches_reserved = 0 where request_id='par' and session_id='{sid}'", 'budget monotonic', 'request: budget azzerato'),
         (f"update public.gptour_semantic_requests set processing_attempts = 1 where request_id='rv' and session_id='{sid}'", 'processing_attempts monotonic', 'request: attempts ridotti'),
         (f"update public.gptour_semantic_requests set lease_token = gen_random_uuid() where request_id='r1' and session_id='{sid}'", 'no lease after finalization', 'request: lease su request done'),
         (f"update public.gptour_semantic_plans set plan = '{{}}' where session_id='{sid}'", 'plans are immutable', 'piano modificato'),
         (f"update public.gptour_semantic_llm_invocations set reserved_at = clock_timestamp() where session_id='{sid}'", 'reservation immutable', 'riserva riscritta'),
         (f"update public.gptour_semantic_sessions set last_plan_id = gen_random_uuid() where session_id='{sid}'", 'state changes only with a new revision', 'sessione: last_plan_id senza nuova revisione'),
         (f"update public.gptour_semantic_requests set plan_id = gen_random_uuid() where request_id='r1' and session_id='{sid}'", 'plan reference immutable', 'request: plan_id sostituito'),
         (f"update public.gptour_semantic_requests set plan_id = gen_random_uuid() where request_id='rv' and session_id='{sid}'", 'plan reference only at pending->done', 'request: plan_id aggiunto dopo la finalizzazione'),
         (f"delete from public.gptour_semantic_requests where session_id='{sid}'", 'deletion only through owner maintenance', 'DELETE request'),
         (f"delete from public.gptour_semantic_sessions where session_id='{sid}'", 'deletion only through owner maintenance', 'DELETE sessione')]
for q, msg, label in cases:
    ok, out = lib.as_user(None, W, q)
    check(not ok and msg in out, S, f'writer con privilegio+policy: {label} → RIFIUTO DEL TRIGGER', out)
ok, out = lib.as_user(None, W, f"update public.gptour_semantic_requests set next_retry_at = null where request_id='rr' and session_id='{sid}' returning request_id")
check(ok and out == 'rr', S, 'controllo: campo non vincolato (next_retry_at su pending) passa → il trigger blocca solo gli invarianti', out)
ok, out = lib.as_user(None, 'service_role', f"update public.gptour_semantic_sessions set revision = revision + 2 where session_id='{sid}'")
check(not ok and 'permission denied' in out and 'U2W' not in out, S, 'service_role: stesso UPDATE → permission denied (privilegio), NON prova del trigger', out)
ok, out = lib.as_user(A, 'authenticated', f"update public.gptour_semantic_sessions set revision = revision + 2 where session_id='{sid}'")
check(not ok and 'permission denied' in out, S, 'authenticated proprietario: UPDATE → permission denied', out)
sql(root, meta, "set role gptour_semantic_owner; drop policy lab_writer_s on public.gptour_semantic_sessions; drop policy lab_writer_r on public.gptour_semantic_requests; drop policy lab_writer_p on public.gptour_semantic_plans; drop policy lab_writer_i on public.gptour_semantic_llm_invocations; reset role; revoke all on all tables in schema public from u2b_lab_writer; revoke usage on schema public from u2b_lab_writer; drop role u2b_lab_writer")
check(sql(root, meta, "select count(*) from pg_policies where tablename like 'gptour_semantic_%'") == '0' and sql(root, meta, "select count(*) from pg_roles where rolname='u2b_lab_writer'") == '0', S, 'ruolo e policy di laboratorio rimossi', '')

# ---------------------------------------------------------------- B10 internal recovery (store_llm → worker loss → takeover → same output, no new reservation)
S = 'B10-recupero-interno'
st, s3 = rpc('create_session', {'p_caller_uid': A, 'p_agent_id': A, 'p_contract_version': V, 'p_engine_version': ENGINE})
sid3 = s3['sessionId']
R1, R2, R3, R4, R5, R6 = (str(uuid.uuid4()) for _ in range(6))
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_payload_hash': H1, 'p_expected_revision': 0})
tok1 = c['token']
CTX = {'catalog': ['milano', 'monza'], 'acceptedAt': c['acceptedAt'], 'turn': 1}
OUT = {'operations': [{'op': 'set_area', 'localities': ['Milano']}], 'clarification': None}
rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1, 'p_context': CTX})
st, b = rpc('begin_llm', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1, 'p_invocation_id': 'inv-1'})
st, b = rpc('store_llm', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1, 'p_invocation_id': 'inv-1', 'p_output': OUT})
st, rw = rpc('recover_work', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1})
check(st == 200 and rw['context'] == CTX and rw['llmOutput'] == OUT and rw['llmDispatchesReserved'] == 1 and rw['invocations'] == [{'invocationId': 'inv-1', 'ordinal': 1, 'outcome': 'stored'}] and rw['baseRevision'] == 0 and rw['processingAttempts'] == 1
      and set(rw) == {'requestId', 'baseRevision', 'processingAttempts', 'processingDeadline', 'leaseUntil', 'llmDispatchesReserved', 'context', 'llmOutput', 'invocations'}, S, 'recover_work (worker corrente): contesto + output + riserve persistiti, chiavi esatte', rw)
sql(root, meta, f"set role gptour_semantic_owner; update public.gptour_semantic_requests set lease_until = clock_timestamp() - interval '1 second' where request_id='{R1}' and session_id='{sid3}'; reset role")
st, b = rpc('recover_work', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1})
check(st == 409, S, 'worker perso (lease scaduto): il suo token non recupera più → 409', st)
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_payload_hash': H1, 'p_expected_revision': 0})
tok1b = c.get('token')
check(c['outcome'] == 'takeover' and c['processingAttempts'] == 2 and c['llmDispatchesReserved'] == 1, S, 'takeover: nuovo token, budget 1 conservato', c)
st, rw2 = rpc('recover_work', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1b})
check(st == 200 and rw2['context'] == CTX and rw2['llmOutput'] == OUT and rw2['processingAttempts'] == 2 and rw2['invocations'] == rw['invocations'], S, 'nuovo worker recupera lo STESSO contesto/output già persistiti', rw2)
st, b = rpc('begin_llm', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1b, 'p_invocation_id': 'inv-2'})
check(b == {'mayDispatch': False, 'outputStored': True, 'reserved': 1} and sql(root, meta, f"select llm_dispatches_reserved||'|'||(select count(*) from public.gptour_semantic_llm_invocations where request_id='{R1}') from public.gptour_semantic_requests where request_id='{R1}'") == '1|1', S, 'dopo il recupero nessuna nuova riserva né invocazione (zero invii al provider)', b)
st, b = rpc('recover_work', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1})
check(st == 409, S, 'vecchio worker risvegliato: recupero respinto (fencing)', st)
st, b = rpc('recover_work', {'p_caller_uid': B, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1b})
check(st == 404, S, 'altro utente con token corrente → 404 (ownership prima del token)', st)
for label, tok_ in [('proprietario A (authenticated)', lib.jwt(A)), ('service_role', lib.jwt(A, role='service_role')), ('anon', ANON)]:
    st, b = rpc('recover_work', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1b}, token=tok_)
    check(st in (401, 403), S, f'{label}: recover_work non invocabile ({st}) — percorso backend-only, distinto dalle proiezioni pubbliche', st)
pk = {'requestId', 'status', 'httpStatus', 'requestOutcome', 'body', 'baseRevision', 'finalRevision', 'planId', 'acceptedAt', 'processingDeadline', 'responseExpiresAt', 'llmDispatchesReserved'}
st, g = rpc('get_request', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1})
check(st == 200 and set(g) == pk and not ({'context', 'llmOutput', 'leaseUntil', 'invocations'} & set(g)), S, 'proiezione pubblica get_request della request pending: nessun contesto/output/lease', g)

# ---------------------------------------------------------------- B11 plan identity (commit → ACK lost → replay → same plan by its id, no second creation)
S = 'B11-identita-piano'
body_p, plan_p = planned_body(sid3, R1)
st, b = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1b, 'p_new_state': {'criteria': 'v1'}, 'p_operational': {'departure': None}, 'p_plan': None, 'p_body': body_p})
check(st == 422 and sql(root, meta, f"select revision from public.gptour_semantic_sessions where session_id='{sid3}'") == '0', S, 'gate planned nel body senza p_plan → 422, nessuna transizione', st)
st, b = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1b, 'p_new_state': {'criteria': 'v1'}, 'p_operational': None, 'p_plan': plan_p, 'p_body': {**body_p, 'gate': None}})
check(st == 422, S, 'p_plan con gate non planned → 422', st)
st, b = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1b, 'p_new_state': {'criteria': 'v1'}, 'p_operational': None, 'p_plan': plan_p, 'p_body': {**body_p, 'sessionId': sid}})
check(st == 422, S, 'body di un’altra sessione → 422 (raccordo identità)', st)
st, b = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1b, 'p_new_state': {'criteria': 'v1'}, 'p_operational': None, 'p_plan': plan_p, 'p_body': {**body_p, 'errorCode': 'internal_error'}})
check(st == 422, S, 'body committed con errorCode → 422 (commit_success è solo per successi)', st)
st, b = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1b, 'p_new_state': {'criteria': 'v1'}, 'p_operational': None, 'p_plan': plan_p, 'p_body': {'free': 'text'}})
check(st == 422 and sql(root, meta, f"select status||'|'||coalesce(lease_token::text,'∅')||'|'||(llm_output is not null)::text from public.gptour_semantic_requests where request_id='{R1}'") == f'pending|{tok1b}|true', S, 'body non TurnResponse → 422; request ancora pending, token e output intatti (rollback dell’eccezione)', st)
st, cm3 = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1b, 'p_new_state': {'criteria': 'v1'}, 'p_operational': {'departure': {'lat': 45.0, 'lng': 9.0}, 'departureSource': 'settings'}, 'p_plan': plan_p, 'p_body': body_p})
pid3 = cm3.get('planId')
bj = json.loads(cm3.get('body') or '{}')
check(st == 200 and cm3['outcome'] == 'committed' and pid3 and bj['plan']['planId'] == pid3 and bj['plan']['sessionId'] == sid3 and bj['plan']['sessionRevision'] == 1 and bj['sessionRevision'] == 1 and bj['result']['revision'] == 1 and bj['engineVersion'] == ENGINE, S, 'commit con piano: planId in ricevuta = body.plan.planId; plan/result/sessionRevision coerenti', f'{st} {bj.get("plan", {}).get("planId")}')
dbrow = sql(root, meta, f"select r.plan_id||'|'||s.last_plan_id||'|'||(s.operational->>'lastPlanId')||'|'||(s.operational->>'planRevision')||'|'||p.plan_id||'|'||p.plan_revision||'|'||(p.plan->>'planId') from public.gptour_semantic_requests r join public.gptour_semantic_sessions s on s.session_id=r.session_id join public.gptour_semantic_plans p on p.session_id=s.session_id where r.request_id='{R1}'")
check(dbrow == '|'.join([pid3, pid3, pid3, '1', pid3, '1', pid3]), S, 'DB: requests.plan_id = sessions.last_plan_id = operational.lastPlanId = plans.plan_id = plan.planId; planRevision 1', dbrow)
# ACK lost → client replays the same request
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_payload_hash': H1, 'p_expected_revision': 0})
check(c['outcome'] == 'cached' and c['planId'] == pid3 and c['body'] == cm3['body'] and 'token' not in c, S, 'ACK perso → replay: cached con lo stesso planId e body byte-identico, nessun token', c.get('planId'))
st, gp = rpc('get_plan', {'p_caller_uid': A, 'p_plan_id': pid3})
check(st == 200 and gp['planId'] == pid3 and gp['planRevision'] == 1 and gp['plan'] == bj['plan'], S, 'get_plan(planId) → lo stesso piano persistito nel body (byte-uguale)', st)
st, gs = rpc('get_state', {'p_caller_uid': A, 'p_session_id': sid3})
check(gs['lastPlanId'] == pid3 and gs['operational']['lastPlanId'] == pid3 and gs['operational']['planRevision'] == 1 and gs['operational']['departureSource'] == 'settings', S, 'get_state: riferimento al piano nella sessione (lastPlanId + operational), operational del handler conservato', gs.get('operational'))
check(sql(root, meta, f"select count(*) from public.gptour_semantic_plans where session_id='{sid3}'") == '1', S, 'nessuna seconda creazione del piano', '')
st, b = rpc('recover_work', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_token': tok1b})
check(st == 409 and sql(root, meta, f"select coalesce(context::text,'∅')||coalesce(llm_output::text,'∅') from public.gptour_semantic_requests where request_id='{R1}'") == '∅∅', S, 'dopo la finalizzazione il recupero interno è chiuso (409) e contesto/output sono stati azzerati', st)
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R2, 'p_payload_hash': H1, 'p_expected_revision': 1})
tok2 = c['token']
rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R2, 'p_token': tok2, 'p_context': {}})
Q1 = {'id': 'q1', 'kind': 'unclear', 'text': 'Quale area?', 'options': []}
st, cm4 = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R2, 'p_token': tok2, 'p_new_state': {'criteria': 'v2'}, 'p_operational': None, 'p_plan': None, 'p_body': {**tbody(sid3, R2, gate='pending_question', result={**body_p['result'], 'requestId': R2, 'status': 'needs_clarification', 'question': Q1}), 'openQuestions': [Q1], 'openQuestionCount': 1}})
gs = rpc('get_state', {'p_caller_uid': A, 'p_session_id': sid3})[1]
check(cm4['outcome'] == 'committed' and cm4['planId'] is None and gs['revision'] == 2 and gs['lastPlanId'] == pid3 and gs['operational']['lastPlanId'] == pid3 and gs['operational']['planRevision'] == 1, S, 'commit senza piano: last_plan_id/operational.lastPlanId restano al piano precedente (rev 1), revisione 2', gs.get('operational'))

# ---------------------------------------------------------------- B12 T06: lab-injected fault after the session UPDATE, before the end of the transaction
S = 'B12-T06-guasto-iniettato'
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R3, 'p_payload_hash': H1, 'p_expected_revision': 2})
tok3 = c['token']
rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R3, 'p_token': tok3, 'p_context': CTX})
rpc('begin_llm', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R3, 'p_token': tok3, 'p_invocation_id': 'inv-3'})
rpc('store_llm', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R3, 'p_token': tok3, 'p_invocation_id': 'inv-3', 'p_output': OUT})
# LAB ONLY: AFTER UPDATE trigger on sessions raising while the flag row exists (runs as the lab superuser via SECURITY DEFINER; never part of the migration)
sql(root, meta, "create schema if not exists u2b_fault; create table if not exists u2b_fault.flags(name text primary key); insert into u2b_fault.flags values ('after_session_update');"
               " create or replace function u2b_fault.after_session_update() returns trigger language plpgsql security definer set search_path = '' as $$ begin"
               " if exists (select 1 from u2b_fault.flags where name = 'after_session_update') then raise exception 'U2B LAB FAULT after session update' using errcode = 'U2F01'; end if; return null; end $$;"
               " grant usage on schema u2b_fault to gptour_semantic_owner; set role gptour_semantic_owner; create trigger u2b_fault_after_update after update on public.gptour_semantic_sessions for each row execute function u2b_fault.after_session_update(); reset role")
snap = lambda: sql(root, meta, f"select s.revision||'|'||coalesce(s.last_plan_id::text,'∅')||'|'||(select count(*) from public.gptour_semantic_plans where session_id='{sid3}')||'|'||r.status||'|'||coalesce(r.lease_token::text,'∅')||'|'||coalesce(r.plan_id::text,'∅')||'|'||(r.context is not null)::text||(r.llm_output is not null)::text||'|'||coalesce(r.response_body,'∅') from public.gptour_semantic_sessions s join public.gptour_semantic_requests r on r.session_id=s.session_id where s.session_id='{sid3}' and r.request_id='{R3}'")
before = snap()
body3, plan3 = planned_body(sid3, R3)
st, fb = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R3, 'p_token': tok3, 'p_new_state': {'criteria': 'v3'}, 'p_operational': None, 'p_plan': plan3, 'p_body': body3})
check(st >= 400 and (fb or {}).get('code') == 'U2F01', S, 'commit_success con guasto dopo UPDATE sessione → errore propagato (nessuna ricevuta)', f'{st} {fb}')
check(snap() == before and before == f'2|{pid3}|1|pending|{tok3}|∅|truetrue|∅', S, 'rollback atomico: sessione rev 2, nessun piano nuovo, request pending con token/contesto/output intatti, nessuna risposta', snap())
st, rw3 = rpc('recover_work', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R3, 'p_token': tok3})
check(st == 200 and rw3['context'] == CTX and rw3['llmOutput'] == OUT, S, 'contesto/output salvati prima del guasto restano recuperabili dal worker', st)
st, fb2 = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R3, 'p_token': tok3, 'p_new_state': {'criteria': 'v3'}, 'p_operational': None, 'p_plan': plan3, 'p_body': body3})
check(st >= 400 and snap() == before, S, 'secondo tentativo con guasto ancora attivo → stesso rollback, nessun effetto parziale accumulato', st)
sql(root, meta, "delete from u2b_fault.flags where name = 'after_session_update'")
st, cm5 = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R3, 'p_token': tok3, 'p_new_state': {'criteria': 'v3'}, 'p_operational': None, 'p_plan': plan3, 'p_body': body3})
after = sql(root, meta, f"select s.revision||'|'||s.last_plan_id||'|'||(select count(*) from public.gptour_semantic_plans where session_id='{sid3}')||'|'||r.status||'|'||r.plan_id||'|'||r.final_revision from public.gptour_semantic_sessions s join public.gptour_semantic_requests r on r.session_id=s.session_id where s.session_id='{sid3}' and r.request_id='{R3}'")
check(st == 200 and cm5['outcome'] == 'committed' and cm5['revision'] == 3 and after == f"3|{cm5['planId']}|2|done|{cm5['planId']}|3", S, 'guasto rimosso: un solo commit riuscito al retry (rev 3, un piano nuovo, request done con plan_id)', after)
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R3, 'p_payload_hash': H1, 'p_expected_revision': 2})
check(c['outcome'] == 'cached' and c['planId'] == cm5['planId'] and c['body'] == cm5['body'], S, 'replay dopo il retry → cached, stesso piano', c.get('planId'))
sql(root, meta, "set role gptour_semantic_owner; drop trigger if exists u2b_fault_after_update on public.gptour_semantic_sessions; reset role; drop schema if exists u2b_fault cascade")
check(sql(root, meta, "select (select count(*) from pg_trigger where tgname like 'u2b_fault%')||'|'||(select count(*) from pg_namespace where nspname='u2b_fault')||'|'||(select count(*) from pg_proc where proname like '%after_session_update%')||'|'||(select count(*) from information_schema.triggers where event_object_table like 'gptour_semantic_%')") == '0|0|0|9', S, 'guasto di laboratorio rimosso: zero residui (trigger/schema/funzione), 9 trigger della migration', '')

# ---------------------------------------------------------------- B13 contract bridge export (validated by contract_bridge.unit.ts with validateTransportResponse + ERROR_POLICIES)
S = 'B13-raccordo-contratto'
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R4, 'p_payload_hash': H1, 'p_expected_revision': 3})
backdate('gptour_semantic_requests', 'gptour_semantic_requests_guard', "processing_deadline = clock_timestamp() - interval '1 second'", f"request_id='{R4}' and session_id='{sid3}'")
st, pe = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R4, 'p_payload_hash': H1, 'p_expected_revision': 3})
pej = json.loads(pe['body'])
check(pe['outcome'] == 'deadline_finalized' and pej['errorCode'] == 'processing_expired' and pej['outcome'] == 'committed' and pej['nextAction'] == 'get_state_and_confirm' and pej['retryableSameRequest'] is False and pej['sessionRevision'] == 3 and pej['requestId'] == R4 and pej['sessionId'] == sid3 and pej['acceptedAt'] == pe['acceptedAt'] and pej['responseExpiresAt'] == pe['responseExpiresAt'] and pej['engineVersion'] == ENGINE and pej['openQuestions'] == [] and pej['result'] is None, S, 'processing_expired: TurnResponse canonico (identità, policy, metadati di commit dalla request, engine della sessione)', pej)
toks = {}
for rid in (R5, R6):
    st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': rid, 'p_payload_hash': H1, 'p_expected_revision': 3}); toks[rid] = c['token']
    rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': rid, 'p_token': c['token'], 'p_context': {}})
st, fe2 = rpc('finish_error', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R5, 'p_token': toks[R5], 'p_http_status': 503, 'p_body': ebody(sid3, R5, 'llm_unavailable', 'committed', 'confirm_new_turn')})
st, bad = rpc('finish_error', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R6, 'p_token': toks[R6], 'p_http_status': 503, 'p_body': {**ebody(sid3, R6, 'llm_unavailable', 'committed', 'confirm_new_turn'), 'gate': 'planned'}})
check(st == 422 and fe2['requestOutcome'] == 'llm_unavailable', S, 'finish_error: body con gate → 422; body d’errore canonico accettato', st)
b6, p6 = planned_body(sid3, R6)
st, l6 = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R6, 'p_token': toks[R6], 'p_new_state': {'criteria': 'v4'}, 'p_operational': None, 'p_plan': p6, 'p_body': {**b6, 'engineVersion': 'spoofed'}})
check(l6['outcome'] == 'committed' and l6['revision'] == 4 and json.loads(l6['body'])['engineVersion'] == ENGINE, S, 'commit R6 (rev 4, secondo piano): engineVersion del body sovrascritta con quella della sessione', l6.get('revision'))
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': str(uuid.uuid4()), 'p_payload_hash': H1, 'p_expected_revision': 3})
rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': c['requestId'], 'p_token': c['token'], 'p_context': {}})
st, rc = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': c['requestId'], 'p_token': c['token'], 'p_new_state': {'x': 1}, 'p_operational': None, 'p_plan': None, 'p_body': tbody(sid3, c['requestId'])})
check(rc['outcome'] == 'revision_conflict' and json.loads(rc['body'])['sessionRevision'] == 4 and rc['finalRevision'] == 4, S, 'revision_conflict con requestId UUID per il raccordo (finalRevision = revisione osservata)', rc.get('outcome'))
gp6 = rpc('get_plan', {'p_caller_uid': A, 'p_plan_id': l6['planId']})[1]
replay1 = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R1, 'p_payload_hash': H1, 'p_expected_revision': 0})[1]
export = {'generated_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'contractVersion': V, 'sessionId': sid3,
          'terminalBodies': [{'name': n, 'httpStatus': x['httpStatus'], 'errorCode': ec, 'finalRevision': x['finalRevision'], 'planId': x.get('planId'), 'requestId': x['requestId'], 'responseBody': x['body']}
                             for n, x, ec in [('committed_with_plan', cm3, None), ('committed_without_plan', cm4, None), ('committed_after_fault_retry', cm5, None), ('processing_expired_sql', pe, 'processing_expired'), ('revision_conflict_sql', rc, 'revision_conflict'), ('finish_error_handler', fe2, 'llm_unavailable')]],
          'sqlPolicies': {code: json.loads(sql(root, meta, f"select public.gptour_semantic_error_policy('{code}')")) for code in ('processing_expired', 'revision_conflict')},
          'sqlPolicyUnknownIsNull': sql(root, meta, "select public.gptour_semantic_error_policy('llm_unavailable') is null") == 't',
          'getPlan': gp6, 'cachedReplayIdentical': replay1['body'] == cm3['body'] and replay1['planId'] == pid3}
(root / 'u2b_contract_export.json').write_text(json.dumps(export, indent=1))
check(len(export['terminalBodies']) == 6 and export['cachedReplayIdentical'] and export['sqlPolicyUnknownIsNull'], S, 'export per il test Deno: 6 body terminali, 2 policy SQL, get_plan; replay byte-identico; policy SQL assente per codici del handler', str(root / 'u2b_contract_export.json'))

# ---------------------------------------------------------------- B12b T06 variant: lab-injected fault AFTER INSERT on plans (session already updated, plan just inserted, request not yet finalized)
S = 'B12b-T06-guasto-dopo-insert-piano'
R7 = str(uuid.uuid4())
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R7, 'p_payload_hash': H1, 'p_expected_revision': 4})
tok7 = c['token']
rpc('store_context', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R7, 'p_token': tok7, 'p_context': CTX})
rpc('begin_llm', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R7, 'p_token': tok7, 'p_invocation_id': 'inv-7'})
rpc('store_llm', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R7, 'p_token': tok7, 'p_invocation_id': 'inv-7', 'p_output': OUT})
sql(root, meta, "create schema if not exists u2b_fault; create table if not exists u2b_fault.flags(name text primary key); insert into u2b_fault.flags values ('after_plan_insert');"
               " create or replace function u2b_fault.after_plan_insert() returns trigger language plpgsql security definer set search_path = '' as $$ begin"
               " if exists (select 1 from u2b_fault.flags where name = 'after_plan_insert') then raise exception 'U2B LAB FAULT after plan insert (plan % rev %)', new.plan_id, new.plan_revision using errcode = 'U2F02'; end if; return null; end $$;"
               " grant usage on schema u2b_fault to gptour_semantic_owner; set role gptour_semantic_owner; create trigger u2b_fault_after_plan_insert after insert on public.gptour_semantic_plans for each row execute function u2b_fault.after_plan_insert(); reset role")
snap7 = lambda: sql(root, meta, f"select s.revision||'|'||coalesce(s.last_plan_id::text,'∅')||'|'||coalesce(s.operational->>'lastPlanId','∅')||'|'||coalesce(s.operational->>'planRevision','∅')||'|'||(s.state->>'criteria')"
                               f"||'|'||(select count(*) from public.gptour_semantic_plans where session_id='{sid3}')||'|'||(select count(*) from public.gptour_semantic_plans where session_id='{sid3}' and plan_revision=5)"
                               f"||'|'||r.status||'|'||coalesce(r.lease_token::text,'∅')||'|'||coalesce(r.plan_id::text,'∅')||'|'||coalesce((r.context = '{json.dumps(CTX)}'::jsonb)::text,'null')||coalesce((r.llm_output = '{json.dumps(OUT)}'::jsonb)::text,'null')||'|'||r.llm_dispatches_reserved"
                               f"||'|'||(select count(*) from public.gptour_semantic_llm_invocations where session_id='{sid3}' and request_id='{R7}')||'|'||coalesce(r.response_body,'∅')||'|'||coalesce(r.final_revision::text,'∅')"
                               f" from public.gptour_semantic_sessions s join public.gptour_semantic_requests r on r.session_id=s.session_id where s.session_id='{sid3}' and r.request_id='{R7}'")
before7 = snap7()
check(before7 == f"4|{l6['planId']}|{l6['planId']}|4|v4|3|0|pending|{tok7}|∅|truetrue|1|1|∅|∅", S, 'stato iniziale: sessione rev 4 riferita al piano R6, 3 piani, request pending con contesto/output e 1 riserva', before7)
body7, plan7 = planned_body(sid3, R7)
st, fb7 = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R7, 'p_token': tok7, 'p_new_state': {'criteria': 'v5'}, 'p_operational': None, 'p_plan': plan7, 'p_body': body7})
check(st >= 400 and (fb7 or {}).get('code') == 'U2F02' and 'rev 5' in (fb7 or {}).get('message', ''), S, 'commit_success con guasto dopo INSERT del piano → errore propagato dal trigger (il piano rev 5 era stato inserito nella transazione)', f'{st} {fb7}')
check(snap7() == before7, S, 'rollback atomico: sessione rev 4 e riferimenti al piano precedente ripristinati, stato invariato, piano rev 5 eliminato (3 piani), request pending con token/contesto/output/riserva intatti, nessuna risposta', snap7())
check(sql(root, meta, f"select count(*) from public.gptour_semantic_plans where plan->>'sessionRevision' = '5' or plan_revision > 4") == '0', S, 'nessun piano orfano della transazione annullata (per revisione o per planId stampato)', '')
st, rw7 = rpc('recover_work', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R7, 'p_token': tok7})
check(st == 200 and rw7['context'] == CTX and rw7['llmOutput'] == OUT and rw7['llmDispatchesReserved'] == 1, S, 'contesto/output precedenti recuperabili dal worker dopo il rollback', st)
st, fb7b = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R7, 'p_token': tok7, 'p_new_state': {'criteria': 'v5'}, 'p_operational': None, 'p_plan': plan7, 'p_body': body7})
check(st >= 400 and snap7() == before7, S, 'secondo tentativo con guasto attivo → stesso rollback, nessun effetto parziale accumulato', st)
sql(root, meta, "delete from u2b_fault.flags where name = 'after_plan_insert'")
st, b = rpc('begin_llm', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R7, 'p_token': tok7, 'p_invocation_id': 'inv-7-retry'})
check(b == {'mayDispatch': False, 'outputStored': True, 'reserved': 1}, S, 'al retry il worker non ottiene nuove riserve LLM (output già persistito)', b)
st, cm7 = rpc('commit_success', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R7, 'p_token': tok7, 'p_new_state': {'criteria': 'v5'}, 'p_operational': None, 'p_plan': plan7, 'p_body': body7})
after7 = snap7()
check(st == 200 and cm7['outcome'] == 'committed' and cm7['revision'] == 5 and after7 == f"5|{cm7['planId']}|{cm7['planId']}|5|v5|4|1|done|∅|{cm7['planId']}|nullnull|1|1|{cm7['body']}|5", S, 'guasto rimosso, stesso requestId: un solo commit (rev 5), un solo nuovo piano (4 totali, 1 a rev 5), request done con plan_id, riserva LLM ancora 1 e 1 sola invocazione', after7)
check(json.loads(cm7['body'])['plan']['planId'] == cm7['planId'] and sql(root, meta, f"select plan_id from public.gptour_semantic_plans where session_id='{sid3}' and plan_revision=5") == cm7['planId'], S, 'planId coerente fra ricevuta, body e tabella piani', cm7.get('planId'))
st, c = rpc('claim', {'p_caller_uid': A, 'p_session_id': sid3, 'p_request_id': R7, 'p_payload_hash': H1, 'p_expected_revision': 4})
check(c['outcome'] == 'cached' and c['planId'] == cm7['planId'] and c['body'] == cm7['body'] and 'token' not in c, S, 'replay dopo il retry → cached, stesso piano, nessun token', c.get('planId'))
sql(root, meta, "set role gptour_semantic_owner; drop trigger if exists u2b_fault_after_plan_insert on public.gptour_semantic_plans; reset role; drop schema if exists u2b_fault cascade")
check(sql(root, meta, "select (select count(*) from pg_trigger where tgname like 'u2b_fault%')||'|'||(select count(*) from pg_namespace where nspname='u2b_fault')||'|'||(select count(*) from pg_proc where proname like '%after_plan_insert%' or proname like '%after_session_update%')||'|'||(select count(*) from information_schema.triggers where event_object_table like 'gptour_semantic_%')") == '0|0|0|9', S, 'guasto di laboratorio rimosso: zero residui (trigger/schema/funzioni), 9 trigger della migration', '')

# cleanup Fase 6 lab rows (A/B enabled only for this suite)
sql(root, meta, f"delete from public.gptour_orchestrator_user_access where user_id in ('{A}','{B}'); delete from public.gptour_orchestrator_access_audit where user_id in ('{A}','{B}')")
passed = sum(r['status'] == 'PASS' for r in results)
(root / 'u2b_report.json').write_text(json.dumps({'generated_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'checks': len(results), 'pass': passed, 'results': results}, indent=1))
print(f'U2B DONE checks={len(results)} pass={passed} fail={len(results) - passed}; credentials SYNTHETIC, LLM/CRM/handler NOT involved')
raise SystemExit(0 if passed == len(results) else 1)
