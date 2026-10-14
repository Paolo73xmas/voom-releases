# GPTour — Piano operativo Fase U2

**Revisione 3 — SOLO DOCUMENTO. U2 non implementata né autorizzata all'esecuzione.**

Base preservata: branch `feature/gptour-semantic-interpreter`, commit U1-4 `259ec92d`.
U1 è conclusa come modulo isolato, verificata dall'utente con **232 controlli**: codice e suite SA/SC/SD/SE restano invariati in questa revisione documentale. Quei controlli non sono stati rieseguiti e non certificano le proprietà distribuite U2.
Unico file oggetto di questo turno: `docs/gptour-semantic/PHASE_U2_PLAN.md`. Nessuna implementazione, installazione, query in produzione, chiamata LLM a pagamento, modifica di altri documenti, commit, push o deploy.

## 0. Scopo, fonti e invarianti

U2 collega U1 a un backend condiviso: interpretazione LLM, applicazione deterministica, filtri CRM certificati, pianificazione e persistenza transazionale. Web e Mobile diventano client dello stesso contratto, senza regole commerciali duplicate.

Fonti della revisione in sola lettura:
- `_shared/gptour-semantic/{contract,interpreter,apply,projection,prompt,schema,openai-port}.ts` e suite U1;
- `gptour-orchestrator/handler.ts`, `_shared/gptour-orchestrator/{orchestrator,ports,contract}.ts`;
- adapter `supabase-store.ts`, `supabase-crm.ts`, migration e guida SQL Fase 4B;
- `src/lib/gptour-orchestrator/client.ts`, `src/hooks/useOrchestratorSession.ts`;
- documentazione U1 e handoff Mobile dell'orchestratore. Nessun accesso al repository Mobile.

Invarianti:
1. U1 non viene riscritta per introdurre trasporto, lease o SQL. Il raccordo appartiene a nuovi moduli U2.
2. GPTour legacy, contratto orchestratore `1.0`, tabelle `gptour_orchestrator_*`, gestione accessi Fase 6 e `GPTOUR_ORCHESTRATOR_ENABLED` restano invariati.
3. Nessun deploy della Edge v7. D3(a) ammette in una futura implementazione soltanto un'estrazione additiva del planner condiviso, con non-regressione dimostrata (§2).
4. Identità dal JWT reale verificato; autorizzazioni, filtri, agenda, consensi e fattibilità server-side. Nessuna service role nei client o per simulare un agente.
5. Nessuna scrittura su clienti, ordini, agenda, tour o follow-up commerciali. I piani U2 sono bozze tecniche separate.
6. Routing stimato sempre distinto da `verified_routing`; un piano recuperato non equivale a una nuova verifica dei dati correnti.
7. Nessun segreto o contenuto dei messaggi nei log. Nessun tenant/company artificiale.
8. Le prescrizioni seguenti sono decisioni tecniche del piano, NON autorizzazioni a eseguirle. Le sole scelte ancora richieste al proprietario sono raccolte in §8.

## 1. Recepimento degli otto rilievi

| Rilievo della revisione | Decisione operativa rev.3 | Riferimento / test previsti |
|---|---|---|
| 1. Errori e conflitto finale non completabili senza aggiornare la sessione | `commit_success` e `finish_error`; il conflitto finale viene committato come errore della sola request | U2-b/U2-c; T03–T07 |
| 2. Lease non impedisce chiamate esterne sovrapposte | fencing di tutte le scritture; budget condiviso; nessuna promessa di non-contemporaneità presso il provider | U2-c; T08–T10 |
| 3. Takeover confusi con chiamate LLM | `processing_attempts` separato da `llm_dispatches_reserved`; ammissione atomica per invocationId | U2-b/U2-c; T11–T14 |
| 4. Retention incompatibile con idempotenza illimitata | replay per 7 giorni, tombstone fino a fine sessione, sessioni assenti mai ricreate dai turni | §5; T19–T22 |
| 5. Output salvato non sufficiente per esito identico | tempo del turno e contesto interpretativo persistiti; CRM operativo rivalidato; identità solo della risposta committata | U2-c; T15–T18 |
| 6. Prima claim prima della sessione viola modello Fase 4B | `create_session` separata, server-generated ID, revisione 0; poi claim con FK e ownership | U2-a/U2-b; T01–T02 |
| 7. Contratto incompleto | adapter `semantic-1.1` → U1 `semantic-1.0`; letture esplicite; partenza persistita; matrice errori | U2-a, §4; T23–T28 |
| 8. Rebase/fallback Web e Mobile ambiguo | recupero dello stato intero, nessun reinvio automatico di un turno in conflitto, cambio motore esplicito | §7; T29–T33 |

Restano motivazioni valide di U2 le scritture separate sessione/risposta della v7, l'assenza di prenotazione/hash e la proiezione non esatta di categorie/comuni omonimi. Si risolvono nel nuovo percorso, non correggendo in parallelo la v7.

## 2. Architettura proposta: D1, D2, D3(a)

- **D1 — Edge separata `gptour-semantic`.** JWT verificato con `auth.getUser`, accesso Fase 6 verificato via RPC esistente, più abilitazione semantica additiva e kill-switch `GPTOUR_SEMANTIC_ENABLED`. Fail-closed anche sulle letture e sui replay.
- **D2 — Persistenza separata `gptour_semantic_*`.** Nessuna FK verso CRM; FK interne e controllo owner/sessione/agente. Nessuna migrazione delle conversazioni v7.
- **D3(a) — Riuso del solo planner mediante confine additivo `planFromCriteria`.** Input già interpretato e verificato: criteri, candidati, decisioni agenda, impostazioni, partenza e porte di routing. Output discriminato: piano verificato/stimato, domanda di fattibilità, impossibilità o errore tecnico.
- Il planner riusato **non** chiama `interpret`, `applyAiPatch`, porte AI, `handleTurn` o `SessionStore`; non legge/scrive sessioni, risposte o piani v7. Persistenza, requestId e lease restano responsabilità U2.
- Il percorso v7 potrà usare la stessa estrazione mantenendo il proprio wrapper, contratto e comportamento. Golden prima/dopo, clock/ID/routing controllati; niente deploy v7. Se l'estrazione cambia il comportamento, U2-d non passa: non si accetta una divergenza silenziosa.
- U2 passa dal cancello `guardPlanning` prima del planner. Il loader semantico non viene vanificato da una successiva riclassificazione generica `existing/newPoints`.
- Ordine: backend condiviso completo e certificazione pertinente, poi Web, poi integrazione Mobile autorizzata. Nessun lavoro sui client in parallelo alla fondazione U2.

## 3. Backend condiviso

### 3.1 Livelli di verifica separati

| Livello | Ambiente previsto | Dimostra | Non dimostra |
|---|---|---|---|
| L1 | Deno CLI 2.9.7 già presente, clock/store/LLM/routing simulati | transizioni, mapping U1/U2, guasti simulati, guardie, contratti e golden a input uguali | SQL/RLS reali, runtime Edge o modello reale |
| L2 | PostgreSQL 15 + PostgREST aarch64 effimeri; handler su `deno serve`; JWT locali | DDL, ACL/RLS, RPC, commit/rollback, lock/CAS, budget atomico, concorrenza tra connessioni, errori PostgREST, filtri su fixture, HTTP end-to-end | GoTrue/gateway reali, bundle Edge, pooling hosted, cold start/limiti reali, compatibilità hosted 17.6 certificata |
| L3 | Runtime Edge effettivo, ambiente da scegliere | bundle/import, gateway, GoTrue, CORS, runtime e limiti dell'ambiente scelto; sottoinsieme esplicito dei test L2 | risultati degli altri livelli o della produzione per semplice equivalenza; qualità statistica LLM |

