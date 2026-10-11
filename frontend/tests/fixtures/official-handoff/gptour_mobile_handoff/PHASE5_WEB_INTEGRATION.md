# GPTour Orchestrator — Fase 5 WEB: integrazione della web app (pilota) e consegna API al team mobile

**Stato (2026-10-11)**: integrazione web **completata in locale e collaudata** (mock + Edge **v6** reale, contratto 1.0). **Nessun push GitHub, nessun deploy Vercel, Edge Function e database non modificati.** Non ancora validata dall'utente finale: resta *shipped localmente, agent-tested, non user-confirmed, non pubblicata*.

- HEAD di partenza `cd26b9eb` (`main` ahead 11 di `origin/main`, remoto a `21b17f64`); commit finale Fase 5: vedi §7.
- Edge pubblicata: `gptour-orchestrator` **v6**, ACTIVE, `verify_jwt=true`, `engineVersion gptour-orchestrator/0.2.0`, `contractVersion 1.0` — verificata in **sola lettura** (metadati + sorgente ESZIP via Management API): `contract.ts` 57/57, `handler.ts` 36/36, `agenda.ts` 19/19, `supabase-store.ts` 27/27 righe identiche al working tree (885/923 righe complessive verbatim; le restanti differiscono solo per escape/caratteri non ASCII nel contenitore ESZIP). Nessun redeploy.

## 1. File nuovi / modificati

| File | Ruolo |
|---|---|
| `src/lib/gptour-orchestrator/contract.ts` | copia esportabile del contratto 1.0 (nessun import runtime), identica al server |
| `src/lib/gptour-orchestrator/client.ts` | adapter web: `buildTurn` (nuovo requestId per azione), `sendOrchestratorRequest` (stesso oggetto nei retry → idempotenza; 200/422/403-con-corpo → stato; 409 → `OrchestratorHttpError revision_conflict`; 401/503/400/5xx → errori tipizzati), `normalize` (403 `pilot_not_enabled` senza corpo completo), `probeOrchestratorAccess` (sonda senza sessioni), `clearOrchestratorLocalState` (logout) |
| `src/hooks/useOrchestratorSession.ts` | sessione per **utente+agente** (`gptour-orch:<uid>:<agentId>` in localStorage, TTL 24 h, uid verificato al ripristino), revisione/`expectedRevision`, retry idempotente, 409 → allinea revisione e chiede di ripetere, ripristino transcript + ultimo piano, `targetAgentId` solo se utente ≠ agente |
| `src/components/aitour/orchestrator/GPTourOrchestratorChat.tsx` | transcript con badge di stato, avviso "conversazione ripristinata", chip criteri, `pendingDecisions`, domande con opzioni + risposta libera, decisioni per singolo follow-up, errori con "Riprova (stessa richiesta)", blocchi `infeasible`/`blocked`/`failed`, conferma esplicita solo client |
| `src/components/aitour/orchestrator/OrchestratorPlanView.tsx` | piano mono/multi-giorno dal server **senza ricalcoli**: data/partenza/rientro (Europe/Rome), totali, tabella tappe, avvisi, note qualità dati, esclusi; badge **"percorso verificato OSRM"** vs **"tempi stimati"**; `planning` = bozza non confermabile |
| `src/components/aitour/orchestrator/OrchestratorPlanMap.tsx` | Leaflet: polilinea da `geometry` `[lat,lng]`, marker numerati nell'ordine delle tappe, partenza, tratteggio se stimato |
| `src/components/aitour/GPTourForm.tsx` | wrapper: selettore "GPTour Orchestrator (pilota) / GPTour classico" visibile **solo** se la sonda server risponde 400; finché la sonda è in corso il planner legacy non viene montato; **un solo motore per volta**; corpo del planner legacy **byte-per-byte identico** alla baseline (`GPTourFormLegacy`) |
| `src/store/authStore.ts` | +3 righe: pulizia transcript/preferenze orchestratore al logout |
| `tests/gptour-orchestrator/web/U_web_client.unit.ts` (+`run.sh`, `supabase-stub.ts`) | unit adapter (fetch simulata) |
| `tests/gptour-orchestrator/web/V_web_ui_mock.py` | browser (Playwright) con Edge **simulata** via `page.route` |
| `tests/gptour-orchestrator/web/W_web_ui_live.py`, `X_web_ui_live_denied.py` | browser contro Edge **v6 reale** (utente allowlist / utente negato) |
| `tests/gptour-orchestrator/H_non_regression.unit.ts` | aggiornato alla Fase 5: legacy invariato salvo wrapper+logout, nuovi file solo nei percorsi isolati, nessun import dal planner legacy |
| `docs/gptour-orchestrator/MOBILE_API_HANDOFF.md`, questo report | consegna |

