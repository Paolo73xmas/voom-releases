#!/usr/bin/env python3
import os
from pathlib import Path
import shutil
import signal
import subprocess
from replay_common import settings
from lab_common import pg_run

root, meta = settings()
pidfile = root / 'postgrest.pid'
if pidfile.exists():
    pid = int(pidfile.read_text())
    try:
        if str(root / 'postgrest.conf').encode() not in Path(f'/proc/{pid}/cmdline').read_bytes():
            raise SystemExit('PID does not belong to this lab; refusing to stop it')
        os.killpg(pid, signal.SIGTERM)
    except (ProcessLookupError, FileNotFoundError):
        pass
    pidfile.unlink()
try:
    pg_run([Path(os.environ['U2_PG_BIN']) / 'pg_ctl', '-D', root / 'pgdata', '-w', 'stop', '-m', 'fast'])
except subprocess.CalledProcessError:
    pass
if os.environ.get('U2_REPLAY_KEEP') != '1':
    shutil.rmtree(root)
print('REPLAY_DOWN DONE')
