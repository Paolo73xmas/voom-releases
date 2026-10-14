#!/usr/bin/env bash
set -euo pipefail
export PYTHONDONTWRITEBYTECODE=1
: "${U2_REPLAY_ROOT:?}" "${U2_PG_BIN:?}" "${U2_PG_OS_USER:?}"
exec python3 "$(dirname "$0")/replay_verify.py"
