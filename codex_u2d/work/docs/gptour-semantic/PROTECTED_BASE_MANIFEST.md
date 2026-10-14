# Manifest dei 40 file protetti U1/v7 — base `259ec92d` e stato dopo `decline_consent` (semantic-1.0.1)

Generato: 2026-10-13T15:36:51Z. Il riferimento ORIGINALE è conservato come prova: **non** viene sostituito.

| Riferimento | SHA-256 cumulativo (nome\0contenuto\0 per i 40 file ordinati) |
|---|---|
| **Originale (base 259ec92d, U1 232/232 user-confirmed)** | `47b38f9561c4420ac09a894697144a63f848e98877039e011cff4ee6c5d7d30f` |
| **Rev.4 (dopo l'estensione autorizzata decline_consent)** | `0ef218f48851515a51c8d463d0c0397959998cd8a1291c61c06436ddcfe8bc67` |
| **Attuale (dopo l'estrazione planner D3(a) autorizzata — U2-d/2)** | `041f2bfa00446526951e79689e2fab9a61276e29b0282ec38e3d29a21b036d88` |

Autorizzazione: proprietario, 2026-10-13 — «Approvo l'implementazione della proposta decline_consent, limitatamente ai file U1, runtime, test e documentazione indicati… SEMANTIC_CONTRACT_VERSION a semantic-1.0.1». File modificati: **5/40**, tutti tra i 5 file U1 elencati nella proposta (`U2_C_TEXTUAL_REFUSAL_PROPOSAL.md` §6). Orchestratore v7 (`gptour-orchestrator/*`) e test U1 esistenti (`SA/SB/SC/SD/SE`, `fixtures.ts`) **invariati**. Nuovo test U1 **non tracciato** (fuori dai 40): `tests/gptour-semantic/SF_decline_consent.unit.ts`.

## File modificati e motivazione
| File | Motivazione |
|---|---|
| `supabase/functions/_shared/gptour-semantic/apply.ts` | slotOf: consent slot anche per decline_consent; case decline_consent (nessuna modifica ai criteri; difesa se non riferito a domanda pendente) |
| `supabase/functions/_shared/gptour-semantic/contract.ts` | SEMANTIC_CONTRACT_VERSION → semantic-1.0.1; OpName += decline_consent (additivo) |
| `supabase/functions/_shared/gptour-semantic/interpreter.ts` | pre-filtro decline_consent: citazione assente / tipo diverso / senza domanda / conflitto grant+decline → rejected SENZA chiudere la domanda originale |
| `supabase/functions/_shared/gptour-semantic/prompt.ts` | riga di prompt decline_consent (solo rifiuto esplicito della domanda pendente; negazioni su altro ≠ decline) + nota su grant_consent |
| `supabase/functions/_shared/gptour-semantic/schema.ts` | OPS += decline_consent (schema LLM strict + validatore) |

## `git diff --stat 259ec92d` (soli file autorizzati)
```
supabase/functions/_shared/gptour-semantic/apply.ts       |  9 ++++++++-
 supabase/functions/_shared/gptour-semantic/contract.ts    |  6 +++---
 supabase/functions/_shared/gptour-semantic/interpreter.ts | 14 ++++++++++++++
 supabase/functions/_shared/gptour-semantic/prompt.ts      |  3 ++-
 supabase/functions/_shared/gptour-semantic/schema.ts      |  2 +-
 5 files changed, 28 insertions(+), 6 deletions(-)
```

## Tabella completa dei 40 file
| File | SHA-256 base | SHA-256 rev.4 | SHA-256 attuale (D3(a)) | Stato |
|---|---|---|---|---|
| `supabase/functions/_shared/gptour-orchestrator/adapters/external.ts` | `d390c8b37b5fc0e7…` | `d390c8b37b5fc0e7…` | `d390c8b37b5fc0e7…` | INVARIATO |
| `supabase/functions/_shared/gptour-orchestrator/adapters/memory.ts` | `3650f6ae92568246…` | `3650f6ae92568246…` | `3650f6ae92568246…` | INVARIATO |
| `supabase/functions/_shared/gptour-orchestrator/adapters/province-it.ts` | `5ec60d6854a254f0…` | `5ec60d6854a254f0…` | `5ec60d6854a254f0…` | INVARIATO |
| `supabase/functions/_shared/gptour-orchestrator/adapters/supabase-crm.ts` | `64b91edff73c5c46…` | `64b91edff73c5c46…` | `64b91edff73c5c46…` | INVARIATO |
| `supabase/functions/_shared/gptour-orchestrator/adapters/supabase-store.ts` | `89caa385d99eaf18…` | `89caa385d99eaf18…` | `89caa385d99eaf18…` | INVARIATO |
| `supabase/functions/_shared/gptour-orchestrator/agenda.ts` | `a68981e2e4227b77…` | `a68981e2e4227b77…` | `a68981e2e4227b77…` | INVARIATO |
| `supabase/functions/_shared/gptour-orchestrator/commercial.ts` | `dd333261546998ee…` | `dd333261546998ee…` | `dd333261546998ee…` | INVARIATO |
| `supabase/functions/_shared/gptour-orchestrator/contract.ts` | `ce79bf47060246be…` | `ce79bf47060246be…` | `ce79bf47060246be…` | INVARIATO |
| `supabase/functions/_shared/gptour-orchestrator/geo.ts` | `6b0b429c5d46b4c9…` | `6b0b429c5d46b4c9…` | `6b0b429c5d46b4c9…` | INVARIATO |
| `supabase/functions/_shared/gptour-orchestrator/interpret.ts` | `098fc4e8383a4a0d…` | `098fc4e8383a4a0d…` | `098fc4e8383a4a0d…` | INVARIATO |
| `supabase/functions/_shared/gptour-orchestrator/multiday.ts` | `b369afd2fa4e53f9…` | `b369afd2fa4e53f9…` | `b369afd2fa4e53f9…` | INVARIATO |
| `supabase/functions/_shared/gptour-orchestrator/orchestrator.ts` | `79a94dd356b8bb04…` | `79a94dd356b8bb04…` | `3d94f2c9ca3c3ade…` | MODIFICATO (autorizzato, D3(a)) |
| `supabase/functions/_shared/gptour-orchestrator/ports.ts` | `d9c7de61255148e8…` | `d9c7de61255148e8…` | `d9c7de61255148e8…` | INVARIATO |
| `supabase/functions/_shared/gptour-orchestrator/routing.ts` | `416f81c159f15d71…` | `416f81c159f15d71…` | `416f81c159f15d71…` | INVARIATO |
| `supabase/functions/_shared/gptour-orchestrator/time.ts` | `552f4b04170576f7…` | `552f4b04170576f7…` | `552f4b04170576f7…` | INVARIATO |
| `supabase/functions/_shared/gptour-semantic/apply.ts` | `0fabde08adc7f966…` | `d43e3d76a06e2fcc…` | `d43e3d76a06e2fcc…` | MODIFICATO (autorizzato) |
| `supabase/functions/_shared/gptour-semantic/contract.ts` | `9148167fb40cd466…` | `b7af222af5b86695…` | `b7af222af5b86695…` | MODIFICATO (autorizzato) |
| `supabase/functions/_shared/gptour-semantic/interpreter.ts` | `44cd3ab24e44df37…` | `d0d33dd272682e55…` | `d0d33dd272682e55…` | MODIFICATO (autorizzato) |
| `supabase/functions/_shared/gptour-semantic/openai-port.ts` | `74e496d7d4cd7901…` | `74e496d7d4cd7901…` | `74e496d7d4cd7901…` | INVARIATO |
| `supabase/functions/_shared/gptour-semantic/projection.ts` | `1713f4a839d7b99f…` | `1713f4a839d7b99f…` | `1713f4a839d7b99f…` | INVARIATO |
| `supabase/functions/_shared/gptour-semantic/prompt.ts` | `093bb385402c6b8a…` | `10286498fd38a3ec…` | `10286498fd38a3ec…` | MODIFICATO (autorizzato) |
| `supabase/functions/_shared/gptour-semantic/schema.ts` | `3402a7a4c1c05a82…` | `d282a454df94805b…` | `d282a454df94805b…` | MODIFICATO (autorizzato) |
| `supabase/functions/gptour-orchestrator/handler.ts` | `28186fcac5be3820…` | `28186fcac5be3820…` | `28186fcac5be3820…` | INVARIATO |
| `supabase/functions/gptour-orchestrator/index.ts` | `20bdf488c07bbf6c…` | `20bdf488c07bbf6c…` | `20bdf488c07bbf6c…` | INVARIATO |
| `tests/gptour-semantic/SA_semantic.unit.ts` | `90d474ad93070257…` | `90d474ad93070257…` | `90d474ad93070257…` | INVARIATO |
| `tests/gptour-semantic/SB_llm_smoke.sh` | `c48635382f2e740d…` | `c48635382f2e740d…` | `c48635382f2e740d…` | INVARIATO |
| `tests/gptour-semantic/SB_llm_smoke.ts` | `c35c460c8daa4ae9…` | `c35c460c8daa4ae9…` | `c35c460c8daa4ae9…` | INVARIATO |
| `tests/gptour-semantic/SC_regression.unit.ts` | `9dc277e950ef838b…` | `9dc277e950ef838b…` | `9dc277e950ef838b…` | INVARIATO |
| `tests/gptour-semantic/SD_regression.unit.ts` | `e1d8fb0e95ea9c49…` | `e1d8fb0e95ea9c49…` | `e1d8fb0e95ea9c49…` | INVARIATO |
| `tests/gptour-semantic/SE_regression.unit.ts` | `f16a255b5040caec…` | `f16a255b5040caec…` | `f16a255b5040caec…` | INVARIATO |
| `tests/gptour-semantic/fixtures.ts` | `c5cb222628524d0f…` | `c5cb222628524d0f…` | `c5cb222628524d0f…` | INVARIATO |
| `tests/gptour-semantic/llm_bridge.py` | `521212e16bd60e18…` | `521212e16bd60e18…` | `521212e16bd60e18…` | INVARIATO |
| `tests/gptour-semantic/repro/REPRO_post_fix.ts` | `5d22aaee2ab69d28…` | `5d22aaee2ab69d28…` | `5d22aaee2ab69d28…` | INVARIATO |
| `tests/gptour-semantic/repro/REPRO_pre_fix.ts` | `795d8bff3d415435…` | `795d8bff3d415435…` | `795d8bff3d415435…` | INVARIATO |
| `tests/gptour-semantic/repro/REPRO_u13.ts` | `74b55ecde777ccc5…` | `74b55ecde777ccc5…` | `74b55ecde777ccc5…` | INVARIATO |
| `tests/gptour-semantic/repro/REPRO_u14_post.ts` | `b2433fd2ee893b19…` | `b2433fd2ee893b19…` | `b2433fd2ee893b19…` | INVARIATO |
| `tests/gptour-semantic/repro/REPRO_u14_pre.ts` | `30a8e1b55c27e1ec…` | `30a8e1b55c27e1ec…` | `30a8e1b55c27e1ec…` | INVARIATO |
| `tests/gptour-semantic/run_all.sh` | `96ce2a4dae04ee1f…` | `96ce2a4dae04ee1f…` | `96ce2a4dae04ee1f…` | INVARIATO |
| `tests/gptour-semantic/run_deno.sh` | `0ca3d485361bbb33…` | `0ca3d485361bbb33…` | `0ca3d485361bbb33…` | INVARIATO |
| `tests/gptour-semantic/tsconfig.json` | `156b815ed8729f6c…` | `156b815ed8729f6c…` | `156b815ed8729f6c…` | INVARIATO |

Nota: i packager (`tests/gptour-semantic/u2/build_delivery.py`, script di consegna) accettano il nuovo hash cumulativo e riportano anche quello originale; il diff completo è in `git diff 259ec92d` (nessun commit eseguito).

## Estrazione planner D3(a) — U2-d/2 (2026-10-14T05:54:19Z)
Autorizzazione: proprietario — «Completa l'estrazione planner D3(a), già autorizzata, con golden v7 prima/dopo identici». File protetti modificati: **1/40** — `supabase/functions/_shared/gptour-orchestrator/orchestrator.ts` (−170/+15 righe: la sezione «dati CRM → selezione → routing → verifica → piano» di `handleTurn` è spostata **testualmente** nel nuovo modulo condiviso `supabase/functions/_shared/gptour-planner-core/planner.ts`; in `handleTurn` resta un wrapper che traduce l'esito `PlannerOutcome` in `base/ask/finish` v7, con gli stessi `extra`, gli stessi contatori `metrics` e la stessa sequenza `savePlan → lastPlanId → finish`). Regole v7, persistenza v7, `applyAction/answerPending/applyAiPatch`, kill-switch `GPTOUR_ORCHESTRATOR_ENABLED` e `gptour-orchestrator/{handler,index}.ts`: **invariati**.
Prova: golden v7 (48 risposte di 30 conversazioni su adapter in memoria, `tests/gptour-orchestrator/golden_v7.ts`) **byte-identico** prima/dopo (`tests/gptour-orchestrator/golden/golden_v7_reference.json`, sha256 `a43b9cd144c6cc6084e15041cbc15f29c3619bd8af4541279824647ff2c98665`); suite v7 completa 14/14 con conteggi di asserzioni identici (`tests/gptour-semantic/u2/u2d/evidence/d3a/`). Diff: `evidence/d3a/orchestrator_d3a.diff`.
