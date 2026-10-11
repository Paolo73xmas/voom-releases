# GPTour Orchestrator — Fase 5 MOBILE

## Aggiornamento: primo collaudo live autorizzato concluso — 11 ottobre2026

**7/25 invocazioni Edge, tutte con risposta; autentica Pirone reale riuscita una sola volta.** Moduli effettivi del client (trasporto/binding/coordinatore/storage isolato) eseguiti in Node contro Supabase principale. Domanda follow-up, include_all, piano, secondo turno ore08, idempotenza, recupero get_plan e conflitto409 superati.

- Risultato server:13tappe (8esistenti+5nuovi),79,7km,07:00–15:53; secondo piano08:00–16:53,30min pausa,2704coordinate, **routingOSRM verified_routing**. Follow-up fuori area segnalati e non inseriti dal motore.
- Engine0.2.0/contratto1.0 osservati; **pubblicazione v6 non verificata indipendentemente**. Fixture P1 Web completa ancora necessaria alla parità esatta.
- **UI live/Android/iPhone nativi NON testati**, pilotaappOFF. Nessuna modifica al codice operativo, credenziali/env/DB/RLS/Edge/secret; nessun push/merge/OTA/deployment/pubblicazione.
- Osservate1sessione,3revisioni,2planId; conteggio delle righe DB tecniche non effettuato. Nessuna richiesta diretta di scrittura CRM; nessun auditDBprima/dopo da dichiarare.
- Iniziale errore preflight delsolo harness su chiavepublishable risolto prima di qualsiasi login; incidente0Auth/0Edge conservato. Totale effettivo finale **1login+1getUser e7Edge**, non due login.
- Rapporti autorevoli della fase: **`PHASE5_MOBILE_LIVE_TEST_REPORT.md`**, **`PHASE5_MOBILE_NATIVE_TEST_INSTRUCTIONS.md`**, `test_reports/phase5_live_first/`, `test_reports/iteration_75.json`.

**STOP attuale: fase autorizzata terminata, nessun'altra chiamata senza nuove istruzioni.** Le sezioni successive descrivono la consegna offline precedente e conservano la propria provenienza storica.

## Consegna aggiornata dopo handoff API 1.0 — 11 ottobre 2026

**Adeguamento client e collaudo isolato completati nei casi verificati. Collegamento live intenzionalmente SPENTO.**
Questo aggiornamento prevale sulle sezioni storiche più sotto: l'handoff non è più mancante e il binding non è più `null`. Non equivale a certificazione della Edge v6 reale né di Android/iPhone fisici.

### A. Fonte, Git e perimetro
- Pacchetto ufficiale: `gptour-orchestrator-mobile-handoff-2026-10-11.zip`, SHA256 `4be8cc369258536939d5752f9c86128c42f1bb2b78c3f4bd452456d1397450f6`, 26 file estratti separatamente. Il codice incluso è stato letto, **non eseguito/importato come implementazione mobile**.
- Fonte prevalente: `MOBILE_API_HANDOFF.md`, contratto1.0, engine `gptour-orchestrator/0.2.0`. Reference web analizzata, non trapiantata. Versione pubblicata v6 e risultati web dichiarati nell'handoff, non verificati con richieste reali.
- Copia documenti/esempi/fixture anonimizzate: `frontend/tests/fixtures/official-handoff/gptour_mobile_handoff/`. Manifest SHA256 dei sette esempi JSON confrontato con gli originali estratti: PASS.
- Branch locale `main`, autorizzato; ultimo HEAD letto durante questa verifica: `f1e0e8762625a91233f895126955ef7b382d1881`. `879333badd5821c1fd5572ed54781818a2e6a3a7` è suo antenato (`merge-base --is-ancestor`, exit0). Non è una perdita della base conflict: HEAD include la predisposizione successiva.
- Nessun remote/upstream/pushurl configurato localmente. Nessun nuovo controllo remoto in questa fase; SHA remoti della sezione storica sono riferimenti datati, non certificazione aggiornata. Destinazione futura ammessa soltanto **`origin/conflict_170826_1303`**, fast-forward, previa autorizzazione; mai main remoto/force/merge.
- Nessuna operazione Git write manuale, nessun push/merge/OTA/pubblicazione. Nessun cambiamento Supabase, Edge, DB, RLS, authStore, backend, manifest/lockfile/env/Metro.
- Controllo byte-per-byte rispetto a `f1e0e876`: **10011 file tracciati frontend/backend**, esclusi i moduli Orchestrator e il layout deliberatamente modificati, nessuna differenza inattesa. GPTour legacy e tutte le sue correzioni commerciali preservati.

