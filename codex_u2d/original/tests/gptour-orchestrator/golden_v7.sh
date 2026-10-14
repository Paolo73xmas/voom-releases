#!/usr/bin/env bash
# D3(a) golden v7: rigenera la battaglia di conversazioni (golden_v7.ts) e la confronta byte-per-byte con il riferimento registrato PRIMA dell'estrazione
# del planner (tests/gptour-orchestrator/golden/golden_v7_reference.json, sha256 a43b9cd1…8665). Poi esegue la suite v7 completa.
set -euo pipefail; cd "$(dirname "$0")/../.."
REF=tests/gptour-orchestrator/golden/golden_v7_reference.json; OUT=${GOLDEN_OUT:-/tmp/golden_v7_current.json}
./node_modules/.bin/esbuild tests/gptour-orchestrator/golden_v7.ts --bundle --platform=node --format=esm --log-level=error --outfile=/tmp/orch_golden_v7.mjs
GOLDEN_OUT="$OUT" node /tmp/orch_golden_v7.mjs
if cmp -s "$REF" "$OUT"; then echo "GOLDEN v7 IDENTICAL to reference ($(sha256sum "$REF" | cut -c1-16)…)"; else echo "GOLDEN v7 DIFFERS from reference"; diff <(python3 -m json.tool "$REF") <(python3 -m json.tool "$OUT") | head -40; exit 1; fi
tests/gptour-orchestrator/run_all.sh
