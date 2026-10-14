# U2-d — Handler Edge `gptour-semantic-v2`: esiti (laboratorio locale) — consegna 2 (completamento perimetro) — pronta per verifica esterna di Codex

> Guida alla verifica, comandi, prerequisiti, baseline/diff e tabella limiti: **`U2_D_VERIFICATION.md`**. Log della versione finale: `tests/gptour-semantic/u2/u2d/evidence/final/`.

**Esecuzione: 2026-10-14 UTC** (consegna 1: 2026-10-13, accettata dall'utente come avanzamento parziale). Perimetro: `U2_D_SCOPE.md` + richieste di completamento del proprietario: (a) `auth.ts` robusto a token malformati, (b) CORS su origini esplicite verificato in browser reale, (c) estrazione planner D3(a) con golden v7 identici, (d) avvio locale dell'entrypoint con dipendenze sintetiche e simulazioni dichiarate. Trasporto `semantic-1.2`, U1 `semantic-1.0.1`, runtime U2-c rev.5 (**invariato** in questa consegna). **Nessuna modifica a SQL né U1**; **un** file v7 modificato su autorizzazione D3(a) (`orchestrator.ts`, vedi §3). Nessun accesso remoto, credenziale reale, LLM/OSRM reale, push o deploy.

## 1. Consegnato / modificato in questa consegna
| File | Ruolo |
|---|---|
| `supabase/functions/gptour-semantic-v2/auth.ts` | **(a)** ogni difetto strutturale del JWT (3 segmenti, alfabeto/padding Base64URL, header/claims non-oggetto JSON, firma non 32 byte, `alg≠HS256`, `sub` non UUID, `exp` non numerico) → `null` **prima** di qualunque operazione crittografica, senza eccezioni (`InvalidCharacterError` eliminato) |
| `…/env.ts` | **(b)** `GPTOUR_SEMANTIC_V2_ALLOWED_ORIGINS` (lista esplicita; default **vuota** = nessuna origin); `parseOrigin` fail-fast: solo `scheme://host[:port]`, mai `*`, mai path/credenziali |
| `…/handler.ts` | **(b)** ordine **origin → preflight → metodo → flag → JWT → pilota → size → JSON → handle()**; header CORS (`access-control-allow-origin: <origin>`, `vary: origin`) su **tutte** le risposte — successo, errori di ingresso, errori contrattuali 1.2, `service_disabled`; preflight `OPTIONS` → 204 con `allow-methods: POST, OPTIONS`, `allow-headers: authorization, content-type`, `max-age: 600`; Origin non ammessa → **403 `origin_not_allowed`** prima dell'autenticazione (nessun effetto); senza Origin (client nativo) → nessun header CORS |
| `supabase/functions/_shared/gptour-planner-core/planner.ts` | **(c) NUOVO** modulo condiviso: `planTour(input, io, metrics) → PlannerOutcome` (`blocked` territorio / `ask` agenda-infeasible / `infeasible` / `failed` routing / `plan`), estratto **testualmente** da `handleTurn` v7 (§3) |
| `supabase/functions/_shared/gptour-orchestrator/orchestrator.ts` | **(c)** wrapper v7: chiama `planTour` e traduce l'esito in `base/ask/finish` con gli stessi `extra`, contatori e ordine `savePlan → lastPlanId → finish` (−170/+15 righe) |
| `…/gptour-semantic-v2/adapters/planner-core.ts` | **(c)** `PlannerPort` U2-d sul core condiviso: `Projection` → criteri v7 (gruppi dalla proiezione o default v7; **nessun filtro nuovo**, U2-e esclusa), porte CRM/routing iniettate (lab: `FakeCrm`/`FakeRouting`); `mapOutcome`: `blocked`→`DependencyError(catalog)`, `failed`→`DependencyError(routing)`, `infeasible` → criterio nominato dal core (`area` / `dates` / `other`), domanda v7 `infeasible` → `time_window`, domanda agenda → `other` con limite dichiarato |
| `…/gptour-semantic-v2/index.ts` | **(d)** entrypoint avviabile in locale (`GPTOUR_SEMANTIC_V2_LAB_PORT`, listener 127.0.0.1); banner di avvio con l'elenco dipendenze; rivalidazione **deterministica** (sotto), `PLANNER_NOT_WIRED` (→ `DependencyError('planner')`, mai esito finto); LLM **non collegato** (`null`) |
| `…/gptour-semantic-v2/adapters/revalidation.ts` | **NUOVO** — sostituisce la simulazione «sempre ok»: `engine_changed` se il contesto interpretativo fu costruito da un motore diverso; `context_changed` se il catalogo riletto ORA (porta RLS dell'utente) ha hash canonico diverso da quello del contesto; catalogo illeggibile → `DependencyError('revalidation')`. Richiede il campo additivo opzionale `catalogHash` in `RevalidationPort.check` (`runtime/ports.ts`) passato da `turn.ts` (unica modifica runtime; regressione U2-c L1/L2 rieseguita) |
| `tests/gptour-semantic/u2/u2d/revalidation.unit.ts` | 12 controlli: unit (ok / engine_changed / context_changed / senza hash / ordine righe / guasto) + runtime via handler (catalogo cambiato fra contesto e piano → 409, stato invariato; guasto → 503 recuperabile + retry; takeover da motore diverso → 409 engine_changed) |
| `…/u2d/verify_protected.py`, `final_verify.sh`, `package_u2d.py` | audit 40 file protetti vs baseline con motivazioni; verifica finale completa con tabella eseguiti/falliti/non eseguiti; packager con rifiuti di sicurezza |
| `tests/gptour-semantic/u2/u2d/auth_cors.unit.ts` | 42 controlli: 18 token malformati → `null` senza eccezione; handler 401 + CORS su errore; preflight/403/405/200/400/503 con e senza header; `parseOrigin`/`configFromEnv` |
| `…/u2d/planner_core.unit.ts` | 18 controlli: piano **reale** dal core tramite handler (`estimated_routing`, mai «verified» con routing simulato; replay byte-identico), nessun candidato → `blocked` su `area`, guasto routing → `dependency_unavailable` + recupero stesso `requestId`, guasto settings → `dependency_unavailable`, proiezione senza data → `dates`, `mapOutcome` su tutti i tipi di esito |
| `…/u2d/lab_serve.ts` + `cors_browser.py` | **(b)** CORS in **browser reale** (Chromium/Playwright): due origini statiche locali, handler reale su 127.0.0.1 |
| `…/u2d/lab_entrypoint.py` | **(d)** avvio di `index.ts` con env sintetico su PostgREST locale (SQL U2-b reale) |
| `tests/gptour-orchestrator/golden_v7.ts`, `golden_v7.sh`, `golden/golden_v7_reference.json` | **(c)** golden v7: 30 conversazioni / 48 risposte, riferimento registrato **prima** dell'estrazione |
| `docs/gptour-semantic/PROTECTED_BASE_MANIFEST.md` | nuovo hash cumulativo dopo D3(a) (originale e rev.4 conservati); `orchestrator.ts` marcato MODIFICATO (autorizzato, D3(a)) |

## 2. Risposte dell'handler (ingresso vs contratto) — aggiornato
| Caso | Risposta | Natura |
|---|---|---|
| Origin presente e **non** in lista | **403** `{ingress:'origin_not_allowed', correlationId}` (senza header CORS) — prima di metodo/JWT | ingresso |
| `OPTIONS` con Origin ammessa | **204** + `allow-origin/vary/allow-methods/allow-headers/max-age` | preflight CORS |
| `OPTIONS` senza Origin | **405** `method_not_allowed` (non è un preflight) | ingresso |
| metodo ≠ POST | **405** | ingresso |
| flag OFF | **503** `service_disabled` 1.2 (+CORS se origin ammessa) | contratto |
| JWT assente / malformato (Base64URL, JSON, alg, firma, sub, exp) / firma invalida / scaduto / ruolo ≠ authenticated | **401** `unauthorized` — zero accessi a store/catalogo/settings | ingresso |
| utente fuori pilota | **403** `pilot_not_allowed` | ingresso |
| body > limite | **413** | ingresso |
| JSON malformato / schema / identità nel payload | **400** `invalid_request` 1.2 | contratto |
| A su agente B / B su sessione di A | **403** `forbidden_agent` / `forbidden_session` | contratto |
Nessuna modifica al contratto `semantic-1.2`.

## 3. Estrazione planner D3(a) — prova «golden v7 identici»
- **Metodo**: prima di toccare v7 è stata registrata la battaglia `golden_v7.ts` (adapter in memoria, orologio fisso 2026-10-15 08:30 Rome; 30 conversazioni: piani verificati/stimati, inattivi 30 gg, «tutti» infeasible → reduce/extend, nessun candidato, provincia, agenda include/escludi/sposta/appuntamento, multi-giornata ask/diretta/2 giorni, guasto routing + retry, guasto territorio, guasto acquisti/registro, pool troncato, obbligatoria non idonea, required/excluded, partenza GPS/esplicita, non lavorativo, reset, oggi tardi/ok, `get_plan`) → 48 risposte + stato store/CRM/routing per passo, mascherando solo `planId/lastPlanId` (alias stabili) e `durationMs`. Due esecuzioni consecutive identiche (deterministico).
- **Prima**: `golden_v7_reference.json` sha256 `a43b9cd144c6cc6084e15041cbc15f29c3619bd8af4541279824647ff2c98665`; suite v7 14 file, `fail=0`.
- **Dopo**: golden rigenerato **byte-identico** (`cmp` ok, `golden_v7.sh`); suite v7 14/14 con **conteggi di asserzioni identici** riga per riga (`evidence/d3a/v7_suite_{before,after}.log`); `deno check` di `gptour-orchestrator/index.ts` ok.
- **Cosa è cambiato**: solo `orchestrator.ts` (diff `evidence/d3a/orchestrator_d3a.diff`): la sezione «dati CRM → classificazione → selezione → multi-giornata → routing → verifica → piano» è spostata in `gptour-planner-core/planner.ts`; `handleTurn` conserva interpretazione, sessione, idempotenza, autorizzazioni, scala delle domande, persistenza. `areaLabel` è esportata dal core e re-importata. Il kill-switch, `handler.ts`/`index.ts` v7, `applyAction/answerPending/applyAiPatch`, SQL e U1: invariati.
- **Manifest**: 40 file protetti, 1 modificato; cumulativo originale `47b38f95…` e rev.4 `0ef218f4…` conservati; nuovo `041f2bfa00446526951e79689e2fab9a61276e29b0282ec38e3d29a21b036d88`.
- **Consumo U2-d**: `adapters/planner-core.ts` usa lo **stesso** `planTour` (nessuna duplicazione di regole). In laboratorio le porte CRM/routing sono `FakeCrm`/`FakeRouting` (OSRM **simulato**): il piano prodotto ha sempre `verification: estimated_routing`.

## 4. Prove — totale U2-d/2: **137 controlli** (`evidence/final/u2d_all.log`) + golden/suite v7 + regressioni complete (`evidence/final/final_status.json`)
| Suite | Esito |
|---|---|
| handler L1 (memoria) / L2 (PostgREST reale + RLS, B vede solo Torino) | **23/23** / **23/23** (regressione consegna 1) |
| auth + CORS (unit) | **42/42** |
| planner-core via handler (core condiviso, CRM/routing simulati) | **18/18** |
| rivalidazione deterministica (unit + runtime) | **12/12** |
| **CORS in browser reale** (Chromium): preflight `OPTIONS` effettivamente inviato dall'origin ammessa (204), poi POST 200/401/400 **leggibili** dalla pagina; origin non ammessa: preflight 403, i 3 fetch falliscono con `TypeError`, **nessun POST** raggiunge l'handler | **8/8** (`evidence/cors_browser_report.json`) |
| **avvio locale entrypoint** `index.ts` (Deno.serve 127.0.0.1, env sintetico, PostgREST locale): banner `revalidation:DETERMINISTIC, llm:NOT_WIRED, planner:NOT_WIRED`; 405 / preflight 204 / 403 origin / 401 assente / 401 malformato / 403 pilota / capabilities 200 + CORS / `create_session` 201 su SQL locale reale / turno libero → **503 `llm_unavailable`** (LLM non collegato: raggiunto **prima** del planner, anch'esso non collegato) / `get_request` → `done`, `originalHttpStatus 503`, `plan: null` | **11/11** (`evidence/entrypoint_report.json`) |
| golden v7 prima/dopo | **identici** (48 risposte) |
| suite v7 | **14/14**, conteggi identici |
Regressioni **rieseguite sulla versione finale** (`final_verify.sh`): U2-c L1/L2 (turn.ts/ports.ts toccati per `catalogHash`), U1 Deno, U2-a trasporto, U2-b SQL, replay schema — esiti in `evidence/final/final_status.json`; suite non eseguite ed esclusioni elencate nello stesso file e in `U2_D_VERIFICATION.md` §6. Nota browser: `Access-Control-Allow-Origin` non è leggibile da JS (non è un header CORS-safelisted); la prova è la leggibilità di status+body, altrimenti `fetch` respinge con `TypeError`.

## 5. Configurazione di laboratorio vs collegamenti reali esclusi (L3)
| Dipendenza | Laboratorio (questa consegna) | Reale — **escluso**, non certificato |
|---|---|---|
| segreto JWT utente | sintetico (`GPTOUR_SEMANTIC_V2_JWT_SECRET` di lab; L2/entrypoint: lo stesso segreto che verifica PostgREST locale) | segreto Supabase hosted |
| store | PostgREST locale su SQL U2-b replayata, backend JWT sintetico con `jti` di lab | PostgREST/gateway hosted, `GPTOUR_SEMANTIC_BACKEND_KEY` emessa, rotazione/revoca |
| catalogo/settings | tabelle `lab_gptour_*` con RLS `auth.uid()`, create/rimosse dai runner | catalogo CRM reale |
| LLM | **non collegato** (`null`) nell'entrypoint → turno libero `llm_unavailable`; mock scriptato nei test | provider reale |
| planner | core D3(a) **reale** con `FakeCrm`/`FakeRouting` nei test; **non collegato** nell'entrypoint (`PLANNER_NOT_WIRED`) | porte CRM/OSRM reali |
| rivalidazione | **deterministica**: versione motore + hash canonico del catalogo riletto con la porta RLS dell'utente (nessuna simulazione residua) | in hosted dipende dal catalogo CRM reale |
| CORS | origini `http://127.0.0.1:<porta>` locali | origini delle app Web reali (da configurare in `GPTOUR_SEMANTIC_V2_ALLOWED_ORIGINS`) |
| client | due adapter HTTP in-process + pagina statica in Chromium | app Web/Mobile reali |

## 6. Limiti dichiarati
- Il piano U2-d prodotto dal core condiviso con routing simulato è **sempre** `estimated_routing`; «routing verificato» richiede OSRM reale (L3).
- Decisioni agenda (follow-up/appuntamenti) che v7 risolve con domanda `follow_ups` non sono rappresentabili in U2-d: mappate a `infeasible/other` con motivo esplicito (nessun blocco muto, via riformulazione/annullamento del runtime).
- `caps.exact` resta `false`: nessun filtro commerciale nuovo (U2-e).
- La parità Web/Mobile è dimostrata con adapter HTTP e con una pagina in browser reale, non con le app.
- Kill-switch v7 ed Edge v7 non toccati; la suite v7 è stata rieseguita perché `orchestrator.ts` è cambiato (identica).
