#!/usr/bin/env python3
"""Package U2-d delivery 2 (lab only): all untracked files of the working tree on base 259ec92d (U2-0/a/b/c/d + planner-core + golden v7),
the tracked files modified under authorization (5 U1 files rev.4 + orchestrator.ts D3(a)) with their diffs, evidence logs, QA reports, manifest, checksums.
Refuses if any OTHER tracked file changed, if the 40 protected files do not match the recorded post-D3(a) hash, or if a secret-like pattern appears.
Usage: package_u2d.py <out_dir_under_/tmp>"""
import hashlib, json, re, subprocess, sys, time, zipfile
from pathlib import Path
repo = Path(__file__).resolve().parents[4]; out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
if not str(out).startswith('/tmp/'): raise SystemExit('out dir must be under /tmp')
name = 'gptour_u2d_final_delivery.zip'
prefixes = ('supabase/functions/_shared/gptour-semantic/', 'tests/gptour-semantic/', 'supabase/functions/gptour-orchestrator/', 'supabase/functions/_shared/gptour-orchestrator/')
protected = sorted(p for p in subprocess.check_output(['git', 'ls-files'], cwd=repo, text=True).splitlines() if p.startswith(prefixes))
h = hashlib.sha256()
for p in protected: h.update(p.encode()); h.update(b'\0'); h.update((repo / p).read_bytes()); h.update(b'\0')
PROTECTED_BASE_ORIGINAL = '47b38f9561c4420ac09a894697144a63f848e98877039e011cff4ee6c5d7d30f'  # base 259ec92d (kept as proof)
PROTECTED_BASE_REV4 = '0ef218f48851515a51c8d463d0c0397959998cd8a1291c61c06436ddcfe8bc67'      # after authorized decline_consent (5 U1 files)
PROTECTED_BASE_D3A = '041f2bfa00446526951e79689e2fab9a61276e29b0282ec38e3d29a21b036d88'       # after authorized D3(a) planner extraction (orchestrator.ts)
if len(protected) != 40 or h.hexdigest() != PROTECTED_BASE_D3A: raise SystemExit(f'Protected base mismatch ({len(protected)} files, {h.hexdigest()}): refusing delivery')
U1 = {'supabase/functions/_shared/gptour-semantic/' + f for f in ('contract.ts', 'schema.ts', 'apply.ts', 'interpreter.ts', 'prompt.ts')}
V7 = {'supabase/functions/_shared/gptour-orchestrator/orchestrator.ts'}
changed = set(subprocess.check_output(['git', 'diff', '--name-only', '259ec92d'], cwd=repo, text=True).split())
if changed - U1 - V7: raise SystemExit(f'Unauthorized tracked changes: {sorted(changed - U1 - V7)}')
subprocess.run(['git', 'diff', '--cached', '--exit-code'], cwd=repo, check=True, capture_output=True)
(out / 'u1_decline_consent.diff').write_text(subprocess.check_output(['git', 'diff', '259ec92d', '--'] + sorted(U1), cwd=repo, text=True))
(out / 'v7_d3a_planner_extraction.diff').write_text(subprocess.check_output(['git', 'diff', '259ec92d', '--'] + sorted(V7), cwd=repo, text=True))
untracked = subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard'], cwd=repo, text=True).splitlines()
evidence = [str(p.relative_to(repo)) for d in ('tests/gptour-semantic/u2/u2b/evidence', 'tests/gptour-semantic/u2/schema_replay/evidence', 'tests/gptour-semantic/u2/u2c/evidence', 'tests/gptour-semantic/u2/u2d/evidence') if (repo / d).is_dir() for p in (repo / d).rglob('*') if p.is_file()]
files = sorted(set(untracked + evidence) - {f for f in untracked if '__pycache__' in f})
secret = re.compile(rb'\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b|\bsk-[A-Za-z0-9_-]{24,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|service_role_key|SUPABASE_SERVICE_ROLE')
qa = [Path(f'/app/test_reports/iteration_{i}.json') for i in range(64, 76)]
entries = [(f, repo / f) for f in files] + [(f'u1_modified_tracked/{f}', repo / f) for f in sorted(U1)] + [(f'v7_modified_tracked/{f}', repo / f) for f in sorted(V7)] \
    + [('u1_decline_consent.diff', out / 'u1_decline_consent.diff'), ('v7_d3a_planner_extraction.diff', out / 'v7_d3a_planner_extraction.diff')] + [(f'qa/{q.name}', q) for q in qa if q.is_file()]
