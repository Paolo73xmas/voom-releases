# Consegna U2-0/U2-a + replay schema reale — guida all'archivio (revisione 2)

Base: branch `feature/gptour-semantic-interpreter`, commit **`259ec92d`** (U1-4). Tutti i file dell'archivio sono **nuovi/non tracciati** rispetto a quel commit; nessun file tracciato è modificato (`schema_replay/evidence/GIT_STATUS.txt`). Nessun commit/push/deploy; nessun accesso a produzione; nessuna chiamata LLM.

## Contenuto
| Cartella | Contenuto | Stato di verifica |
|---|---|---|
| `supabase/functions/_shared/gptour-semantic-transport/` | contratto `semantic-1.1`: tipi, validatori strict request/response, validazione action, bridge → U1 `semantic-1.0`, proiezioni pubbliche, politiche errore | 409 controlli Node+Deno nel pod (agent-tested + QA `qa/iteration_64.json`); **sorgenti e test non ancora verificati dal proprietario** |
| `tests/gptour-semantic/u2/contract.unit.ts`, `bridge.unit.ts`, `edge_receipt_negative.unit.ts`, `golden-cases.ts`, `transport-goldens.json`, `write_goldens.ts`, `run_contract.sh` | i 409 controlli (368 + 31 + 10) e 41 golden; `run_contract.sh` li esegue su Node e Deno | idem |
| `tests/gptour-semantic/u2/{lab_common.py,local_bootstrap.sql,local_up.*,local_verify.*,local_down.*,install_postgrest.py,build_delivery.py}` | laboratorio sintetico U2-0 (23 controlli) e script di installazione PostgREST/archivio | agent-tested + QA iteration_64 |
| `tests/gptour-semantic/u2/schema_replay/` | replay dello schema reale (baseline da tipi + snapshot prod 2026-03-24 + 69 migrazioni reali) e 111 controlli SQL/RLS/HTTP; `evidence/` con report JSON, log, `GIT_STATUS.txt`, `U1_V7_BASE.sha256` | agent-tested + QA `qa/iteration_65.json` (rev. 1: 93 controlli; S7 aggiunta in rev. 2 e rieseguita ×2) |
| `docs/gptour-semantic/` | `PHASE_U2_PLAN.md` rev.3 (invariato, sha256 a0b429bf…4701), `U2_0_A_README.md`, `U2_0_A_RESULTS.md`, `U2_0_SCHEMA_REPLAY_REPORT.md` | documenti |
| `qa/`, `logs/` | report QA indipendenti 64/65; log di esecuzione U1/U2/Deno/dry-run v7 | evidenze |

## Dipendenze non incluse (riferimenti esatti)
- **Sorgenti U1 e planner v7** (40 file versionati al commit `259ec92d`): elenco e SHA-256 in `schema_replay/evidence/U1_V7_BASE.sha256`; richiesti da `bridge.unit.ts` e dal bridge (`import ../gptour-semantic/*`). Verifica: `git show 259ec92d:<path> | sha256sum`.
- Node 20.20.2 con `esbuild` 0.25.12 presente in `node_modules` del repository (dipendenza transitiva di Vite nel lockfile al commit); Deno 2.9.7 aarch64 (`U2_DENO_BIN`); PostgreSQL 15 con `postgresql-15-postgis-3`; PostgREST 16.2 (`install_postgrest.py`, digest ufficiale verificato); Python 3.11.
- Fonti reali replicate: `src/lib/supabase/database.types.ts` (commit `3c891f99`), `docs/backup/*_20260324_043722.sql`, `supabase/migrations/*`, `supabase/orchestrator-pending/phase4b|phase6` — tutti versionati, letti invariati.

## Riesecuzione
```bash
git checkout 259ec92d            # oppure il branch feature/gptour-semantic-interpreter a quel commit
unzip -o <archivio>.zip -d .     # aggiunge solo file nuovi
bash tests/gptour-semantic/run_all.sh                                   # U1 232
U2_DENO_BIN=/percorso/deno bash tests/gptour-semantic/u2/run_contract.sh  # U2 409 Node+Deno
# laboratorio sintetico e replay: variabili in docs/gptour-semantic/U2_0_A_README.md e U2_0_SCHEMA_REPLAY_REPORT.md §8
```
