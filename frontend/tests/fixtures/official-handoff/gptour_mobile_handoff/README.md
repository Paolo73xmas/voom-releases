# GPTour Orchestrator — pacchetto handoff per l'AI MOBILE (Android/iOS) — 2026-10-11

Contenuto (nessuna credenziale, nessun token):
- `MOBILE_API_HANDOFF.md` — DOCUMENTO PRINCIPALE, autonomo: endpoint, auth, sessioni, contratto, stati/HTTP, follow-up, mappe, esempi, fixture, checklist, limiti.
- `PHASE5_WEB_INTEGRATION.md` — rapporto dell'integrazione web (riferimento di comportamento e test da replicare).
- `CLIENT_CONTRACT.md` — contratto client della Fase 4A (storico, coerente con 1.0).
- `contract/gptour-orchestrator-contract.ts` — tipi TypeScript runtime-independent (identici alla Edge v6), copiabili nel progetto mobile.
- `examples/*.json` — richieste/risposte reali anonimizzate (turni 1-2, decisione singola, errori 409/403/422/401/400/500/503, domande).
- `fixtures/pilot_4b_real_anonymized.{json,log}` — esiti del collaudo reale server (23 verifiche); `legacy_gptour_comparison_anonymized.json` — confronto con il GPTour legacy; `edge_mock_scenarios_web.py` — simulatore della Edge usato dai test web (scenari: multi-turno, 409, 500, 422, planning stimato, infeasible, multi-giorno, blocked, 503): riutilizzabile come riferimento per i mock mobile.
- `web-reference/` — adapter, hook e componenti della web app (React/Leaflet) come riferimento di implementazione; NON vanno importati nel mobile, servono a replicare la logica di sessione/idempotenza/visualizzazione.
Vincoli: Edge v6 è l'unica versione di riferimento; allowlist solo server-side; mai service_role nel client; nessun ricalcolo commerciale/di routing nel client.
