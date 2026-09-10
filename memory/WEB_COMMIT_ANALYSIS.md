# Verifica commit web → mobile — 10/09/2026

## Ambito e metodo
- Richiesta: verificare gli ultimi commit della **web app** e valutare gli aggiornamenti necessari per l'app mobile, senza modificare codice.
- Repository: https://github.com/Paolo73xmas/voom, branch `main`; copia di consultazione `/tmp/voomweb`.
- Ultimo confronto documentato: web `8b55120` del 06/09/2026.
- HEAD remoto verificato anche a fine analisi: `22cb5835de1c15dc652cfdde512abaf717ec1615`, 10/09/2026 19:02 UTC.
- Intervallo: **20 commit** dopo `8b55120`. Riferimento mobile: `254e5ee4`.
- Analisi statica di cronologia, patch, implementazioni corrispondenti e migrazioni. Nessuna scrittura su Supabase, nessun tour avviato, nessuna chiamata AI, nessuna modifica applicativa. Non è una verifica runtime/device né della pubblicazione delle migrazioni.

## Conclusione
**Sì: necessario allineare AI Tour per parità funzionale e per rispettare sul mobile i nuovi vincoli dei tour generati dal web.** Due commit interessano direttamente il mobile. Gli altri diciotto riguardano Jack, amministrazione o OCR assegni e non richiedono porting nelle funzioni mobili attuali.

### 1. `01becd4` — regola 15 giorni (07/09)
- Web: `scoring.ts` introduce `isRecentlyServed` / `splitRecentlyServed`: esclusione automatica se ultima visita O ultimo ordine risalgono a meno di 15 giorni; esenzione per `appointmentAt` o `followUpDate`.
- `AITour.tsx` applica l'esclusione prima di reinserire le tappe esplicitamente richieste; filtro anche sui riempitivi orfani e avviso sul numero di esclusi.
- `week.ts` applica la stessa regola a soggetti in scadenza e riempitivi.
- Mobile: helper assenti, `week.ts:212-220` filtra solo cadenza/tipo. La generazione giornaliera e da brief non hanno il filtro.
- Impatto: l'app può riproporre soggetti appena serviti che il web ora esclude. Portare preservando follow-up, appuntamenti e selezioni esplicite; verificare gli effetti sulla vista mensile che usa la pianificazione settimanale.

### 2. `22cb583` — nuova gestione dei vincoli AI Tour (10/09)
Commit ampio: 41 file, 2.124 righe aggiunte e 158 rimosse, inclusa suite di test.

#### Partenza/arrivo e interprete
- Nuovi `route.startPlace` / `endPlace`: Casa, Sede, indirizzo o cliente, con coordinate reali confermate. Casa/Sede vincolate alle impostazioni dell'agente, non a coordinate prodotte dall'AI.
- Mobile: `ai-tour.tsx:1066-1095` usa il punto del form, fallback GPS → Sede/Casa e flag di rientro; NON interpreta luoghi di partenza/arrivo indipendenti nel brief. Non dire che al mobile mancano completamente Casa/Sede: già presenti nel form.
- Web aggiunge contratto risposta `4.1`, capability `ordered_journey_v1`, controlli su risposte incomplete e nuove regole nel prompt.
- Mobile usa **il proprio FastAPI** `/api/ai-tour/parse-brief` (`backend/server.py:275-297`), non la Edge Function web aggiornata. Occorre aggiornare insieme prompt/contratto backend e normalizzazione/UI mobile; modificare soltanto Supabase non basta. Non c'è evidenza che il nuovo 409 della funzione web rompa l'interprete mobile, che non la chiama.

#### Clienti nominati e obbligatori
- Identificazione fuzzy su portafoglio paginato con nome CRM, denominazione registro, referente, codice rivendita e indirizzo; scelta esplicita per ambiguità.
- Priorità 1–3, consenso per eccezioni fuori zona, controllo duplicati/coordinate/date/numeri incompatibili.
- `includeAutomatic`: non aggiungere altri clienti a un elenco di clienti nominati salvo autorizzazione nel brief.
- Mobile: risoluzione soltanto durante generazione (`ai-tour.tsx:1169-1191`); se obbligatorio ambiguo/non trovato, genera un warning e procede senza quella tappa. Mancano il pannello di risoluzione e i nuovi campi, con limite attuale di 10 riferimenti invece dei 60 del web.
- Nuovo controllo di fattibilità obbligatori/orari/ritorno/routing prima di salvare o avviare. Assente sul mobile; non basta aggiungere i nuovi chip.

