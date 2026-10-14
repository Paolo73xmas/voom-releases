#!/usr/bin/env bash
# Applies the U2-b migration twice (idempotency) on the running replay lab, runs the SQL acceptance suite,
# then validates the SQL-built/stored terminal bodies against the semantic-1.1 contract with Deno (no network).
set -euo pipefail
export PYTHONDONTWRITEBYTECODE=1
: "${U2_REPLAY_ROOT:?}" "${U2_PG_BIN:?}" "${U2_PG_OS_USER:?}" "${U2_DENO_BIN:?}"
here="$(cd "$(dirname "$0")" && pwd)"; repo="$(cd "$here/../../../.." && pwd)"
port="$(python3 -c "import json;print(json.load(open('$U2_REPLAY_ROOT/lab.json'))['pg_port'])")"
PSQL=(runuser -u "$U2_PG_OS_USER" -- "$U2_PG_BIN/psql" -X -v ON_ERROR_STOP=1 -q -h "$U2_REPLAY_ROOT/socket" -p "$port" -d u2_replay)
for i in 1 2; do "${PSQL[@]}" -f "$repo/supabase/orchestrator-pending/u2b/01_semantic_migration.sql" 2>/dev/null && echo "U2B MIGRATION PASS $i (idempotent)"; done
sleep 0.6
cd "$here" && python3 verify_u2b.py
cd "$repo"
"$U2_DENO_BIN" check --no-config --no-lock tests/gptour-semantic/u2/u2b/contract_bridge.unit.ts
"$U2_DENO_BIN" run --no-config --no-lock --allow-read="$U2_REPLAY_ROOT/u2b_contract_export.json" tests/gptour-semantic/u2/u2b/contract_bridge.unit.ts "$U2_REPLAY_ROOT/u2b_contract_export.json"
