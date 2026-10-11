# GPTour Orchestrator — Contratto client unificato (web + mobile) · bozza Fase 4A

Un solo endpoint (`POST /functions/v1/gptour-orchestrator`), un solo significato dei campi e degli stati per web e app mobile. **I client non implementano logica commerciale o di pianificazione**: inviano testo o azioni strutturate e rendono la risposta. Questo documento mappa le operazioni client sul contratto già esistente (`_shared/gptour-orchestrator/contract.ts`, `contractVersion "1.0"`), senza introdurre nuovi campi. Nessun client è ancora collegato.

## Trasporto
- `Authorization: Bearer <JWT Supabase dell'utente>` (identità e ruolo derivano solo dal token; `role/agentId/tenantId/isAdmin` nel payload sono rifiutati con 400). `apikey` anon come per ogni Edge Function.
- Risposta sempre JSON `OrchestratorResponse`. Codici HTTP: 200 (qualunque `status` conversazionale), 400 payload/contratto non valido, 401 token mancante/non valido, 403 `blocked`, 405 metodo, 409 `revision_conflict`, 422 `failed`, 503 funzione disattivata (`GPTOUR_ORCHESTRATOR_ENABLED != true`).
- `sessionId` scelto dal client (UUID, uno per conversazione); `requestId` univoco per invio: lo stesso `requestId` restituisce la stessa risposta (idempotenza) e non avanza la revisione. Facoltativo `expectedRevision` per rifiutare invii su stato obsoleto.

## Operazioni client → richiesta
| Operazione | Richiesta | Note |
|---|---|---|
| Avviare una conversazione | `{ sessionId: nuovo, requestId, message: "<testo agente>" }` | il primo messaggio può contenere tutto o niente: il motore chiede ciò che manca |
| Rispondere a un chiarimento | `message` libero **oppure** `action: { type: 'answer', questionId, optionId, value? }` | `question.options[].id` sono gli `optionId` ammessi; `set_date { date }` e `set_start_time { time }` sono scorciatoie strutturate |
| Recuperare una sessione | qualunque richiesta con lo stesso `sessionId`: la risposta contiene sempre `criteria` e `sessionRevision`; per l'ultimo piano usare `action: { type: 'get_plan', planId }` con il `planId` ricevuto | lo stato è autorevole sul server (persistenza dimostrata dopo riavvio Edge e DB) |
| Confermare decisioni sui follow-up | `action: { type: 'follow_up_decision', followUpId, decision: 'include' \| 'exclude' \| 'propose_reschedule', proposedDate? }` o testo ("includili tutti", "escludili") | `propose_reschedule` non modifica il CRM: il piano resta `dependsOnPendingChanges` |
| Richiedere modifiche | testo ("partiamo alle 10", "aggiungi anche Opera", "togli i nuovi punti", "entro le 16", "togli la tappa X") o `require_stop { key }` / `exclude_stop { key }` | ogni modifica rigenera il piano e incrementa `sessionRevision`; i piani precedenti restano recuperabili con `get_plan` |
| Visualizzare il piano | leggere `plan` quando `status === 'ready'` | vedi sotto |
| Ricominciare | `action: { type: 'reset' }` | azzera i criteri della sessione |

## Risposta → rendering (identico su web e mobile)
| `status` | Cosa mostrare |
|---|---|
| `needs_clarification` | `message` + `question` (`kind`: `area`, `date`, `inactive_days`, `non_working_day`, `past_time`, `day_over`, `follow_ups`, `stale_draft`, `infeasible`, `free_text`) con `options` come pulsanti; sempre consentire testo libero |
| `ready` | `plan`: `date`, `startMin/finishMin/endMin` (minuti dalla mezzanotte Europe/Rome), `departure/returnTo`, `stops[]` (`arrivalMin, departureMin, visitMin, travelMinFromPrev, travelKmFromPrev, waitMin, lunchBeforeMin, role` ∈ `appointment/follow_up_confirmed/required_by_agent/suggested`, `group` ∈ `existing/new`, `daysSinceOrder`, `reason`), `totals`, `geometry`, `verification` (`verified_routing` = OSRM reale; `estimated_routing` = stima da dichiarare), `warnings`, `selectionReasons.excluded[]` (motivi), `days[]` se multi-giornata (`returnHomeAfterDay`, `nightKmHome`) |
| `infeasible` | `message` + `conflicts[]`; nessun piano: l'agente decide (riduci, aggiungi giornata, prolunga, cambia data) |
| `blocked` | autorizzazione negata o dati dell'agente non leggibili (`errorCode` es. `agent_settings_unavailable`): mostrare il messaggio, non riprovare automaticamente |
| `failed` | `errorCode`: `routing_unavailable` (riprova più tardi, nessun piano stimato "finto"), `revision_conflict` (ricaricare lo stato e ripetere l'ultimo messaggio), altro |
| HTTP 503 | funzione non attiva: il client **non** deve ripiegare su logiche locali di pianificazione |

`metrics` (durata, query CRM, chiamate/token AI, routing) e `dataQuality` (completezza pool, fonte routing) sono informativi per diagnostica.

## Regole per i client
1. Nessuna classificazione commerciale, filtro acquisti, calcolo di fattibilità o routing lato client: solo rendering e invio.
2. Mai costruire un piano da una risposta `needs_clarification`/`infeasible`/`failed`.
3. Mostrare sempre `verification` e `warnings`; distinguere stima e routing verificato; il traffico reale non è modellato.
4. Conservare `sessionId` e ultimo `planId` localmente solo come riferimento; lo stato è sul server.
5. Feature flag lato client separato dal flag server; attivazione graduale per agente pilota.
