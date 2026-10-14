#!/usr/bin/env bash
# U2-d/2 FINAL verification on the exact delivered tree. Runs every relevant suite, stores full logs in tests/gptour-semantic/u2/u2d/evidence/final/
# and a machine-readable status table (final_status.json) distinguishing executed-pass / executed-fail / not-executed(+reason).
# Prerequisites (see docs/gptour-semantic/U2_D_VERIFICATION.md): Deno 2.9.7 aarch64 (/opt/deno/deno), Node 20 + esbuild (repo node_modules), Python 3.11 + playwright,
# Chromium, local PostgreSQL 15 + PostgREST lab started via tests/gptour-semantic/u2/schema_replay/replay_up.sh (U2_REPLAY_ROOT).
# Env: U2_DENO_BIN U2_REPLAY_ROOT U2_PG_BIN U2_PG_OS_USER [U2D_CHROME]
set -uo pipefail; cd "$(dirname "$0")/../../../.."
: "${U2_DENO_BIN:?}" "${U2_REPLAY_ROOT:?}" "${U2_PG_BIN:?}" "${U2_PG_OS_USER:?}"
E=tests/gptour-semantic/u2/u2d/evidence/final; mkdir -p "$E"; rm -f "$E"/*.log "$E"/*.json
status=(); run() { local name=$1; shift; echo "== $name"; ( "$@" ) > "$E/$name.log" 2>&1; local rc=$?; status+=("{\"suite\":\"$name\",\"rc\":$rc,\"result\":\"$([ $rc -eq 0 ] && echo executed_pass || echo executed_fail)\",\"log\":\"evidence/final/$name.log\"}"); echo "   rc=$rc"; }
{ date -u; "$U2_DENO_BIN" --version | head -1; node --version; ./node_modules/.bin/esbuild --version; python3 --version; python3 -c "import importlib.metadata as m; print('playwright', m.version('playwright'))"; "$U2_PG_BIN/postgres" --version; "${U2_POSTGREST_BIN:-/opt/voom-u2/bin/postgrest}" --version 2>&1 | head -1; "${U2D_CHROME:-chromium}" --version; git rev-parse HEAD; git status --short; } > "$E/tool_versions.log" 2>&1
run protected_files python3 tests/gptour-semantic/u2/u2d/verify_protected.py --json "$E/protected_files.json"
run v7_golden_and_suite bash tests/gptour-orchestrator/golden_v7.sh
run v7_edge_check "$U2_DENO_BIN" check --no-config --no-lock supabase/functions/gptour-orchestrator/index.ts
run u2d_all bash tests/gptour-semantic/u2/u2d/run_u2d.sh
run u2c_regression bash tests/gptour-semantic/u2/u2c/run_u2c.sh
run u1_deno env DENO_BIN="$U2_DENO_BIN" bash tests/gptour-semantic/run_deno.sh
run u2a_transport bash tests/gptour-semantic/u2/run_contract.sh
run u2b_sql bash tests/gptour-semantic/u2/u2b/run_u2b.sh
run schema_replay bash tests/gptour-semantic/u2/schema_replay/replay_verify.sh
cp tests/gptour-semantic/u2/u2d/evidence/cors_browser_report.json tests/gptour-semantic/u2/u2d/evidence/entrypoint_report.json "$E/" 2>/dev/null
NOT_RUN='[{"suite":"LLM provider reale","result":"not_executed","reason":"escluso (L3): nessuna chiamata LLM reale autorizzata"},{"suite":"OSRM / CRM reali","result":"not_executed","reason":"escluso (L3): porte reali non collegate"},{"suite":"runtime hosted / Supabase JWT / backend key","result":"not_executed","reason":"escluso (L3): nessun accesso remoto"},{"suite":"app Web/Mobile reali","result":"not_executed","reason":"fuori perimetro: parità provata con adapter HTTP + pagina in browser"},{"suite":"tests/gptour-orchestrator K/L/M/O/T/V6 (RLS/pg17/OSRM reale/AI/SQL dry-run)","result":"not_executed","reason":"richiedono servizi/credenziali esterni o sono fuori dal perimetro U2-d; suite v7 *.unit.ts eseguita"}]'
printf '{"generated_utc":"%s","executed":[%s],"not_executed":%s}\n' "$(date -u +%FT%TZ)" "$(IFS=,; echo "${status[*]}")" "$NOT_RUN" > "$E/final_status.json"
python3 - "$E/final_status.json" <<'EOF'
import json,sys; d=json.load(open(sys.argv[1])); bad=[s for s in d['executed'] if s['rc']]
for s in d['executed']: print(f"{s['result']:14} {s['suite']}")
print(f"FINAL VERIFICATION DONE executed={len(d['executed'])} failed={len(bad)} not_executed={len(d['not_executed'])}"); sys.exit(1 if bad else 0)
EOF
