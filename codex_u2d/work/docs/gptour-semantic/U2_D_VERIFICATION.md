# U2-d — Guida alla verifica esterna (Codex) — punto d'ingresso dell'archivio

**Stato dichiarato: «perimetro locale completato — pronto per verifica esterna di Codex».** Non è completata alcuna integrazione reale (L3): vedi §6.

## 1. Cosa c'è nell'archivio
| Cartella | Contenuto |
|---|---|
| `supabase/functions/gptour-semantic-v2/` | handler Edge U2-d (`handler.ts`, `auth.ts`, `env.ts`, `index.ts`, `adapters/{catalog-postgrest,planner-core,revalidation}.ts`) |
| `supabase/functions/_shared/gptour-planner-core/planner.ts` | planner condiviso estratto da v7 (D3(a)) |
| `supabase/functions/_shared/gptour-semantic-runtime/`, `…-transport/` | runtime U2-c e trasporto semantic-1.2 (non tracciati su base `259ec92d`) |
| `v7_modified_tracked/` + `v7_d3a_planner_extraction.diff` | l'unico file v7 modificato (`orchestrator.ts`) e il suo diff rispetto alla baseline |
| `u1_modified_tracked/` + `u1_decline_consent.diff` | i 5 file U1 modificati in rev.4 (autorizzati) e il diff |
| `tests/gptour-orchestrator/golden_v7.{ts,sh}`, `golden/golden_v7_reference.json` | golden v7 registrato PRIMA dell'estrazione + script di confronto |
| `tests/gptour-semantic/u2/u2d/` | suite U2-d, lab browser/entrypoint, `verify_protected.py`, `final_verify.sh`, `package_u2d.py` |
| `tests/gptour-semantic/u2/u2d/evidence/final/` | **log della versione finale consegnata** (`final_status.json`, un log per suite, `tool_versions.log`, `protected_files.json`) |
| `docs/gptour-semantic/` | perimetro (`U2_D_SCOPE.md`), esiti (`U2_D_RESULTS.md`), questa guida, `PROTECTED_BASE_MANIFEST.md`, documenti U2-0…U2-c |
| `qa/iteration_*.json` | revisioni indipendenti dell'agente di test (64…75; 74 e 75 = consegna finale) |
| `MANIFEST.json` | hash SHA-256 + dimensione di ogni file dell'archivio; `README_DELIVERY.txt` |

## 2. Baseline e diff
- Baseline identificata: commit **`259ec92d`** del branch `feature/gptour-semantic-interpreter` (= `HEAD` del repository di lavoro; nessun commit eseguito).
- File **tracciati** modificati: 6/40 protetti, tutti autorizzati (`verify_protected.py`, `evidence/final/protected_files.json`): 5 U1 (rev.4) + `orchestrator.ts` (D3(a)). Hash cumulativo dei 40 file: originale `47b38f95…d30f`, rev.4 `0ef218f4…bc67`, attuale `041f2bfa…6d88`.
- Tutto il resto dell'archivio è **non tracciato** sulla baseline (file nuovi): l'elenco completo con hash è `MANIFEST.json`.

## 3. Prerequisiti e versioni (quelle usate per le evidenze: `evidence/final/tool_versions.log`)
Deno 2.9.7 (aarch64), Node v20.20.2 + esbuild 0.25.12 (in `node_modules` del repo VOOM), Python 3.11 + `playwright` 1.63 (browser di sistema Chromium 154 via `U2D_CHROME`), PostgreSQL 15.19 + PostGIS, PostgREST 16.2. Laboratorio SQL locale: `tests/gptour-semantic/u2/schema_replay/replay_up.sh` (crea DB/PostgREST effimeri in `U2_REPLAY_ROOT`, segreto JWT **sintetico** generato localmente).
Variabili: `U2_DENO_BIN U2_REPLAY_ROOT U2_PG_BIN U2_PG_OS_USER [U2D_CHROME]`.

