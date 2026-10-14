#!/usr/bin/env bash
# U2-d: deno check + L1 (memory store, fixture catalog) + auth/CORS + planner-core (shared D3(a) core, simulated CRM/routing) + real-browser CORS
# + L2 (PostgREST store, RLS catalog) + local start of the real entrypoint with synthetic deps. Env: U2_REPLAY_ROOT U2_PG_BIN U2_PG_OS_USER U2_DENO_BIN [U2D_CHROME=/usr/bin/chromium].
set -euo pipefail; cd "$(dirname "$0")/../../../.."
"$U2_DENO_BIN" check --no-config --no-lock supabase/functions/gptour-semantic-v2/*.ts supabase/functions/gptour-semantic-v2/adapters/*.ts supabase/functions/_shared/gptour-planner-core/*.ts tests/gptour-semantic/u2/u2d/*.ts
RUN=("$U2_DENO_BIN" run --no-config --no-lock --allow-env=U2C_CONFIG,U2D_KIT_OUT --allow-read --allow-write=tests/gptour-semantic/u2/u2d/kit)
U2D_KIT_OUT=tests/gptour-semantic/u2/u2d/kit/semantic-1.2-kit.json "${RUN[@]}" tests/gptour-semantic/u2/u2d/handler.unit.ts
"${RUN[@]}" tests/gptour-semantic/u2/u2d/auth_cors.unit.ts
"${RUN[@]}" tests/gptour-semantic/u2/u2d/planner_core.unit.ts
"${RUN[@]}" tests/gptour-semantic/u2/u2d/revalidation.unit.ts
python3 tests/gptour-semantic/u2/u2d/cors_browser.py
python3 tests/gptour-semantic/u2/u2d/lab_u2d.py
python3 tests/gptour-semantic/u2/u2d/lab_entrypoint.py
