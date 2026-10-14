# U2-d — Perimetro operativo: handler Edge e confine del planner — SOLO PERIMETRO, NESSUNA IMPLEMENTAZIONE AUTORIZZATA

Stato: documento di perimetro richiesto dal proprietario dopo l'accettazione di U2-c (rev.5, 985 controlli locali; D-U2C-02/03 chiuse nel perimetro locale). Riferimenti: `PHASE_U2_PLAN.md` §U2-d rev.3, `U2_C_RESULTS.md`, `U2_B_PRIVILEGE_MODEL.md`. Trasporto **`semantic-1.2`**, U1 **`semantic-1.0.1`**. Nessun accesso remoto, LLM reale, push o deploy: tutto ciò che segue è previsto, non eseguito.

## 1. Obiettivo e confine
U2-d costruisce l'**handler** che espone il runtime U2-c come Edge Function **separata** (`gptour-semantic-v2`), senza toccare `gptour-orchestrator` v7 né il kill-switch `GPTOUR_ORCHESTRATOR_ENABLED`. L'handler fa solo: parsing HTTP → verifica identità (JWT utente) → `TrustedCaller` → `handle()` U2-c → risposta. Nessuna regola CRM/routing/autorizzazione nel client, nessun parser legacy, nessuna lettura del catalogo prima dell'autorizzazione. Il **planner** viene collegato attraverso la porta `PlannerPort` già definita (D3(a) estratto, senza interpretazione/persistenza); `planned` del cancello U1 = chiamata ammessa, non piano fattibile.

## 2. File coinvolti
| Area | File | Natura |
|---|---|---|
| Edge (nuovi) | `supabase/functions/gptour-semantic-v2/index.ts` (serve + routing operazioni), `auth.ts` (verifica JWT utente → `TrustedCaller`; mai dal payload), `env.ts` (flag/variabili, fail-fast), `adapters/{catalog,settings,planner,llm,revalidation}.ts` (implementazioni reali dietro le porte U2-c) | nuovi, non tracciati fino a autorizzazione |
| Shared (invariati) | `_shared/gptour-semantic-runtime/*` (U2-c), `_shared/gptour-semantic-transport/*` (1.2), `_shared/gptour-semantic/*` (U1 1.0.1) | **nessuna modifica** salvo difetto documentato prima |
| Planner | estrazione D3(a) da `_shared/gptour-orchestrator/*` in modulo puro `_shared/gptour-planner-core/*` consumato sia da v7 (wrapper invariato) sia da U2-d | **autorizzazione separata**: golden v7 prima/dopo identici |
| SQL | `supabase/orchestrator-pending/u2b/01_semantic_migration.sql` | **invariata**; eventuale difetto → stop e descrizione |
| Test | `tests/gptour-semantic/u2/u2d/` (handler L1 con store memoria, L2 con PostgREST lab, fault injection, parità Web/Mobile), `tests/gptour-semantic/u2/u2d/kit/` (richieste/risposte 1.2 per i client) | nuovi |
| Doc | `U2_D_RESULTS.md`, aggiornamento `U2_C_RESULTS.md` solo per rimandi | nuovi/aggiornati |

## 3. Dipendenze: reali vs simulate (per livello)
| Dipendenza | L1 | L2 (lab locale) | L3 (riservato, non in questo perimetro) |
|---|---|---|---|
| Store (RPC U2-b) | memoria (spec) | **PostgreSQL 15 + PostgREST reali**, credenziale backend sintetica | hosted + `GPTOUR_SEMANTIC_BACKEND_KEY` reale |
| Identità utente | JWT sintetici firmati nel lab | JWT sintetici verificati dall'handler con chiave di lab | JWT Supabase Auth reali |
| Catalogo CRM / settings agente | fixture | fixture servite via adapter contro tabelle sintetiche di lab (schema reale replayato) | CRM reale read-only |
| LLM | mock scriptato (`LlmProviderError` strutturato) | mock | provider reale, modalità e budget registrati |
| Planner / routing | mock | planner estratto D3(a) **reale** con OSRM **simulato** (matrice fissa) | OSRM reale |
| Rivalidazione | mock | reale su lab | reale |
| Tempo | clock finto | clock DB + backdate (pattern U2-b B5) | reale |
Nessuna di queste dipendenze L3 viene contattata in U2-d; i report dichiarano per ogni prova il livello.

