# Proposta — Rifiuto TESTUALE di una proposta di consenso (`decline_consent`) — SOLO PROPOSTA, NON IMPLEMENTATA

Stato: bozza per decisione del proprietario (coinvolge il contratto semantico U1). Nessun file di implementazione modificato. D-U2C-02 e D-U2C-03 restano aperte. Nessun avvio U2-d, nessuna attività remota.

## 1. Lacuna (riprodotta su rev.3)
Il rifiuto da pulsante (`action: answer`, `optionId: 'no'`) è rispettato e conservato (rev.3). Il rifiuto **testuale** no: con «No grazie» e output LLM valido `{operations: [], clarification}` U1 apre un chiarimento generico (`unclear`) **sopra** la domanda di consenso, che resta pendente in pila. Non esiste un'operazione semantica che rappresenti «rifiuto la proposta X»: `grant_consent` esiste, il suo contrario no. Il runtime U2-c (`refusedProposal`) riconosce quindi solo il pulsante.

## 2. Principio
Il rifiuto testuale deve seguire **le stesse regole del pulsante**: (a) domanda identificata (la domanda di consenso in cima alla pila, tipo esatto), (b) ambito esatto (tipo + date/giorni della proposta), (c) provenienza verificata (operazione LLM con citazione letterale presente nel messaggio, validata da U1 come ogni altra), (d) persistenza nello stato di sessione (`declined`, già in rev.3), (e) replay byte-identico. **Nessun parser locale Web/Mobile, nessun riconoscimento generico della parola «no»**: la classificazione è dell'interprete LLM, il server verifica identità, ambito, citazione e coerenza, senza dedurre nulla.

## 3. Modifica minima al contratto semantico U1
Nuova operazione **`decline_consent`**, speculare a `grant_consent`, stessa forma piatta (`consent ∈ ConsentKind`, `evidence` obbligatoria, altri campi null). Nessun nuovo campo nell'`Operation`, nessuna modifica a `SemanticCriteria`, `SemanticState`, `PublicQuestion`, `SemanticResult` né allo `StateSnapshot`/`TurnResponse` di `semantic-1.1` (invariante 13 rispettata: il validatore `result.applied` accetta la nuova op tramite `validateLlmOutput`, nessuna chiave nuova).

