#!/usr/bin/env bash
set -uo pipefail

ROOT="/app"
OUTDIR="/tmp/aitour-mobile-tests"
mkdir -p "$OUTDIR"

TESTS=(
  "core_journey_planner"
  "brief_customer_area_dev_saved"
  "normalize_recent15_feasibility"
  "edit_plan"
  "live_save_guards"
  "liveops_protected"
)

FAIL=0
FAILED=()

for test in "${TESTS[@]}"; do
  esbuild "$ROOT/tests/aitour/${test}.unit.ts" \
    --bundle --platform=node --format=cjs \
    --alias:react-native=./tests/stubs/rn.js \
    --alias:@react-native-async-storage/async-storage=./tests/stubs/storage.js \
    --alias:expo-location=./tests/stubs/expo-location.js \
    --define:process.env.EXPO_PUBLIC_SUPABASE_URL='"https://example.invalid"' \
    --define:process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='"test-only"' \
    --outfile="$OUTDIR/${test}.cjs"

  if ! node --import "$ROOT/tests/aitour/ws-preload.mjs" "$OUTDIR/${test}.cjs"; then
    FAIL=$((FAIL + 1))
    FAILED+=("$test")
  fi
done

if [ "$FAIL" -eq 0 ]; then
  printf '%s\n' "PASS run_suite.sh (${#TESTS[@]} files)"
else
  printf '%s\n' "FAIL run_suite.sh ($FAIL/${#TESTS[@]} failed): ${FAILED[*]}"
  exit 1
fi
