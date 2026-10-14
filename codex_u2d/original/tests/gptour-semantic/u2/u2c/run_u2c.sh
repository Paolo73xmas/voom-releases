#!/usr/bin/env bash
# U2-c: deno check + L1 (memory store, fake clock) + L2 (lab PostgREST with the real U2-b rev.2.1 migration). No network beyond loopback.
set -euo pipefail
export PYTHONDONTWRITEBYTECODE=1
: "${U2_REPLAY_ROOT:?}" "${U2_PG_BIN:?}" "${U2_PG_OS_USER:?}" "${U2_DENO_BIN:?}"
here="$(cd "$(dirname "$0")" && pwd)"; repo="$(cd "$here/../../../.." && pwd)"; cd "$repo"
"$U2_DENO_BIN" check --no-config --no-lock supabase/functions/_shared/gptour-semantic-runtime/*.ts tests/gptour-semantic/u2/u2c/*.unit.ts
for s in validator conformance turn interruptions; do "$U2_DENO_BIN" run --no-config --no-lock --allow-env=U2C_CONFIG --allow-read tests/gptour-semantic/u2/u2c/$s.unit.ts; done
python3 tests/gptour-semantic/u2/u2c/lab_u2c.py