### B. Matrice contratto → implementazione mobile

| Funzionalità prevista | Stato mobile | Compatibilità/API1.0 | Modifica effettuata / residuo |
|---|---|---|---|
| Envelope/JWT/identità | Implementato | Verifica offline PASS | Client Supabase esistente, whitelist, no ruoli/service_role, nessuna nuova auth |
| Sonda pilota | Implementata, dormiente | Body solo contractVersion;400/403/503 PASS | Probe prima di sessione; flag pilota non abilitato |
| Otto azioni | Implementate | Encoding ufficiale PASS | Obbligo planId per get_plan; `propose_reschedule`, key e optionId esatti |
| Sessioni/revisioni | Implementato | PASS nei casi testati | UUID, una richiesta in volo, persistenza prima dell'invio, revisione server |
| Retry idempotente | Implementato | PASS rete/5xx e replay422 | Body/ID identici; nuovo turno solo con nuovo invio/ID |
| Conflitto409 | Implementato | PASS | Revisione server anche0, niente replay automatico, piano/domande obsolete rimossi |
| Transcript/ripresa | Implementato | PASS | Locale24h, niente piano/geometry salvati; recupero server con planId, mai ricostruzione da chat |
| Logout/account/target | Implementato | Unitari PASS | Pulizia cache locale tramite listener indipendente, rigetto scritture tardive, nuova sessione al cambio agente |
| Target amministrativo | Implementato | Campo ammesso solo UI admin/admincustom | UUID esplicito; nessuna lista/allowlist locale inventata; autorizzazione server |
| Sei stati e messaggi | Implementati | Unitari + UI isolata PASS | planning mostra bozza stimata, terminali senza piano |
| Criteri/domande/follow-up | Implementati | PASS | Criteri e decisioni pendenti visibili; aggregate e individuali senza autoselezione |
| Piano daily/multi-day | Implementato | PASS su fixture sintetiche tipizzate | Sequenze, tempi, km, rientro, pernottamenti, avvisi senza ricalcolo |
| Mappe | Renderer RN predisposto | Coordinate/order/unitari PASS | LAT,LNG, geometry server; assenza geometry solo linea visuale esplicitamente non stradale |
| Dettagli/esclusioni | Implementati | PASS | Ruolo/gruppo, ultimo ordine, pausa/attesa, fuori finestra, esclusi su richiesta |
| Conferma esplicita | Implementata | UI PASS, zero chiamate aggiuntive | Solo locale, solo ready verified; non salva tour o appuntamenti |
| P1 Pirone esatto | NON certificato | Fixture ufficiale incompleta | Non inventate13tappe/geometria; serve piano completo o live autorizzato |
| Legacy | Invariato | Regressioni PASS | Nessun fallback automatico; pulsante esplicito modalità separata |

**Autorità unica:** nessun nuovo parser commerciale/geografico/date, caricamento pool, routing OSRM client, ordinamento, riempimento giornata o calcolo di fattibilità. Le trasformazioni sono esclusivamente di visualizzazione. Conferma locale non equivale a creazione tour.

### C. Dettagli di recovery e scelte conservative
- 403 `pilot_not_enabled` ridotto non pretende campi mancanti e non conferma una revisione nuova. Gli altri403 e i422 completi passano dal decoder strutturale.
- Errori400/401 non vengono ritentati automaticamente.503/500/rete mantengono l'operazione pendente per retry esplicito identico.
- Replay422 conserva la risposta memorizzata senza duplicare il transcript; per tentare un nuovo turno l'utente invia un nuovo messaggio/azione. Non viene simulato un falso successo del replay.
-409 non usa il vecchio get_plan come se fosse l'ultimo piano autorevole: aggiorna revisione, invalida piano/opzioni precedenti e richiede un nuovo invio esplicito. Nessun rebase automatico.
- Il recupero get_plan verifica anche che il planId restituito sia quello richiesto; ammette revisione del piano precedente alla revisione corrente della sessione, mai futura.
- La cache locale non contiene geometry/tappe. TTL24h locale; richieste con esito incerto non vengono scartate automaticamente alla scadenza. Durata cache/TTL server non documentata: gap dichiarato.
- Nuova conversazione genera un nuovo sessionId senza chiamare reset server. Se abbandona una richiesta incerta, la UI avverte che non annulla l'eventuale elaborazione server.
- Nessun polling inventato: planning è una bozza stimata, non un indicatore di job in background garantito.