## 2. Verifiche eseguite (tutte agent-tested, 11/10/2026)

| Verifica | Esito |
|---|---|
| `tests/gptour-orchestrator/web/run.sh` (adapter) | **21/21 PASS**: contratto 1.0, nessuna identità nel payload, requestId nuovo/riusato, 200/422/403/409/401/503/400/500, normalizzazione 403 gateway, sonda, pulizia logout |
| **FASE A** `V_web_ui_mock.py` (login reale, Edge simulata) | **43/43 PASS**: S1 sonda/selettore; S2 multi-turno (inactive_days → date → follow_ups) con opzioni e **decisione singola** follow-up, piano 3 tappe con orari/km/visite/attese/pranzo/totali/data/partenza identici al mock, avviso fuori area, mappa (3 marker ordinati per latitudine, polilinea nel riquadro), esclusi, criteri, conferma solo UI; S3 **ripristino dopo reload** (10 messaggi, rev. 5, stessa sessione e revisione nel turno successivo); S4 **409** (nessun retry, revisione allineata, ripetizione con nuovo requestId); S5 **500 → Riprova con lo stesso requestId**; S6 422 `routing_unavailable`; S7 `planning`/`estimated_routing` → bozza non confermabile; S8 `infeasible`; S9 **multi-giorno** (`plan.days`, pernottamento); S10 `blocked/agent_mismatch`; S11 **503**; S12 **isolamento per agente** (chiave `uid:agentId`, agente B vuoto, ritorno ripristinato); S13 reset; S14 passaggio legacy/orchestrator (UI smontata); S15 sonda 403/503 → solo GPTour classico |
| **FASE B** `W_web_ui_live.py` (admin1 per conto dell'agente pilota, Edge v6 reale) | **37/37 PASS**: sonda 400; P1 → `follow_ups` → "Includili tutti" → **`ready` 13 tappe, 79,7 km, partenza 07:00, fine 15:53 (limite 20:00), guida 77′+36′, visite 390′, margine 247′** = identico al pilota 4B; `aiCalls 0`, `routingCalls 2`, 2,2–4,4 s/turno; **ogni tappa** (ordine, nome, comune, arrivo–partenza, km, visita) identica al JSON; planId/status UI = server; badge verificato; mappa 13 marker numerati, posizioni coerenti con lat/lng, geometria (2.704 punti) nel riquadro; 2 avvisi follow-up fuori area integrali; 672 esclusi; conferma senza chiamate; **ripristino dopo reload**; **idempotenza reale** (stesso requestId → corpo identico); **409 reale**; 401; 400 identità nel payload; sessionId nuovo con revisione obsoleta → 409 a rev 0; turno UI successivo ("Parto alle 8") con revisione corretta → rev. 3, piano 08:00 → 16:53 |
| `X_web_ui_live_denied.py` (utente autenticato fuori allowlist) | **PASS**: sonda 403, nessun selettore, solo GPTour classico, una sola chiamata |
| `tests/gptour-orchestrator/run_all.sh` (motore server, A–S) | **fail=0** (H_non_regression 55/55 aggiornata alla Fase 5) |
| `vite build` | **verde** (3 build, ~36 s) |
| `tsc -p tsconfig.app.json` | **516 errori preesistenti**, identici alla baseline; **nessuno nei file Fase 5** (le modifiche a `authStore.ts` non toccano la riga 330 già in errore) |

Scritture prodotte dai test live: solo sessioni/richieste/piani nelle tabelle `gptour_orchestrator_*` (owner admin1); nessuna modifica a clienti, ordini, appuntamenti, follow-up, tour.

## 3. Comportamento dell'interfaccia

- Tab **GPTour** → sonda server → se abilitato: selettore (default Orchestrator, preferenza per utente) altrimenti direttamente GPTour classico. Il legacy non parte mai in parallelo.
- Conversazione: messaggi liberi o pulsanti delle domande; criteri confermati come chip; follow-up decidibili in blocco o per riga; `pendingDecisions` evidenziate; stato per messaggio (domanda/bozza/piano pronto/non fattibile/non autorizzato/errore).
- Piano: solo quando il server lo restituisce; `ready` → "Itinerario proposto · percorso verificato OSRM" + **Conferma itinerario** (azione separata, solo UI, nessuna scrittura); `planning` → "Bozza (non definitiva) · tempi stimati", nessuna conferma; `infeasible/failed/blocked` → spiegazione, nessun piano.
- Errori: 409 → "sessione aggiornata, ripeti" (nessun retry automatico); 5xx/rete/422 → "Riprova (stessa richiesta)"; 503 → invito al GPTour classico; 401/403 → non ritentabili.
- Sessioni: una per utente+agente, ripristinata dopo reload (24 h), separata per agente, cancellata al logout e con "Nuova conversazione".

## 4. Anomalie trovate e corrette in questa fase

1. 403 `pilot_not_enabled` del gateway senza corpo completo → avrebbe fatto fallire la UI (`criteria` undefined): aggiunta `normalize`.
2. Transcript in `sessionStorage` (per scheda) → non ripristinato in nuova scheda: passato a `localStorage` con chiave `uid:agentId`, uid verificato, TTL 24 h, pulizia al logout.
3. Planner legacy montato durante la sonda (doppio avvio e caricamento pool) → loader finché la sonda non risponde.
4. Conferma disponibile anche su bozza `planning`/stimata → ora solo con `ready`.
5. Avvisi del piano mostrati due volte (livello giorno + piano) nel mono-giorno → avvisi per giornata solo nel multi-giorno.
6. `H_non_regression` codificava "nessun client chiama l'endpoint" (valido fino alla Fase 4) → aggiornata agli invarianti Fase 5.
7. 500 senza `errorCode` mappato a `http_error` generico → `internal_error`, ritentabile con lo stesso requestId.

Non sono emersi difetti del server/Edge v6.

## 5. Pilota, attivazione, rollback

- Pilota attivo solo per gli UUID nel secret server `GPTOUR_ORCHESTRATOR_ALLOWED_UIDS` (admin1, agente pilota); gli altri vedono solo il GPTour classico. **L'autorizzazione resta esclusivamente server-side**; la UI non contiene allowlist.
- Attivazione generale (quando autorizzata): aggiunta UUID al secret (nessuna modifica di codice). Rollback immediato lato server: `GPTOUR_ORCHESTRATOR_ENABLED=false` → sonda 503 → selettore nascosto, legacy automatico. **Nessuna di queste azioni è stata eseguita.**
- Rollback della UI web: ripristino al commit precedente (`cd26b9eb`) o, per utente, pulsante "GPTour classico". Edge/DB non coinvolti.
- Compatibilità: contratto 1.0 identico a Edge v6; nessuna modifica proposta al contratto.

## 6. Consegna mobile

`docs/gptour-orchestrator/MOBILE_API_HANDOFF.md` è autonomo (endpoint senza credenziali, auth JWT/ruoli/allowlist/sonda, ciclo sessioni/revisioni/idempotenza, tipi TS esportabili identici alla Edge v6, azioni, tabella stati/HTTP/errorCode, follow-up, mappe `[lat,lng]`, orari, multi-giorno, esempi JSON reali anonimizzati inclusi 409/401/400/403, fixture condivise, checklist di conformità, limiti). Può essere inviato così com'è all'AI mobile; opzionalmente allegare `src/lib/gptour-orchestrator/contract.ts` (stesso contenuto della §3 del documento).

## 7. Commit e pubblicazione

- Commit locale Fase 5 (autore Paolo Natale): unico commit successivo a `cd26b9eb` su `main` (ahead 12 di `origin/main`); il SHA definitivo è in `git log -1` e in `memory/CHANGELOG.md` (non può essere incluso nel commit stesso).
- **Nessun push** (attiverebbe Vercel), **nessun deploy**, **Edge v6 e DB invariati**. Prima di pubblicare, su autorizzazione: build verde, utenti fuori allowlist vedono solo il GPTour classico (verificato), stato del flag server come desiderato.
- Limiti residui: typecheck globale rosso per 516 errori preesistenti non correlati; microfono non collegato alla nuova modalità; nessun salvataggio tour operativo (azione futura separata); isolamento multi-azienda non certificato.
