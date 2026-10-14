# U2-b rev.2.1 — Persistenza SQL e RPC transazionali GPTour semantic: esiti (laboratorio locale)

**Esecuzione: 2026-10-13 UTC** su `/tmp/voom-u2-replay` (PostgreSQL 15.19 + PostGIS 3.3.2 + PostgREST 16.2, loopback, schema reale replicato) e, per la prova «DB vergine», su un cluster nuovo `/tmp/voom-u2-replay-fresh` poi rimosso. Base `259ec92d`. Nessun handler U2-c, Edge, client, LLM reale, accesso remoto, segreto di produzione, commit, push o deploy. U1, contratto `semantic-1.1`, v7 e policy legacy invariati (diff dei file tracciati vuoto).

La rev.1 (99 controlli) e la rev.2 (archivio `gptour_u2b_sql_delivery_rev2.zip`, SHA-256 + 78 checksum, 45 controlli Deno rieseguiti sui dati esportati) sono state verificate dall'utente. La rev.2 ha recepito le quattro correzioni richieste: **recupero interno**, **identità del piano**, **T06** e **raccordo esplicito con `semantic-1.1`**. La **rev.2.1** aggiunge la sola seconda variante T06 concordata (guasto AFTER INSERT su `gptour_semantic_plans`): **migration invariata**, nessun difetto rilevato.

## 1. Consegna

| File | Contenuto |
|---|---|
| `supabase/orchestrator-pending/u2b/01_semantic_migration.sql` | migration **rev.2 idempotente** (×2 sul lab già alla rev.1, ×2 su cluster vergine): ruoli, 5 tabelle (+`sessions.last_plan_id`, +`requests.plan_id`), 9 trigger di invarianti, funzioni di controllo/lock, `receipt`, `ts`, `error_policy`, `terminal_turn`, `align_body`, **13 RPC** (+`recover_work`), REVOKE/GRANT. In cartella «pending»: **mai applicata da qui a un ambiente remoto**. Le firme rev.1 di `commit_success`/`finish_error` vengono rimosse (`DROP FUNCTION IF EXISTS`) e sostituite. |
| `supabase/orchestrator-pending/u2b/README.md` | novità rev.2, invarianti, mappa RPC, privilegi, pulizia futura |
| `tests/gptour-semantic/u2/u2b/verify_u2b.py`, `run_u2b.sh` | suite SQL/HTTP **151 controlli** (B1–B13 + B12b) + passo Deno |
| `tests/gptour-semantic/u2/u2b/contract_bridge.unit.ts` | **45 controlli Deno**: i body terminali persistiti validati con `validateTransportResponse`; policy SQL = `ERROR_POLICIES`; piano persistito valido come Plan 1.0; replay byte-identico |
| `tests/gptour-semantic/u2/u2b/evidence/` | `u2b_report.json` (151/151), `u2b_contract_export.json` (input del test Deno), `u2b_run.log` (151 + 45), `u2b_inventory.txt` (catalogo: 5 tabelle, 2 colonne nuove, 27 funzioni, 9 trigger, membership, zero policy, zero residui del guasto), `u2b_fresh_cluster.log`, log regressioni |
| `docs/gptour-semantic/U2_B_RESULTS.md` | questo documento |

Modifica all'additivo esistente: `tests/gptour-semantic/u2/schema_replay/replay_verify.py` controllo S1 accetta namespace libero oppure l'inventario rev.2 (5 tabelle / 27 funzioni).

## 2. Correzioni rev.2

### 2.1 Recupero interno (`gptour_semantic_recover_work`)
Percorso **backend-only** (EXECUTE solo `gptour_semantic_backend`), fenced esattamente come le scritture: `assert_backend` → `lock_session` (ownership, autorizzazione attuale Fase 6, scadenza logica) → `lock_fenced` (request pending, token corrente, lease vivo, deadline). Restituisce `context`, `llmOutput`, `invocations`, `llmDispatchesReserved`, `baseRevision`, `processingAttempts`, `processingDeadline`, `leaseUntil` (chiavi esatte). È **distinto dalle proiezioni pubbliche**: `get_request`/`get_state`/`get_plan` non espongono mai contesto/output/lease (asserito con insieme esatto di chiavi). Dopo la finalizzazione risponde 409 e contesto/output sono già azzerati.