### D. Test finali effettivamente eseguiti

| Verifica | Esito |
|---|---|
| Test Orchestrator precedenti (astrazione interna) |32 PASS|
| Nuovi test attraverso binding ufficiale/lifecycle/condizioni limite |26 PASS, 5 suite|
| Totale Orchestrator |**58 PASS**, 8 suite|
| Tutte le regressioni applicative, escluso SOLO build_lockfile.test.ts |**426 PASS**, 43 suite|
| Suite integrale |**432 PASS / 6 FAIL / 438**, 44 suite|
| TypeScript tsc --noEmit |PASS|
| Lint mirato codice/test toccati |PASS; avvisi introdotti nei nuovi file rimossi|
| Legacy/config/backend rispetto a baseline |Invariati fuori moduli Orchestrator/layout|
| Emulatore Android / simulatore iOS / device fisici |**NON ESEGUITI**|
| Supabase/Auth/Edge/CRM reali |**NON CHIAMATI**|

I sei errori preesistenti sono elencati separatamente in `test_reports/PHASE5_LOCKFILE_BASELINE.md`; nessuna modifica a lockfile o test per nasconderli. **Non dichiaro verde la suite integrale.** Le suite GPTour acquisti e ultimi ordini sono incluse nella regressione finale; i loro wrapper Vitest restano un test ciascuno, non confondere numero di test con asserzioni interne.

**Unitari:** request esatte/8azioni, limiti payload, probe,403ridotto/completo,422,409,400/401/500/503, errori malformati, coordinate, single/multi-day, planId/revisioni, ripresa,TTL, target, cleanup logout e scrittura locale in volo. Auth/functions sono sostituite SOLO nei test, non nell'app operativa.

**Browser mobile isolato (390×844 e320×568):** UI + binding + trasporto + coordinatore reali, risposte wire iniettate; percorso chiarimento ufficiale → decisione singola follow-up → planning stimato non confermabile → ready → giorno2/esclusi/conferma locale senza chiamate.503 replay body identico;409 revisione20 e invio esplicito nuovo; nuova conversazione; infeasible/blocked/failed senza piano; require/exclude_stop con key esatta; nessun overflow orizzontale. Nessuna richiesta business reale rilevata.

Harness riutilizzabile SOLOtest: `frontend/tests/fixtures/OrchestratorHarness.tsx`. La route temporanea `/phase5-offline-check` è stata **rimossa**. Flag operativo mai attivato; gateOFF verificato separatamente nell'app reale. Il browser non prova Apple/Google Maps, tastiera o lifecycle nativi.

Evidenze:
- `test_reports/phase5_handoff_final/{tsc,lint,vitest-app,vitest-full}.log`.
- `test_reports/iteration_71.json`: primo run, gap copertura ufficiale ancora aperto in quel momento.
- `test_reports/iteration_72.json`: aggiunge12 test; il limite UI del report è superato dai replay main seguenti, senza attivare il pilota.
- `/root/.emergent/automation_output/20261011_201229/`: percorso principale/retry/conflitto/conferma.
- `/root/.emergent/automation_output/20261011_201424/`: stati terminali/azioni tappe/320px.
- `test_reports/phase5_handoff_final/verification.json`: riepilogo consolidato.
- Verifica finale dopo riavvioExpo: `/root/.emergent/automation_output/20261011_201927/`, gateOFF/inputreadonly/senddisabled/harnessassente PASS, zero richieste business. Expo RUNNING, bundle completato. Log server contiene warning deprecazione shadow e messaggi `Cannot pipe to a closed or destroyed stream`; nessun guasto del rendering riprodotto nell'ultima prova. Non sono stati modificati Metro o infrastruttura per tali messaggi.

### E. File interessati dall'adeguamento all'handoff
Nuovi moduli: `lib/aitour/orchestrator/{binding,wire-contract,wire-actions,wire-response,presentation,lifecycle}.ts`, `hooks/useOrchestratorAccess.ts`, `components/aitour/orchestrator/{ServerQuestion,TargetAgentControl}.tsx`.

Aggiornati i moduli Fase5 esistenti: `gptour-orchestrator-api.ts`, `orchestrator/{contract,errors,request,session,storage,view}.ts`, `hooks/useOrchestratorSession.ts`, `app/gptour-orchestrator.tsx`, `OrchestratorScreen.tsx`, `ServerPlan.tsx`. `_layout.tsx` aggiunge soltanto il listener di pulizia cache locale Orchestrator; authStore non modificato.

