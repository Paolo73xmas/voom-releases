# GPTour mobile — consegna software, prima della verifica nativa

## Stato e limiti della consegna

Implementata una modalità GPTour separata nell'app Expo Android/iPhone. Verificati TypeScript, lint, test isolati e bundle JavaScript per entrambe le piattaforme. **Non è una certificazione di build nativa o dispositivo reale. Nessuna pubblicazione effettuata.**

Nessuna migrazione applicata, nessuna modifica alle regole CRM di assegnazione/orfanizzazione, nessuna chiave AI inserita nel client, nessun secondo interprete FastAPI, nessuna scrittura sui dati CRM reali durante i test. Nessuna modifica a `.env`, Metro, package.json, requirements, app.json o motore JavaScript.

### Basi

- Web: `Paolo73xmas/voom`, `main`, **88bfb440d86ca4103016ed2b5c1ed3416ecf497a**. Ricontrollato anche dopo il porting: nessun commit GPTour successivo disponibile.
- Mobile: `Paolo73xmas/voom-releases`, **conflict_170826_1303**, **cddc85274894eed1ebdbef4597ff1c33cb67c1ad**. Workspace iniziale HEAD95493772, discendente con frontend/backend identici alla base mobile. NON usato main mobile.
- Il lockfile già presente non è stato modificato da questo intervento; le vecchie questioni di snapshot/build remota restano fuori ambito.

## Architettura

```text
AI Tour → nuova schermata /gptour (React Native)
  useGptour: conversazione, bozza, agenda, editing globale, proposte, salvataggio
    ↓ sessione Supabase → ai-tour-gptour (stessa Edge del web)
    ↓ verifica ruolo/subject/risposta strutturata
    ↓ merge TourIntent non distruttivo
    ↓ validazione deterministica / follow-up per evento
    ↓ completamento + identità + multi-day + routing stradale
    ↓ anteprima, conferme, ricalcolo dopo editing
    ↓ area_filter esistente + gptourContext opzionale v1
    ↓ save_tours_batch (singola chiamata atomica)
    ↓ I miei Tour / Tour Live ESISTENTE
```

La dettatura riusa Expo Audio e il servizio `/api/ai-tour/transcribe` già presente. Non è un interprete GPTour alternativo: il testo trascritto viene inviato alla stessa Edge Supabase.

## Funzioni implementate

### Ruoli e contratto Edge

- `agent`/`agentcustom`: solo ID autenticato; tentativo di target altrui rifiutato prima della chiamata.
- `admin`/`admincustom`: selettore agente; target mantenuto nel passaggio ai tour salvati. Parametro target della schermata AI Tour considerato solo per questi due ruoli.
- Altri ruoli non abilitati. `agentcustom` aggiunto alla union UserRole; nessun nuovo privilegio server.
- `effectiveAgentId` obbligatorio e identico al target, non soltanto se presente.
- 403, risposta non valida, orari invalidi e azioni follow-up non riconosciute non producono un nuovo piano.
- Risposte dopo cambio account non applicate; richieste UI concorrenti bloccate.
- Dati elenco agenti malformati: errore recuperabile e ricaricamento, non crash `.find`.

### Intent, dati e filtri

- Tutti i campi richiesti: tipi, contatto fisico/ordine, fatturato, progetto, area, obbligatori/esclusi, espansioni, buffer accettato, rifiuti, ownOrphansOnly, wantAll, maxDays, pernottamento e decisioni per evento.
- Merge dei soli valori definiti, null per reset dove previsto, conservazione rifiuti e consenso alla fine anticipata fino al reset.
- I dati storici derivano da RPC/sessione/RLS; contatto fisico = max(visita,ispezione). Soglie N inclusive; ordini distinti.
- Stato «non verificato» distinto da assenza conosciuta; fonti fallite, cap registro/territori e copertura parziale visibili.
- Caricamento GPTour più rigoroso per progetti, esclusioni commerciali, configurazione/stato orfani e fasce; default legacy invariati perché strict è opt-in.
- Propri orfani marcati dal ramo proprietario e disponibili fuori zona; altri orfani esclusi dal criterio ownOrphansOnly. Nessuna modifica alle regole CRM.
- Filtri anche sulla selezione iniziale, aggiunte manuali e proposte; aree espresse nei criteri trattate come vincoli. Alias provincia normalizzati.
- Dedup per customer ID, tabaccheria ID, identità geografica/nome. wantAll completa il pool idoneo senza delegarne il numero all'AI.