Prova B10: `store_llm` → perdita del worker (lease scaduto; il vecchio token → 409) → `claim` = `takeover` (attempts 2, budget 1 conservato) → `recover_work` con il nuovo token restituisce **lo stesso** contesto/output/riserve → `begin_llm` = `outputStored` (nessuna nuova riserva né riga d'invocazione) → vecchio worker risvegliato respinto → altro utente 404 → `authenticated`/`service_role`/`anon` 401/403.

### 2.2 Identità del piano
In `commit_success` il `plan_id` è generato **prima di ogni scrittura** e stampato ovunque nella stessa transazione: `plans.plan_id`, `requests.plan_id` (write-once, solo `pending→done`, trigger `U2W06`), ricevuta (`planId`), sessione (`last_plan_id` + `operational.lastPlanId/planRevision`, trigger `U2W08`: cambiano solo con nuova revisione), body (`plan.planId/sessionId/sessionRevision`). Senza piano, `last_plan_id`/`operational.lastPlanId` restano al piano precedente.

Prova B11: `requests.plan_id = sessions.last_plan_id = operational.lastPlanId = plans.plan_id = plan.planId` (una sola query); **ACK perso → replay** `cached` con lo stesso `planId` e body byte-identico, nessun token; `get_plan(planId)` restituisce il piano byte-uguale a quello nel body; `get_state` espone `lastPlanId`; **un solo piano** in tabella. Negativi (tutti 422 senza transizione, request e token intatti): `gate=planned` senza `p_plan`; `p_plan` con gate non `planned`; body di un'altra sessione; body `committed` con `errorCode`; body non TurnResponse.

### 2.3 T06 — guasto iniettato dopo l'UPDATE della sessione
Solo laboratorio: schema `u2b_fault` con tabella-flag e trigger **AFTER UPDATE** su `gptour_semantic_sessions` (SECURITY DEFINER del superuser di lab; non fa parte della migration) che solleva `U2F01` finché il flag esiste. Sequenza B12: request con contesto+output persistiti → `commit_success` → errore propagato (nessuna ricevuta) → **rollback atomico**: sessione rev 2, `last_plan_id` invariato, nessun piano nuovo, request `pending` con token/contesto/output intatti, `plan_id` nullo, nessuna risposta → `recover_work` restituisce contesto/output → secondo tentativo con guasto attivo: stesso rollback, nessun effetto parziale → flag rimosso → **un solo commit riuscito al retry** (rev 3, un piano, request `done` con `plan_id`) → replay `cached` con lo stesso piano → trigger/schema/funzione del guasto rimossi: **zero residui**, 9 trigger della migration.

**Variante B12b (rev.2.1) — guasto AFTER INSERT su `gptour_semantic_plans`**: trigger di laboratorio che solleva `U2F02` quando il piano è appena stato inserito (sessione già aggiornata a rev 5, request non ancora finalizzata). Stato iniziale fotografato in una sola query (revisione, `last_plan_id`, `operational.lastPlanId/planRevision`, stato, numero piani, piani a rev 5, status/token/`plan_id`/contesto/output/riserve/invocazioni/risposta/`final_revision` della request). Esito: errore propagato con `plan_id` e `plan_revision` del piano inserito → **rollback atomico**: sessione rev 4 e riferimenti al piano precedente ripristinati, stato invariato, **piano rev 5 eliminato** (3 piani, nessun orfano per revisione o `planId` stampato), request `pending` con token/contesto/output/riserva intatti, nessuna risposta → `recover_work` restituisce contesto/output → secondo tentativo con guasto attivo: stesso rollback → flag rimosso → `begin_llm` = `outputStored` (**nessuna nuova riserva LLM**) → stesso `requestId`: **un solo commit** (rev 5), **un solo nuovo piano** (4 totali, 1 a rev 5), request `done` con `plan_id`, riserva ancora 1 e 1 sola invocazione; `planId` coerente fra ricevuta, body e tabella; replay `cached` con lo stesso piano → trigger/schema/funzioni rimossi: **zero residui**, 9 trigger della migration.

### 2.4 Raccordo esplicito con `semantic-1.1` e replay canonico
- `response_body` è sempre il **testo di una TurnResponse canonica**, perché il replay la restituisce al client così com'è.
- `commit_success(…, p_body jsonb)` e `finish_error(…, http, p_body jsonb)`: `gptour_semantic_align_body` esige `operation=turn`, `contractVersion` della sessione, `sessionId`/`requestId` della request, `outcome` presente e ≠ `not_accepted`, chiavi `errorCode`/`nextAction`/`retryableSameRequest`; poi **stampa** `engineVersion` (sessione), `sessionRevision`, `acceptedAt`, `responseExpiresAt` e, se presente, `result.revision/sessionId/requestId`; con piano stampa `plan` (vedi 2.2). `commit_success` esige `outcome=committed` senza `errorCode` e `gate=planned` ⇔ `p_plan`; `finish_error` esige `errorCode`, nessun `gate`/`plan`, `result` nullo o `status=error`, http 4xx/5xx; `outcome` persistito = `errorCode`.
- `revision_conflict` e `processing_expired` sono costruite **interamente dal SQL** (`gptour_semantic_terminal_turn`) con `gptour_semantic_error_policy`, specchio dei **soli due codici emessi dal DB** (`processing_expired`: 503/committed/get_state_and_confirm/non ritentabile; `revision_conflict`: 409/…); per ogni altro codice la funzione restituisce NULL (nessuna duplicazione delle policy del handler). `final_revision` = revisione osservata anche per `processing_expired` e `finish_error`.
- Timestamp del contratto (`acceptedAt`, `responseExpiresAt`, `expiresAt`, `createdAt`, `lastCommitAt`, `processingDeadline`) in UTC con millisecondi e `Z` (`gptour_semantic_ts`), conformi a `isTimestamp`.
- Test Deno `contract_bridge.unit.ts` (45/45) sui 6 body persistiti esportati dal lab (`committed_with_plan`, `committed_without_plan`, `committed_after_fault_retry`, `processing_expired_sql`, `revision_conflict_sql`, `finish_error_handler`): `validateTransportResponse` ok; identità; `errorCode`; `http_status` = `ERROR_POLICIES[code].httpStatus` (200 senza errore); `sessionRevision` = `final_revision`; outcome/nextAction/retryable = `ERROR_POLICIES`; `plan.planId` = `planId` della ricevuta; policy SQL identiche a `errors.ts`; piano persistito valido dentro una risposta `get_plan`; replay byte-identico.

## 3. Risultati — 151/151 SQL/HTTP + 45/45 Deno (rev.2: 140 ×3 sul lab rev.1→rev.2 e ×1 su cluster vergine; rev.2.1: 151 ×2 sul lab, QA indipendente iteration_67 su cluster vergine per la rev.2)

| Sezione | N. | Evidenza |
|---|---|---|
| B1 struttura/privilegi | 9 | owner/RLS/zero policy/zero grant; EXECUTE **13 RPC** solo backend, 27 funzioni, nessuna voce PUBLIC; `search_path` fissato; membership; 9 trigger |
| B2 flusso | 24 | come rev.1 + body persistito stampato dal SQL (`sessionRevision`, `plan.planId`, `acceptedAt`, `engineVersion`), ricevuta con `planId`, `get_state` con `lastPlanId`/`operational`, `get_plan` con piano stampato, `finish_error` con `outcome = errorCode` |
| B3 negativi | 15 | 13 RPC × 5 identità → 401/403; 5 tabelle × 4 ruoli × 4 verbi; backend senza SELECT/helper/jti; claims falsificati |
| B4 ownership/autorizzazione | 8 | + `recover_work` incluso nelle 11 operazioni respinte (404) dopo revoca Fase 6 |
| B5 fencing/lease/deadline | 9 | token sconosciuto su **8** RPC fenced → 409; `deadline_finalized` con body `processing_expired` canonico |
| B6 conflitto finale | 5 | + body del conflitto costruito dal SQL (policy, `sessionRevision` osservata, `plan`/`result` nulli), replay identico |
| B7 concorrenza | 4 | invariato (body del vincitore identico nei 6 replay paralleli) |
| B8 scadenze/tombstone | 8 | invariato |
| B9 trigger vs privilegio vs RLS | 22 | + `last_plan_id` senza revisione, `plan_id` sostituito, `plan_id` dopo finalizzazione → rifiuto del trigger |
| **B10 recupero interno** | 11 | §2.1 |
| **B11 identità piano** | 13 | §2.2 |
| **B12 T06 guasto iniettato** | 7 | §2.3 |
| **B12b T06 guasto dopo INSERT piano** | 11 | §2.3 variante (rev.2.1) |
| **B13 raccordo (export)** | 5 | `processing_expired` canonico, `finish_error` 422 con gate, `engineVersion` sovrascritta, `revision_conflict` UUID, export 6 body/2 policy/get_plan |
| **B14 Deno raccordo** | 45 | §2.4 |

Regressioni dopo rev.2.1 (rieseguite): **U1 232/232** (Node), **U2-a 409/409** (Node+Deno), **replay 111/111** (lab rev.2 e cluster vergine), v7 non toccata, diff tracciato vuoto. La simulazione del tempo nei test resta transazionale e dichiarata (`backdate()`), non disponibile ad alcun ruolo.

## 4. Limiti e aperture (invariati salvo dove indicato)

- Compatibilità hosted della credenziale backend (emissione `jti`, `CREATE ROLE`, `GRANT … TO authenticator`, `SET ROLE` via gateway): **aperta per L3**.
- Rilievo policy `profiles` basate su `user_metadata.role`: aperto; U2-b non legge `profiles` se non tramite l'helper owned dal migratore.
- Il body canonico resta prodotto dal futuro handler (U2-c); il DB ne verifica il raccordo strutturale e ne stampa identità/revisione/metadati/piano. Le policy dei codici del handler restano in `errors.ts`; il SQL ne possiede solo le due che emette, verificate uguali dal test Deno.
- Pulizia fisica: solo compatibilità dimostrata (owner può eliminare; nessun altro); il job resta da autorizzare. `sessions.last_plan_id` è un riferimento senza FK: la futura pulizia dei piani scaduti non è bloccata e `get_plan` risponde 404/410.

**Stop al termine di U2-b rev.2.1.** U2-c (protocollo/handler), U2-d (Edge), client e qualunque operazione remota restano non autorizzati.