Test aggiunti: `orchestrator_official_{contract,session,ui_harness,edges,lifecycle}.test.ts`, fixture sintetica tipizzata, harnessUI, documenti/esempi ufficiali e manifest. Il test denominato `ui_harness.test.ts` è una prova del coordinatore/modello, **non** una prova del renderer; quella è documentata dai replay browser separati.

### F. Cosa resta prima del live
Nessuna incompatibilità bloccante riprodotta nei casi offline. Restano: piano P1 completo/parità esatta, versione/autorizzazioni/risposte reali della Edge, durata cache server e QA nativo Android/iPhone. Dettaglio in **`PHASE5_MOBILE_CONTRACT_GAPS.md`**.

Piano separato pronto: **`PHASE5_MOBILE_LIVE_TEST_PLAN.md`**, con precondizioni/consenso anche per sessioni tecniche lato server, budget proposto, matrice emulatori/device, stop su scritture CRM o discrepanze, confronto web/mobile e protezione dati.

**STOP rispettato:** nessuna chiamata live, push, merge, OTA o pubblicazione. Attendere autorizzazione utente al piano reale. Eventuale miglioramento successivo: selettore amministrativo leggibile al posto dell'UUID manuale, usando solo una fonte autorizzata e senza replicare i permessi server.

---
## ARCHIVIO — predisposizione iniziale prima dell'handoff

**Le sezioni seguenti sono conservate come storico. Le affermazioni “handoff mancante”, “binding null” e i vecchi conteggi non descrivono più la consegna attuale.**

## Stato della consegna

**Predisposizione client isolata implementata e testata. Integrazione operativa NON attivata e NON dichiarata completata.**

`MOBILE_API_HANDOFF.md` non è presente; l’utente ha confermato che è in preparazione e ha autorizzato adapter, interfaccia e test con mock. Il binding di produzione rimane `null` e il flag pilota non è abilitato. Non è stato inventato un decoder del contratto server né un formato wire delle azioni.

Nessun push, merge, reset, cambio del branch predefinito, modifica backend/Edge/database, pubblicazione, OTA o attivazione generale.

## 1. Verifiche Git richieste

Verifica ripetuta l’**11 ottobre 2026, 19:03 UTC**:

| Elemento | Risultato verificato |
|---|---|
| Repository sorgente/destinazione prevista | `Paolo73xmas/voom-releases` |
| Branch locale effettivo | `main`, **autorizzato esplicitamente dall’utente dopo il chiarimento** |
| HEAD iniziale | `879333badd5821c1fd5572ed54781818a2e6a3a7` |
| GitHub `refs/heads/conflict_170826_1303` | `879333badd5821c1fd5572ed54781818a2e6a3a7` |
| GitHub `refs/heads/main` | `14b244580db42a2e4bbd1795c5b5df8046135746` |
| HEAD finale verificabile durante questa consegna | `879333badd5821c1fd5572ed54781818a2e6a3a7`; modifiche della Fase 5 nel working tree |
| Remote/upstream/pushurl configurati nel Git locale | **Nessuno** |
| Destinazione ammessa per un futuro push | **Solo `origin/conflict_170826_1303`, fast-forward, previa autorizzazione** |

### Conclusioni precise
- La base locale **è esattamente il codice del ramo conflict**, non quello del vecchio main remoto. Il solo nome `main` locale non identificava un errore di base: la precedente conclusione di blocco è stata corretta.
- Il working tree tracciato era pulito prima dell’intervento; i file non tracciati preesistenti sono stati preservati.
- `git merge-base --is-ancestor` ha confermato che i commit delle correzioni commerciali (`b6f680c3`) e dello smoke precedente (`c84e31a2`) sono inclusi nella base conflict.
- Non esiste una destinazione push leggibile nella configurazione Git di questo workspace. **Non assumo** che un eventuale pannello esterno sia già impostato sul ramo corretto.
- **Non è verificabile dai soli dati Git disponibili** se i push storici furono eseguiti da `main` locale verso conflict, né da quale build furono pubblicate le versioni Android/iPhone. La presenza degli stessi commit prova l’inclusione del codice, non il meccanismo del push o la pubblicazione delle app. Non sono stati interrogati servizi di build/pubblicazione.

