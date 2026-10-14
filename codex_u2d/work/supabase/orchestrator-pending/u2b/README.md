# U2-b rev.2 — `01_semantic_migration.sql` (PENDING, solo laboratorio locale)

Stato: non applicata ad alcun ambiente remoto. Idempotente (`IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP TRIGGER IF EXISTS` / `ADD COLUMN IF NOT EXISTS` / `DROP FUNCTION IF EXISTS` delle firme rev.1), verificata ×2 sul laboratorio replay già alla rev.1 e ×2 su un cluster vergine. Prerequisiti ambientali: ruolo `authenticator` (PostgREST), `pgcrypto` (`gen_random_uuid`), tabelle `profiles` e `gptour_orchestrator_user_access` (Fase 6) per l'helper di autorizzazione. Prerequisiti **da verificare in L3**: `CREATE ROLE`/`GRANT … TO authenticator` dal ruolo migratore, emissione della chiave backend (`jti`), `SET ROLE` attraverso il gateway hosted.

## Novità rev.2
- **Identità del piano**: `plan_id` generato **prima di ogni scrittura** in `commit_success` e stampato in `plans.plan_id`, `requests.plan_id` (write-once, solo `pending→done`), ricevuta (`planId`), sessione (`last_plan_id` + `operational.lastPlanId/planRevision`, cambiano solo con nuova revisione) e dentro il body persistito (`plan.planId/sessionId/sessionRevision`). Replay dopo ACK perso → stesso `planId`, stesso body, nessuna seconda creazione.
- **Recupero interno** `recover_work(caller, session, request, token)`: backend-only, fenced come le scritture (ownership → autorizzazione attuale → token corrente → lease vivo → deadline); restituisce `context`, `llmOutput`, riserve/invocazioni, `baseRevision`, attempts, deadline/lease. Distinto dalle proiezioni pubbliche (`get_*` non espongono mai contesto/output/lease). Dopo takeover il nuovo worker recupera lo stesso output e `begin_llm` risponde `outputStored` (zero nuovi invii).
- **Raccordo con `semantic-1.1`**: `commit_success(…, p_body jsonb)` e `finish_error(…, http, p_body jsonb)` ricevono una TurnResponse del handler; il SQL verifica `operation/contractVersion/sessionId/requestId/outcome/errorCode/nextAction/retryableSameRequest` (altrimenti `PT422`, nessuna transizione) e **stampa** `engineVersion` (sessione), `sessionRevision`, `acceptedAt`, `responseExpiresAt`, `result.revision/sessionId/requestId`, `plan` (con `planId`). `revision_conflict` e `processing_expired` sono costruite **interamente dal SQL** come TurnResponse canoniche con `gptour_semantic_error_policy()` (specchio dei soli due codici emessi dal DB; uguaglianza con `errors.ts` asserita dal test Deno `contract_bridge.unit.ts`). `final_revision` = revisione osservata anche per `processing_expired` e `finish_error`. Timestamp del contratto in UTC ms `Z` (`gptour_semantic_ts`).
- **T06** eseguito in laboratorio in due varianti (trigger AFTER UPDATE su sessions e, rev.2.1, AFTER INSERT su plans; schema `u2b_fault`, rimosso a fine test): rollback di sessione/piano/finalizzazione, piano appena inserito eliminato, contesto/output recuperabili, un solo commit e un solo piano al retry senza nuove riserve LLM.

## Oggetti
- Ruoli: `gptour_semantic_owner` (proprietario, nessun membro), `gptour_semantic_backend` (concesso ad `authenticator`; solo EXECUTE sulle **13 RPC**).
- Tabelle: `gptour_semantic_sessions` (+`last_plan_id`), `_requests` (+`plan_id`), `_llm_invocations`, `_plans`, `_backend_keys` — RLS abilitata, nessuna policy, nessun grant a ruoli PostgREST. Il proprietario supera la RLS: dentro le RPC la protezione sono i controlli espliciti.
- Trigger: `*_guard` (BEFORE UPDATE, codici `U2W01–U2W11`) e `gptour_semantic_no_delete` (BEFORE DELETE, ammesso solo a `current_user = gptour_semantic_owner`, cioè alla futura RPC di manutenzione; nessun job creato).
- Funzioni interne (nessun EXECUTE a ruoli PostgREST, 27 funzioni totali): `assert_backend`, `lock_session`, `lock_fenced`, `receipt`, `ts`, `error_policy`, `terminal_turn`, `align_body`, trigger. Helper `gptour_semantic_is_authorized(uuid,uuid)` owned dal ruolo migratore, EXECUTE solo all'owner.

