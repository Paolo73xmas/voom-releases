# U2-c — Perimetro esecutivo (protocollo, recupero, lease, budget LLM) — PROPOSTA, implementazione NON avviata

Derivato da `PHASE_U2_PLAN.md` rev.3 (§3 U2-c, §4, §5, §6) e da `U2_B_RESULTS.md` rev.2.1 (store SQL user-confirmed). Stato: **approvato ed eseguito** (vedi `U2_C_RESULTS.md`); precisazioni dell'utente recepite: C2 senza promessa di catalogo identico (due scenari), conformità L1/L2 con la specifica come riferimento (divergenze documentate, non adattate), identità affidabile separata dal payload.

## 0. Confini

| Fase | Contenuto | Qui |
|---|---|---|
| **U2-c (questo perimetro)** | runtime TypeScript puro, iniettabile: adapter dello store SQL (13 RPC U2-b), gestione del turno (macchina a stati §U2-c), recupero (`recover_work`/replay/takeover), rinnovo del lease, porta LLM decorata con budget atomico, costruzione delle risposte `semantic-1.1` lato handler, test delle interruzioni L1 (store in memoria conforme) e L2 (lab PostgREST + RPC reali) | **sì** |
| U2-d | handler Edge (`serve`, JWT utente → `p_caller_uid`, credenziale backend reale, `ReferenceCatalog` da CRM con JWT, planner estratto D3(a), rivalidazione CRM operativa reale, OSRM) | **no** |
| U2-e | regole/filtri commerciali, `expectedKeys`, divergenze legacy, `caps.exact` | **no** |
| U2-f / L3 / client | certificazione, kit, runner hosted, Web/Mobile | **no** |

Vincoli: solo laboratorio locale (`/tmp`), credenziali sintetiche, **LLM e routing simulati**, nessuna operazione remota, nessuna chiamata LLM reale, nessun commit/push/deploy. U1 (232), `semantic-1.1`/U2-a (409), v7, policy legacy e **migration U2-b invariati**: un difetto SQL emerso in U2-c viene documentato e corretto solo con autorizzazione separata. I client non ricevono alcuna regola duplicata: tutte le decisioni restano nel runtime server-side.

## 1. File previsti (tutti nuovi; nessun file esistente modificato)

Cartella runtime: `supabase/functions/_shared/gptour-semantic-runtime/` (Deno-compatibile, import relativi verso `gptour-semantic` e `gptour-semantic-transport` invariati; nessun `serve`, nessun segreto, nessun import di `openai-port.ts`).

