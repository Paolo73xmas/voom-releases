#!/usr/bin/env python3
"""Replay of REAL repository SQL on a local PostgreSQL 15 (+PostGIS) with PostgREST. Everything under /tmp, loopback only.

Phases: local_env shim -> generated baseline (from types) -> each real SQL file unchanged (one psql run each,
error captured, never edited) -> second pass (idempotency) -> declared policy shims -> synthetic fixture ->
inventory. Writes <root>/replay_report.json (no secrets, no CRM text).
"""
import json
import os
from pathlib import Path
import pwd
import re
import secrets
import socket
import subprocess
import sys
import time
from replay_common import KIND, DB, REPO, HERE, root_path, settings, psql, sql, sql_file, replay_files
from lab_common import pg_run, local_http

os.umask(0o077)
root = root_path()
pg = Path(os.environ['U2_PG_BIN'])
rest = Path(os.environ['U2_POSTGREST_BIN']).resolve()
owner = pwd.getpwnam(os.environ['U2_PG_OS_USER'])
if not subprocess.check_output([pg / 'postgres', '--version'], text=True).startswith('postgres (PostgreSQL) 15.'):
    raise SystemExit('This lab requires PostgreSQL 15')
if root.exists() and not (root / 'lab.json').is_file():
    raise SystemExit('Refusing to reuse unmarked directory')


def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


if not root.exists():
    root.mkdir(mode=0o700)
    pg_port, rest_port = port(), port()
    while rest_port == pg_port:
        rest_port = port()
    meta = {'kind': KIND, 'root': str(root), 'pg_port': pg_port, 'rest_port': rest_port}
    (root / 'lab.json').write_text(json.dumps(meta))
    (root / 'jwt.secret').write_text(secrets.token_urlsafe(48))
    (root / 'socket').mkdir(mode=0o700)
    (root / 'postgrest.conf').write_text(f'''db-uri = "postgresql://authenticator@/{DB}?host={root}/socket&port={pg_port}"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "@{root}/jwt.secret"
jwt-aud = "authenticated"
server-host = "127.0.0.1"
server-port = {rest_port}
db-pool = 4
log-level = "crit"
''')
    for file in root.rglob('*'):
        file.chmod(0o700 if file.is_dir() else 0o600)
        if os.geteuid() == 0:
            os.chown(file, owner.pw_uid, owner.pw_gid)
    if os.geteuid() == 0:
        os.chown(root, owner.pw_uid, owner.pw_gid)
root, meta = settings()
if not (root / 'pgdata/PG_VERSION').exists():
    pg_run([pg / 'initdb', '-D', root / 'pgdata', '--auth-local=trust', '--auth-host=reject', '--encoding=UTF8', '--no-locale'])
try:
    pg_run([pg / 'pg_ctl', '-D', root / 'pgdata', 'status'])
except subprocess.CalledProcessError:
    options = f'-h 127.0.0.1 -p {meta["pg_port"]} -k {root}/socket -c unix_socket_permissions=0700'
    pg_run([pg / 'pg_ctl', '-D', root / 'pgdata', '-l', root / 'postgres.log', '-o', options, '-w', 'start'])
if sql(root, meta, f"select 1 from pg_database where datname='{DB}'", db='postgres') != '1':
    pg_run(psql(root, meta, 'postgres') + ['-c', f'create database {DB}'])

already = (root / 'replay_report.json').is_file() and os.environ.get('U2_REPLAY_FORCE') != '1'
if already:
    # restart of an already replayed cluster: start services only, never re-apply the schema stack (set U2_REPLAY_FORCE=1 to re-apply)
    report = json.loads((root / 'replay_report.json').read_text())
    report['restarted_without_reapply'] = report.get('restarted_without_reapply', 0) + 1