L3 non è attualmente disponibile nel pod secondo l'ultima verifica (Docker e Supabase CLI mancanti). Alternative da autorizzare: L3-a macchina utente con Docker e stack Supabase locale; L3-b staging/branch; L3-c produzione con flag OFF e successivo pilota ristretto. Registrare versioni reali PostgreSQL/runtime: una prova Docker non dimostra automaticamente i limiti hosted.
Runner previsto: `tests/gptour-semantic/u2/L3_runtime.ts`, tramite fetch, URL configurato. Produzione: soltanto azioni senza LLM finché le chiamate a pagamento non sono autorizzate. Stub permesso esclusivamente in ambiente di test esplicitamente configurato/validato; configurazione assente o production lo rifiuta. Report L1/L2/L3 separati, con versione, data, casi eseguiti e non eseguibili.

### U2-0 — Ambiente L1/L2, non avviato

- Installazione fuori repository, dati effimeri in `/tmp`, Postgres 15 e PostgREST aarch64 con checksum verificato. Richiede autorizzazione preventiva.
- Bootstrap ruoli, schema auth minimo con `auth.uid()` da claims, utenti sintetici e credenziale JWT effimera non registrata nei file/log. Non è un'emulazione completa di GoTrue.
- Replay schema CRM minimo verificato, Fase 4B, Fase 6, `20261029_gptour_catalog_scope.sql` e futura migration U2 soltanto sul DB locale.
- Fixture sintetiche; `local_up.sh` idempotente; ACL owner A/B/anon, connessioni distinte, guasti e clock controllabili.
- Accettazione: bootstrap ripetibile, nessun accesso a endpoint produttivi, nessun segreto nei report, check locale dell'entrypoint. Differenza PG15/hosted da verificare separatamente in L3.

### U2-a — Contratto di trasporto e adattamento U1

Trasporto nuovo **`semantic-1.1`**, endpoint separato. Non significa che il validatore U1 debba accettare 1.1: il bridge U2 costruisce una `SemanticRequest` interna con **`semantic-1.0`**, chiama U1 invariata e rimappa l'output nel trasporto 1.1. Il contratto v7 `1.0` non cambia. Il client che non supporta 1.1 riceve 400 `unsupported_contract`; nessun downgrade/reinoltro automatico.

Ogni POST ha `contractVersion` e discriminante `operation`. Validazione strict per variante, incluse action e sotto-oggetti; campi sconosciuti respinti. Nessun payload accetta ruolo, owner, `agentId`, `tenantId`, `isAdmin`, lease, budget, clock interpretativo o stato autorevole.

| operation | Campi specifici | Risposta / effetti |
|---|---|---|
| `capabilities` | solo diagnostica `client` opzionale | 200 con versioni/capacità/limiti; nessuna sessione o LLM |
| `create_session` | `targetAgentId` opzionale, validato server-side | 201, nuovo UUID generato dal server, revisione 0, stato vuoto, scadenze; zero LLM |
| `turn` | sessionId, requestId, expectedRevision intera >=0; esattamente uno fra message non vuoto <=2000 e action; departure/gps opzionali; client diagnostico | risposta applicativa o errore secondo §4; unico percorso che elabora il turno |
| `get_state` | sessionId | 200, snapshot autorevole corrente; zero LLM/planner, nessun incremento revisione |
| `get_request` | sessionId, requestId | 200, ricevuta con stato `not_found/pending/done/expired`, lease/retryAfter pubblici senza token, scadenze e risultato terminale se conservato; non avvia elaborazione |
| `get_plan` | sessionId, planId | 200, bozza immutabile e metadati di validità/scadenza; zero rigenerazioni o aggiornamenti revisione |

`get_request` è una lettura: HTTP 200 non significa che il turno sia riuscito. Se done, contiene `originalHttpStatus` e risposta committata; il replay del POST `turn` restituisce invece direttamente HTTP/body originari. Sessione non disponibile → 410 generico; piano non disponibile nella propria sessione → 404 generico. Nessuna enumerazione di risorse altrui.
Se una request è ancora fisicamente pending ma processing_deadline è passata, la ricevuta indica `processingExpired=true, recoverable=false`: non inventa una risposta committata. Un POST identico può finalizzarla con 503 `processing_expired`, senza LLM/planner; in alternativa la chiude la manutenzione autorizzata. Le letture non cambiano lo stato.

`targetAgentId` viene fissato alla creazione. Un eventuale valore nei turni deve coincidere; altrimenti 403 `agent_mismatch`, nessun nuovo turno. I client non inventano sessionId né inviano turni prima dell'ACK della creazione.
La creazione non è un turno idempotente: se l'ACK si perde, un retry può creare un'altra sessione VUOTA con un diverso ID, mai elaborare due volte un messaggio. Le sessioni inutilizzate (nessuna request mai accettata, non semplicemente revisione 0) scadono dopo 24 ore; quelle usate seguono §5. Nessuna promessa exactly-once sulla creazione, nessun costo LLM associato.

**Snapshot `get_state`:** revisione corrente, criteri, domanda attiva e lista pubblica delle domande aperte, notices, stato/gate dell'ultima elaborazione, contesto partenza, lastPlanId, revisione del piano, scadenze, contract/engine version. Non espone deferred con messaggi originali, catalogo privato, token di lease o output LLM.

**Contesto operativo persistito:** `departure` esplicita, origine e istante di acquisizione; GPS accettato e sua provenienza; lastPlanId e planRevision. Partenza esplicita conserva precedenza su GPS e impostazioni nei turni successivi. GPS non sostituisce una partenza già scelta, deve essere finito e con accuracy <=200 m; capturedAt deve essere valido, non oltre 30 s nel futuro e non più vecchio di 5 min al momento dell'accettazione. GPS vecchio/invalido non viene adottato e genera notice; una partenza esplicita malformata è 400, mai fallback silenzioso. Reset azzera il contesto del nuovo flusso come dichiarato nella risposta. Le scelte non risiedono solo nello storage locale Web/Mobile.

**Risposta del turno:** contratto/engine, sessionId/requestId, `outcome` (`committed/recoverable/unknown/not_accepted/expired`), `errorCode`, `retryableSameRequest`, `nextAction`, `retryAfterMs`, acceptedAt/responseExpiresAt; risultato semantico e revisione coerenti. `gate` è null per errori tecnici; negli esiti applicativi è `pending_question/blocked/needs_consent/planned`. Piano solo se effettivamente prodotto, con forma Plan 1.0 e badge verification invariati. `openQuestions` è sempre una lista pubblica, non alternativamente numero/lista; `openQuestionCount` è separato.

La risposta committata descrive la revisione di QUEL turno, non promette di essere lo stato corrente dopo altri turni. `get_state` è la fonte per riallinearsi. Tipi trasporto/golden generati da una fonte condivisa: niente copie Web/Mobile curate indipendentemente.

### U2-b — Persistenza e RPC transazionali, solo future migration locali

Tabelle isolate previste:

| Tabella | Dati principali e vincoli |
|---|---|
| sessions | session_id PK server-generated, owner_uid, agent_id immutabili; revision; SemanticState U1; contesto operativo U2; contract/engine, created_at, updated_at, expires_at |
| requests | PK(session_id,request_id), FK sessione/owner coerenti; hash payload; status pending/done/expired; processing_attempts; lease_until/token; base_revision; accepted_at, processing_deadline, response_expires_at; context/engine version; output LLM valido write-once; conteggi e last_error_code |
| llm_invocations | PK(session_id,request_id,invocation_id), FK request; ordinal univoco, riserva/invio osservato/esito; una riserva non è revocabile né rimborsabile |
| plans | bozza immutabile, sessione/owner, planRevision, Plan, created_at/expires_at; nessuna FK CRM |

