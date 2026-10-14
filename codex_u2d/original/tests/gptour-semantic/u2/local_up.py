#!/usr/bin/env python3
"""Repeatable PG15/PostgREST startup: /tmp only, Unix private socket + loopback, runtime secret only."""
import json
import os
from pathlib import Path
import pwd
import secrets
import socket
import subprocess
import time
from lab_common import root_path, pg_run, sql_command, local_http, settings

os.umask(0o077)
root = root_path()
pg = Path(os.environ['U2_PG_BIN'])
rest = Path(os.environ['U2_POSTGREST_BIN']).resolve()
owner = pwd.getpwnam(os.environ['U2_PG_OS_USER'])
if not pg.is_absolute() or not rest.is_file():
    raise SystemExit('Missing configured binaries; no remote fallback')
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
    meta = {'kind': 'voom-u2-synthetic-local-only', 'root': str(root), 'pg_port': pg_port, 'rest_port': rest_port}
    (root / 'lab.json').write_text(json.dumps(meta))
    (root / 'jwt.secret').write_text(secrets.token_urlsafe(48))
    (root / 'socket').mkdir(mode=0o700)
    # Private Unix socket permits trust only within the owned 0700 directory. TCP DB logins are rejected.
    config = f'''db-uri = "postgresql://u2_authenticator@/u2_lab?host={root}/socket&port={pg_port}"
db-schemas = "u2_lab"
db-anon-role = "anon"
jwt-secret = "@{root}/jwt.secret"
jwt-aud = "voom-u2-local"
server-host = "127.0.0.1"
server-port = {rest_port}
db-pool = 4
log-level = "crit"
'''
    (root / 'postgrest.conf').write_text(config)
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
exists = pg_run(sql_command(root, meta, 'postgres') + ['-Atc', "select 1 from pg_database where datname='u2_lab'"], text=True).stdout.strip()
if exists != '1':
    pg_run(sql_command(root, meta, 'postgres') + ['-c', 'create database u2_lab'])
pg_run(sql_command(root, meta), input=(Path(__file__).parent / 'local_bootstrap.sql').read_bytes())
try:
    alive = local_http(meta, '/owner_probe?select=id')[0] == 200
except (OSError, RuntimeError):
    alive = False
if not alive:
    # Launch detached local fixture service; no changes to supervisor/frontend/backend.
    prefix = ['runuser', '-u', owner.pw_name, '--'] if os.geteuid() == 0 else []
    with (root / 'postgrest.log').open('ab') as log:
        proc = subprocess.Popen(prefix + [str(rest), str(root / 'postgrest.conf')], stdout=log, stderr=log, start_new_session=True,
                                env={k: v for k, v in os.environ.items() if not k.startswith(('PGRST_', 'PG', 'SUPABASE_'))})
    (root / 'postgrest.pid').write_text(str(proc.pid))
    for _ in range(60):
        try:
            if local_http(meta, '/owner_probe?select=id')[0] == 200:
                break
        except (OSError, RuntimeError):
            pass
        time.sleep(0.1)
    else:
        raise SystemExit('PostgREST not ready; inspect private runtime logs locally (do not publish secrets)')
print('PASS local_up: PostgreSQL15 + PostgREST ready; fixture data only; repeatable startup')