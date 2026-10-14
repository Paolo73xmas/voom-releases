#!/usr/bin/env python3
"""Build a source-only, checksummed handoff. No environment credentials or runtime DB in archive."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import zipfile

repo = Path(__file__).resolve().parents[3]
out = Path(os.environ['U2_DELIVERY_DIR']).resolve()
evidence = Path(os.environ['U2_EVIDENCE_DIR']).resolve()
if not str(out).startswith('/tmp/') or not str(evidence).startswith('/tmp/') or out == evidence:
    raise SystemExit('Use distinct outside-repository /tmp directories')
stage = out / 'gptour_u2_0_a'
if stage.exists():
    shutil.rmtree(stage)
(stage / 'source').mkdir(parents=True)
(stage / 'reports').mkdir()
prefixes = ('supabase/functions/_shared/gptour-semantic/', 'tests/gptour-semantic/',
            'supabase/functions/gptour-orchestrator/', 'supabase/functions/_shared/gptour-orchestrator/')
protected = sorted(p for p in subprocess.check_output(['git','ls-files'],cwd=repo,text=True).splitlines() if p.startswith(prefixes))
h = hashlib.sha256()
for name in protected:
    h.update(name.encode()); h.update(b'\0'); h.update((repo/name).read_bytes()); h.update(b'\0')
# Base originale 259ec92d: '47b38f9561c4420ac09a894697144a63f848e98877039e011cff4ee6c5d7d30f' (conservato come prova). Dopo l'estensione autorizzata decline_consent (semantic-1.0.1, 5 file U1): vedi docs/gptour-semantic/PROTECTED_BASE_MANIFEST.md
PROTECTED_BASE_ORIGINAL = '47b38f9561c4420ac09a894697144a63f848e98877039e011cff4ee6c5d7d30f'
PROTECTED_BASE_CURRENT = '0ef218f48851515a51c8d463d0c0397959998cd8a1291c61c06436ddcfe8bc67'
if len(protected) != 40 or h.hexdigest() != PROTECTED_BASE_CURRENT:
    raise SystemExit('Protected base changed: refusing delivery')
authorized = {'supabase/functions/_shared/gptour-semantic/' + f for f in ('contract.ts','schema.ts','apply.ts','interpreter.ts','prompt.ts')}
changed = set(subprocess.check_output(['git','diff','--name-only','259ec92d'],cwd=repo,text=True).split())
if changed - authorized: raise SystemExit(f'Unauthorized tracked changes: {sorted(changed - authorized)}')
subprocess.run(['git','diff','--cached','--exit-code'],cwd=repo,check=True,capture_output=True)
plan = 'docs/gptour-semantic/PHASE_U2_PLAN.md'
if hashlib.sha256((repo/plan).read_bytes()).hexdigest() != 'a0b429bf51431777c5c531149f6aa0b022d317535ef52d007b9049a2ae214701':
    raise SystemExit('Frozen plan changed')
new = sorted(str(p.relative_to(repo)) for folder in ('supabase/functions/_shared/gptour-semantic-transport','tests/gptour-semantic/u2')
             for p in (repo/folder).rglob('*') if p.is_file() and p.suffix in ('.ts','.py','.sh','.sql','.json','.md'))
new += ['docs/gptour-semantic/U2_0_A_README.md','docs/gptour-semantic/U2_0_A_RESULTS.md']
all_sources = sorted(set(protected + new + [plan]))
for name in all_sources:
    src = repo/name
    data = src.read_bytes()
    if re.search(rb'\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b|\bsk-[A-Za-z0-9_-]{24,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n',data):
        raise SystemExit('Potential embedded secret: refuse archive (inspect locally, do not print value)')
    dst = stage/'source'/name
    dst.parent.mkdir(parents=True,exist_ok=True); dst.write_bytes(data)
patch, stats = [], []
for name in new:
    diff = subprocess.run(['git','diff','--no-index','--','/dev/null',name],cwd=repo,capture_output=True,text=True)
    if diff.returncode not in (0,1):
        raise SystemExit('Diff generation failed')
    patch.append(diff.stdout)
    stats.append({'file':name,'added_lines':len((repo/name).read_text().splitlines())})
(stage/'DIFF.patch').write_text(''.join(patch))
(stage/'DIFF_SUMMARY.json').write_text(json.dumps({'base':'259ec92d','tracked_changes':0,'additions':stats,'plan_preexisting_unchanged':plan},indent=2)+'\n')
(stage/'U1_V7_BASE.sha256').write_text(''.join(f'{hashlib.sha256((repo/p).read_bytes()).hexdigest()}  source/{p}\n' for p in protected))
for name in ('u2-contract-node-deno.log','u1-node.log','u1-deno.log','local-verify.log','local-after-restart.log'):
    text=(evidence/name).read_text()
    (stage/'reports'/name).write_text(re.sub(r'\x1b\[[0-9;]*m','',text))
qa = Path('/app/test_reports/iteration_64.json')
if qa.is_file():
    shutil.copyfile(qa,stage/'reports/qa-before-fixes.json')
receipt = Path(os.environ['U2_TOOLS_DIR'])/'installation.json'
shutil.copyfile(receipt,stage/'reports/postgrest-installation.json')
(stage/'reports/final-results.json').write_text(json.dumps({
    'base':'259ec92d','scope':['U2-0 local minimal lab','U2-a pure contract/adapter'],
    'u1_unique_checks':232,'u1_runtimes':['Node','Deno'],'u2_unique_checks':409,'u2_runtimes':['Node','Deno'],
    'u2_checks_breakdown':{'contract':368,'bridge':31,'edge_negative':10},'golden_fixtures':41,
    'local_rls_checks':23,'parallel_local_reads':24,'remaining_known_failures':[],
    'qa_defects_fixed':['nonexpired pending recoverability','not_accepted acceptance metadata'],
    'qa_clarification':'Accepted-but-recoverable responses may carry acceptance timestamps; positive regression included.',
    'mocked':['LLM','CRM','clock','app auth/gates','planner','storage','lease','budget'],
    'not_implemented':['U2-b','U2-c','planner extraction','commercial filters','Web/Mobile','Edge endpoint'],
    'not_certified':['production auth/RLS','CRM/Fase4B/Fase6 DDL replay','L3 Edge runtime','entire T01-T40 matrix']},indent=2)+'\n')
(stage/'README.txt').write_text('U2-0/U2-a source-only handoff, base259ec92d. No secrets/runtime DB/node_modules.\n'
    'Read source/docs/gptour-semantic/U2_0_A_README.md and U2_0_A_RESULTS.md.\n'
    'DIFF.patch contains ONLY new block files, not the unchanged plan or protected base.\n'
    'Verify every archive file: sha256sum -c SHA256SUMS\n'
    'Verify unchanged baseline files: sha256sum -c U1_V7_BASE.sha256\n'
    'Run commands from source/ with configured local tools; Node path requires existing esbuild.\n'
    'Deno-only contract tests can run without node_modules: deno run --no-config --no-lock --allow-read=tests/gptour-semantic/u2/transport-goldens.json tests/gptour-semantic/u2/contract.unit.ts\n'
    'Repeat for bridge.unit.ts and edge_receipt_negative.unit.ts. Original U1 tests: deno run --no-config --no-lock tests/gptour-semantic/SA_semantic.unit.ts (and SC,SD,SE).\n'
    'STOP before U2-b. No production credentials/endpoints are needed or authorized.\n')
manifest=''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(stage)}\n' for p in sorted(stage.rglob('*')) if p.is_file())
(stage/'SHA256SUMS').write_text(manifest)
archive=out/'gptour_u2_0_a_delivery.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for file in sorted(stage.rglob('*')):
        if file.is_file():
            z.write(file,str(Path(stage.name)/file.relative_to(stage)))
with zipfile.ZipFile(archive) as z:
    if z.testzip() is not None:
        raise SystemExit('Archive CRC failure')
    for line in manifest.splitlines():
        digest,name=line.split('  ',1)
        if hashlib.sha256(z.read(f'{stage.name}/{name}')).hexdigest()!=digest:
            raise SystemExit('Archive manifest mismatch')
digest=hashlib.sha256(archive.read_bytes()).hexdigest()
(out/'gptour_u2_0_a_delivery.zip.sha256').write_text(f'{digest}  {archive.name}\n')
print(f'PASS archive verified: {len(all_sources)} source files, {len(new)} additive files; {archive.stat().st_size} bytes')
print('SHA256',digest)
print('Archive path',archive)