| File | Ruolo | Dipende da |
|---|---|---|
| `store-port.ts` | tipi del contratto store: input/output delle 13 RPC (`claim` → `new/takeover/in_progress/cached/reused/expired/deadline_finalized`, ricevuta con `planId`, `recover_work`, ecc.), classe d'errore `StoreError{sqlstate, httpStatus}` (PT403/404/409/410/422, 42501), interfaccia `SemanticStore` | `gptour-semantic-transport/contract.ts` |
| `store-postgrest.ts` | adapter HTTP verso `/rpc/gptour_semantic_*` con credenziale backend **sintetica** (lab); timeout per chiamata; nessun retry nascosto; mappa errori PostgREST → `StoreError`; mai service role | `store-port.ts` |
| `store-memory.ts` | store in memoria che replica la semantica SQL (lock per sessione, fencing, write-once, budget ≤2, tombstone, scadenze con clock iniettato); usato solo in L1; tenuto onesto dalla suite di conformità §3.1 eseguita anche contro il lab | `store-port.ts` |
| `canonical.ts` | canonicalizzazione del `TurnRequest` (ordinamento chiavi, esclusione di `client`) e `payloadHash` SHA-256 (64 hex, come richiesto da `claim`); invariante: `client.platform` non influenza hash/prompt | `transport/validation.ts` |
| `interpretive-context.ts` | contesto persistito prima della prima riserva: catalogo minimo realmente usato, hash/schema del contesto, versione prompt/engine, identificativo modello non segreto, `acceptedAt`; clock del turno ancorato ad `accepted_at` (Europe/Rome, DST) | `gptour-semantic/contract.ts` |
| `llm-gate.ts` | `LlmPort` decorata: output persistito → replay senza invio; altrimenti `begin_llm(invocationId)` → **un solo** `complete()` → validazione schema → `store_llm`; ACK perso dello store → rilettura con `recover_work`; esiti infrastrutturali strutturati (`llm_retryable/llm_budget_exhausted/llm_unavailable/llm_invalid_output`) distinti dagli errori semantici U1; contatori: riserve vs invii osservati | `store-port.ts`, `gptour-semantic/interpreter.ts` (solo tipi) |
| `lease.ts` | rinnovo finito (ogni 15 s e ai checkpoint), arresto in `finally`, mai oltre `processingDeadline` né oltre il budget d'esecuzione iniettato; controllo pre-invio «lease residuo ≥ timeout + 5 s» altrimenti renew o arresto recuperabile | `store-port.ts` |
| `turn.ts` | orchestrazione del turno: validazione trasporto → `claim` → mappa esiti → (takeover) `recover_work` → contesto → `interpretCandidate` (bridge U2-a, U1 invariata, clock fissato) → rivalidazione operativa (porta) → `guardPlanning` con porta planner → `commit_success` / `finish_error` / `release_recoverable` → risposta definitiva **riletta dalla ricevuta** (mai anteprima non committata) | tutti i precedenti, `transport/bridge.ts`, `gptour-semantic/projection.ts` |
| `responses.ts` | costruzione delle TurnResponse lato handler con `ERROR_POLICIES` (committed con `result/gate/plan`, errori §4); proiezione della ricevuta SQL nel contratto `get_request` (`status/processingExpired/recoverable/originalHttpStatus/response`); `get_state`/`get_plan` dal SQL | `transport/errors.ts`, `transport/response-validation.ts` |
| `ports.ts` | porte iniettabili: `PlannerPort` (planned/blocked/needs_consent/infeasible/errore), `OperationalRevalidationPort` (autorizzazione attuale, evento nominato, partenza, engine → `context_changed/engine_changed`), `CatalogPort`, `Clock`, `ExecutionBudget` | `gptour-semantic/contract.ts`, `gptour-orchestrator/contract.ts` (solo tipi `Plan`) |

Test e laboratorio: `tests/gptour-semantic/u2/u2c/`

| File | Ruolo |
|---|---|
| `mocks/llm.ts` | LLM **MOCKED** a script: `ok(output)`, `timeout`, `invalid_json`, `http_5xx`, `http_401`, `hang_then_ok` (risposta dopo il timeout locale, T09); contatore degli invii osservati |
| `mocks/planner.ts`, `mocks/revalidation.ts`, `mocks/catalog.ts` | planner/routing **MOCKED** (`estimated_routing`, mai `verified_routing`), rivalidazione operativa a scenario, `ReferenceCatalog` sintetico |
| `mocks/faulty-store.ts` | wrapper dello store che inietta guasti per RPC: `throw_before`, `throw_after_ack_lost` (RPC eseguita, risposta persa), `delay`; usato per T07/T12/T14/T15 |
| `crash-points.ts` | interruzione del turno ai checkpoint C1–C8 (§3.3) tramite segnale/eccezione, con ripresa da un «nuovo worker» (stesso `requestId`, nuovo processo logico) |
| `conformance.unit.ts` | suite di conformità store eseguita **due volte**: contro `store-memory` e contro il lab PostgREST (rev.2.1): stessi esiti per claim/fencing/budget/write-once/tombstone/ricevuta |
| `turn.unit.ts` | L1: macchina a stati, mapping §4, risposte validate con `validateTransportResponse`, parità backend (T33) |
| `interruptions.unit.ts` | L1: C1–C8 × guasti LLM/store con attese su attempts/riserve/invii/revisione/piani/stato request |
| `lab_u2c.py`, `run_u2c.sh` | L2: stessa matrice contro il lab (`/tmp/voom-u2-replay`, migration rev.2.1 applicata), processi/connessioni distinti per i casi concorrenti, guasti SQL con il pattern `u2b_fault` (rimosso a fine test), report JSON + inventario residui |
| `evidence/` | report, log, export dei body per il test Deno di raccordo già esistente (`u2b/contract_bridge.unit.ts` riusato sui body prodotti dal runtime) |

Documentazione: `docs/gptour-semantic/U2_C_RESULTS.md` (esiti), aggiornamento additivo di `U2_B_RESULTS.md` solo se emergono difetti SQL (documentati, non corretti senza autorizzazione).

