#!/usr/bin/env python3
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
from lab_common import settings, pg_run

root, meta = settings()
pidfile = root / 'postgrest.pid'
if pidfile.exists():
    pid = int(pidfile.read_text())
    try:
        cmdline = Path(f'/proc/{pid}/cmdline').read_bytes()
        if str(root / 'postgrest.conf').encode() not in cmdline:
            raise SystemExit('PID does not belong to this lab; refusing to stop it')
        os.killpg(pid, signal.SIGTERM)
    except (ProcessLookupError, FileNotFoundError):
        pass
    pidfile.unlink()
try:
    pg_run([Path(os.environ['U2_PG_BIN']) / 'pg_ctl', '-D', root / 'pgdata', '-w', 'stop', '-m', 'fast'])
except subprocess.CalledProcessError:
    # Already stopped is OK, anything else must remain visible as a failure.
    try:
        pg_run([Path(os.environ['U2_PG_BIN']) / 'pg_ctl', '-D', root / 'pgdata', 'status'])
    except subprocess.CalledProcessError as error:
        if error.returncode != 3:
            raise
    else:
        raise
if '--destroy' in sys.argv:
    shutil.rmtree(root)
print('PASS local_down: local fixture processes stopped' + ('; ephemeral data destroyed' if '--destroy' in sys.argv else ''))