Non attribuisco alle modifiche un nuovo SHA Git non ancora verificabile. Hash SHA-256 del manifest ordinato dei **21 file di codice/test della consegna**:
`774aa495c817d6a75b8f542e6e84149063be62403df778057c595dfe5bc68d36`.
È un’identificazione del contenuto, **non uno SHA di commit**. Documentazione e artefatti sono esclusi.

## 2. Analisi del legacy e separazione delle responsabilità

Nel GPTour precedente le seguenti decisioni sono effettuate localmente:

| Modulo legacy | Responsabilità individuata |
|---|---|
| `gptour-data.ts`, `gptour-registry.ts` | Caricamento pool, territori, classificazione e perimetro |
| `gptour-intent.ts`, `gptour-purchase-intent.ts`, `gptour-commercial.ts`, `gptour-criteria.ts` | Interpretazione e filtri commerciali |
| `gptour-planning-pool.ts`, `gptour-purchases.ts` | Verifica acquisti e selezione del pool ammissibile |
| `gptour-api.ts` | Vecchia funzione AI e invio candidati TSV |
| `gptour-engine.ts`, `gptour-routing.ts`, `gptour-development.ts` | Costruzione, ordinamento, routing, orari e completamento |
| `gptour-opportunities.ts`, `gptour-acceptance.ts` | Proposte e aggiunta/rimozione delle tappe |
| `gptour-dates.ts`, `gptour-day-consent.ts`, `gptour-followups.ts` | Date, giornate e decisioni follow-up |
| `useGptour.ts`, `gptour-context.ts`, `gptour-save.ts` | Orchestrazione locale, bozze e salvataggi |

**Il nuovo percorso non chiama questi moduli di pianificazione.** Non carica candidati CRM, non classifica clienti, non interpreta date, non chiama OSRM, non riordina tappe, non aggiunge giornate o soste, non aggiorna follow-up/appuntamenti.

Il codice legacy, le sue schermate e i suoi dati persistiti sono rimasti intatti. Il controllo Git sui file legacy, Supabase/auth, configurazione, manifest/lockfile e backend è passato. L’unico file applicativo preesistente modificato è `_layout.tsx`, con una registrazione Stack aggiuntiva.

## 3. Nuovo adapter HTTP

File: `frontend/lib/aitour/gptour-orchestrator-api.ts`.

- Utilizza il client Supabase già esistente e invoca esclusivamente `gptour-orchestrator`.
- JWT letto dalla sessione Supabase corrente, passato nell’header Authorization. Nessun ruolo, permesso o identità amministrativa aggiunto dal telefono.
- Controllo dell’account prima e dopo la richiesta; una risposta tardiva di un account precedente viene scartata.
- Whitelist dei campi request noti: `contractVersion`, `sessionId`, `requestId`, `expectedRevision`, `message` **oppure** `action`, `targetAgentId`, `departure`, `gps`.
- `targetAgentId` non viene aggiunto per la normale sessione personale. È predisposto come contesto esplicito; l’autorizzazione resta server-side e la UI di selezione target attende le opzioni/garanzie del contratto.
- `departure`/`gps` sono dati opzionali opachi da codificare tramite specifica approvata; **non è stato implementato un formato GPS presunto né una nuova acquisizione della posizione**.
- Nessuna chiave privata/service_role/credenziale AI; nessun log dei token.
- Timeout esteso anche all’attesa della sessione; cancellazione esplicita e controllo delle risposte tardive.
- Nessun retry automatico e nessun fallback al vecchio motore.

### Contratto implementato vs ancora da confermare

Sono predisposti l’envelope noto della versione `1.0`, i nomi delle otto azioni e i sei stati dichiarati dall’utente. **Non sono certificati contro il contratto pubblicato**, che non è stato consegnato né interrogato.

`ContractBinding` richiede esplicitamente:
- codifica delle azioni secondo il formato server;
- decodifica/validazione della risposta;
- politica di revisione per `get_plan`;
- provenienza verificata dell’handoff.

`APPROVED_ORCHESTRATOR_BINDING = null` impedisce qualunque invocazione operativa. I tipi `ServerSnapshot`, `PlanView`, `DayView`, `StopView` e `QuestionView` sono **modelli interni di visualizzazione, NON la dichiarazione del JSON API1.0**. La rappresentazione finale di revisioni e geometria sarà confermata dall’handoff.

La configurazione Supabase esistente corrisponde al progetto `gorwxfzzyzxmxnizmebw` (verifica locale dell’host, senza contatto remoto). La versione **v6** è un dato fornito dall’utente, non una versione verificata live in questa fase.

## 4. Sessioni, revisioni e idempotenza

