#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
: "${U2_DENO_BIN:?Set an existing Deno executable}"
tmp=$(mktemp -d /tmp/voom-u2-contract.XXXXXX)
trap 'rm -rf "$tmp"' EXIT
"$U2_DENO_BIN" check --no-config --no-lock supabase/functions/_shared/gptour-semantic-transport/index.ts tests/gptour-semantic/u2/contract.unit.ts tests/gptour-semantic/u2/bridge.unit.ts tests/gptour-semantic/u2/edge_receipt_negative.unit.ts
for name in contract bridge edge_receipt_negative; do
  ./node_modules/.bin/esbuild "tests/gptour-semantic/u2/${name}.unit.ts" --bundle --platform=node --format=esm --log-level=error --outfile="$tmp/$name.mjs"
  node "$tmp/$name.mjs"
  "$U2_DENO_BIN" run --no-config --no-lock --allow-read=tests/gptour-semantic/u2/transport-goldens.json,tests/gptour-semantic/u2/transport-goldens-1.2.json "tests/gptour-semantic/u2/${name}.unit.ts"
done
printf 'U2 CONTRACT NODE+DENO DONE fail=0 (no network permission)\n'