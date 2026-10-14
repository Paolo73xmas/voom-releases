#!/usr/bin/env python3
"""Protected-file audit for external review: compares the 40 protected U1/v7 files against the identified baseline commit 259ec92d
(git show), prints per-file status + reason for every authorized difference, and the cumulative hashes (original / rev.4 / D3(a)).
Exit 1 if any protected file differs WITHOUT an authorization entry, or if the cumulative hash is not one of the recorded values.
Usage: verify_protected.py [--json out.json]"""
import hashlib, json, subprocess, sys
from pathlib import Path
repo = Path(__file__).resolve().parents[4]; BASE = '259ec92d'
prefixes = ('supabase/functions/_shared/gptour-semantic/', 'tests/gptour-semantic/', 'supabase/functions/gptour-orchestrator/', 'supabase/functions/_shared/gptour-orchestrator/')
AUTHORIZED = {
 'supabase/functions/_shared/gptour-semantic/apply.ts': 'rev.4 decline_consent (U1 semantic-1.0.1) — autorizzazione proprietario 2026-10-13',
 'supabase/functions/_shared/gptour-semantic/contract.ts': 'rev.4 decline_consent (U1 semantic-1.0.1) — autorizzazione proprietario 2026-10-13',
 'supabase/functions/_shared/gptour-semantic/interpreter.ts': 'rev.4 decline_consent (U1 semantic-1.0.1) — autorizzazione proprietario 2026-10-13',
 'supabase/functions/_shared/gptour-semantic/prompt.ts': 'rev.4 decline_consent (U1 semantic-1.0.1) — autorizzazione proprietario 2026-10-13',
 'supabase/functions/_shared/gptour-semantic/schema.ts': 'rev.4 decline_consent (U1 semantic-1.0.1) — autorizzazione proprietario 2026-10-13',
 'supabase/functions/_shared/gptour-orchestrator/orchestrator.ts': 'D3(a) estrazione planner in _shared/gptour-planner-core/planner.ts (wrapper v7; golden v7 identici) — autorizzazione proprietario U2-d',
}
CUMULATIVE = {'original_259ec92d': '47b38f9561c4420ac09a894697144a63f848e98877039e011cff4ee6c5d7d30f', 'rev4_decline_consent': '0ef218f48851515a51c8d463d0c0397959998cd8a1291c61c06436ddcfe8bc67', 'd3a_planner_extraction': '041f2bfa00446526951e79689e2fab9a61276e29b0282ec38e3d29a21b036d88'}
protected = sorted(p for p in subprocess.check_output(['git', 'ls-files'], cwd=repo, text=True).splitlines() if p.startswith(prefixes))
sha = lambda b: hashlib.sha256(b).hexdigest()
rows, cum, unauthorized = [], hashlib.sha256(), []
for p in protected:
    cur = (repo / p).read_bytes(); base = subprocess.check_output(['git', 'show', f'{BASE}:{p}'], cwd=repo)
    cum.update(p.encode()); cum.update(b'\0'); cum.update(cur); cum.update(b'\0')
    same = sha(cur) == sha(base); reason = AUTHORIZED.get(p)
    if not same and not reason: unauthorized.append(p)
    rows.append({'file': p, 'base_sha256': sha(base), 'current_sha256': sha(cur), 'bytes_base': len(base), 'bytes_current': len(cur), 'status': 'INVARIATO' if same else 'MODIFICATO', 'authorization': None if same else reason})
digest = cum.hexdigest(); known = [k for k, v in CUMULATIVE.items() if v == digest]
report = {'baseline': BASE, 'protected_files': len(protected), 'cumulative_sha256': digest, 'cumulative_matches': known, 'known_cumulative': CUMULATIVE, 'modified': [r for r in rows if r['status'] == 'MODIFICATO'], 'unauthorized': unauthorized, 'files': rows}
if '--json' in sys.argv: Path(sys.argv[sys.argv.index('--json') + 1]).write_text(json.dumps(report, indent=1))
for r in rows:
    if r['status'] == 'MODIFICATO': print(f"MODIFICATO {r['file']} ({r['bytes_base']}→{r['bytes_current']} B) :: {r['authorization'] or 'NON AUTORIZZATO'}")
print(f"PROTECTED {len(protected)} files; modified={len(report['modified'])}; unauthorized={unauthorized}; cumulative={digest} matches={known}")
raise SystemExit(0 if not unauthorized and known and len(protected) == 40 else 1)