Moduli `orchestrator/session.ts`, `storage.ts`, `request.ts` e `useOrchestratorSession.ts`:

- UUID di sessione alla prima creazione e nuovo UUID per ogni nuova richiesta.
- Chiavi di persistenza separate per account e target agente.
- Persistenza **prima** dell’invio della richiesta pendente, per poter riprendere lo stesso `requestId` e lo stesso corpo dopo timeout/interruzione.
- Una sola richiesta in volo; un doppio tap non crea una seconda richiesta.
- `expectedRevision` deriva soltanto dall’ultima revisione confermata.
- Stato confermato aggiornato solo dopo risposta validata e persistenza dei metadati riuscita.
- Nello storage non sono salvati piani o cronologie server autorevoli: solo identificativi, revisione e l’eventuale richiesta outbound non confermata.
- Ripresa di sessione confermata tramite `get_plan`; richiesta pendente riproposta con lo stesso ID, non ricostruita dai messaggi locali.
- Conflitto409: nessun replay/rebase automatico della mutazione. Recupero esplicito dello stato usando la politica definita dal binding; la semantica reale deve arrivare dall’AI WEB.
- Logout/cambio account: schermata ripulita, attesa annullata, risultati tardivi ignorati; la riapertura richiede nuovamente una sessione Supabase coerente.
- Lifecycle del hook predisposto per evitare il riuso di un coordinatore già dismesso durante i cleanup React.

Durante il rafforzamento dei test sono stati corretti due casi limite: annullamento mentre `getSession` rimane in attesa e secondo invio bloccato che poteva nascondere il percorso di retry/conflitto originale.

## 5. Interfaccia e mappe

Nuova route separata: `/gptour-orchestrator`.

- Schermata conversazionale con safe area, gestione tastiera, input e controlli touch.
- Rendering dei sei stati: `needs_clarification`, `planning`, `ready`, `infeasible`, `blocked`, `failed`.
- Domande e opzioni provenienti dal modello normalizzato server; nessuna risposta selezionata automaticamente.
- Il piano è mostrato come definitivo **solo in ready**, senza richiesta pendente/errore. Durante un aggiornamento non viene presentato come definitivo il vecchio itinerario.
- Routing stimato/non verificato chiaramente segnalato.
- Tappe, sequenza, arrivo/partenza, trasferimento, visita, attesa, pause, impegni, pernottamenti, metriche e rientro mostrati nell’ordine ricevuto, senza calcoli locali.
- Giorni navigabili tramite selettore: nessun nuovo giorno creato dal client.
- `ServerRouteMap.native.tsx` usa `react-native-maps`: partenza, tappe numerate, geometria ricevuta e rientro. Nessun fetch di candidati, OSRM o ricostruzione della linea.
- Conversione coordinate disponibile solo specificando esplicitamente l’ordine; nessuna deduzione automatica latitudine/longitudine. L’ordine wire effettivo resta da confermare.
- La preview web mostra esplicitamente il limite della mappa nativa; **non è una simulazione dichiarata equivalente a Google/Apple Maps**.
- Pulsante per aprire GPTour classico chiaramente etichettato come scelta di modalità separata: nessun cambio automatico su errore.

Non sono state attivate funzioni di salvataggio/avvio operativo, modifica appuntamenti, acquisizione GPS o navigazione esterna basate su campi non documentati. Non è stata modificata la schermata legacy per indirizzare gli agenti al pilota.

## 6. Errori gestiti

| Caso | Comportamento client predisposto/testato isolatamente |
|---|---|
| Handoff/binding assente | Blocco prima di auth/invoke, invio disabilitato |
| 401 | Messaggio sessione assente/scaduta, niente fallback legacy |
| 403 | Accesso pilota/target negato dal server, niente allowlist locale |
| 409 | Recupero esplicito, non retry automatico della mutazione obsoleta |
| 503 / indisponibilità | Retry manuale stesso body e ID |
| Timeout / risposta persa | Richiesta rimane non confermata; nessun nuovo ID per il retry |
| Risposta malformata / sessione errata / revisione numerica regressiva | Nessun aggiornamento del piano |
| Storage non disponibile | Nessun nuovo invio non tracciabile; richiesta conservata per retry quando possibile |
| Cambio account / chiusura componente | Nessun risultato del precedente account mostrato |

TTL, scadenza delle sessioni, eventuale polling di `planning`, semantica di reset e payload degli errori restano da confermare; non sono stati dedotti arbitrariamente.

## 7. File creati e modificati