## 2. Comportamenti da realizzare (normativi, dal piano)

1. **Macchina a stati** §U2-c: assente → pending → done → expired; una `requestId` sconosciuta è nuova solo in sessione viva; nessun arco inverso; replay/letture passano comunque da validazione trasporto e autorizzazione attuale (via SQL).
2. **Esiti di `claim`** → HTTP/contratto: `cached` → HTTP/body conservati (zero catalogo/LLM/planner); `reused` → 422 `request_id_reused`; `expired` → 410 `request_expired`; `in_progress` → 409 `request_in_progress` + `retryAfterMs`; `deadline_finalized` → ricevuta 503 già canonica; `new/takeover` → elaborazione con token.
3. **Takeover**: prima di qualunque lavoro `recover_work`; contesto presente → riuso; output presente → `LlmPort` risponde dal persistito (zero invii); `begin_llm` mai chiamata se `llmOutput` presente.
4. **Budget atomico** (§U2-c punti 1–8): `begin_llm` per `invocationId` nuovo → un solo `complete()`; replay stessa `invocationId` → nessun invio; ACK perso della riserva → nessun invio su esito incerto, slot consumato; 2 slot massimo; timeout/5xx con slot residuo → `release_recoverable` (pending, backoff server); senza slot → `finish_error` 503 `llm_budget_exhausted`; output invalido → 502 `llm_invalid_output` immediato; action → `llm=null`, zero riserve.
5. **Store dell'output prima dell'uso**: output validato → `store_llm` → solo allora restituito a U1; store fallito → output non applicato; ACK store perso → `recover_work` e riuso, mai nuovo LLM alla cieca.
6. **Contesto temporale**: `acceptedAt` dalla ricevuta `claim` (fissato dal DB) → clock U1; T16 (mezzanotte/DST) con clock iniettato.
7. **Rivalidazione prima del planner** (porta mock in U2-c): autorizzazione attuale già riverificata dal SQL ad ogni RPC; evento scomparso/partenza passata/engine incompatibile → `finish_error` 409 `context_changed`/`engine_changed`, stato invariato.
8. **Commit**: `commit_success(state, operational, plan|null, body)` con body canonico (`gate=planned` ⇔ piano); conflitto finale → ricevuta 409 restituita; `planId` letto **solo** dalla ricevuta; risposta al client = `body` riletto dalla ricevuta (byte-identico al replay).
9. **Lease**: rinnovo finito e in `finally`; controllo residuo pre-invio; nessun worker permanente/job; dopo la deadline nessun successo tardivo (il SQL lo respinge, il runtime non deve mascherarlo).
10. **Parità backend** (T33): stesso stato+clock+catalogo+output simulato con `client.platform` web vs mobile → stesso hash, stesso prompt, stessi criteri/gate/azioni; stessa request done → stesso body attraverso due adapter.
11. **Diagnostica**: risposta U2 espone riserve e invii osservati separatamente; `diagnostics.llmCalls` U1 misura chiamate alla porta (replay incluso) e non viene presentato come costo nuovo.

## 3. Criteri di accettazione (tutti agent-tested, poi verifica utente)

### 3.1 Conformità store (L1 ≡ L2)
- `conformance.unit.ts` **identico esito** contro `store-memory` e contro il lab PostgREST: esiti `claim`, fencing (token non corrente/lease scaduto → 409), write-once contesto/output, budget ≤2 e `alreadyReserved`, `recover_work` solo con token corrente, conflitto finale come ricevuta, tombstone/410, ricevuta con `planId`. Divergenza = difetto dello store in memoria (si corregge quello; il SQL è il riferimento).

### 3.2 Turno (L1 + L2)
- Ogni risposta prodotta passa `validateTransportResponse`; ogni errore rispetta `ERROR_POLICIES` (http/outcome/retryable/nextAction); i body `committed` riletti dalla ricevuta sono byte-identici al replay (`cached`).
- T01, T03, T04, T05, T07, T23, T24, T27, T28, T33, T34, T37, T38, T39 PASS a L1 e L2 (T04/T13/T34 con processi/connessioni distinti a L2).
- Zero chiamate alla porta planner con domanda pendente; zero riserve LLM per `action`; `planned` del cancello U1 non produce `gate=planned` senza esito positivo della porta planner.

