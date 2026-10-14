#!/usr/bin/env python3
"""U2-d/2: LOCAL start of the real entrypoint index.ts (Deno.serve) with SYNTHETIC dependencies only:
local PostgREST (U2-b SQL replay) + lab backend JWT + lab catalog tables + synthetic user JWT secret. No remote link is contacted.
Checks the HTTP surface end-to-end: 405 / CORS preflight / 401 / 403 pilot / capabilities 200 / create_session 201 (real local SQL) /
free-text turn → LLM NOT wired (llm:null) → 503 llm_unavailable (reached BEFORE the planner, which is also not wired), i.e. every L3 exclusion is explicit, never a fake plan.
Writes <root>/u2d_entrypoint_report.json and evidence/entrypoint_report.json."""
import json, os, secrets, socket, subprocess, sys, time, urllib.error, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'schema_replay')); sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from replay_common import settings, sql  # noqa: E402
import replay_verify_lib as lib  # noqa: E402
root, meta = settings(); repo = Path(__file__).resolve().parents[4]; here = Path(__file__).resolve().parent
A, B, C = lib.A, lib.B, lib.C
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
PORT = free_port(); REST = f"http://127.0.0.1:{meta['rest_port']}"; ORIGIN = 'http://127.0.0.1:4173'
sql(root, meta, f"""
create table if not exists public.lab_gptour_catalog_localities(agent_id uuid not null, name text not null, provincia text not null);
create table if not exists public.lab_gptour_agent_settings(agent_id uuid primary key, working_days int[] not null);
alter table public.lab_gptour_catalog_localities enable row level security; alter table public.lab_gptour_agent_settings enable row level security;
drop policy if exists lab_cat_own on public.lab_gptour_catalog_localities; create policy lab_cat_own on public.lab_gptour_catalog_localities for select to authenticated using (agent_id = auth.uid());
drop policy if exists lab_set_own on public.lab_gptour_agent_settings; create policy lab_set_own on public.lab_gptour_agent_settings for select to authenticated using (agent_id = auth.uid());
grant select on public.lab_gptour_catalog_localities, public.lab_gptour_agent_settings to authenticated;
delete from public.lab_gptour_catalog_localities; delete from public.lab_gptour_agent_settings;
insert into public.lab_gptour_catalog_localities values ('{A}','Milano','MI'); insert into public.lab_gptour_agent_settings values ('{A}','{{1,2,3,4,5}}');
insert into public.gptour_semantic_backend_keys(jti, not_after, note) values ('u2d-entry-key', clock_timestamp() + interval '1 day', 'lab') on conflict (jti) do update set revoked_at = null, not_after = excluded.not_after;
insert into public.gptour_orchestrator_user_access(user_id, enabled, updated_by) values ('{A}', true, '{C}') on conflict (user_id) do update set enabled = true;
notify pgrst, 'reload schema';""")
time.sleep(1.5)
user_secret = lib.key.decode() if isinstance(lib.key, bytes) else lib.key  # synthetic lab JWT secret (same one PostgREST verifies)
env = {**os.environ, 'GPTOUR_SEMANTIC_V2_JWT_SECRET': user_secret, 'GPTOUR_SEMANTIC_V2_ENABLED': 'true', 'GPTOUR_SEMANTIC_V2_ALLOWED_UIDS': A, 'GPTOUR_SEMANTIC_V2_ALLOWED_ORIGINS': ORIGIN,
       'GPTOUR_SEMANTIC_V2_REST_URL': REST, 'GPTOUR_SEMANTIC_BACKEND_KEY': lib.jwt(sub=None, role='gptour_semantic_backend', extra={'jti': 'u2d-entry-key'}, expires=3600), 'GPTOUR_SEMANTIC_V2_LAB_PORT': str(PORT)}
