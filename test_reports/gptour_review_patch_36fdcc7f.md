# GPTour — patch mirata su 36fdcc7f, verifica prima di commit/push

> **AGGIORNAMENTO successivo:** l'utente ha approvato la correzione puntuale dell'accettazione. Implementata e verificata: `gptour_accepted_fill_36fdcc7f.md`,250test/20suite e flusso browser isolatoPASS. Restano aperti soltanto i blocchi separati runtimeRPC/outputSQL e tracciamentoGitlockfile, oltre alle verifiche native già dichiarate. Questo rapporto217test mantiene il dettaglio della fase precedente.

## Stato

**Non pronta per una dichiarazione di risoluzione completa.** Correzione del predicate fill/corridor e test del payload completati; tre questioni restano aperte: introspezione RPC runtime non autorizzata, lockfile non incluso in Git/HEAD, conservazione delle sole tappe fill accettate durante il successivo ricalcolo. Nessun commit/push eseguito manualmente, nessuna pubblicazione, nessuna migrazione applicata.

- Base mobile: `Paolo73xmas/voom-releases`, `conflict_170826_1303`, **36fdcc7f58b8598332cfc3caaf5bee161f37e43b**; remoto verificato alla stessa SHA.
- Porting precedente: **771706e0463116c3fea6b2a949c6246d7cc3cd41**.
- Semantica web confrontata: `Paolo73xmas/voom`, **88bfb440d86ca4103016ed2b5c1ed3416ecf497a**.
- Nessun aggiornamento di dipendenze o package manager. Nessuna modifica a prompt/Edge, regole orfani, RLS, ruoli, RPC follow-up, merge Intent, dedup, wantAll, planner, pernottamento, OSRM, Live o proposta SQL idempotenza.

## File applicativi e test

Modificati:
1. `frontend/lib/aitour/gptour-criteria.ts` — allowedTypesFor e costante della soglia prospect.
2. `frontend/tests/build_lockfile.test.ts` — verifica packageManager Yarn1.22.22, profilo EAS, assenza bypass e lockfile di altri PM.

Aggiunti:
3. `frontend/tests/gptour_fill_corridor.test.ts` — 26 regressioni.
4. `frontend/tests/gptour_batch_payload.test.ts` — 3 test sul vero serializer saveToursBatch, solo rete simulata.
5. `frontend/scripts/check-build-lockfile.cjs` — controllo manuale read-only: presenza + tracciamento + inclusione HEAD; **fallisce correttamente nello snapshot attuale**.

Documentazione/evidenze: questo rapporto, `gptour_batch_runtime_readonly.sql`, `gptour_acceptance_gap.md`, `iteration_53.json` e aggiornamento PRD. Il test temporaneo dell'agente che dimostrava il bug di accettazione è stato rimosso dalla suite, per non promuovere il bug ad aspettativa di regressione corretta.

### git diff --stat (file già tracciati, rispetto a36fd)

```text
 frontend/lib/aitour/gptour-criteria.ts | 17 +++++++++++++----
 frontend/tests/build_lockfile.test.ts  |  8 ++++++++
 memory/PRD.md                          |  9 +++++++++
 3 files changed, 30 insertions(+), 4 deletions(-)
```

Il comando non mostra file nuovi/untracked. Verificati separatamente con `git diff --no-index --stat /dev/null FILE`:

```text
 frontend/tests/gptour_fill_corridor.test.ts     +84 righe
 frontend/tests/gptour_batch_payload.test.ts     +45 righe
 frontend/scripts/check-build-lockfile.cjs       +19 righe
 frontend/yarn.lock                             +9833 righe (già presente locale, NON generato/modificato ora)
 test_reports/gptour_batch_runtime_readonly.sql  +21 righe
```

Ulteriori nuovi file di documentazione: rapporto corrente, acceptance-gap e iteration53. Nessun git add usato per alterare artificialmente lo stat; inclusione effettiva lockfile nel commit ancora da risolvere.

### Diff principale richiesto

