# First controlled Pirone live test — COMPLETED / DO NOT RERUN

Result: PASS (2026-10-11), one genuine login + identity check,7 of25 permitted Edge calls. Full report: `/app/PHASE5_MOBILE_LIVE_TEST_REPORT.md`.

`phase5-pirone.live.ts` is NOT part of the default `*.test.ts` suite. In its default mode it only performs local guard tests, with no live network.

Safe local check, from frontend:
```
./node_modules/.bin/vitest run --config tests/live/vitest.live.config.ts
```

The completed live attempt is permanently locked by `/app/test_reports/phase5_live_first/run-marker.json`. Do not delete/replace/reset that marker or `edge-ledger.json`, do not set execution/authorization flags and do not repeat login. Any new live phase requires new user instructions and its own clearly agreed budget; it must preserve this phase's evidence.

The initial JWT-only preflight rejection used0 Auth/Edge calls and is preserved in `preflight-incident-original.json`; its one-time correction was NOT a second login. Existing opaque publishable key remained unchanged. Service-role/secret keys stay forbidden.

Node uses the genuine Supabase SDK and actual mobile transport/binding/controller with RN-only storage/crypto bridges. This does not certify a native app or a live UI. Never label the live HTTP scenario as an Android/iPhone test. No credentials/tokens in logs or artifacts.