cmd = [os.environ['U2_DENO_BIN'], 'run', '--no-config', '--no-lock', '--allow-env=GPTOUR_SEMANTIC_V2_JWT_SECRET,GPTOUR_SEMANTIC_V2_ENABLED,GPTOUR_SEMANTIC_V2_ALLOWED_UIDS,GPTOUR_SEMANTIC_V2_ALLOWED_ORIGINS,GPTOUR_SEMANTIC_V2_REST_URL,GPTOUR_SEMANTIC_BACKEND_KEY,GPTOUR_SEMANTIC_V2_LAB_PORT',
       f"--allow-net=127.0.0.1:{PORT},127.0.0.1:{meta['rest_port']}", str(repo / 'supabase/functions/gptour-semantic-v2/index.ts')]
proc = subprocess.Popen(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=repo)
startup = []
for _ in range(400):
    if proc.poll() is not None: break
    try: urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{PORT}/', method='GET'), timeout=0.5); break
    except urllib.error.HTTPError: break
    except Exception: time.sleep(0.1)
def call(method, headers=None, body=None):
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}/', method=method, headers=headers or {}, data=body.encode() if body else None)
    try:
        with urllib.request.urlopen(req, timeout=10) as r: return r.status, dict(r.headers), r.read().decode()
    except urllib.error.HTTPError as e: return e.code, dict(e.headers), e.read().decode()