## Invarianti imposti dal DB (anche ad accessi diretti e service_role)
sessione: identità immutabile, `revision` +1 esatto, stato/`operational`/`last_plan_id` cambiano solo con nuova revisione · request: identità/hash/base_revision/scadenze immutabili; `pending→done|expired`, `done→expired`, mai ritorno a pending; `context`/`llm_output` write-once e cancellabili solo alla finalizzazione; `response_body`/`http_status`/`outcome`/`final_revision`/`plan_id` scritti solo con `pending→done`, mai sostituiti; `response_body` azzerabile solo `done→expired` oltre `response_expires_at` (tombstone con `http_status`/revisioni/contatori); `processing_attempts` e `llm_dispatches_reserved` monotoni (≤2); nessun lease dopo finalizzazione · invocazioni: riserva immutabile · piani: immutabili · nessun DELETE applicativo.

## RPC (backend only; `p_caller_uid` asserito dalla Edge dopo verifica del JWT utente; ownership + autorizzazione attuale + scadenze riverificate in SQL)
| RPC | Esito |
|---|---|
| `create_session(caller, agent, contract, engine)` | autorizza l'agente (helper + Fase 6) → sessione rev 0, ID server |
| `claim(caller, session, request, hash, expectedRevision)` | `new` (token, base_revision=expectedRevision, deadline +5 min, replay +7 gg) · `reused` (hash diverso) · `expired` (+tombstone se done) · `cached` (ricevuta con `planId`) · `deadline_finalized` (503 `processing_expired`, body canonico SQL) · `in_progress` (+`retryAfterMs`) · `takeover` (nuovo token, attempts+1) |
| `renew_lease` | pending+token+lease vivo+deadline → `min(now+45s, deadline)` |
| `store_context` | write-once prima di ogni riserva |
| `begin_llm(…, invocationId)` | richiede contesto; prima riserva → `mayDispatch=true`; replay → `alreadyReserved`; output presente → `outputStored`; ≥2 → `budgetExhausted` |
| `store_llm(…, invocationId, output)` | richiede riserva; write-once |
| `recover_work(…, token)` | **interno**: contesto/output/riserve persistiti per il worker corrente (fenced); 409 dopo finalizzazione o con token non corrente |
| `commit_success(…, state, operational, plan, body)` | conflitto → request done 409 `revision_conflict` (body SQL, ritorno); altrimenti `plan_id` generato, +1, stato, piano opzionale (`gate` deve essere `planned`), body allineato e stampato, ricevuta con `planId`, pulizia context/output/lease — tutto in una transazione |
| `finish_error(…, http 4xx/5xx, body)` | solo request; `outcome` = `body.errorCode`; body con `gate`/`plan` o senza `errorCode` → 422 |
| `release_recoverable(…, code, retryAfterMs)` | lease rilasciato, `next_retry_at` (≤60 s, ≤ deadline), resta pending |
| `get_state` / `get_request` / `get_plan` | proiezioni di contratto (`lastPlanId`, `planId`, timestamp UTC); 404/410 non enumeranti; autorizzazione attuale applicata anche al replay |

Codici HTTP via PostgREST: `PT403` 403, `PT404` 404, `PT409` 409, `PT410` 410, `PT422` 422, `42501` 403.

## Esecuzione locale
```bash
export U2_PG_BIN=/usr/lib/postgresql/15/bin U2_PG_OS_USER=postgres U2_REPLAY_ROOT=/tmp/voom-u2-replay U2_DENO_BIN=/opt/deno/deno
bash tests/gptour-semantic/u2/u2b/run_u2b.sh     # migration x2 + 151 controlli SQL/HTTP + 45 controlli Deno di raccordo (report in $U2_REPLAY_ROOT/u2b_report.json, export in u2b_contract_export.json)
```