Risposta definitiva salvata come `response_body` canonico testuale + `http_status` + eventuale JSON per ispezione. Prima risposta e replay usano gli STESSI bytes conservati; non si presume che una rilettura JSONB mantenga ordine chiavi/serializzazione. Date header, tracing e header di trasporto non fanno parte della garanzia byte-identica.
Hash SHA-256 di una rappresentazione canonica del payload semantico/operativo validato, inclusi sessionId, requestId, expectedRevision, message/action, departure/gps e versione; esclusi solo `client` diagnostico e credenziali trasporto. Omissione/null normalizzati solo dove equivalenti per contratto. Nessun trim o normalizzazione cambia il significato del testo. Il corpo completo del retry è immutabile; cambiare GPS o revisione con lo stesso ID è 422.

ACL/RLS: isolamento owner-only e nessun DELETE client, come principio Fase 4B, NON copia letterale delle vecchie policy. FK e INSERT della request richiedono sessione già creata. RPC a privilegi minimi con identità del chiamante verificata, `search_path` fissato; CRM sempre con JWT utente. Il progetto SQL deve far rispettare gli invarianti anche agli accessi diretti PostgREST ammessi: done non torna pending, hash/risposta/owner non riscrivibili, contatori non azzerabili. Owner-only da sola non dimostra questi vincoli. Test negativi obbligatori; nessuna deroga tramite service role nel percorso utente.

**Ordine lock globale:** sessione → request → invocation/piano. Nessuna transazione SQL rimane aperta durante LLM, CRM remoto o routing. RPC brevi; tempo DB letto con `clock_timestamp()` DOPO i lock per valutare scadenze reali, non con timestamp di inizio transazione potenzialmente vecchio. Durate e budget sono valori server, mai parametri controllabili dal client pubblico.

| RPC logica | Comportamento richiesto |
|---|---|
| `create_session` | autorizza agente e crea sessione vuota a rev0; ID generato server; nessuna request prima di questa riga |
| `claim` | verifica accesso/sessione viva; INSERT request o lock esistente; hash diverso → reused; response_expires_at raggiunta/tombstone → expired; done conservata → cached; pending oltre processing_deadline → finalizzazione per scadenza senza elaborazione; pending con lease vivo o next_retry_at futuro → in_progress; altrimenti takeover con NUOVO token e processing_attempts+1 |
| `renew_lease` | solo pending, token corrente e non scaduto, deadline non raggiunta; estende fino a min(now+45s, processing_deadline); non resuscita token vecchi |
| `store_context` | salva una sola volta il contesto interpretativo prima di qualsiasi riserva LLM; write-once e fencing |
| `begin_llm` | lock e riserva atomica descritta in U2-c; budget indipendente da processing_attempts |
| `store_llm` | solo output strict-validato, richiesta pending e token corrente/non scaduto; output write-once; nessuna applicazione prima della conferma persistita |
| `commit_success` | lock sessione/request; verifica pending, token, lease/deadline, ownership e revisione; scrive UNA nuova revisione, stato/contesto, eventuale piano e risposta done nella stessa transazione |
| `finish_error` | completa SOLO request con errore terminale, HTTP/body e pulizia output/context; NON aggiorna sessione, timestamp di attività, revisioni o piani |
| `release_recoverable` | salva codice errore tecnico/next_retry_at, libera il lease corrente; lascia pending e output/context/budget intatti; nessuna risposta terminale |

La prima claim salva `base_revision = expectedRevision` del payload validato (non la revisione corrente scelta al suo posto), accepted_at e scadenze immutabili; processing_attempts parte da 1 e il budget LLM da 0. Tutti i takeover conservano questi valori. Nessuna riallocazione del budget o riancoraggio del messaggio durante un retry.
**Conflitto finale:** se sotto lock `session.revision != base_revision`, `commit_success` NON scrive sessione/piano. Nella stessa transazione registra request done con 409 `revision_conflict`, rev osservata e risposta snapshot. Restituisce un esito, NON solleva un'eccezione che annulli anche la memorizzazione del conflitto.
`finish_error` non richiede che la sessione sia ancora alla base_revision: può completare il perdente senza toccare il vincitore. Richiede però ownership, request pendente e fencing valido. Una finalizzazione per scadenza può, sotto lock e con tempo DB oltre deadline, revocare il lease e chiudere la request; impedisce qualsiasi successo tardivo.
Request già done: restituzione del risultato memorizzato, mai seconda finalizzazione. Token vecchio: nessuna scrittura, recupero della ricevuta del vincitore. Fallimento SQL reale: rollback totale della RPC; nessun piano orfano. ACK DB perso: risultato INCERTO, non prova di rollback (§4).

La revisione di trasporto/state persistito avanza esattamente +1 per turno applicativo committato (anche una nuova domanda), zero per errore terminale. Il bridge normalizza sulla copia di output U1 la revisione finale a base+1, anche se `proposeExpansion` ha prodotto incrementi intermedi; non modifica U1. `turn` e ID delle domande mantengono la sequenza interna U1 e vengono testati separatamente. `SemanticResult.revision`, sessionRevision e planRevision devono coincidere quando esiste un piano nuovo.

### U2-c — Protocollo, recupero, lease e budget

**Valori tecnici iniziali del piano:** lease 45 s, rinnovo durante il solo worker HTTP attivo ogni 15 s e ai checkpoint, timeout LLM 12 s, `MAX_LLM_DISPATCHES=2`, processing_deadline = accepted_at + 5 min. Durate da misurare in L3; nessun worker permanente o job di elaborazione implicito. In assenza di worker vivo il recupero è attivato da un nuovo POST identico, non da `get_request`.
Il rinnovo ha durata finita, si ferma in finally e non supera la deadline globale o il tempo di esecuzione Edge disponibile. Prima dell'invio LLM serve lease residuo >= timeout+5 s, altrimenti renew o arresto recuperabile. Sono mitigazioni, NON una prova che il provider abbia interrotto la prima chiamata.

**Macchina a stati:** assente → pending → done → expired (tombstone). Pending può diventare done per errore/scadenza senza aggiornare la sessione. Nessun arco done/expired → pending. Una requestId sconosciuta è nuova solo dentro una sessione esistente/viva; non crea mai la sessione.

```text
auth + accesso + validazione trasporto (anche per replay/letture)
  → claim(sessionId, requestId, hash)
      cached       → HTTP/body conservati, zero nuovo CRM catalogo/LLM/planner
      reused       → 422, non alterare la richiesta originale
      expired      → 410, non rielaborare
      in_progress  → 409 recuperabile + retryAfterMs, stesso ID
      new/takeover → token T e contesto persistito della richiesta
  → verifica deadline e revisione corrente contro base_revision
      conflitto    → finish_error(409), solo request done
  → action? U1 con llm=null; altrimenti contesto + porta LLM persistente
      output salvato → riuso, zero invii al provider
      output assente → begin_llm → dispatch autorizzato → validazione → store_llm
  → interpretTurn interno semantic-1.0, clock del turno, stato base della stessa revisione
      error        → terminale o recuperabile secondo §4; MAI planner
  → rivalida CRM operativo corrente; guardPlanning(stato)
      domanda/blocco/consenso → persisti stato e domanda; nessun piano nuovo
      libero       → planFromCriteria; mappa anche impossibilità/domande del planner
  → commit_success(T): verifica finale revisione/tempo; successo O conflitto terminale
  → restituisci solo risposta definitiva riletta/confermata, mai anteprima non committata
```

