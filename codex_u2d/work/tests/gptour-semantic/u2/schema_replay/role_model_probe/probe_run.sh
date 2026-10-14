#!/usr/bin/env bash
# Applies the role-model probe on the running replay lab, verifies it, then removes it (U2_PROBE_KEEP=1 to keep).
set -euo pipefail
export PYTHONDONTWRITEBYTECODE=1
: "${U2_REPLAY_ROOT:?}" "${U2_PG_BIN:?}" "${U2_PG_OS_USER:?}"
here="$(cd "$(dirname "$0")" && pwd)"
port="$(python3 -c "import json;print(json.load(open('$U2_REPLAY_ROOT/lab.json'))['pg_port'])")"
PSQL=(runuser -u "$U2_PG_OS_USER" -- "$U2_PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q -h "$U2_REPLAY_ROOT/socket" -p "$port" -d u2_replay)
"${PSQL[@]}" -f "$here/probe.sql" 2>/dev/null && sleep 0.6
rc=0; (cd "$here" && PYTHONPATH=.. python3 probe_verify.py) || rc=$?
if [ "${U2_PROBE_KEEP:-0}" != "1" ]; then "${PSQL[@]}" -f "$here/probe_down.sql" 2>/dev/null && echo "PROBE REMOVED"; fi
exit $rc