```diff
-import type { TourCandidate } from './types';
+import type { EntityType, TourCandidate } from './types';
 export type IntentMatchMode = 'initial' | 'fill' | 'corridor';
+export const DEFAULT_FILL_CONTACT_DAYS = 15;
+/** Web 88bfb44: fill without explicit expansions uses the progressive ranking.
+ * Initial AI selections and corridor remain constrained to requested + allowed types. */
+export function allowedTypesFor(intent: TourIntent, mode: IntentMatchMode): Set<EntityType> | null {
+  const requested = intent.requestedEntityTypes, expansion = intent.allowedExpansionTypes;
+  if (requested.length === 0 && expansion.length === 0) return null;
+  if (mode === 'fill' && expansion.length === 0) return null;
+  return new Set<EntityType>([...requested, ...expansion]);
+}
-  const types = [...i.requestedEntityTypes, ...i.allowedExpansionTypes];
-  if (types.length && !types.includes(c.entityType)) e.push('tipologia non autorizzata');
+  const types = allowedTypesFor(i, mode);
+  if (types && !types.has(c.entityType)) e.push('tipologia non autorizzata');
-  const contactLimit = i.physicalContactMinDays ?? (mode !== 'initial' && c.entityType === 'prospect' ? 15 : null);
+  const contactLimit = i.physicalContactMinDays ?? (mode !== 'initial' && c.entityType === 'prospect' ? DEFAULT_FILL_CONTACT_DAYS : null);
```

La condizione ownOrphansOnly è invariata: limita SOLO i candidati `orphan` non propri. `initial` resta rigido, non eredita l'espansione fill. Null equivale a nessun filtro di tipo, come nel web: l'ordinamento delle proposte decide la scala progressiva, compreso il fallback clienti nel livello residuale già esistente.

### Copertura fill/corridor

| Caso | Own orphan | Orphan altrui | Prospect | Free/Never |
|---|---|---|---|---|
| A: fill, ownOnly, espansioni vuote | sì | no | sì | sì |
| B: corridor, stesso Intent | sì | no | no | no |
| C: fill + espansione prospect | sì | no | sì | no |
| C: corridor + espansione prospect | sì | no | sì | no |
| D: ownOnly=false | sì | sì | secondo modalità/tipi | secondo modalità/tipi |

Verificati anche: nessun criterio tipi, sole espansioni, initial invariato, prospect14/15/16/null, soglia esplicita29/30/31/null, zero esplicito, contatto sconosciuto, altre esclusioni/fatturato/area non aggirati e proposte effettive con matrice sintetica. Nessuna scrittura o chiamata LLM.

## save_tours_batch — verifica runtime

- Individuato nel progetto configurato il percorso esistente `exec_sql({sql})`, senza creare endpoint o concedere permessi.
- Sessione con admin già documentato: HTTP200. Nessun segreto riportato.
- Inviata esclusivamente la SELECT in `test_reports/gptour_batch_runtime_readonly.sql`, con `pg_get_functiondef(to_regprocedure('public.save_tours_batch(jsonb)'))`, metadati colonna e trigger.
- **Risposta runtime HTTP403**, SQLSTATE **42501**, `permission denied for function exec_sql`.
- Nessun accesso Postgres diretto/token management già configurato; nessun tentativo di aggirare la negazione. **Definizione installata e persistenza effettiva di is_follow_up: NON VERIFICATE.**
- Nessuna RPC di salvataggio invocata sul CRM e nessun database Postgres isolato disponibile. Una sessione valida non autorizza l'introspezione.
- Git conferma che la definizione20261013 omette la colonna presente nella20260902, ma questo NON prova quale sia installata.
- **Nessuna migration correttiva preparata alla cieca:** serve prima l'output runtime per preservarne tutte le modifiche effettive. Se manca il campo, si aggiungeranno solo colonna `is_follow_up` e valore `coalesce((s->>'is_follow_up')::boolean, false)` alla definizione installata più recente, mostrando il file prima dell'applicazione.

Query minima da eseguire nell'editor SQL autorizzato del progetto utilizzato dal mobile:

```sql
SELECT pg_get_functiondef(to_regprocedure('public.save_tours_batch(jsonb)')) AS definition;
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ai_tour_stops'
  AND column_name = 'is_follow_up';
```

Il file SQL completo aggiunge i trigger per controllare possibili trasformazioni del valore. Restituire il testo, non token/password.

### Payload batch

Il test nuovo importa **la funzione reale `saveToursBatch`**, non il suo mock. Solo `supabase.rpc` è simulata. Verificati:
- normale senza isFollowUp → `is_follow_up:false`;
- follow-up con isFollowUp=true → `is_follow_up:true`;
- entrambi i flag presenti nelle due giornate di un unico payload;
- errore RPC propagato, nessun fallback a insert separati o retry.

Questo prova il client, **non la persistenza nel DB operativo**. Nessuna modifica necessaria al serializer mobile, che era già corretto.

## Lockfile

