# Iteration 67 — Smoke GPTour Igor (territorio reale)

## Esito sintetico
- **PASS**: discovery territoriale reale prima dell'AI, selezione Igor via Admin, comune verificato scelto **TREVISO** (no fallback Bacoli), piano generato e coerente col comune richiesto.
- **PASS**: nessuna azione di scrittura CRM (save/start/reschedule/write) inoltrata.
- **FAIL/PARZIALE**: nuove chiamate Edge registrate **2** (non 4 attese dal requisito scenario).
- **BLOCKED**: RPC mappa `tabaccherie_points_in_bbox` bloccata dal guard readonly (11 blocchi), con warning fetch in console.

## Copertura PASS / FAIL / BLOCKED

### PASS
1. **Discovery obbligatoria prima AI**
   - Profilo Igor trovato via Admin.
   - `agent_zones`: 1 zona.
   - `loadGptourPool` reale: 2237 candidati.
   - `loadLatestPurchases` reale usata per idonei >=30gg.
   - Comune verificato scelto: **TREVISO** (8 idonei: 7 clienti + 1 orfano).

2. **E2E browser reale 390x844**
   - Login Admin OK.
   - Selezione Igor OK, pool caricato con testo Igor e stato non-loading.
   - Base casa usata (esistente).

3. **Turni GPTour**
   - Turno1 inviato con filtro 30gg + comune verificato + singola giornata + no followup.
   - Turno2 inviato: "Parti alle 09:00" senza ripetere filtro/comune.
   - Piano finale: 3 tappe, 36 km, 09:00→11:22.
   - Verifica comune: tutte le tappe nel comune verificato (`all_stops_in_verified_comune=true`).
   - Ultimo ordine presente (data/giorni/numero) su sample tappa.

4. **Back/Reopen senza nuove AI call**
   - Reopen GPTour eseguito.
   - Call AI prima reopen: 2.
   - Call AI dopo reopen: 2 (**invariato**, quindi no nuove call in reopen).
   - Timing misurati:
     - pool admin default: ~22.96s
     - pool Igor: ~10.83s
     - reopen pool admin: ~23.04s
     - reopen pool Igor: ~10.60s

### FAIL / PARZIALE
1. **Conteggio chiamate Edge**
   - Requisito scenario: fino a 4 nuove call (2 passaggi x 2 turni).
   - Osservato: **2 nuove call** (entrambe 200).
   - Metadati agent binding OK su entrambe (`agentInfo` + `effectiveAgentId` match selezione).

2. **Banner filtro acquisti**
   - `gptour-purchase-filter` non valorizzato nel dump finale (`""`), nonostante chips criterio/piano coerenti.

### BLOCKED
1. **Guard readonly fail-closed**
   - Blocchi: 11x `POST /rest/v1/rpc/tabaccherie_points_in_bbox` (RPC non in allowlist).
   - Effetto: warning fetch in console su tabaccherie bbox dots.
   - Nessuna mutazione CRM inoltrata (`crm_writes_forwarded=0`).

## Artifact principali
- `/app/test_reports/artifacts_iter67/iter67_igor_territory_discovery.json`
- `/app/test_reports/artifacts_iter67/iter67_gptour_igor_run.json`
- `/app/test_reports/artifacts_iter67/iter67_gptour_igor_smoke.jpeg`
- `/root/.emergent/automation_output/20261009_155318/console_20261009_155318.log`
