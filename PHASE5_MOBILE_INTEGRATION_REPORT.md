# GPTour Orchestrator — Fase 5 MOBILE

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