## 4. Comandi riproducibili (dalla radice del repository VOOM con i file dell'archivio sovrapposti)
```bash
export U2_DENO_BIN=/opt/deno/deno U2_REPLAY_ROOT=/tmp/voom-u2-replay U2_PG_BIN=/usr/lib/postgresql/15/bin U2_PG_OS_USER=postgres U2D_CHROME=/usr/bin/chromium
bash tests/gptour-semantic/u2/schema_replay/replay_up.sh            # lab SQL/PostgREST locale (una volta)
python3 tests/gptour-semantic/u2/u2d/verify_protected.py           # 40 file protetti vs baseline, differenze autorizzate motivate
bash tests/gptour-orchestrator/golden_v7.sh                        # golden v7 byte-identico + suite v7 (14 file)
bash tests/gptour-semantic/u2/u2d/run_u2d.sh                       # U2-d: check, L1, auth/CORS, planner-core, revalidation, CORS browser, L2, entrypoint
bash tests/gptour-semantic/u2/u2d/final_verify.sh                  # tutto quanto sopra + regressioni U2-c/U1/U2-a/U2-b/replay → evidence/final/
```
Il packager (`package_u2d.py <dir_in_/tmp>`) rifiuta l'archivio se i file protetti non corrispondono all'hash registrato, se compaiono modifiche tracciate non autorizzate o pattern di segreti.

Nota di coerenza: `evidence/final/` è stata prodotta da `final_verify.sh` sull'albero di codice consegnato; dopo l'esecuzione sono stati modificati **solo** testi (`U2_D_VERIFICATION.md`, `U2_D_RESULTS.md`, `README`/`package_u2d.py`), nessun sorgente o test. L'agente di QA indipendente ha rieseguito `lab_entrypoint.py` (rigenerando `evidence/entrypoint_report.json` con esito identico) — `qa/iteration_75.json`.

## 5. Risultati: dimostrati / da verificare / incompleti
**Dimostrati localmente (log in `evidence/final/`)** — vedi `U2_D_RESULTS.md` §3-§4 per il dettaglio:
- handler: ingresso/auth/pilota/size/JSON, identità solo dal token, nessun accesso prima dell'autorizzazione, parità Web/Mobile (adapter HTTP), recupero dipendenze (L1+L2 con SQL reale locale e RLS);
- auth hardening; CORS unit + **browser reale**; planner D3(a): golden v7 **byte-identico**, suite v7 identica; adapter planner-core (piano reale `estimated_routing`); rivalidazione deterministica (motore + hash catalogo); avvio locale dell'entrypoint con dipendenze sintetiche.
**Dichiarazioni che il revisore deve verificare** (non dimostrabili dal solo log): equivalenza testuale della sezione estratta (`v7_d3a_planner_extraction.diff` vs `planner.ts`), copertura rappresentativa del golden (30 conversazioni elencate in `golden_v7.ts`), assenza di regole CRM/routing duplicate nel client (nessun client reale esiste), correttezza della mappatura `mapOutcome`.
**Incompleti / esclusi (nessun successo simulato al loro posto)** — §6.

## 6. Limiti, simulazioni, esclusioni (L3) e attività bloccate
| Componente | Stato nella consegna | Cosa resta da fare (fuori perimetro autorizzato) |
|---|---|---|
| LLM | **non collegato** (`llm: null` nell'entrypoint; mock scriptato nei test). Turno libero reale → `503 llm_unavailable` | integrazione provider con credenziali di progetto; prove con output LLM reale (il riconoscimento testuale di `decline_consent` resta dipendente dal provider) |
| Planner nell'entrypoint | **non collegato** (`PLANNER_NOT_WIRED` → `dependency_unavailable`). Il core D3(a) è reale e testato con `FakeCrm`/`FakeRouting` | porte CRM (candidati, acquisti, agenda, territorio, settings) e OSRM reali; «routing verificato» impossibile senza OSRM |
| Rivalidazione | **deterministica** (motore + hash catalogo) — non più simulata | nessuna; in hosted dipende dal catalogo CRM reale |
| Catalogo/settings | tabelle `lab_gptour_*` sintetiche con RLS | catalogo CRM reale (schema/policy da autorizzare) |
| Store | PostgREST **locale** su SQL U2-b replayata; backend JWT sintetico con `jti` | gateway/PostgREST hosted, emissione/rotazione `GPTOUR_SEMANTIC_BACKEND_KEY`, compatibilità gateway (prerequisito L3 aperto) |
| JWT utente | segreto **sintetico**; verifica HS256 reale | segreto Supabase hosted; `aud`/`iss` di progetto |
| CORS | origini `127.0.0.1` di lab | lista origini delle app Web reali |
| Client | adapter HTTP in-process + pagina statica in Chromium | app Web/Mobile reali (repo Mobile non autorizzato) |
| Agenda in U2-d | domanda `follow_ups` v7 → `infeasible/other` con motivo esplicito | rappresentazione delle decisioni agenda nel contratto semantico (nuova autorizzazione) |
| U2-e | esclusa: nessun filtro commerciale nuovo, `caps.exact=false` | — |
| Git/deploy | nessun commit/push/deploy | — |