### Creati — codice applicativo
```text
frontend/lib/aitour/gptour-orchestrator-api.ts
frontend/lib/aitour/orchestrator/contract.ts
frontend/lib/aitour/orchestrator/request.ts
frontend/lib/aitour/orchestrator/errors.ts
frontend/lib/aitour/orchestrator/coordinates.ts
frontend/lib/aitour/orchestrator/view.ts
frontend/lib/aitour/orchestrator/storage.ts
frontend/lib/aitour/orchestrator/session.ts
frontend/hooks/useOrchestratorSession.ts
frontend/app/gptour-orchestrator.tsx
frontend/components/aitour/orchestrator/OrchestratorScreen.tsx
frontend/components/aitour/orchestrator/ServerPlan.tsx
frontend/components/aitour/orchestrator/ServerRouteMap.native.tsx
frontend/components/aitour/orchestrator/ServerRouteMap.tsx
frontend/components/aitour/orchestrator/controls.tsx
frontend/components/aitour/orchestrator/styles.ts
```

### Creati — test
```text
frontend/tests/orchestrator_api.test.ts
frontend/tests/orchestrator_session_controller.test.ts
frontend/tests/orchestrator_view_normalization.test.ts
frontend/tests/fixtures/orchestrator-fixtures.ts
```

### Modificato — applicazione esistente
- `frontend/app/_layout.tsx`: sola registrazione della nuova route.

### Documentazione
- `PHASE5_MOBILE_CONTRACT_GAPS.md`: richieste tecniche per AI WEB.
- Questo `PHASE5_MOBILE_INTEGRATION_REPORT.md`.
- `memory/PRD.md`, `test_result.md`, nota di consenso nella documentazione credenziali; **nessuna credenziale o account modificato**.
- Report e artefatti di test, elencati sotto.

Nessuna modifica a `supabase.ts`, `authStore.ts`, legacy GPTour, `ai-tour.tsx`, mappe legacy, backend, package/lockfile, `app.json`, configurazioni protette o variabili d’ambiente.

## 8. Test effettivamente eseguiti

### Unitari e statici
| Prova | Esito finale |
|---|---|
| Nuovi test Orchestrator isolati | **32 PASS** (10 adapter, 14 sessione/storage, 8 modello/coordinate) |
| Regressioni applicative + nuovi test, escluso solo `build_lockfile.test.ts` | **400 PASS / 38 file** |
| Suite integrale | **406 PASS, 6 FAIL / 412 test, 39 file** |
| TypeScript `tsc --noEmit` | **PASS** |
| Lint JS/TS dei file nuovi | **PASS** |
| Controllo Git file legacy/config invariati e whitespace | **PASS** |

I sei FAIL integrali sono i test del lockfile **già preesistenti**, documentati nella consegna precedente. Il lockfile e il test non sono stati modificati per nascondere il problema. La baseline applicativa prima dei nuovi test era 368 PASS; non dichiaro verde la suite integrale.

Copertura: autenticazione Supabase simulata, header JWT, isolamento account/target, ID/revisioni, doppio tap, storage prima/dopo risposta, chiusura/ripresa del coordinatore, timeout, cancellazione, 401/403/409/503, recupero esplicito, tutte le azioni come delega al binding, risposte malformate, coordinate, ordine delle tappe e tutti gli stati.

Frasi su clienti inattivi **15/20/30**, tour misti, nuovi, oggi/domani, ore10, Opera e termine alle16 sono verificate come trasmissione **inalterata**: i test non certificano le regole commerciali del backend. I valori server simulati restano inalterati nel renderer; non viene implementato un parser mobile parallelo per oggi/domani o orari passati.

### Browser mobile, 390×844
- Route preparatoria reale: messaggio handoff mancante, input non editabile e invio disabilitato.
- Harness temporaneo con il componente UI reale: chiarimento e scelta → planning → ready; routing stimato; selezione giorno; infeasible/blocked/failed; errore con retry.
- La route temporanea di test è stata **rimossa**. Nessuna fixture è attivata nel percorso operativo.
- **MOCKED SOLO NEI TEST:** Supabase auth/functions, binding artificiale `_fixtureWire`, risposte normalizzate e storage. `_fixtureWire` NON è un esempio del contratto API1.0.