**Budget atomico, non contatore dei takeover:**
1. `processing_attempts` conta acquisizioni di elaborazione, senza autorizzare o vietare chiamate LLM. I takeover sono limitati dalla deadline e dal backoff, non dal budget del modello.
2. `llm_dispatches_reserved` conta autorizzazioni irreversibili all'invio. Sostituisce il nome ambiguo `llm_calls_started`; il numero realmente osservato di invii è diagnostica separata e può essere inferiore.
3. `begin_llm(T, invocationId)` verifica request pending, lease/deadline, output assente e contatore <2; inserisce invocationId univoco e incrementa atomicamente. Restituisce `mayDispatch=true` SOLTANTO alla prima esecuzione che crea la riserva.
4. Ripetere la stessa RPC/invocationId non incrementa e restituisce `mayDispatch=false, alreadyReserved=true`. ACK della riserva perso → nessun invio sulla base di un esito incerto. Quello slot resta consumato; un eventuale nuovo invio richiede un'altra riserva entro il tetto. Non si rimborsa uno slot perché non si sa se il provider è stato contattato.
5. Ogni risposta positiva autorizza un solo POST provider. Nessun retry automatico nascosto nell'adapter/SDK: ogni altro invio richiede nuova invocationId e nuova ammissione SQL. Le invocazioni concorrenti non possono oltrepassare 2.
6. Un output validato viene salvato prima di restituirlo alla chiamata interna U1. Se lo store fallisce, non si applica l'output. Se l'ACK dello store manca, si legge la request per verificare se l'output esiste, senza nuovo LLM alla cieca.
7. Timeout/HTTP provider transitorio con slot residuo → pending recuperabile; senza slot residui → done 503. Output JSON/schema invalido → done 502 immediato, senza riparazione LLM automatica. Un nuovo messaggio confermato dall'utente è una nuova request, non un'estensione del budget precedente.
8. Più crash prima di begin_llm consumano zero slot. Crash dopo la riserva ma prima dell'invio può consumare uno slot senza chiamata. Crash dopo output ricevuto ma prima dello store può richiedere seconda chiamata. Output già salvato è riusato anche dopo molti takeover, finché request/deadline/revisione sono valide.

**Contesto temporale e interpretativo:**
- `accepted_at` viene fissato dal DB alla prima claim e mai spostato dal retry. Europe/Rome, today e localTime per U1 derivano da quell'istante, anche dopo mezzanotte/DST.
- Prima della prima riserva vengono persistiti catalogo interpretativo minimo realmente usato, hash/schema del contesto, versione del prompt/engine, configurazione modello identificativa non segreta. Niente intero portafoglio se non necessario. Retry e output recuperato usano lo stesso contesto; `created_at` da solo non sostituisce il catalogo.
- Bridge U2 invoca U1 invariata con clock fissato e `LlmPort` decorata: ritorna output salvato oppure esegue la sequenza ammissione/store. Le sue interruzioni infrastrutturali vengono distinte dagli errori semantici tramite esito strutturato U2, senza trasformarle tutte in errori LLM terminali perché U1 cattura un'eccezione.
- I contatori diagnostici U1 misurano chiamate alla porta, non necessariamente al provider (replay della porta incluso). La risposta U2 espone separatamente riserve e invii osservati; non presenta un replay come costo LLM nuovo.
- Stato base riusabile solo se la revisione è ancora quella accettata. Snapshot interpretativo NON congela autorizzazioni, assegnazioni, agenda, disponibilità o sicurezza CRM.
- Prima del planner si ricaricano con JWT dati operativi correnti. Evento nominato scomparso/modificato in modo incompatibile, partenza oggi già passata o versione engine non compatibile col contesto → done 409 `context_changed`/`engine_changed`, stato invariato, rilettura + conferma nuovo turno. Mai spostare automaticamente «domani» o ripristinare vecchi diritti.
- Dopo `store_llm`, recupero significa **zero nuova chiamata**, non «piano identico a uno mai committato». Fino al commit un ricalcolo routing/CRM può differire, ma deve rispettare gli stessi criteri o fermarsi. Identità della risposta garantita solo dopo done.

**Garanzie corrette:**
- G1: per coppia sessionId/requestId accettata, al massimo una transizione applicativa della sessione; errori terminali zero transizioni. Token, stato pending e CAS sono verificati sotto lock. Dopo scadenza non si rielabora la coppia (§5).
- G2: massimo 2 riserve/invii del nostro handler per request accettata, anche con takeover; al massimo un output scelto contribuisce allo stato committato. Senza guasti: una chiamata per messaggio, zero per action.
- NON garantiti: exactly-once presso il provider, conteggio esatto della fatturazione, assenza di sovrapposizione esterna, singola esecuzione del planner prima del commit. Un takeover può ricalcolare, ma non duplicare il piano persistito.
- Replay HTTP/body identico solo entro la conservazione della risposta, con sessione ancora viva e accesso ancora autorizzato. Un diniego attuale impedisce anche il replay; non cancella o riscrive il risultato storico.

### U2-d — Handler e confine del planner

- Nuovo handler iniettabile, bridge U1, store U2 e ReferenceCatalog con JWT. Nessuna lettura del catalogo prima dell'accesso; replay done non ricarica catalogo o routing, ma ricontrolla autorizzazioni.
- Azioni strutturate senza modello; invalid request/errori U1 senza planner. Domanda pendente in qualunque punto della pila → zero planner; consensi date-bound.
- Persistire domanda `blocked`/proposta `needs_consent` prima di esporre pulsanti che vi rispondono. Piano precedente non mostrato come attuale se la nuova revisione è bloccata o in attesa.
- Planner estratto D3(a) senza interpretazione/persistenza: U2 ne converte domande di fattibilità in domande rispondibili del contratto, senza reintrodurre parser legacy. Un `planned` del cancello U1 indica chiamata ammessa, NON automaticamente piano fattibile: controllare l'esito del planner prima di emettere gate planned.
- Impossibilità commerciale/fisica verificata → 200 applicativo blocked/needs_consent con criteri e domanda persistiti. Errore di caricamento/OSRM → §4, mai finto insieme vuoto o routing dichiarato verificato.
- Accettazione: U1 232 controlli e suite orchestratore invariati/passanti; golden v7 identici; prove negative su tutti i gate; nessuna scrittura v7/CRM; nessun nuovo type error nei moduli interessati.

### U2-e — Correttezza dei filtri CRM

1. Specificare con il proprietario le regole di prodotto ancora ambigue: client/prospect/orphan/free/never, ownOnly, soglie acquisti/visite, inclusione dei mai acquirenti, comuni/province/limitrofi, territorio/eccezioni progetto. Non assumere che legacy, v7 e richieste recenti siano già equivalenti.
2. Tabella per regola: definizione, colonne, soggetto fisico e chiave canonica, esclusioni chiusi/disabilitati/GPS, confini temporali Europe/Rome; nessuna decisione tramite LLM.
3. Fixture sintetiche con `expectedKeys` scritti a mano, dentro/fuori/confine: N/N-1/N+1 giorni, mezzanotte/DST, cancelled/deleted/quote/status NULL, altri agenti, stati visita, orfani, collegamenti customer/registro, comuni omonimi, GPS mancante/sospetto.
4. Nuovo adapter L2 deve restituire ESATTAMENTE gli insiemi attesi `cust:<id>`/`tab:<id>`, con differenze simmetriche leggibili. Verificare anche identità fisica/deduplica e completezza della paginazione; i conteggi da soli non bastano.
5. Generatore a seed fisso: SQL adapter contro riferimento TS puro della specifica, scritto separatamente. Test di combinazioni di segmenti e soglie, non soltanto categorie singole.
6. Eseguire legacy sulle stesse fixture (`gptour-criteria.ts`, `gptour-registry.ts`, query ai-tour-gptour riprodotte localmente). Registrare differenze in futuro `U2_LEGACY_DIVERGENCES.md`: regola, caso, chiavi, legacy, atteso e decisione. Nessuna divergenza risolta in silenzio.
7. `caps[k].exact=true` solo dopo regole concordate, test attesi/differenziali passanti e divergenze decise. Province per comune devono arrivare alla query; il nuovo raccordo non deve aggirare i blocchi U1 per criteri ancora non supportati.
8. Query produzione facoltative, read-only e separatamente autorizzate: set/hash delle chiavi con sale effimero, differenza simmetrica lato DB, output minimo. Non eseguite e non sostitutive delle fixture attese.