manifest = []
for arc, src in entries:
    data = src.read_bytes()
    if arc != 'tests/gptour-semantic/u2/u2d/package_u2d.py' and secret.search(data): raise SystemExit(f'Potential embedded secret in {arc}: refusing archive')  # the scanner itself contains the patterns
    manifest.append({'path': arc, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
readme = ("# Consegna FINALE U2-d — perimetro locale completato, PRONTA PER VERIFICA ESTERNA DI CODEX (nessuna integrazione reale/L3 completata).\n"
          "# PUNTO D'INGRESSO: docs/gptour-semantic/U2_D_VERIFICATION.md (baseline 259ec92d, diff, prerequisiti/versioni, comandi, risultati dimostrati/da verificare/incompleti, limiti). Esiti: docs/gptour-semantic/U2_D_RESULTS.md.\n"
          "# Evidenze della versione finale: tests/gptour-semantic/u2/u2d/evidence/final/ (final_status.json: 9 suite eseguite, 5 non eseguite motivate; un log per suite; tool_versions.log; protected_files.json).\n"
          "# Manifest 40 file protetti (originale 47b38f95…, rev.4 0ef218f4…, D3(a) 041f2bfa…): docs/gptour-semantic/PROTECTED_BASE_MANIFEST.md + tests/gptour-semantic/u2/u2d/verify_protected.py.\n"
          "# File tracciati modificati: u1_modified_tracked/ (5 file U1, rev.4) + u1_decline_consent.diff; v7_modified_tracked/ (orchestrator.ts, D3(a)) + v7_d3a_planner_extraction.diff.\n"
          "# Esiti U2-d: handler L1 23 + L2 23 (RLS), auth+CORS 42, planner-core 18, revalidation 12, CORS browser 8, entrypoint 11 (137); golden v7 48 risposte byte-identiche; suite v7 14/14 identica; regressioni U2-c/U1/U2-a/U2-b/replay verdi. QA indipendente: qa/iteration_74.json, qa/iteration_75.json.\n"
          "# NON collegato / escluso (L3, dichiarato, nessun successo simulato): LLM (llm_unavailable), planner nell'entrypoint (dependency_unavailable; core D3(a) testato con CRM/OSRM simulati), segreto JWT Supabase, backend key hosted, catalogo CRM, app Web/Mobile reali, U2-e.\n"
          "# Nessun segreto, credenziale reale, accesso remoto, push o deploy.\n")
meta = {'delivery': 'U2-d FINAL — handler gptour-semantic-v2 + planner-core D3(a) + deterministic revalidation (lab only: L1+L2+browser+entrypoint; L3 excluded) + full untracked tree', 'branch': 'feature/gptour-semantic-interpreter', 'base_commit': '259ec92d',
        'protected_base': {'original': PROTECTED_BASE_ORIGINAL, 'rev4': PROTECTED_BASE_REV4, 'd3a_current': PROTECTED_BASE_D3A}, 'generated_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'files': manifest}
zpath = out / name
with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
    for arc, src in entries: z.write(src, arc)
    z.writestr('MANIFEST.json', json.dumps(meta, indent=1)); z.writestr('README_DELIVERY.txt', readme)
digest = hashlib.sha256(zpath.read_bytes()).hexdigest()
(out / (name + '.sha256')).write_text(f'{digest}  {name}\n')
print(f'{name} files={len(manifest)} bytes={zpath.stat().st_size} sha256={digest}')