### Agenda

- Keep/exclude sono decisioni del giro per ID evento, non cancellazioni CRM.
- Rinvia: modale con avviso della scrittura reale, data/ora esplicite, verifica sessione/owner/stato corrente, RPC e conferma solo dopo risultato coerente.
- Eventi arretrati riconosciuti; nuovi giorni richiedono nuova lettura dell'agenda.
- Follow-up fuori dal pool territoriale iniziale possono essere recuperati dal portafoglio autorizzato per la decisione obbligatoria.
- Due eventi dello stesso soggetto su date diverse/orari distinti non vengono eliminati silenziosamente: richiedono risoluzione esplicita.
- Appuntamenti restano distinti dai follow-up. Cliente nel giro: slot appuntamento; impegno esterno: tempo riservato e avviso bloccante se il trasferimento non è verificabile. Non si inventano coordinate.
- Chiusura same-day mobile preesistente non modificata; suite legacy ancora verde.

### Planner, saturazione, UI

- Motore GPTour separato: NN, 2-opt sensibile alle fasce, ordine imposto, pranzo, giorni esclusi, controllo orario e rientro.
- Raggruppamento, completezza, ribilanciamento di giornate non vincolate, dedup globale, maxDays e obbligatori datati.
- Pernottamento home/away/condizionale; distanza stradale alla prima tappa reale del giorno dopo; `<` alla soglia; retry limitato; routing_unknown/unstable con scelta prudenziale.
- Corridoio misurato sulla polilinea, non soltanto alle tappe; best insertion e deviazione combinata. Matrice priva di distanze reali non presentata come stradale.
- Proposte, non inserimenti automatici; priorità tipi/geografia prima del cap tecnico; rifiuti ricordati. `max_daily_buffer_minutes` separato da `buffer_max_min`.
- Dataset ISTAT copiato integralmente dal commit web in asset locale versionato, SHA256 `4b8556b205c0449c501d1b48db15693d08792bb4372d031491cf8f1068b57419`.
- UI nativa: chat, voce, criteri, base Casa/Sede/GPS, giorni, elenco, apertura mappa, metriche, avvisi, accetta/rifiuta, aggiunta/rimozione/riordino/spostamento giornata e salvataggio.
- Editing ricostruisce l'intero gruppo e le dipendenze, non soltanto una riga. Obbligatori non rimovibili senza cambiare prima il vincolo.
- Limite tecnico dichiarato: oltre80tappe in una singola giornata si richiede una distribuzione su più giorni, senza scartarne una parte o avviare un calcolo cubico che blocchi il telefono.

### Salvataggio, contesto e Live

- Una chiamata `save_tours_batch` per tutte le giornate, niente fallback a insert separati.
- Contesto opzionale e versionato in `area_filter.gptourContext`, con merge dei campi esistenti: Intent, eventi, pernottamento, routing, gruppo/giorno, date e fatti dei candidati per ripristino.
- Bozza locale per attore/agente. Registro locale scritto PRIMA dell'invio del batch; errore storage impedisce l'invio.
- Esito incerto: niente secondo invio; «Verifica salvataggio» riconcilia gruppo, date e numero giornate. Successi riconosciuti tornano agli stessi ID. Verifica disponibile anche dopo ripresa senza ricostruire il piano.
- L'idempotenza server durevole non è attiva: vedere la proposta SQL sotto. Il comportamento sicuro approvato blocca retry ambigui anziché promettere esattamente-once senza supporto server.
- Tour Live normale, con GPS/visite/ispezioni/ordini e stato tappe preesistenti. Ripristino dati GPTour e filtri per aggiunte/Più Visite; aggiornamento namespace nelle operazioni Live.
- Metadati mancanti/non supportati, candidati estranei, coordinate o data incompatibili: avviso/blocco delle operazioni dipendenti dai criteri, nessuna ricostruzione inventata.
- `replaceTourPlan` preserva anche il JSON corrente quando un editor legacy invia solo i propri campi.
- Verifica STATICA web: normale caricamento da salvato conserva `loaded.tour.area_filter`, ricalcolo usa spread del piano, `planAreaMetadata` fa spread dell'area, Live riusa `ctx.tour.area_filter`. Non rilevata cancellazione integrale del namespace in quei percorsi al commit88bfb44. Il web non applica ancora la semantica del nuovo namespace: non promettiamo editing web semanticamente equivalente dopo le sue modifiche.
- Tour legacy senza namespace continuano sul percorso precedente, senza nuovi campi obbligatori.