- PM ufficiale: `packageManager` = `yarn@1.22.22+sha512...`; binario locale1.22.22.
- EAS: `frontend/eas.json`, profilo preview internal, nessun bypass lockfile; main Expo Router invariato.
- `.gitignore` root e frontend già contengono negazioni corrette; nessun `.easignore`. NON modificati inutilmente.
- `frontend/yarn.lock` presente **452.334byte**, formato v1. SHA256 **f95d3900bf35adf6bdd9936d931b40cfffc91880c03f5d515600c6624a33a4cd**.
- Lock già coerente: non rigenerati transitive/versioni per creare un diff artificiale.
- Installazione pulita in `/tmp/gptour-review-clean-DNTPrA`, inizialmente senza node_modules e senza `.env`: **`yarn install --frozen-lockfile --non-interactive` exit0**, hash package.json e lock invariati.
- Log `/tmp/gptour-review-clean-install.log`: nessun `No lockfile found`; warning preesistente peer `expo-asset` non modificato.
- **Git tracking FALLISCE**: `git ls-files --error-unmatch frontend/yarn.lock`; anche il commitHEAD e il ramo remoto controllato non contengono il file. Il file locale non basta.
- `node frontend/scripts/check-build-lockfile.cjs` è un gate manuale che fallisce su questo stato, non un successo di release né un lifecycle hook EAS già installato.
- Non eseguiti git add/commit/push. Il percorso Git autorizzato è Save to GitHub dopo aver sciolto il blocco runtime e ricevuto il via libera; occorre poi verificare realmente il file nel commit/snapshot, non presumere che sia incluso. Se l'interfaccia continua a ometterlo, il problema di cattura dei sorgenti resta da risolvere con supporto.
- **Lockfile locale/installazione risolti e verificati; inclusione Git/EAS remota NON risolta.** Nessuna build EAS remota lanciata: non viene dichiarata sparita l'anomalia nello snapshot remoto.

## Area geografica — volutamente invariata

Il mobile applica comune/provincia/zona come vincoli rigidi, con normalizzazione provincia. Il web non applica uniformemente questa semantica (alcuni campi guidano preferenza/ranking, province non confrontabili sono ammesse). Decisione ancora da prendere: **preferred area vs strict area**. Nessuna euristica o modifica geografica in questa patch.

## Risultati finali

| Controllo | Esito |
|---|---|
| Suite completa mobile | **217/217 PASS,19suite**, anche dopo installazione pulita |
| Suite GPTour | **100/100 PASS,4suite** |
| Test lockfile/packageManager | **4/4 PASS** per contenuto locale/config |
| Nuove regressioni fill/corridor | **26/26 PASS** |
| Nuovi test serializer batch | **3/3 PASS** |
| TypeScript | PASS |
| ESLint dei5file nuovi/modificati di codice | PASS, nessun errore/warning |
| ESLint globale | **FAIL preesistente**:1erroreBuffer in scripts/aitour_inspection_rls_probe.mjs +132warning |
| Baseline ESLint al commit36fd | Stesso erroreBuffer +131warning; warning extra attuale è filegenerato `.expo/types/router.d.ts` |
| Android export JS `--no-bytecode` | PASS |
| iOS export JS `--no-bytecode` | PASS |
| Native/Hermes | Host aarch64 vs hermescx86-64, esecuzione diretta errno8Execformat; nessun enginechange |
| Build preview nativa | NON eseguita: toolchain/credenziali build non disponibili e snapshotlockincompleto |
| Runtime funzione/persistenzaDB | NON verificato:403introspezione |
| Lockfile Git/HEAD | BLOCKED |

Errore lint globale fuori perimetro: riprodotto su copia pulita di36fd, non introdotto qui e non corretto con refactoring non richiesto.

Export: `/tmp/gptour-review-android-js`, `/tmp/gptour-review-ios-js`; log omonimi in `/tmp`. Test/TypeScript clean: `/tmp/gptour-review-clean-tests.log`, `/tmp/gptour-review-clean-tsc.log`. Verifica indipendente: `iteration_53.json`.

## Ulteriore blocco fill emerso, non modificato senza consenso

Il nuovo predicate produce correttamente le proposte A–D, ma `useGptour.acceptProposal` passa al ricalcolo l'Intent invariato. La validazione `initial` del planner scarta quindi le tipologie progressive appena accettate, e il controllo di persistenza è anch'esso initial. Riprodotto con fixture, dettagli in `gptour_acceptance_gap.md`.

Per completare questo percorso serve una modifica puntuale di provenienza/accettazione delle key nei componenti indicati come protetti. Proposta: ricordare **solo le key accettate**, senza allargare automaticamente corridor o allowedExpansionTypes per intere categorie. Richiede approvazione prima di implementare il contratto corrispondente. Non considerare la sola patch del predicate una correzione end-to-end di questo caso.

## Stop

Richiedere output SQL runtime e decisione sulla conservazione delle tappe fill accettate. Non procedere a commit/push/pubblicazione o migrazioni. La bozza `proposals/gptour_idempotency_v1_NOT_APPLIED.sql` è rimasta intatta.