report = report if already else {'generated_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'phases': {}, 'files': []}


def first_error(stderr):
    text = stderr.decode(errors='replace')
    m = re.search(r'psql:.*?:(\d+): ERROR:\s*(.*)', text)
    return (m.group(2).strip()[:200] if m else text.strip().splitlines()[-1][:200]) if text.strip() else 'unknown'


def run_file(path, label):
    started = time.time()
    try:
        sql_file(root, meta, path)
        entry = {'file': label, 'status': 'PASS', 'ms': int((time.time() - started) * 1000)}
    except subprocess.CalledProcessError as error:
        entry = {'file': label, 'status': 'FAIL', 'error': first_error(error.stderr), 'ms': int((time.time() - started) * 1000)}
    return entry


if not already:
    # Phase 1: declared local platform shim
    report['phases']['local_env'] = run_file(HERE / 'local_env.sql', 'schema_replay/local_env.sql (SHIM)')
    report['postgis_version'] = sql(root, meta, 'select postgis_lib_version()')
    report['postgres_version'] = sql(root, meta, 'show server_version')

    # Phase 2: generated baseline from the committed type snapshot
    gen = subprocess.run([sys.executable, str(HERE / 'gen_baseline.py')], capture_output=True, check=True)
    baseline = root / 'baseline_from_types.sql'
    baseline.write_bytes(gen.stdout)
    if os.geteuid() == 0:
        os.chown(baseline, owner.pw_uid, owner.pw_gid)
    report['baseline'] = json.loads(gen.stderr)
    report['phases']['baseline'] = run_file(baseline, 'generated baseline_from_types.sql (DERIVED)')
    report['phases']['views_shim'] = run_file(HERE / 'views_shim.sql', 'schema_replay/views_shim.sql (SHIM)')

    # Phase 2b: production snapshot 2026-03-24 committed in docs/backup (real objects), applied block by block.
    BACKUP = REPO / 'docs/backup'
    ext_owned = set(sql(root, meta, "select p.proname from pg_depend d join pg_proc p on p.oid=d.objid join pg_extension e on e.oid=d.refobjid where d.classid='pg_proc'::regclass and d.deptype='e'").splitlines())


    def apply_blocks(filename, header, exclude=frozenset()):
        text = (BACKUP / filename).read_text()
        parts = re.split(r'\n(?=-- ' + header + r': )', text)
        kept, skipped = [], []
        for part in parts:
            m = re.match(r'-- ' + header + r': (\S+)', part)
            if m and m.group(1).split('(')[0] in exclude:
                skipped.append(m.group(1))
                continue
            kept.append(part)
        filtered = root / ('snapshot_' + filename)
        filtered.write_text('\n'.join(kept))
        if os.geteuid() == 0:
            os.chown(filtered, owner.pw_uid, owner.pw_gid)
        proc = pg_run(psql(root, meta) + ['-v', 'ON_ERROR_STOP=0', '-f', str(filtered)])
        # map error line numbers back to the object header preceding them
        lines = filtered.read_text().splitlines()
        headers = [(i + 1, re.match(r'-- ' + header + r': (.+)', l).group(1)) for i, l in enumerate(lines) if re.match(r'-- ' + header + r': ', l)]
        failures = {}
        for m in re.finditer(r':(\d+): ERROR:\s*(.*)', proc.stderr.decode(errors='replace')):
            line, msg = int(m.group(1)), m.group(2).strip()
            name = next((h for n, h in reversed(headers) if n <= line), '?')
            failures.setdefault(name, msg[:160])
        # a primary-key index already created by the baseline PK is not a failure of the snapshot
        benign = {k: v for k, v in failures.items() if k.endswith('_pkey') and v.startswith('cannot drop index')}
        failures = {k: v for k, v in failures.items() if k not in benign}
        return {'file': 'docs/backup/' + filename, 'objects': len(headers), 'skipped_extension_owned': len(skipped),
                'applied': len(headers) - len(failures), 'already_present_pkey': len(benign), 'failed': len(failures), 'failures': failures}


    snap = {}
    snap['functions'] = apply_blocks('functions_backup_20260324_043722.sql', 'Function', ext_owned)
    snap['trigger_functions'] = apply_blocks('trigger_functions_backup_20260324_043722.sql', 'Trigger function', ext_owned)
    snap['indexes'] = apply_blocks('indexes_backup_20260324_043722.sql', 'Index')
    snap['triggers'] = apply_blocks('triggers_backup_20260324_043722.sql', 'Trigger')
    snap['rls_status'] = run_file(BACKUP / 'rls_status_backup_20260324_043722.sql', 'docs/backup/rls_status_backup_20260324_043722.sql')
    snap['rls_policies'] = apply_blocks('rls_policies_backup_20260324_043722.sql', 'Policy')
    report['snapshot_2026_03_24'] = snap

    # Phase 3: real SQL files, unchanged, each in its own transaction scope as authored
    files = replay_files()
    expected_fail = {rel for rel, exp in files if exp}
    for rel, exp in files:
        entry = run_file(REPO / rel, rel)
        if exp:
            entry['expected_local_failure'] = True
        report['files'].append(entry)
    unexpected = [e['file'] for e in report['files'] if e['status'] == 'FAIL' and e['file'] not in expected_fail]
    report['phases']['replay_pass1'] = {'total': len(files), 'pass': sum(e['status'] == 'PASS' for e in report['files']),
                                        'expected_local_failures': sorted(expected_fail), 'fail': unexpected}

    # Phase 4: second pass of the SAME files (re-runnability as authored; informational for real migrations)
    second = [run_file(REPO / rel, rel) for rel, _ in files]
    report['phases']['replay_pass2_rerun'] = {'total': len(files), 'pass': sum(e['status'] == 'PASS' for e in second),
                                              'not_rerunnable': [{'file': e['file'], 'error': e['error']} for e in second if e['status'] == 'FAIL' and e['file'] not in expected_fail]}

    # Phase 5: synthetic fixture on the real columns (no policy shims needed: hosted policies come from docs/backup)
    report['phases']['fixture'] = run_file(HERE / 'fixture.sql', 'schema_replay/fixture.sql (SYNTHETIC DATA)')

    # Phase 7: inventory
    inv = {}
    inv['tables_public'] = int(sql(root, meta, "select count(*) from pg_tables where schemaname='public'"))
    inv['tables_aitour_private'] = int(sql(root, meta, "select count(*) from pg_tables where schemaname='aitour_private'"))
    inv['views_aitour_private'] = int(sql(root, meta, "select count(*) from pg_views where schemaname='aitour_private'"))
    inv['functions_public'] = int(sql(root, meta, "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname not like 'st\\_%' and p.proname not like '\\_st\\_%' and p.proname not like 'postgis%' and p.proname not like 'geometry%' and p.proname not like 'geography%' and p.proname not like 'box%' and p.proname not like 'pgis%'"))
    inv['policies_public'] = int(sql(root, meta, "select count(*) from pg_policies where schemaname='public'"))
    inv['rls_enabled_tables'] = int(sql(root, meta, "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity"))
    inv['gptour_tables'] = sql(root, meta, "select string_agg(tablename, ',' order by tablename) from pg_tables where schemaname='public' and tablename like 'gptour%'")
    inv['gptour_functions'] = sql(root, meta, "select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'gptour%' or p.proname like 'ai_tour_%' or p.proname like 'save_%tours%')")
    inv['security_definer_without_search_path'] = sql(root, meta, "select coalesce(string_agg(n.nspname||'.'||p.proname, ',' order by 1),'') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','aitour_private') and p.prosecdef and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))")
    inv['baseline_fk_not_reconstructed'] = sql(root, meta, "select coalesce(string_agg(table_name||'.'||fk_name||' :: '||left(reason,80), ' | ' order by 1),'') from u2_replay_meta.fk_not_reconstructed")
    report['inventory'] = inv

(root / 'replay_report.json').write_text(json.dumps(report, indent=1))
if os.geteuid() == 0:
    os.chown(root / 'replay_report.json', owner.pw_uid, owner.pw_gid)

# PostgREST (loopback) for HTTP/RLS tests
try:
    alive = local_http(meta, '/')[0] == 200
except (OSError, RuntimeError):
    alive = False
if not alive:
    prefix = ['runuser', '-u', owner.pw_name, '--'] if os.geteuid() == 0 else []
    with (root / 'postgrest.log').open('ab') as log:
        proc = subprocess.Popen(prefix + [str(rest), str(root / 'postgrest.conf')], stdout=log, stderr=log, start_new_session=True,
                                env={k: v for k, v in os.environ.items() if not k.startswith(('PGRST_', 'PG', 'SUPABASE_'))})
    (root / 'postgrest.pid').write_text(str(proc.pid))
    for _ in range(80):
        try:
            if local_http(meta, '/')[0] == 200:
                break
        except (OSError, RuntimeError):
            pass
        time.sleep(0.1)
    else:
        raise SystemExit('PostgREST not ready; inspect private runtime logs locally')
else:
    # schema changed: ask PostgREST to reload its cache
    pg_run(psql(root, meta) + ['-c', "notify pgrst, 'reload schema'"])
    time.sleep(0.5)

p1, p2 = report['phases']['replay_pass1'], report['phases']['replay_pass2_rerun']
snap, inv = report['snapshot_2026_03_24'], report['inventory']
snapline = ' '.join(f"{k}={v['applied']}/{v['objects']}" for k, v in snap.items() if 'objects' in v)
print(('REPLAY_UP RESTARTED (schema not re-applied) ' if already else '') + f"REPLAY_UP DONE pg={report['postgres_version']} postgis={report['postgis_version']} snapshot[{snapline}] "
      f"baseline_tables={report['baseline']['tables']} real_files={p1['total']} pass1={p1['pass']} pass2={p2['pass']} "
      f"fixture={report['phases']['fixture']['status']} "
      f"tables={inv['tables_public']} policies={inv['policies_public']} report={root / 'replay_report.json'}")
for e in report['files']:
    if e['status'] == 'FAIL':
        print('EXPECTED_LOCAL_FAIL' if e.get('expected_local_failure') else 'FAIL', e['file'], '::', e['error'])
for e in p2['not_rerunnable']:
    print('NOT_RERUNNABLE', e['file'], '::', e['error'])
sys.exit(0 if not p1['fail'] and report['phases']['fixture']['status'] == 'PASS' else 1)