### 3.3 Interruzioni (crash points C1–C8 × guasti) — L1 e L2
| Punto | Interruzione dopo… | Atteso al ripristino (stesso `requestId`, nuovo worker) |
|---|---|---|
| C1 | validazione, prima di `claim` | `new`, attempts 1, riserve 0 |
| C2 | `claim new`, prima di `store_context` | takeover (attempts 2), contesto ricostruito identico (stesso hash), riserve 0 (T11) |
| C3 | `store_context`, prima di `begin_llm` | `recover_work` → stesso contesto; riserve 0 |
| C4 | `begin_llm` (riserva), prima dell'invio | slot consumato senza invio; seconda riserva ammessa; terza rifiutata (T12/T13) |
| C5 | invio riuscito (mock), prima di `store_llm` | ≤2 invii totali; al secondo crash → 503 `llm_budget_exhausted`, +0 (T14) |
| C6 | `store_llm`, prima di `commit_success` | zero invii aggiuntivi su N takeover; stesso contesto/output (T15); eventuale ricalcolo planner mock ammesso ma un solo piano persistito |
| C7 | `commit_success`, ACK perso | replay `cached`: HTTP/body/planId identici, +0, zero LLM/planner (T07/T39) |
| C8 | durante il rinnovo del lease (worker lento, T08/T09/T10) | lease corto impedisce l'invio; vecchio worker risvegliato respinto su renew/store/commit; un solo output committato |
- Guasti LLM mock (T26): timeout con slot → pending recuperabile + `retryAfterMs`; timeout senza slot → 503 D; JSON invalido → 502 D immediato; 401 provider → 503 `llm_unavailable` D; nessun retry nascosto nell'adapter.
- Guasti SQL di laboratorio (riuso pattern `u2b_fault`, poi zero residui): errore in `commit_success` → il runtime restituisce `storage_retryable`/`outcome_unknown` secondo §4 e **non** emette anteprima; il retry riusa output e commette una volta sola.
- Contatori verificati per ogni caso: `processing_attempts`, `llm_dispatches_reserved`, invii osservati dal mock, revisione sessione, numero piani, stato request, `planId`.

### 3.4 Non-regressione e igiene
- U1 232/232, U2-a 409/409, U2-b 151/151 + Deno 45/45, replay 111/111 invariati; 40 file protetti invariati; diff tracked vuoto (nessun file esistente modificato); `deno check` dei nuovi moduli senza nuovi errori; nessun import di `openai-port.ts`/segreti; nessun service role.
- Report con revisioni, piani, stati request, slot e invii osservati; nessun testo CRM né credenziali.

## 4. Dipendenze simulate (esplicite)
LLM (script, mai rete) · planner/routing (`estimated_routing`, mai verificato) · catalogo CRM (fixture sintetica) · rivalidazione operativa (scenario) · clock (iniettato, ancorato ad `acceptedAt`) · budget d'esecuzione Edge (valore iniettato, da misurare in L3) · credenziale backend (JWT sintetico del lab) · guasti store/SQL (wrapper + trigger di lab).

## 5. Fuori perimetro e aperture rimandate
- Edge `serve`, verifica JWT utente, emissione credenziale backend hosted, `ReferenceCatalog` da CRM reale, planner estratto, OSRM, filtri (U2-d/U2-e/L3).
- Valori definitivi di lease/rinnovo/timeout/budget esecuzione: provvisori (45 s / 15 s / 12 s / 5 min), misurazione in L3.
- Rilievi aperti invariati: compatibilità hosted credenziale backend; policy `profiles.user_metadata.role`; job di pulizia.

## 6. Sequenza proposta (ogni passo testabile da solo; STOP finale senza U2-d)
C-1 `store-port` + `store-postgrest` + conformità sul lab → C-2 `store-memory` + conformità identica → C-3 `canonical` + `interpretive-context` + `llm-gate` con mock (budget, replay, ACK perso) → C-4 `lease` + `turn` + `responses` (L1, validazione contratto, parità) → C-5 interruzioni C1–C8 L1 → C-6 L2 sul lab (concorrenza reale, guasti SQL, zero residui) → regressioni, `U2_C_RESULTS.md`, archivio, **stop**.
