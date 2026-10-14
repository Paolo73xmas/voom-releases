#!/usr/bin/env python3
"""L2 runner U2-d: handler (Deno) against the REAL U2-b SQL/RPC via PostgREST + LAB-ONLY catalog/settings tables with RLS (auth.uid()),
read with the USER's JWT. Synthetic secrets; Fase 6 enablement for A only; everything cleaned at the end. Writes <root>/u2d_report.json."""
import json, os, subprocess, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'schema_replay')); sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from replay_common import settings, sql, psql  # noqa: E402
import replay_verify_lib as lib  # noqa: E402
root, meta = settings(); repo = Path(__file__).resolve().parents[4]; here = Path(__file__).resolve().parent
A, B, C = lib.A, lib.B, lib.C
LAB_SQL = f"""
create table if not exists public.lab_gptour_catalog_localities(agent_id uuid not null, name text not null, provincia text not null);
create table if not exists public.lab_gptour_agent_settings(agent_id uuid primary key, working_days int[] not null);
alter table public.lab_gptour_catalog_localities enable row level security; alter table public.lab_gptour_agent_settings enable row level security;
drop policy if exists lab_cat_own on public.lab_gptour_catalog_localities; create policy lab_cat_own on public.lab_gptour_catalog_localities for select to authenticated using (agent_id = auth.uid());
drop policy if exists lab_set_own on public.lab_gptour_agent_settings; create policy lab_set_own on public.lab_gptour_agent_settings for select to authenticated using (agent_id = auth.uid());
grant select on public.lab_gptour_catalog_localities, public.lab_gptour_agent_settings to authenticated;
delete from public.lab_gptour_catalog_localities; delete from public.lab_gptour_agent_settings;
insert into public.lab_gptour_catalog_localities values ('{A}','Milano','MI'),('{A}','Monza','MB'),('{B}','Torino','TO');
insert into public.lab_gptour_agent_settings values ('{A}','{{1,2,3,4,5}}'),('{B}','{{1,2,3,4,5,6}}');
notify pgrst, 'reload schema';
"""
sql(root, meta, LAB_SQL)
sql(root, meta, "insert into public.gptour_semantic_backend_keys(jti, not_after, note) values ('u2d-lab-key', clock_timestamp() + interval '1 day', 'lab') on conflict (jti) do update set revoked_at = null, not_after = excluded.not_after")
sql(root, meta, f"insert into public.gptour_orchestrator_user_access(user_id, enabled, updated_by) values ('{A}', true, '{C}') on conflict (user_id) do update set enabled = true")
cfg = {'kind': 'postgrest', 'baseUrl': f"http://127.0.0.1:{meta['rest_port']}", 'backendJwt': lib.jwt(sub=None, role='gptour_semantic_backend', extra={'jti': 'u2d-lab-key'}, expires=3600),
       'userJwtSecret': lib.key.decode() if isinstance(lib.key, bytes) else lib.key, 'psql': ['runuser', '-u', os.environ['U2_PG_OS_USER'], '--'] + [str(a) for a in psql(root, meta)] + ['-At']}
cfg_path = root / 'u2d_config.json'; cfg_path.write_text(json.dumps(cfg)); os.chmod(cfg_path, 0o600)
time.sleep(1.5)
kit = here / 'kit' / 'semantic-1.2-kit-l2.json'
cmd = [os.environ['U2_DENO_BIN'], 'run', '--no-config', '--no-lock', '--allow-env=U2C_CONFIG,U2D_KIT_OUT', f'--allow-read={cfg_path},{repo}', f'--allow-write={kit}', f"--allow-net=127.0.0.1:{meta['rest_port']}", '--allow-run=runuser', str(here / 'handler.unit.ts')]
r = subprocess.run(cmd, env={**os.environ, 'U2C_CONFIG': str(cfg_path), 'U2D_KIT_OUT': str(kit)}, capture_output=True, text=True, cwd=repo)
out = r.stdout + r.stderr; print(out, end='')
last = [l for l in out.splitlines() if 'DONE checks=' in l]
# RLS proof at SQL level: user B sees only its own rows through PostgREST
import urllib.request
req = urllib.request.Request(f"{cfg['baseUrl']}/lab_gptour_catalog_localities?select=name", headers={'Authorization': 'Bearer ' + lib.jwt(sub=B)})
rls = json.loads(urllib.request.urlopen(req).read())
sql(root, meta, f"delete from public.gptour_orchestrator_user_access where user_id in ('{A}'); delete from public.gptour_orchestrator_access_audit where user_id in ('{A}'); drop table public.lab_gptour_catalog_localities; drop table public.lab_gptour_agent_settings; notify pgrst, 'reload schema';")
cfg_path.unlink()
ok = r.returncode == 0 and rls == [{'name': 'Torino'}]
(root / 'u2d_report.json').write_text(json.dumps({'generated_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'level': 'L2 (real local SQL/RPC via PostgREST; lab-only catalog/settings tables with RLS; LLM/planner/routing MOCKED)', 'handler': {'rc': r.returncode, 'summary': last[-1] if last else 'NO SUMMARY'}, 'rls_user_B_sees': rls, 'lab_tables_dropped': True, 'pass': ok}, indent=1))
print(f"U2D L2 DONE handler={last[-1] if last else 'NO SUMMARY'} rls_B={rls} pass={ok}; credentials SYNTHETIC; LLM/planner/routing MOCKED; no remote access")
raise SystemExit(0 if ok else 1)
