"""Schema-replay lab helpers. Separate /tmp root from the synthetic lab; reuses the guarded primitives of lab_common."""
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lab_common import pg_run, local_http  # noqa: E402

KIND = 'voom-u2-schema-replay-local-only'
DB = 'u2_replay'
REPO = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent


def root_path():
    raw = Path(os.environ['U2_REPLAY_ROOT'])
    if not raw.is_absolute() or raw.is_symlink():
        raise RuntimeError('Absolute non-symlink /tmp replay root required')
    path = raw.resolve()
    if not str(path).startswith('/tmp/') or len(path.parts) < 3:
        raise RuntimeError('Replay lab must stay under /tmp')
    return path


def settings():
    root = root_path()
    meta = json.loads((root / 'lab.json').read_text())
    if meta['kind'] != KIND or meta['root'] != str(root):
        raise RuntimeError('Wrong lab marker')
    return root, meta


def psql(root, meta, db=DB):
    return [Path(os.environ['U2_PG_BIN']) / 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-q', '-h', root / 'socket',
            '-p', str(meta['pg_port']), '-U', os.environ['U2_PG_OS_USER'], '-d', db]


def sql(root, meta, text, db=DB):
    return pg_run(psql(root, meta, db) + ['-At'], input=text.encode(), text=False).stdout.decode().strip()


def sql_file(root, meta, path, db=DB):
    return pg_run(psql(root, meta, db) + ['-f', str(path)])


def replay_files():
    """Returns [(repo_relative_path, expected_local_failure: bool)]. A leading '?' marks a file whose local
    failure is expected and documented in the line comment of replay_set.txt (declared limit, not a blocker)."""
    out = []
    for line in (HERE / 'replay_set.txt').read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        expected = line.startswith('?')
        out.append((line.lstrip('?').split(' #')[0].strip(), expected))
    return out