### U2-f — Certificazione del backend, parità e preparazione dell'attivazione

**Attività, prima dei client:**
- Congelare schema trasporto 1.1, mapping completo §4, canonicalizzazione payload/risposta e golden per tutte le operation, gate ed errori; pubblicare kit autonomo per Web/Mobile nel repository quando l'implementazione sarà autorizzata.
- Eseguire matrice §6 L1/L2 con fault injection e processi/connessioni distinti; raccogliere revisioni, numero piani, stati request, slot LLM e invii realmente osservati. Niente testo CRM o credenziali nei report.
- Eseguire U1 e golden v7 prima/dopo l'estrazione planner. Certificare il confine con porte AI/store che falliscono se il planner tenta di usarle.
- Produrre report filtri e divergenze, capability manifest (abilitate/bloccate), guida locale migration/rollback/diagnosi e prove della pulizia logica/fisica/expiry.
- Preparare runner L3 e handoff `MOBILE_SEMANTIC_HANDOFF.md` autosufficiente: esempi, state machine, error matrix, recovery, storage/logout, contratto retry e kit golden, senza richiedere il repository Mobile.
- Preparare runbook di attivazione: flag OFF, verifiche read-only, pilota nominato/autorizzato, metriche errori/lease/budget/conflitti; arresto con kill-switch semantico e conservazione delle request per recovery. Non migrare dati verso v7 né reinoltrare turni al legacy durante l'arresto.

**Criteri di accettazione distinti:**
1. U2-f/L1-L2 PASS: tutti i test applicabili di §6 passanti, nessun difetto aperto nelle garanzie; U1 232/232 e non-regressione v7; set attesi e capability manifest coerenti; documenti/kit completi. Non equivale a Edge-ready.
2. U2-f/L3 PASS: prova sul runtime effettivo autorizzato con versioni registrate, auth/gateway/import, recovery e limiti misurati; test non fattibili (es. crash/provider in production) esplicitamente esclusi e coperti in L1/L2. Niente badge L3 PASS se L3 non eseguito.
3. Parità backend: stesso stato+clock+catalogo+risposta LLM simulata → stessi criteri/gate/azioni; differenza `client.platform` non influenza hash/prompt/regole. Stessa request già done → stesso HTTP/body attraverso due adapter di trasporto. Non promettere identità fra generazioni LLM indipendenti.
4. Via libera ai client solo dopo backend e verifica L3 pertinente, secondo ambiente scelto. Le prove con adapter non sono E2E di app native: certificazione Mobile resta M4.
5. Attivazione reale resta un'azione separata autorizzata, mai conseguenza automatica di un report PASS. U2-f produce prontezza e runbook, non un deploy implicito.

## 4. Matrice operativa di errori e recupero (normativa per entrambi i client)

Legenda: **N** = richiesta non accettata, nessun nuovo record; **P** = pending recuperabile, sessione invariata; **D** = risposta terminale committata in request done, sessione invariata salvo esito applicativo; **E** = scaduta/non rielaborabile; **U** = esito ignoto finché non viene letto il DB. Se un errore precede la claim ma la coppia esiste già, quella riga resta intatta: N non significa cancellazione.
`retry` indica il POST turn, non le letture di recupero. Ogni nuovo ID rappresenta un NUOVO turno, mai una correzione silenziosa del vecchio. Un 503 non basta a decidere: usare errorCode+outcome e, se il corpo non è attendibile/contrattuale, trattarlo come U.

| Caso / errorCode | HTTP e outcome | Persistenza | Retry e requestId | Conferma / comportamento utente |
|---|---|---|---|---|
| JSON/schema/campo vietato/identificatore invalido `invalid_request` prima di claim | 400 not_accepted | N | correggere payload; nuovo ID per messaggio cambiato; non loop automatico | mostrare errore; utente corregge il contenuto se necessario |
| versione non supportata `unsupported_contract` | 400 not_accepted | N | nessun retry identico; aggiornare client; nuovo turno solo dopo riallineamento | conservare testo, nessun downgrade/fallback automatico |
| token mancante/scaduto `unauthenticated` | 401 not_accepted | nessuna mutazione di request esistenti | refresh una volta tramite flusso auth esistente; poi stessa request/ID; se serve, login | login se refresh fallisce; con utente diverso mai replay della vecchia coda |
| non abilitato `pilot_not_enabled` / accesso negato `forbidden_*`, `agent_mismatch` | 403 not_accepted | richiesta esistente intatta | nessun retry automatico; stessa request solo dopo accesso ripristinato e controllo stato/scadenza | nessun bypass via altro motore; sessione corretta/nuova agente richiede scelta esplicita |
| kill-switch `service_disabled` | 503 not_accepted | nessuna mutazione del risultato esistente | stessa request dopo riattivazione e get_request; nessun nuovo ID per aggirare stop | possibile scelta esplicita del legacy, con contesto separato |
| accesso non verificabile `access_unavailable` | 503 not_accepted | nessuna mutazione | backoff limitato, stessa request; dopo login/rete verificare ricevuta | nessuna conferma per retry identico, niente letture CRM senza accesso |
| sessione assente/scaduta/non visibile `session_unavailable` | 410 expired | sessione non creata dal turno; dati scaduti non riattivati | vietato retry operativo vecchio ID; create_session + nuovo turno | nuova sessione e riconferma della richiesta, soprattutto date relative |
| stesso ID, hash diverso `request_id_reused` | 422 not_accepted | originale P/D/E non alterato | get_request dell'originale; non correggere hash in posto; nuovo ID solo se davvero nuovo turno | evidenziare conflitto, riconferma contenuto; niente fallback |
| lease vivo `request_in_progress` / worker perde token `lease_lost` | 409 recoverable | P oppure vincitore già D, mai scrittura del perdente | get_request, backoff con retryAfterMs; stesso ID; se D recuperare risposta | nessuna conferma per recupero identico |
| `revision_conflict` al load O al commit | 409 committed | D errore; nessun piano/stato del perdente; vincitore intatto | replay stesso ID restituisce quel 409; get_state corrente; eventuale NUOVO ID | riconferma obbligatoria; mai rebase automatico di sì/consensi/azioni |
| domanda non attuale `unknown_question` | 409 committed | D errore; nessuna revisione incrementata | get_state; vecchio ID solo replay; nuova risposta con nuovo ID | rispondere alla domanda ora visibile, nessun trasferimento automatico del consenso |
| contesto temporale/CRM incompatibile `context_changed` | 409 committed | D errore; stato invariato | get_state e rivalutazione; nuovo ID solo dopo conferma | mostrare cosa è cambiato senza divulgare dati altrui |
| versione recovery incompatibile `engine_changed` | 409 committed | D errore, niente LLM nuovo sulla stessa request | snapshot aggiornato e nuovo ID | riconfermare; mai reinterpretare un output storico con regole non compatibili |
| errore semantico `invalid_request` scoperto dentro U1 dopo claim | 400 committed | D errore, stato invariato | stesso ID solo replay; correzione come nuovo turno | messaggio corretto dall'utente; zero planner |
| timeout LLM / rete/429/5xx provider, slot residuo `llm_retryable` | 503 recoverable + retryAfterMs | P; riserva consumata, nessun output applicato | backoff e stessa request; seconda riserva atomica entro deadline | nessuna conferma per recupero identico nel budget già previsto |
| budget finito senza output `llm_budget_exhausted` | 503 committed | D errore, stato invariato; conteggi conservati | nessun altro invio su quell'ID; nuovo turno/ID solo esplicito | confermare riformulazione/riprova con nuovo budget; non automatica |
| JSON/schema/output vuoto invalido `llm_invalid_output` | 502 committed | D errore; raw invalido non persistito; slot consumato | vecchio ID solo replay; nuovo ID per riformulazione | informare, riformulazione esplicita; nessun repair call nascosto |
| provider/config non recuperabile `llm_unavailable` | 503 committed | D errore, stato invariato; nessuna prova con credenziali alternative | attendere ripristino; poi nuovo turno/ID confermato | niente dettagli sensibili, nessun fallback automatico |
| catalogo/CRM/settings/routing temporaneamente indisponibile `dependency_unavailable` | 503 recoverable | P; output già salvato conservato, sessione invariata | stesso ID entro deadline, ricarica verificata; nessun LLM se output presente | nessuna conferma per recupero identico; non mostrare zero candidati fittizio |
| errore DB con rollback ACCERTATO `storage_retryable` | 503 recoverable | P se claim già esiste, altrimenti N; zero scritture parziali | stessa request; verificare ricevuta prima di ripartire | nessuna conferma, nessun nuovo ID automatico |
| ACK claim/begin_llm/store/commit perso, timeout rete client, 502/503 gateway senza contratto `outcome_unknown` | nessuna risposta HTTP certa, oppure 503 unknown dal handler | U: DB può avere N/P/D; non dichiarare rollback | get_request e stesso POST/ID; mai nuova identità per superare l'incertezza | attesa/recupero, nessuna conferma di un risultato non verificato |
| errore interno deterministico inatteso `internal_error` con finalizzazione disponibile | 500 committed | D errore, sessione invariata; se finalizzazione incerta diventa U | replay identico; nuovo turno solo dopo diagnosi/ripristino | non suggerire ripetizioni illimitate o cambiare motore di nascosto |
| deadline elaborazione superata `processing_expired` | 503 committed | P→D errore sotto lock, token revocato, stato invariato | vecchio ID solo replay nella finestra; nuovo ID dopo get_state | riconferma richiesta e riferimenti temporali |
| risposta oltre finestra replay `request_expired` | 410 expired | E/tombstone; nessun reset contatori né nuova elaborazione | get_state/get_plan se disponibili; nuova richiesta solo se necessaria | riconferma, avvertire che il vecchio turno potrebbe essere già riuscito |
| get_plan inesistente/scaduto/non della sessione `plan_unavailable` | 404 not_accepted (lettura) | nessuna scrittura, nessun turno | ripetere lettura solo per problema transitorio noto; nuovo piano richiede nuovo turno | non rigenerare automaticamente; riconfermare per nuova pianificazione |