## Differenze intenzionali dal web

1. Validazione anche della selezione iniziale e risposta/subject più rigorosi.
2. Criteri geografici rigidi, dati sconosciuti fail-closed, eccezioni da chiarire anziché allargamenti silenziosi.
3. Salvataggio unico atomico e gestione prudente dell'esito incerto, non salvataggi per-giorno parziali.
4. Contesto v1 persistito e bozza locale, preservazione JSON legacy.
5. Ricalcolo globale dopo editing, nessuna perdita silenziosa di eventi CRM.
6. Routing stimato e conflitti di fattibilità impediscono il salvataggio finché non risolti; impegni esterni senza percorso noto restano esplicitamente da verificare.
7. Base mai inventata; se mancano Casa/Sede occorre GPS autorizzato.

## Test ed evidenze

### Automatizzati — esito finale

- `tsc --noEmit --pretty false`: PASS.
- ESLint sui moduli nuovi e sui file applicativi modificati: PASS.
- Vitest completo: **187 test PASS, 17 suite**: **71 GPTour + 116 precedenti**. Incluso errore storage successivo al commit del batch: resta esito incerto, mai un invito a reinviare.
- Coperti ruoli/impersonificazione/403, subject mancante, risposte malformate, Intent multi-turn/reset, soglie29/30/31/null, dati sconosciuti, propri/altrui/fuorizona, espansioni, aree, filtro iniziale, dedup, wantAll/maxDays/ribilanciamento, eventi distinti/keep/exclude/rinvio/errore, required datati, fasce/ordine, saturazione/buffer/costi/corridoio, dataset ISTAT, soglie notte/unknown/unstable, contesto/legacy e batch/incertezza/riconciliazione.
- Le prove del batch sono test degli adattatori con dipendenze isolate: NON prova transazionale eseguita sul database condiviso.
- Testing indipendente: `test_reports/iteration_52.json`, inizialmente178test. Un problema UI rilevato (payload agenti malformato) corretto successivamente e verificato con errore recuperabile+ricaricamento e test unitario.
- L'agente di test ha aggiunto due test di riconciliazione; modifiche lette e incluse nella regressione finale.

### Browser isolato

Tutte le chiamate auth/Supabase/Edge/OSRM della prova intercettate con fixture; nessun account operativo usato, zero scritture CRM reali.

- Accesso agentcustom, nessun selettore di impersonificazione, pool5candidati: PASS.
- UI admin con elenco malformato → errore recuperabile → ricaricamento elenco: PASS.
- Generazione su2giorni, candidato AI sotto soglia fatturato escluso deterministicamente: PASS.
- Proposta accettata esplicitamente, ricalcolo globale e riordino manuale: PASS.
- Apertura contenitore mappa: PASS; caricamento cartografia/marker nativi NON certificato da questa prova (frame iniziale scuro nello screenshot).
- Un'unica RPC simulata,2giorni salvati con contesto v1: PASS.
- Larghezza320px senza overflow orizzontale: PASS.
- Navigazione alla schermata normale I miei Tour, due schede GPTour visibili: verificata nello screenshot finale. L'ultima asserzione testuale dello script ha selezionato un duplicato nascosto del titolo e ha dato timeout; non è stata conteggiata come asserzione automatica riuscita.
- Browser non ha eseguito un avvio Live con scritture né registrazione voce reale/GPS su device.

### Export e build

| Verifica | Android | iOS |
|---|---|---|
| `expo export --no-bytecode` finale | PASS, bundle JS7.62MB | PASS, bundle JS7.63MB |
| Export con compilazione Hermes predefinita | BLOCCATO nell'ambiente | BLOCCATO nell'ambiente |
| APK/AAB/IPA compilato e installato | NON eseguito | NON eseguito |
| Dispositivo reale / simulatore nativo | NON disponibile in questa verifica | NON disponibile in questa verifica |

RCA confermata: host `aarch64`, `react-native/sdks/hermesc/linux64-bin/hermesc` ELF **x86-64**. Nessuna configurazione motore cambiata per aggirarlo. Export senza bytecode = verifica bundle/assets JS, NON build nativa né idoneità pubblicazione.

