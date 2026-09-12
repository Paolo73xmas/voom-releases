#!/usr/bin/env bash
set -uo pipefail

ROOT="/app"
OUTDIR="/tmp/verification-mobile-tests"
mkdir -p "$OUTDIR"
cd "$ROOT" || exit 1

TESTS=(
  "customer_verification_service"
  "verification_location"
)

FAIL=0
FAILED=()

for test in "${TESTS[@]}"; do
  EXTRA_ALIAS=""
  if [ "$test" = "verification_location" ]; then
    EXTRA_ALIAS="--alias:expo-location=./tests/verification/stubs/expo-location.verification.js"
  fi

  # shellcheck disable=SC2086
  if ! esbuild "$ROOT/tests/verification/${test}.unit.ts" \
    --bundle --platform=node --format=cjs \
    --alias:react-native=./tests/stubs/rn.js \
    --alias:@react-native-async-storage/async-storage=./tests/stubs/storage.js \
    $EXTRA_ALIAS \
    --define:process.env.EXPO_PUBLIC_SUPABASE_URL='"https://example.invalid"' \
    --define:process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='"test-only"' \
    --outfile="$OUTDIR/${test}.cjs"; then
    FAIL=$((FAIL + 1))
    FAILED+=("$test (build)")
    continue
  fi

  if ! node --import "$ROOT/tests/aitour/ws-preload.mjs" "$OUTDIR/${test}.cjs"; then
    FAIL=$((FAIL + 1))
    FAILED+=("$test")
  fi
done

if [ "$FAIL" -eq 0 ]; then
  printf '%s\n' "PASS run_verification_suite.sh (${#TESTS[@]} files)"
else
  printf '%s\n' "FAIL run_verification_suite.sh ($FAIL/${#TESTS[@]} failed): ${FAILED[*]}"
  exit 1
fi