Esiti applicativi `pending_question`, `blocked`, `needs_consent`, `planned`: HTTP 200 **committed**, D, revisione +1, zero/uno piano secondo esito. Un blocco non è un errore di trasporto: si mostrano motivi/notApplied e domanda; il successivo intervento dell'utente è un nuovo turno/ID. Ogni risposta error con accesso valido espone revisione snapshot se disponibile, mai uno stato inventato per riempire campi mancanti.

## 5. Scadenze, conservazione e pulizia (proposta di prodotto D5)

| Dato / orizzonte | Politica precisa proposta |
|---|---|
| pending elaborabile | massimo 5 min da accepted_at, anche attraversando più worker; letture/get_state/retry non estendono la deadline |
| risposta completa e payload hash replay | 7 giorni da accepted_at, non dal retry; response_expires_at fisso comunicato al client |
| output LLM e catalogo interpretativo | eliminati nella finalizzazione terminale; se crash, non oltre scadenza pending + prima pulizia autorizzata; mai necessari per replay done |
| tombstone request | dopo 7 giorni eliminare body/testo/context, mantenere coppia ID, hash, esito terminale minimo, revisioni, scadenze e contatori fino a eliminazione sessione; non si reinserisce quella coppia |
| sessione con almeno una request accettata | 30 giorni dall'ultimo commit applicativo, oppure dalla creazione se non c'è ancora alcun commit applicativo; letture, errori e retry non prolungano questa scadenza |
| sessione mai usata | 24 ore dalla creazione SOLO se non esiste alcuna request accettata; un turno fallito a rev0 conta come uso, quindi le sue ricevute seguono la finestra normale |
| piani | 30 giorni dalla creazione, comunque non oltre la vita della sessione; immutabili, con planRevision distinta dalla revisione corrente |

Alla creazione sessions.expires_at è creation+30gg; la scadenza effettiva aggiuntiva di 24h per una sessione mai usata è calcolata sotto lock verificando l'assenza di request. La prima claim prima delle 24h elimina quella sola condizione di inutilizzo tramite l'inserimento della request, senza modificare stato/revisione/updated_at della sessione. Un commit applicativo aggiorna poi expires_at a commit_time+30gg. Le risposte espongono sempre la scadenza effettiva calcolata dal server.
L'applicazione controlla le scadenze logiche a ogni operazione anche se il job di pulizia non è ancora passato. Dopo scadenza sessione, qualsiasi turn/get_state/get_request/get_plan riferito a quell'ID è respinto: sessioni eliminate non vengono ricreate. Solo create_session genera un diverso UUID. In questo modo la scadenza fisica non azzera il budget di una vecchia identità.
La pulizia di request pending usa lock/deadline e revoca il token; non elimina righe con lease/elaborazione ancora validi. Le cancellazioni fisiche sessione/FK sono ordinate e atomiche. Non eliminare una risposta solo per una riga di manutenzione incompleta: usare il suo response_expires_at.
Il job tecnico con privilegi di manutenzione è un'attività futura da autorizzare nell'ambiente scelto, non un timer applicativo, né un job creato da questo documento. Finché non è predisposto, dichiarare che la scadenza di accesso è garantita ma la cancellazione fisica tempestiva NON è certificata. La release che promette retention dei dati richiede anche prova del job.

**Retry tardivo Mobile:** la coda conserva payload congelato, requestId, sessionId, UID/agente e scadenza server conosciuta. Oltre replay expiry non reinvia il turno: legge stato/piano se consentito e chiede conferma per una nuova richiesta. Dopo session expiry apre nuova sessione solo su scelta esplicita. Testi offline mai accettati dal server non hanno accepted_at: sono bozze, da riconfermare prima dell'invio (in particolare «oggi/domani»). Non si deduce la data affidabile da UUID o clock del dispositivo.
Replay di una vecchia risposta done non deve far regredire UI/revisione: conservarla come ricevuta del turno, poi get_state se esiste uno stato più recente. Un 409 committato può contenere una revisione storica; non usarla per un rebase cieco.

## 6. Matrice di test PREVISTA, non eseguita

Tutti i test sono futuri. L1/L2 usano LLM/routing **MOCKED** e fixture CRM sintetiche; i contatori controllano gli invii simulati, non fatturazioni reali. L3 usa azioni senza LLM oppure stub solo negli ambienti consentiti. `+0/+1` sotto indica variazione della sessione, non numero di tentativi. Ogni errore verifica HTTP/outcome, stato request, revisioni, piani, budget, strategia ID e conferma come §4.