## 4. Verifiche previste
1. **Handler**: metodo/JSON/dimensione/`contractVersion` → `invalid_request`/`unsupported_contract` (1.1 refusata); JWT assente/invalido/scaduto → 401 trasporto senza toccare lo store; `TrustedCaller` mai derivato dal body; `targetAgentId` non autorizzato → `forbidden_agent`; header/CORS minimi; nessun log con testo CRM o token.
2. **Passthrough U2-c**: ogni operazione (`capabilities`, `create_session` 201, `turn`, `get_state`, `get_request`, `get_plan`) produce byte-per-byte il body di `handle()`; validazione finale 1.2 già interna; HTTP = `http` del runtime.
3. **Flag**: `GPTOUR_SEMANTIC_V2_ENABLED=false` → `service_disabled` prima di ogni accesso; `GPTOUR_SEMANTIC_V2_ALLOWED_UIDS` → pilota nominato; kill-switch v7 invariato e indipendente.
4. **Planner estratto**: golden v7 prima/dopo identici (stessi input → stessi piani); porte AI/store che **falliscono** se il planner tenta di usarle; `infeasible` con `criterion` dichiarato dal planner (mai attribuito dal runtime: D-U2C-03); errore OSRM → `dependency_unavailable`, mai insieme vuoto o routing dichiarato verificato.
5. **Fault injection L2**: processi/connessioni distinti; interruzioni C1–C8 attraverso l'handler; ACK perso → `outcome_unknown` con id originali → `get_request`; replay `cached`; budget LLM ≤2; lease/fencing.
6. **Parità Web/Mobile con semantic-1.2 (comportamento comune)**: la stessa `TurnRequest` inviata con `client.platform: 'web'` e `'mobile'` attraverso **due adapter HTTP distinti** (fetch "browser-like" e client "mobile-like": header, serializzazione JSON, ordine chiavi, encoding) deve dare: stesso `payloadHash`, stesso prompt LLM (mock che registra l'input), stessi criteri/gate/azioni/domande, stesso HTTP/body per una request già `done`; `client.platform` non entra in hash/prompt/regole. Matrice: successo, `blocked` con domanda, `needs_consent` + rifiuto (pulsante e testuale `decline_consent`), errori `not_accepted` (identità conservata/null, `correlationId`), `outcome_unknown` → recupero. Kit golden 1.2 pubblicato per i client (richiesta → risposta attesa) e validato con `validateTransportResponse`. Le prove con adapter **non** sono E2E delle app native (M4 resta separata).
7. **Regressioni**: U1 232+15, suite orchestratore v7, U2-a 549, U2-b 151+45, replay 111, U2-c L1/L2 (19+37+96+37 / 37+97+38) invariati.

## 5. Criteri di accettazione (U2-d/L1-L2; non equivale a Edge-ready/L3)
- Tutte le verifiche §4 verdi in L1 e L2 con esiti identici; nessun difetto aperto sulle garanzie (identità affidabile, zero planner con domanda aperta, ≤1 planner e 1 revisione per turno, nessuna scrittura CRM/v7, nessuna modifica autonoma dei criteri).
- Golden v7 identici prima/dopo l'estrazione planner; se divergono U2-d **non passa** (nessuna divergenza accettata in silenzio).
- Parità Web/Mobile §4.6 dimostrata con due adapter e kit golden 1.2 pubblicato; errori 1.2 con identità conservata/null e `correlationId` conformi.
- Nessun nuovo errore `deno check` nei moduli interessati (baseline 516 globali non toccata); nessun segreto nei file/report; archivio con diff, checksum e limiti dichiarati; QA indipendente.
- Dichiarazione esplicita dei limiti: L3 non eseguito; LLM, OSRM, CRM e client reali non certificati.

## 6. Autorizzazioni necessarie prima di iniziare
1. Avvio **U2-d** (handler + adapter + test + doc) nel solo lab locale.
2. **Estrazione planner D3(a)** da `_shared/gptour-orchestrator/*` (tocca i 40 file protetti → nuovo manifest con l'originale conservato) e criterio «golden v7 identici».
3. Conferma che **U2-e** (filtri CRM) resta esclusa: l'adapter catalogo U2-d usa fixture/schema replay, nessuna regola di filtro nuova; `caps.exact` resta `false`.
4. Nome funzione/flag (`gptour-semantic-v2`, `GPTOUR_SEMANTIC_V2_ENABLED`, `GPTOUR_SEMANTIC_V2_ALLOWED_UIDS`) e conferma che il kill-switch v7 non va toccato.
5. Decisione sui client 1.1 (non compatibili con 1.2): adeguamento Web/Mobile fuori da U2-d, dopo kit golden.
6. Restano **non autorizzati**: accesso remoto/hosted, emissione della credenziale backend reale (L3, `U2_B_PRIVILEGE_MODEL.md`), LLM reale, OSRM reale, CRM reale, push, deploy, modifiche a SQL/U1/v7.