#### Zone ordinate, direzioni e corridoi stradali
- Nuova `briefJourney`: es. sud di Milano → Rozzano → Pavia, mantenendo l'ordine geografico e le visite nei corridoi costruiti con strade OSRM reali.
- Anteprima mappa con conferma delle zone e dei suggerimenti di correzione località; mai sostituire silenziosamente una località dettata.
- Nuovi `journeyStage`, `enforceJourneyOrder`, `briefAreas`, `briefRequirements`, `journeyStageCounts` e metadati di rientro persistiti nel JSON esistente `ai_tours.area_filter`.
- Mobile: tipi/moduli/review e vincoli assenti. Il caricamento di un tour pianificato (`viewSaved`, `ai-tour.tsx:1487-1569`) non ricostruisce questi metadati. Il Live legge il JSON ma non ne applica i nuovi vincoli; `areaCheckForTour` in `liveops.ts` conosce soltanto i vecchi filtri.
- **Rischio prioritario web → mobile:** apertura iniziale possibile, ma ricalcolo o “Più Visite” possono cambiare ordine delle zone/ampliare la zona rispetto alla richiesta confermata sul web. È un rischio verificato a livello di codice, non un incidente riprodotto su tour reali.
- Portare insieme salvataggio, richiamo, modifica, avvio, Live, aggiunta/riordino/estensione tappe. Il web rafforza anche le guardie contro ricalcoli parziali (`plan.stops.length < remaining.length` e controllo chiavi prima di persistere); il mobile controlla ancora soprattutto il caso zero tappe.
- Nel web la suddivisione automatica in più giornate è disabilitata per brief con obbligatori protetti o percorso ordinato: evitare che il vecchio split mobile aggiri questi vincoli.

#### Filtri territoriali e sviluppo
- Web filtra l'area **prima** dei top-N; nessun risultato non allarga più automaticamente il bacino. Normalizza province estese (es. Brescia → BS).
- Mobile: `ai-tour.tsx:1128` applica il filtro soltanto se `keep.size > 0`. Se non trova candidati nell'area, mantiene il bacino precedente. La selezione top-N precede il filtro (`1104`). Correzione funzionale da portare, non semplice novità visiva.
- Web carica il registro per sviluppo/mista nell'area richiesta; distingue ricerca fallita/troncata da assenza di soggetti e deduplica per rivendita.
- Mobile: carica nuove rivendite nel brief prevalentemente tramite `new_around`; manca il nuovo caricamento territoriale esplicito. `loadCandidates` non pagina la query clienti (`data.ts:239-245`), a differenza del web; rischio di troncamento oltre il limite del server.

## Altri 18 commit: nessun porting mobile richiesto
- **Jack (14):** `c91eb15`, `99d8071`, `3241e57`, `d4ca187`, `b96a233`, `e4ed59d`, `8c65a03`, `7ee4948`, `db29a9e`, `3ecf8f9`, `015a980`, `b39992c`, `a089aaa`, `334ea9e`.
  OAuth/proxy/audit; letture attività/ordini/clienti; creazione ordini controllata; estero; stock/spedizioni/consumi; regola ordini validi; letture GPS. La creazione usa le tabelle CRM ordinarie ma non richiede il client Jack nel mobile.
- **Provvigioni/amministrazione (3):** `ec5cb18`, `2c70b5a`, `4944e94`: contributo operativo, costi accessori e sostenibilità/pro-rata; moduli non usati dall'app agente.
- **OCR assegni (1):** `50b9af9`: riguarda il flusso upload browser mobile della web app e la funzione OCR, non le ispezioni Expo.
- Verificato staticamente che nessuna delle 20 RPC aggiunte/modificate nelle migrazioni del range compare come chiamata `.rpc('...')` nel codice applicativo mobile esaminato. Nessuna incompatibilità diretta rilevata da queste migrazioni; non certifica lo stato del DB/servizi in esecuzione.

## Nota sulla domanda precedente: magazzino Jack
Ora verificabile **dal codice**: `015a980` espone `get_stock` nel catalogo MCP e nel gateway, con RPC che restituisce giacenza, impegnato su ordini draft non eliminati, disponibile e flag estero per prodotti attivi. Autorizza profili attivi `admin`, `admincustom`, `ai_readonly`, `supervisor`. `a089aaa` aggiunge `get_warehouse_consumption` (consumo da righe ordine vs venduto, non storico completo dei movimenti). Non verificata una sessione MCP reale né il rilascio delle funzioni; non richiede aggiornamento mobile.

## Priorità proposte (non implementate)
- **P0:** nessun nuovo crash/runtime bloccante accertato in questa analisi statica.
- **P1 alta:** preservare vincoli dei nuovi tour web nel mobile; correggere filtri territoriali; regola 15 giorni; completare il flusso Dillo all'AI (backend + revisione + planner + persistenza/Live).
- **P1:** paginazione portafoglio e gestione affidabile della ricerca registro; test di regressione form/brief/settimana/multi-day/Live con casi sintetici prima di qualunque test autorizzato su DB condiviso.
- **P2:** backlog precedente Bozze/Preventivi e visualizzazione totali ordini (`b2e2983/a7ece71/593604c`, `3a4ba76/92f8c8f`), distinto dai 20 commit nuovi. Il fix mobile Sconto Benvenuto è già presente: non riapplicarlo.
- **Vincolo di porting:** integrare le nuove logiche, NON sovrascrivere interamente il planner col web. Il mobile possiede già `evalOrder`/`improveOrder`, Or-opt e refill contro doppi passaggi; preservare anche deduplicazione candidati, timeout Hermes/GPS, foto low-end e sincronizzazione cestino durante ricalcolo.

## Stato consegna
Aggiornata soltanto documentazione. Nessuna modifica a frontend/backend/configurazione o dati operativi; nessun nuovo test funzionale eseguito. I test del nuovo commit web sono presenti nel repository ma NON sono stati eseguiti in questa analisi.