| ID | Sequenza / guasto concreto | Atteso verificabile | Livello previsto |
|---|---|---|---|
| T01 | create_session → primo turn | sessione rev0 già presente prima di claim; FK/policy valide; turno +1, non doppio INSERT sessione | L1/L2/L3 |
| T02 | ACK creazione perso → nuova creazione; turn verso ID inventato o sessione eliminata | eventuali due bozze VUOTE con ID diversi; ID assente 410, nessuna creazione da turn, zero LLM | L1/L2/L3 |
| T03 | expectedRevision vecchia prima dell'LLM | 409 D, +0, zero LLM/piani; replay stesso 409; get_state e conferma nuovo ID | L1/L2/L3 |
| T04 | due requestId alla stessa revisione, entrambi superano load, poi commit concorrenti | uno 200 D e uno 409 D, totale +1 e massimo un piano nuovo; nessun perdente pending | L1/L2/L3 |
| T05 | errore terminale 503 con sessione esistente | D solo request, stato/rev/updated_at/lastPlanId invariati; nessun insert piano | L1/L2 |
| T06 | errore SQL iniettato dopo UPDATE sessione/prima di fine commit | rollback completo sessione+piano+request; output precedente resta; retry stesso ID | L2 |
| T07 | commit riuscito, ACK HTTP perso | get_request vede D; stesso POST restituisce HTTP/body identici, +0 extra, zero nuovo LLM/planner | L1/L2/L3 |
| T08 | lease45s, catalogo lento, begin a t40; poi takeover | rinnovo/residuo impedisce avvio su lease corto; in caso pausa successiva vale fencing, non promessa no-overlap | L1/L2 |
| T09 | provider continua dopo timeout locale; takeover mentre prima chiamata ancora attiva | sovrapposizione simulata ammessa, riserve <=2; un solo output committato, +0 oppure +1 | L1/L2 |
| T10 | worker A si risveglia con vecchio token e tenta renew/store/commit dopo B | tutte le scritture di A respinte; B intatto; recupero ricevuta senza nuovo ID | L1/L2 |
| T11 | tre crash prima di begin_llm, entro deadline, poi successo | processing_attempts cresce, riserve 0 fino all'ultimo; poi una sola chiamata, successo possibile | L1/L2 |
| T12 | begin_llm ripetuta stessa invocationId e ACK perso | una sola riserva, mayDispatch false sui replay, nessun invio su ACK incerto; mai rimborso slot | L1/L2 |
| T13 | riserve LLM concorrenti diverse, oltre il limite | massimo due ammissioni; terza rifiutata atomicamente; reset contatore/direct update vietato | L2 |
| T14 | crash dopo output ricevuto/prima store, ripetuto due volte | <=2 invii, nessun output mostrato/applicato; budget esaurito 503 D, +0 | L1/L2 |
| T15 | store_llm riuscito, crash prima di apply/commit, più takeover | zero invii aggiuntivi; budget non legato al numero takeover; stesso contesto interpretativo | L1/L2 |
| T16 | «domani» accettato 15/10 23:59, recupero 16/10 dopo mezzanotte; variante DST | data interpretativa resta 16/10, non 17/10; clock server ancorato, senza alterare U1 | L1/L2 |
| T17 | output salvato, evento nominato/diritti cambiano prima del recupero | autorizzazione ricontrollata; diniego attuale oppure 409 context_changed, mai vecchi permessi congelati | L1/L2; subset L3 autorizzato |
| T18 | routing ricalcolato prima commit / engine incompatibile sul takeover | nessuna promessa di piano identico precommit; criteri rispettati o 409; done invece replay byte-identico | L1/L2 |
| T19 | 503 terminale con budget2 e sessione ancora viva/immutata, anche rev0; retry all'ottavo giorno | 410 request_expired, tombstone impedisce nuove riserve; contatore non riparte; sessione con request fallita non eliminata come mai usata dopo24h | L1/L2 |
| T20 | successo al giorno0, altri turni, poi retry oltre7 giorni | 410 non rielabora; get_state corrente; niente downgrade UI né recupero falso della vecchia revisione | L1/L2 + client |
| T21 | sessione scaduta/eliminata; replay del primo turno expectedRevision0 | 410, nessuna resurrezione con stessa identità; nuova sessione/ID richiede conferma | L1/L2 |
| T22 | cleanup concorrente, lease vivo vs deadline/retention raggiunta | nessuna eliminazione di pending valido; terminalizzazione scaduta atomica; nessun commit tardivo | L2 |
| T23 | payload1.1 validato → bridge U1; versioni non supportate | U1 riceve semantic-1.0; response1.1; unsupported 400 N e zero LLM; v7 invariata | L1/L2/L3 |
| T24 | get_state/get_request/get_plan, resource altrui e piano scaduto | snapshot corretto; receivedHTTP distinto originalHTTP; zero LLM/revisioni; 410/404 non enumeranti | L1/L2/L3 |
| T25 | partenza esplicita nel turno1, modifica criteri nel turno2 senza coordinate, GPS diverso nel retry | partenza conservata; GPS non sovrascrive; payload cambiato con stesso ID 422 | L1/L2 + client |
| T26 | output invalido/timeout/provider401/errore CRM/routing | tutti i rami §4 distinti, stato invariato negli errori, niente repair nascosto o candidati vuoti fittizi | L1/L2 |
| T27 | domanda aperta, action senza LLM, blocco categorie, proposta consenso | zero planner con pending; zero LLM per action; domanda persistita rispondibile; no piano corrente obsoleto | L1/L2/L3 |
| T28 | interpretazione + proposeExpansion nello stesso turno | una sola revisione persistita +1; ID/turn domande coerenti; risposta e piano allineati | L1/L2 |
| T29 | Mobile «sì» su vecchio contesto, Web avanza, Mobile riceve409 | snapshot ricaricato, nessun reinvio automatico; consenso solo dopo nuova conferma/ID | L1/L2 + Web/M4 |
| T30 | coda Mobile offline >7 giorni / testo mai accettato / logout e altro UID | non replay automatico scaduto; bozza riconfermata; nessuna coda attraversa utenti/agenti | kit L1 + Web/M4 |
| T31 | 401 refresh riuscito/fallito; 403; 422; 503 con/senza corpo contrattuale | stessa request dopo refresh valido; nessun fallback indiscriminato; 503 ignoto → ricevuta, non nuovo ID | kit L1 + Web/M4 + subset L3 |
| T32 | UI già rev8, arriva cached rev6 o cached409 storico | nessun regresso criteri/piano; ricevuta storica distinta; get_state autorevole | kit L1 + Web/M4 |
| T33 | stesso input/stato/clock/catalogo/output simulato, platform web vs mobile | stesso prompt/regole/hash/esito; stessa request done → body identico; chiamate indipendenti non obbligate uguali | L1/L2/L3 kit + M4 |
| T34 | 10 POST identici paralleli senza guasti, poi retry sequenziale | una riserva per messaggio (zero per action L3), un commit, altri in_progress/cached; piano una volta; bytes finali identici | L1/L2/L3 consentito |
| T35 | pool sintetici attesi, soglie/DST/omonimi/status NULL/dedup/pagine | uguaglianza di set, differenze SQL/TS/legacy documentate; categorie non certificate restano bloccate | L1/L2 |
| T36 | estrazione D3(a), porte AI/store vietate nel planner, regressioni U1/v7 | U1 232 e suite v7 PASS, golden v7 invariati, nessuna interpretazione/persistenza dentro planner | L1/L2 |
| T37 | kill-switch/accesso revocato dopo un risultato committato | replay bloccato da accesso attuale, D intatta; nessun bypass, no LLM/CRM operativo | L1/L2/L3 |
| T38 | deadline superata con worker ancora vivo; errore ripetuto senza nuove chiamate | 503 processing_expired D, +0; lease revocato; nessun successo tardivo; retry non estende scadenze | L1/L2 |
| T39 | confronto prima risposta vs replay dopo serializzazione DB; doppia finalizzazione | HTTP/body byte-identici, ms/ID congelati; done immutabile; nessun secondo piano | L1/L2/L3 |
| T40 | backend PASS L1/L2 ma L3 non disponibile o Mobile non integrato | report non dichiara Edge/Mobile certificati; attivazione resta bloccata nei livelli mancanti | verifica runbook U2-f |

## 7. Web e Mobile, soltanto dopo il backend

