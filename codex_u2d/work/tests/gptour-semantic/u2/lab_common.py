"""Local-only guard/utilities. Does not load repo .env or any production credential."""
import json
import os
from pathlib import Path
import pwd
import subprocess
import urllib.request

def root_path():
    raw = Path(os.environ['U2_LAB_ROOT'])
    if not raw.is_absolute() or raw.is_symlink():
        raise RuntimeError('Absolute non-symlink /tmp lab root required')
    path = raw.resolve()
    if not str(path).startswith('/tmp/') or path == Path('/tmp') or len(path.parts) < 3:
        raise RuntimeError('Lab must stay under /tmp')
    return path

def settings():
    root = root_path()
    meta = json.loads((root / 'lab.json').read_text())
    if meta['kind'] != 'voom-u2-synthetic-local-only' or meta['root'] != str(root):
        raise RuntimeError('Wrong lab marker')
    return root, meta

def pg_run(args, **kwargs):
    user = os.environ['U2_PG_OS_USER']
    uid = pwd.getpwnam(user).pw_uid
    if uid == 0:
        raise RuntimeError('PostgreSQL OS owner must be non-root')
    prefix = ['runuser', '-u', user, '--'] if os.geteuid() == 0 else []
    if not prefix and os.geteuid() != uid:
        raise RuntimeError('Run as root or the configured local lab OS user')
    env = {k: v for k, v in os.environ.items() if not k.startswith(('PG', 'PGRST_', 'SUPABASE_'))}
    env['PYTHONDONTWRITEBYTECODE'] = '1'
    return subprocess.run(prefix + [str(a) for a in args], env=env, check=True, capture_output=True, **kwargs)

def sql_command(root, meta, db='u2_lab'):
    return [Path(os.environ['U2_PG_BIN']) / 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-h', root / 'socket',
            '-p', str(meta['pg_port']), '-U', os.environ['U2_PG_OS_USER'], '-d', db]

def local_http(meta, path, *, token=None, method='GET', body=None):
    # Literal loopback constructed from our own marker, no configurable remote host or redirects.
    port = meta['rest_port']
    if not isinstance(port, int) or not 1024 <= port <= 65535 or not path.startswith('/'):
        raise RuntimeError('Invalid local endpoint')
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            raise RuntimeError('Redirect prohibited in local tests')
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(f'http://127.0.0.1:{port}{path}', data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    try:
        with opener.open(req, timeout=5) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()