### Android e iPhone — distinzione obbligatoria
| Livello | Android | iPhone/iOS |
|---|---|---|
| Codice React Native e tipi della mappa | Controllo statico PASS | Controllo statico PASS |
| Unitari client condivisi con IO mock | PASS, non prova nativa | PASS, non prova nativa |
| Browser responsive | Eseguito, non emulatore Android | Eseguito, non simulatore iOS |
| Emulatore/simulatore nativo | **NON ESEGUITO** | **NON ESEGUITO** |
| Dispositivo fisico | **NON ESEGUITO** | **NON ESEGUITO** |
| Mappe, tastiera, GPS/lifecycle nativi | **NON CERTIFICATI** | **NON CERTIFICATI** |
| Login/pilota Supabase reale e v6 | **NON ESEGUITI** | **NON ESEGUITI** |

`adb` e `xcrun` non sono disponibili in questo ambiente. Nessuna build o pubblicazione è stata effettuata per aggirare tale limite.

Artefatti: `test_reports/iteration_70.json`, `test_reports/artifacts_iter70/orchestrator_ui_smoke_evidence.json` e screenshot correlati. Il report70 documenta 23 test iniziali; successivamente il main agent ha aggiunto/verificato 9 controlli portando il totale a32.
Output finali: `test_reports/phase5_mobile/tsc.log`, `vitest-app.log`, `vitest-full.log`.

## 9. Web/mobile e richieste all’AI WEB

Nessun confronto live a parità di agente/sessione/orario/versione è stato eseguito. Non è stato riprodotto il pilota Milano e i dati sintetici del test non vengono confrontati con 13 tappe/79,7 km.

Il client è costruito per visualizzare il piano server senza ricalcolo. Per certificare la parità servono il contratto, esempi JSON/golden fixtures e contesto equivalente. Nessun difetto del motore centrale è stato dimostrato; non sono state richieste modifiche autonome al backend.

Richiesta tecnica pronta in **`PHASE5_MOBILE_CONTRACT_GAPS.md`**: schema azioni/risposte, versioni, revisione e conflitti, sessioni/reset/TTL, coordinate/routing, impegni, target agente, polling, operazioni operative e fixtures comparabili. Non è sufficiente sostituire il decoder fittizio con un cast TypeScript.

## 10. Attivazione controllata — NON eseguita

1. Ricevere `MOBILE_API_HANDOFF.md`, verificare versione/JSON/azioni e confrontare con l’implementazione.
2. Implementare un binding **realmente validato**, inclusa geometria, errori, sessioni, target, ripresa e ogni azione; sostituire `APPROVED_ORCHESTRATOR_BINDING = null` solo dopo tale verifica.
3. Eseguire nuovamente fixture conformi al contratto e i test di compatibilità web/mobile.
4. Presentare all’utente un piano separato di test reali (agente autorizzato, sessione isolata, scenario, numero chiamate, nessuna modifica operativa CRM) e **attendere consenso**.
5. Solo dopo autorizzazione, abilitare l’ingresso pilota tramite `Constants.expoConfig.extra.gptourOrchestratorPilotEnabled`; aggiungere una scelta di modalità esplicita per il percorso previsto. Il flag UI **non è un’autorizzazione**: JWT/allowlist restano esclusivamente server-side.
6. Completare QA nativo Android/iPhone e confronto con il web, prima di ogni richiesta di rilascio.
7. Per l’eventuale push autorizzato: verificare nuovamente base e remoto, destinazione esplicita **solo conflict**, aggiornamento fast-forward. Se non è garantibile, fermarsi. **Mai origin/main, mai force push.**

## 11. Rollback di modalità — procedura, NON eseguita

- Disabilitare l’ingresso/flag pilota, senza modificare il motore legacy.
- Il collegamento reale resta disattivato anche se manca il binding approvato.
- L’utente può scegliere esplicitamente «GPTour classico»; errori Orchestrator non effettuano questa scelta automaticamente.
- Metadati Orchestrator e bozze legacy hanno namespace separati; non convertirli né sovrascriverli.
- Nessun reset Git, merge, rollback database o spostamento di appuntamenti è richiesto da questa separazione.

## 12. Problemi aperti e prossima azione

**Bloccanti per l’integrazione definitiva:** handoff completo/contratto verificato, binding reale, prova controllata del servizio pubblicato e QA nativo. Selezione target e operazioni di salvataggio/avvio/navigazione devono seguire esclusivamente il contratto consegnato, non assunzioni del client.

**Preesistente fuori perimetro:** sei FAIL del lockfile.

La predisposizione isolata è verificata; il collegamento operativo rimane intenzionalmente spento. **In attesa dell’handoff e, per test reali o rilascio, di successive autorizzazioni distinte.**