### W1 — Trasporto e sessione
- Client nuovo `src/lib/gptour-semantic/client.ts`, contratto/golden condivisi. Creazione esplicita; snapshot server; requestId UUID per nuovo turno, oggetto congelato per retry incluso GPS.
- Persistenza della request in volo e ricevute per UID/agente/sessione; nessuna logica di criteri locale. Non basta conservare solo la revisione. Logout/cambio utente interrompe chiamate e cancella coda e stato locale; risultati tardivi ignorati tramite identità/sessione/generazione richiesta.
- `request_in_progress`/errori recoverable: backoff con jitter e retryAfterMs (es. 1/2/4/8s, massimo 10s e non prima del minimo server), stesso ID fino a deadline. App in background non tiene worker attivi: riprende con get_request al ritorno.
- Dopo processing_deadline sono ancora consentiti letture/replay e un POST identico di sola finalizzazione della request scaduta: nessuna nuova elaborazione o riserva LLM. Se anche la finalizzazione ha esito di rete incerto, continuare il recupero della stessa ricevuta entro response_expires_at, non creare un turno nuovo automaticamente.
- Esito di rete ignoto: get_request. D → ricevuta; P → attendi o stesso POST; not_found con sessione viva → stesso POST congelato; E/sessione indisponibile → stop e conferma. Non inferire «mai eseguito» da un timeout.
- Conflitto: get_state completo, nessun aggiornamento locale della sola expectedRevision e nessun reinvio automatico. Il nuovo turno nasce da conferma sul contesto corrente.
- Errori/refresh/fallback esattamente secondo §4. Cambio esplicito al legacy apre contesto separato, non trasferisce consensi/pending/piano come equivalenti; avverte se una request semantica è ancora incerta e ne conserva la ricevuta recuperabile.

### W2 — UI
- Pila domande, domanda attiva, dismiss, notices e criteri restituiti dal server; consenso con date e questionId esatti. Unknown_question non diventa «sì» testuale su altra domanda.
- Criteri blocked/notApplied con rimozione esplicita, stato elaborazione/recupero distinto dall'errore definitivo. Nessuna anteprima non committata.
- Piano e mappa esistenti, badge verified/estimated, piano storico distinto dalla revisione attuale. Nessun ricalcolo sul client.
- Selettore solo per utenti abilitati; legacy e v7 intatti. data-testid univoci per interazioni e stati critici.
- Accettazione prevista: Vite verde, nessun nuovo type error rispetto ai 516 storici (nessuna pulizia globale), Playwright L2 con mock controllati, responsive e casi T25/T29–T33. Non eseguita ora.

### W3 — Abilitazione semantica
- Controllo additivo in `/users/gptour-access` mediante nuova RPC admin; agente non può autoabilitarsi. Non alterare RPC/gestione Fase 6 esistente. Richiede autorizzazione nella successiva fase implementativa.

### Mobile
- Senza repository: handoff autonomo U2-f e kit di conformità/replay. NON equivale a integrazione nativa.
- **M1:** client nativo stesso contratto/§4, sessione per uid:agentId, ricevuta e coda persistite; cancellazione al logout, scadenze e richieste obsolete gestite come W1.
- **M2:** stessa semantica domande, consensi, notices, errori definitivi/recuperabili, piani e cambio motore esplicito.
- **M3:** platform=mobile solo diagnostica; GPS/partenza con stesse regole e corpo congelato; nessun ruolo/identità dichiarata nel payload.
- **M4:** golden in CI, E2E emulatore contro L3 autorizzato, background/resume, rete instabile, due dispositivi, scadenze e logout. Report separato da Web e kit backend.
- **M5:** eventuale release store, fuori perimetro. Accesso/scrittura Mobile sempre separatamente autorizzati.
- Prima di M1 il team fornisce framework/versioni, HTTP client, gestione token esistente, CI e processo release; non si deducono dallo snapshot esterno.

## 8. D1–D5 e sole scelte ancora richieste al proprietario

| Decisione | Proposta mantenuta nella rev.3 | Stato |
|---|---|---|
| D1 | Edge separata `gptour-semantic`, v7 non ridistribuita | direzione del piano, nessuna autorizzazione a deploy |
| D2 | tabelle U2 separate, nessun riuso delle conversazioni/storage v7 | direzione del piano, nessuna migration autorizzata |
| D3(a) | estrazione additiva planner senza interpretazione o persistenza v7, golden obbligatori | proposta tecnica scelta per il piano; non viene aperta una nuova scelta D3(b) |
| D4 | output persistito prima dell'applicazione; tetto atomico MAX_LLM_DISPATCHES=2 distinto dai takeover | protocollo precisato; massimo numero di invii da accettare come prodotto, non promessa di un tetto monetario |
| D5 | lease45s/rinnovo15s/timeout12s/deadline5min; replay7gg, sessioni/piani30gg e tombstone per vita sessione | valori tecnici da misurare; orizzonti dati/offline da approvare come prodotto |

**Scelte di prodotto ancora aperte (non questioni SQL da scaricare sull'utente):**
- **P1 — Regole commerciali U2-e:** definizioni e divergenze effettive, specialmente categorie, storico ordini/visite, territorio/eccezioni e copertura. Presentare la tabella delle regole prima di codificare filtri controversi.
- **P2 — Costo/esperienza di recupero:** proposta fino a due invii per request, eventuale sovrapposizione esterna dichiarata, secondo invio transitorio automatico nel budget; nuovo budget solo con conferma. L'alternativa di prodotto è tetto1 con più rinunce al recupero, non una promessa exactly-once.
- **P3 — Retention/offline:** proposta replay7gg e sessione attiva30gg dall'ultimo commit, piani massimo30gg, tombstone minime finché esiste la sessione (anche se attiva più a lungo). Confermare compatibilità con uso offline e politica dati; non cancellare tombstone prima della sessione continuando ad accettare gli stessi ID.
- **P4 — Pilota:** utenti e sottoinsieme iniziale delle capacità certificate da abilitare, solo dopo i report. Nessuna categoria non verificata viene abilitata per completare artificialmente il pilota.

**Scelte/autorizzazioni di ambiente ancora aperte:**
- **E1:** autorizzazione a predisporre L2 effimero fuori repository.
- **E2:** scegliere L3-a/L3-b/L3-c, accesso alla macchina/progetto, versione runtime e disponibilità di ambiente test-only. In produzione nessuno stub e nessuna prova invasiva senza autorizzazione specifica.
- **E3:** autorizzazioni successive e distinte per migration/Edge, abilitazioni/secrets, job di pulizia, eventuali query production read-only e chiamate LLM reali. Nessuna è implicita nell'approvazione del documento.
- **E4:** accesso e dati tecnici del repository Mobile, poi test nativi e release separati; eventuale pubblicazione Web/push separatamente autorizzati.

Non richiedono una nuova scelta di prodotto: HTTP/errorCode, uso dello stesso ID nei retry, no rebase automatico, separazione commit/errori, vincoli atomici e adattamento U1. Sono prescrizioni tecniche di questa proposta. Le misure L3 potranno adeguare i budget temporali tecnici documentando l'effetto sulla UX, senza ampliare da sole budget LLM o retention approvati.

## 9. Ordine operativo futuro e criterio di consegna

```text
approvazione perimetro + P/E pertinenti
  → U2-0 → U2-a → U2-b → U2-c → U2-d
  → U2-e (regole → fixture → insiemi → divergenze → capacità)
  → U2-f/L1-L2 (contratto, recovery, non-regressione, kit, runbook)
  → L3 autorizzato → U2-f/L3
  → W1 → W2 → W3; handoff/kit già pronto → M1..M4 con accesso Mobile
  → eventuale attivazione/pubblicazione/release, SOLO su autorizzazione separata
```

Non eseguire ora alcun passo della sequenza. Non effettuare commit per «congelare» il piano senza richiesta. La consegna di questo turno è esclusivamente la revisione 3 di questo documento e il riepilogo in chat.
Verifica documentale prevista per questa consegna: presenza degli otto raccordi, U2-f con attività e accettazione, matrice HTTP/persistenza/retry/ID/conferma, matrice test non dichiarati eseguiti, D1/D2/D3(a) e invarianti U1/v7. Confronto read-only delle impronte dei sorgenti/test protetti; nessuna build o suite applicativa necessaria a dichiarare modificato un piano.