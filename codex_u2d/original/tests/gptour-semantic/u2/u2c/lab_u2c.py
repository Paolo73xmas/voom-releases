#!/usr/bin/env python3
"""L2 runner: U2-c runtime (Deno) against the REAL U2-b SQL/RPC on the local replay lab via PostgREST. Synthetic backend JWT and
Fase 6 enablement for the synthetic user A only; cleaned at the end. Writes <root>/u2c_report.json."""
import json, os, subprocess, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'schema_replay')); sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from replay_common import settings, sql, psql  # noqa: E402
import replay_verify_lib as lib  # noqa: E402
root, meta = settings(); repo = Path(__file__).resolve().parents[4]; here = Path(__file__).resolve().parent
A, C = lib.A, lib.C
sql(root, meta, "insert into public.gptour_semantic_backend_keys(jti, not_after, note) values ('u2c-lab-key', clock_timestamp() + interval '1 day', 'lab') on conflict (jti) do update set revoked_at = null, not_after = excluded.not_after")
sql(root, meta, f"insert into public.gptour_orchestrator_user_access(user_id, enabled, updated_by) values ('{A}', true, '{C}') on conflict (user_id) do update set enabled = true")
cfg = {'kind': 'postgrest', 'baseUrl': f"http://127.0.0.1:{meta['rest_port']}", 'backendJwt': lib.jwt(sub=None, role='gptour_semantic_backend', extra={'jti': 'u2c-lab-key'}, expires=3600),
       'psql': ['runuser', '-u', os.environ['U2_PG_OS_USER'], '--'] + [str(a) for a in psql(root, meta)] + ['-At']}
cfg_path = root / 'u2c_config.json'; cfg_path.write_text(json.dumps(cfg)); os.chmod(cfg_path, 0o600)
results = {}
for suite in ('conformance', 'turn', 'interruptions'):
    cmd = [os.environ['U2_DENO_BIN'], 'run', '--no-config', '--no-lock', '--allow-env=U2C_CONFIG', f'--allow-read={cfg_path},{repo}', f"--allow-net=127.0.0.1:{meta['rest_port']}", '--allow-run=runuser', str(here / f'{suite}.unit.ts')]
    r = subprocess.run(cmd, env={**os.environ, 'U2C_CONFIG': str(cfg_path)}, capture_output=True, text=True, cwd=repo)
    out = r.stdout + r.stderr; print(out, end='')
    last = [l for l in out.splitlines() if 'DONE checks=' in l]
    results[suite] = {'rc': r.returncode, 'summary': last[-1] if last else 'NO SUMMARY'}
residue = sql(root, meta, "select (select count(*) from pg_trigger where tgname like 'u2b_fault%')||'|'||(select count(*) from pg_namespace where nspname='u2b_fault')||'|'||(select count(*) from information_schema.triggers where event_object_table like 'gptour_semantic_%')")
sql(root, meta, f"delete from public.gptour_orchestrator_user_access where user_id in ('{A}'); delete from public.gptour_orchestrator_access_audit where user_id in ('{A}')")
cfg_path.unlink()
ok = all(v['rc'] == 0 for v in results.values()) and residue == '0|0|9'
(root / 'u2c_report.json').write_text(json.dumps({'generated_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'level': 'L2 (real local SQL/RPC via PostgREST; LLM/planner/catalog/revalidation MOCKED)', 'suites': results, 'fault_residue_trigger|schema|migration_triggers': residue, 'pass': ok}, indent=1))
print(f"U2C L2 DONE suites={results} residue={residue} pass={ok}; credentials SYNTHETIC; LLM/planner/routing MOCKED; no remote access")
raise SystemExit(0 if ok else 1)