Log finali: `/tmp/gptour-final-tests.log`, `/tmp/gptour-final-tsc.log`, `/tmp/gptour-final-ios-export.log`, `/tmp/gptour-final-android-export.log`. Export: `/tmp/gptour-final-ios-js`, `/tmp/gptour-final-android-js`.

## File aggiunti — 24 frontend + 1 proposta SQL

```text
frontend/app/gptour.tsx
frontend/assets/data/comuni-adiacenti.json
frontend/components/aitour/gptour/Conversation.tsx
frontend/components/aitour/gptour/FollowUps.tsx
frontend/components/aitour/gptour/Plan.tsx
frontend/components/aitour/gptour/UI.tsx
frontend/hooks/useGptour.ts
frontend/hooks/useGptourVoice.ts
frontend/lib/aitour/comuni-adjacency.ts
frontend/lib/aitour/gptour-api.ts
frontend/lib/aitour/gptour-auth.ts
frontend/lib/aitour/gptour-context.ts
frontend/lib/aitour/gptour-criteria.ts
frontend/lib/aitour/gptour-data.ts
frontend/lib/aitour/gptour-dates.ts
frontend/lib/aitour/gptour-engine.ts
frontend/lib/aitour/gptour-followups.ts
frontend/lib/aitour/gptour-identity.ts
frontend/lib/aitour/gptour-intent.ts
frontend/lib/aitour/gptour-opportunities.ts
frontend/lib/aitour/gptour-routing.ts
frontend/lib/aitour/gptour-save.ts
frontend/tests/gptour_adapters.test.ts
frontend/tests/gptour_core.test.ts
proposals/gptour_idempotency_v1_NOT_APPLIED.sql
```

## File applicativi modificati — 13

```text
frontend/app/_layout.tsx
frontend/app/ai-tour.tsx
frontend/components/aitour/LiveTourView.tsx
frontend/lib/aitour/brief-feasibility.ts
frontend/lib/aitour/brief-live.ts
frontend/lib/aitour/data.ts
frontend/lib/aitour/liveops.ts
frontend/lib/aitour/osrm.ts
frontend/lib/aitour/tours.ts
frontend/lib/aitour/types.ts
frontend/lib/api/orphan-claims.ts
frontend/lib/visit-slots.ts
frontend/store/authStore.ts
```

Documentazione aggiornata: questo documento, PRD, piano, credenziali fixture; report del testing indipendente conservato come evidenza storica, non riscritto per simulare un pass.

## Proposta SQL NON applicata e problemi/verifiche residue

1. **`proposals/gptour_idempotency_v1_NOT_APPLIED.sql`**: registro richieste attore+requestID, fingerprint server, wrapper di `save_tours_batch`, transazione e RLS. Solo bozza. Non eseguita neppure su DB condiviso di prova, non chiamata dall'app. Richiede revisione e approvazione prima dell'applicazione; i test SQL transazionali reali/concorrenza restano da fare su ambiente isolato autorizzato.
2. Verificare sul servizio reale disponibilità/versione della Edge e RPC sotto RLS, incluso comportamento dell'effettivo `save_tours_batch` per flag/eventi follow-up già presenti. La lettura di una migrazione Git e i test fixture non certificano la versione installata o l'assenza di duplicazioni agenda nel suo comportamento server.
3. Finché manca idempotenza server, journal locale/reconciliation proteggono i retry sul dispositivo; reinstallazione/azzeramento storage o altre sessioni non equivalgono a un registro server durevole.
4. Contratto web di persistenza non ancora adottato semanticamente dal motore web: namespace preservato nei flussi ispezionati, ma modifiche esterne possono richiedere ricostruzione/verifica mobile.
5. Conflitti fra due eventi distinti o appuntamenti esterni privi di percorso sono esposti e bloccanti, non risolti inventando dati. Sono casi da risolvere esplicitamente nel giro/calendario.
6. Ancora richieste prove su **Android e iPhone reali/preview nativa**: testo, registrazione/dettatura, mappa/marker, permessi e GPS, sospensione/ripresa, batch su dati dedicati autorizzati, apertura/avvio normale Tour Live. Non autorizzate scritture CRM reali in questa sessione, non effettuate.

**Stop richiesto rispettato:** nessuna pubblicazione Android/iPhone, nessuna migrazione condivisa applicata. Il software viene consegnato con evidenze e limiti espliciti per la verifica dell'utente, non dichiarato integralmente validato su dispositivo.