Regole server (deterministiche):
1. `decline_consent` è **accettata solo se** la domanda pendente in cima è `kind: 'consent'` con `consentKind` **uguale** a `op.consent` (stessa condizione `asked` di `grant_consent`). Altrimenti l'operazione è **respinta** (`rejected`, motivo «rifiuto non riferito a una domanda di consenso pendente»), senza aprire domande e senza toccare i criteri.
2. Citazione: vale la regola esistente `evidenceOk` (frammento letterale del messaggio); citazione assente → respinta (come ogni op LLM).
3. Coerenza: `grant_consent` e `decline_consent` dello stesso tipo nello stesso output → **entrambe respinte**, la domanda di consenso resta aperta (nessuna scelta al posto dell'agente). Il guard esistente «consenso in un messaggio di diniego» (apply.ts, `grant_consent` + messaggio che inizia con no/non/niente/annulla/lascia) resta invariato: è una protezione contro un consenso indebito, non un riconoscitore del rifiuto.
4. Effetto in `apply`: **nessuna modifica ai criteri**; l'op entra in `applied` (provenienza LLM, citazione verificata). Ambito `slotOf(decline_consent) = consent:<kind>` ⇒ in `route()` il turno **risolve** la domanda di consenso in cima (stesso meccanismo del pulsante), le altre operazioni sospese seguono le regole attuali.
5. Prompt: aggiunta di una riga speculare a `grant_consent`: «`decline_consent`: SOLO se la DOMANDA PENDENTE chiede quel consenso e l'agente lo rifiuta esplicitamente (“no”, “no grazie”, “non includerla”). Una negazione riferita ad altro (“no, togli Monza”) NON è decline_consent: usa l'operazione pertinente. Mai dedurlo.»
6. Versione: `SEMANTIC_CONTRACT_VERSION` resta `semantic-1.0` **oppure** passa a `semantic-1.0.1`/`1.1` — decisione del proprietario (nessun client dipende oggi dal valore; il bridge usa la costante). Raccomandazione: nessun bump, l'estensione è additiva e lato server.

## 4. Applicazione nel runtime U2-c (stesse regole del pulsante)
`refusedProposal(req, prev, u1Result)` riconosce il rifiuto se **(pulsante)** `answer/no` sulla domanda consent in cima **oppure (testo)** `u1Result.applied` contiene `decline_consent` con `consent === prev.pendingQuestion.consentKind` e `prev.pendingQuestion.kind === 'consent'` con `proposal`. Da lì il percorso è identico a rev.3: `withRefusal` (ambito tipo + date/giorni esatti, persistito in `declined`), `isRefused` al cancello, `refusedGate` → `blocked` + chiarimento (`drop:dates` / nuova data), data mai modificata, replay `cached`, una revisione per turno. Nessuna modifica alla migration SQL (lo stato è jsonb opaco).

## 5. Casi da coprire (test L1/L2, LLM MOCKED con output scriptati)
| Caso | Output LLM (mock) | Atteso |
|---|---|---|
| «No grazie» | `[decline_consent non_working_day, evidence "No grazie"]` | domanda consent chiusa; rifiuto conservato; `blocked` con chiarimento; nessun consenso/piano; data invariata; rev +1 |
| «No grazie» ma LLM restituisce `{operations:[], clarification}` | nessuna op | comportamento attuale: `needs_clarification` (`unclear`) sopra la domanda consent; **nessuna deduzione** di rifiuto; documentato come fallback |
| «no» secco | `[decline_consent, evidence "no"]` | come il primo caso (la citazione «no» è letterale e presente) |
| Messaggio non pertinente «Aggiungi anche Monza» | `[add_locality Monza]` | side update; la domanda consent resta pendente; nessun rifiuto |
| Negazione su altro criterio «No, niente Monza» | `[remove_locality Monza, evidence "niente Monza"]` | side update; consent pendente; nessun rifiuto |
| LLM emette `decline_consent` **senza** domanda consent pendente | `[decline_consent …]` | respinta (`rejected`), criteri invariati, nessuna domanda |
| LLM emette `decline_consent` di **tipo diverso** da quello chiesto | `[decline_consent extra_days]` con pending non_working_day | respinta; consent pendente |
| `grant_consent` + `decline_consent` stesso tipo | entrambe | entrambe respinte; domanda consent resta aperta |
| `decline_consent` con citazione assente dal messaggio | evidence inventata | respinta (regola citazioni) |
| Replay stesso `requestId` del rifiuto testuale | — | `cached` byte-identico, zero LLM/planner, +0 |
| Dopo il rifiuto testuale: nuova data / `drop:dates` / ritorno alla data rifiutata | come rev.3 | planned / data rimossa / `blocked` conservato |
| Pulsante «no» | — | invariato (rev.3) |
Rischio residuo (documentato, non eliminabile senza parser): se l'LLM classifica erroneamente una negazione riferita ad altro come `decline_consent` con citazione letterale presente (es. evidence «No» in «No, niente Monza»), il server la accetta come rifiuto esplicito; mitigazioni: regola di prompt (§3.5), citazione obbligatoria, ambito esatto, reversibilità (nuova data/`reset`), nessun piano generato.

## 6. File interessati (nessuno modificato ora)
| File | Modifica | Note |
|---|---|---|
| `supabase/functions/_shared/gptour-semantic/contract.ts` | `OpName` += `'decline_consent'` | **U1 tracciato/protetto** (hash cumulativo 40 file cambia) |
| `supabase/functions/_shared/gptour-semantic/schema.ts` | `OPS` += `'decline_consent'` | schema LLM strict + validatore |
| `supabase/functions/_shared/gptour-semantic/apply.ts` | `slotOf` (consent slot), `case 'decline_consent'` (regole §3.1–3.4), coerenza grant/decline | nessuna modifica ai criteri |
| `supabase/functions/_shared/gptour-semantic/interpreter.ts` | nessuna modifica necessaria al pulsante; eventuale pre-filtro `decline_consent` senza domanda pendente → `rejected` (se non gestito in apply) | — |
| `supabase/functions/_shared/gptour-semantic/prompt.ts` | riga `decline_consent` (§3.5) | prompt deterministico invariato nel resto |
| `tests/gptour-semantic/SA_semantic.unit.ts` (+ fixtures) | casi §5 lato U1 | U1 passa da 232 a N controlli; i 232 esistenti devono restare verdi |
| `supabase/functions/_shared/gptour-semantic-transport/*` | **nessuna** | `semantic-1.1` invariato; `result.applied` accetta la nuova op via `validateLlmOutput` |
| `supabase/functions/_shared/gptour-semantic-runtime/refused-consent.ts` | `refusedProposal(req, prev, u1Result)` (§4) | runtime |
| `supabase/functions/_shared/gptour-semantic-runtime/turn.ts` | passaggio di `u1.result` a `refusedProposal` | runtime |
| `tests/gptour-semantic/u2/u2c/harness.ts`, `turn.unit.ts` | step LLM mock con `decline_consent`; casi §5 L1/L2 | — |
| `supabase/orchestrator-pending/u2b/01_semantic_migration.sql` | **nessuna** | stato jsonb opaco |
| `tests/gptour-semantic/u2/build_delivery.py`, script di packaging | aggiornare l'hash atteso dei 40 file protetti **dopo** autorizzazione | oggi rifiutano se U1 cambia |
| `docs/gptour-semantic/U2_C_RESULTS.md`, `PHASE_U1_SEMANTIC_INTERPRETER.md` | documentare l'estensione | — |

## 7. Cosa NON si propone
Parser locale Web/Mobile; regex generica su «no» nel server; chiusura implicita della domanda consent su messaggi non pertinenti; modifica della data o dei criteri in conseguenza del rifiuto; nuovi campi in `semantic-1.1`; modifica alla migration SQL; avvio U2-d.

## 8. Prerequisiti per l'implementazione
Autorizzazione esplicita a modificare i 5 file U1 (§6) e i test U1; decisione su `SEMANTIC_CONTRACT_VERSION`; conferma che il fallback «clarification generico senza deduzione» è accettabile quando l'LLM non emette `decline_consent`.