J = lambda s: json.loads(s) if s else None
ja, jb = lib.jwt(sub=A), lib.jwt(sub=B)
cap = json.dumps({'operation': 'capabilities', 'contractVersion': 'semantic-1.2'})
r_get = call('GET'); r_pre = call('OPTIONS', {'Origin': ORIGIN, 'Access-Control-Request-Method': 'POST'}); r_pre_bad = call('OPTIONS', {'Origin': 'http://evil.example', 'Access-Control-Request-Method': 'POST'})
r_noauth = call('POST', {'content-type': 'application/json'}, cap); r_bad = call('POST', {'authorization': 'Bearer a.b.!!!', 'content-type': 'application/json'}, cap)
r_pilot = call('POST', {'authorization': f'Bearer {jb}', 'content-type': 'application/json'}, cap)
r_cap = call('POST', {'authorization': f'Bearer {ja}', 'content-type': 'application/json', 'Origin': ORIGIN}, cap)
r_cs = call('POST', {'authorization': f'Bearer {ja}', 'content-type': 'application/json'}, json.dumps({'operation': 'create_session', 'contractVersion': 'semantic-1.2'}))
sid = (J(r_cs[2]) or {}).get('state', {}).get('sessionId'); rid = str(__import__('uuid').uuid4())
turn = json.dumps({'operation': 'turn', 'contractVersion': 'semantic-1.2', 'sessionId': sid, 'requestId': rid, 'expectedRevision': 0, 'message': 'Vai a Milano', 'client': {'platform': 'web', 'appVersion': 'lab'}})
r_turn = call('POST', {'authorization': f'Bearer {ja}', 'content-type': 'application/json'}, turn)
r_req = call('POST', {'authorization': f'Bearer {ja}', 'content-type': 'application/json'}, json.dumps({'operation': 'get_request', 'contractVersion': 'semantic-1.2', 'sessionId': sid, 'requestId': rid}))
proc.terminate()
try: out = proc.communicate(timeout=10)[0]
except subprocess.TimeoutExpired: proc.kill(); out = proc.communicate()[0]
startup = [l for l in out.splitlines() if 'gptour-semantic-v2 start' in l]
sql(root, meta, f"delete from public.gptour_orchestrator_user_access where user_id = '{A}'; delete from public.gptour_orchestrator_access_audit where user_id = '{A}'; drop table if exists public.lab_gptour_catalog_localities; drop table if exists public.lab_gptour_agent_settings; notify pgrst, 'reload schema';")
tb = J(r_turn[2]) or {}
checks = {
 'started_with_lab_banner': bool(startup) and 'planner:NOT_WIRED' in startup[0] and 'llm:NOT_WIRED' in startup[0] and 'revalidation:DETERMINISTIC' in startup[0],
 'get_405': r_get[0] == 405 and (J(r_get[2]) or {}).get('ingress') == 'method_not_allowed',
 'preflight_204_allowed_origin': r_pre[0] == 204 and r_pre[1].get('access-control-allow-origin') == ORIGIN and 'authorization' in r_pre[1].get('access-control-allow-headers', ''),
 'preflight_403_other_origin': r_pre_bad[0] == 403 and 'access-control-allow-origin' not in {k.lower() for k in r_pre_bad[1]},
 'no_jwt_401': r_noauth[0] == 401, 'malformed_jwt_401': r_bad[0] == 401 and (J(r_bad[2]) or {}).get('ingress') == 'unauthorized',
 'outside_pilot_403': r_pilot[0] == 403 and (J(r_pilot[2]) or {}).get('ingress') == 'pilot_not_allowed',
 'capabilities_200_with_cors': r_cap[0] == 200 and (J(r_cap[2]) or {}).get('supportedVersions') == ['semantic-1.2'] and r_cap[1].get('access-control-allow-origin') == ORIGIN,
 'create_session_201_real_local_sql': r_cs[0] == 201 and bool(sid),
 'turn_llm_not_wired_503_no_fake_plan': r_turn[0] == 503 and tb.get('errorCode') == 'llm_unavailable' and tb.get('plan') is None and tb.get('gate') is None,
 'get_request_done_llm_unavailable_no_fake_result': r_req[0] == 200 and (lambda rc: rc.get('status') == 'done' and rc.get('originalHttpStatus') == 503 and (rc.get('response') or {}).get('errorCode') == 'llm_unavailable' and (rc.get('response') or {}).get('plan') is None)((J(r_req[2]) or {}).get('receipt') or {}),
}
report = {'generated_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'entrypoint': 'supabase/functions/gptour-semantic-v2/index.ts (Deno.serve, local listener)', 'startup_banner': startup,
          'lab_configuration': {'store': 'local PostgREST over U2-b SQL replay (synthetic backend JWT)', 'catalog_settings': 'lab tables (RLS, user JWT)', 'user_jwt_secret': 'synthetic (lab)', 'llm': 'NOT WIRED (L3)', 'planner': 'NOT WIRED (L3)', 'revalidation': 'DETERMINISTIC (engine version + catalog hash re-read with user JWT)', 'cors_origin': ORIGIN},
          'real_links_excluded': ['Supabase hosted JWT secret', 'hosted PostgREST / GPTOUR_SEMANTIC_BACKEND_KEY', 'CRM catalog', 'OSRM', 'LLM provider', 'Web/Mobile apps'],
          'receipt': (J(r_req[2]) or {}).get('receipt'), 'responses': {'get': r_get[0], 'preflight': r_pre[0], 'preflight_other': r_pre_bad[0], 'no_jwt': r_noauth[0], 'malformed_jwt': r_bad[0], 'pilot': r_pilot[0], 'capabilities': r_cap[0], 'create_session': r_cs[0], 'turn': [r_turn[0], tb.get('errorCode')], 'get_request': r_req[0]},
          'checks': checks, 'pass': all(checks.values()), 'proc_exit': proc.returncode}
(root / 'u2d_entrypoint_report.json').write_text(json.dumps(report, indent=1)); (here / 'evidence').mkdir(exist_ok=True); (here / 'evidence' / 'entrypoint_report.json').write_text(json.dumps(report, indent=1))
for k, v in checks.items(): print(f"{'PASS' if v else 'FAIL'} entrypoint: {k}")
if not report['pass']: print(out[-3000:])
print(f"U2D ENTRYPOINT DONE checks={len(checks)} pass={sum(checks.values())} fail={len(checks) - sum(checks.values())}; deps SYNTHETIC; llm+planner NOT WIRED (L3); revalidation DETERMINISTIC; no remote access")
raise SystemExit(0 if report['pass'] else 1)
