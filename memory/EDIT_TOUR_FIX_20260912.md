# Fix ricalcolo anteprima AI Tour — 12/09/2026

## Richiesta
L'utente genera un giro, aggiunge tappe obbligatorie nella finestra “Modifica giro” e non riesce né a ricalcolare con AI né ad applicare la sequenza manuale; sembra possibile soltanto chiudere. Ha precisato che il problema è nell'anteprima, prima dell'avvio.

## Cause riscontrate nel codice
1. Il catch del ricalcolo aggiornava il banner della pagina, nascosto DIETRO il Modal. Il motivo del blocco non era visibile nella finestra di modifica.
2. Nuove tappe fuori dalla zona del brief erano sempre rifiutate, senza un comando di consenso nell'editor.
3. Le `requiredStops` del piano precedente venivano ricopiate anche dopo cambiamenti espliciti alle stelle o rimozioni. Il ramo manuale inoltre riutilizzava i vecchi flag mandatory dei singoli stop.
4. Cambiare soltanto una stella o rimuovere una tappa non attivava `orderTouched`, lasciando disabilitato il comando manuale.
5. La descrizione AI veniva attesa prima di chiudere il modal. Nel caso di un piano salvato, l'UI veniva aggiornata prima della conferma della persistenza.

Non è stato aperto o modificato il giro reale dell'utente: la specifica condizione geografica/oraria del suo giro non è stata ispezionata. Le cause sopra sono verificate nel codice e riprodotte con casi isolati.

## Correzione
- Nuovo `frontend/lib/aitour/edit-plan.ts`: preparazione immutabile del piano modificato, allineamento flag/requiredStops/metadati in entrambi i modi, preservazione delle fasce concordate e delle priorità, controllo duplicati/coordinate/chiavi mancanti, timeout del calcolo e validazione di completezza.
- Nuove tappe fuori zona richiedono “Conferma eccezione fuori zona” sotto la tappa selezionata. Il consenso è legato a soggetto/coordinate/zona correnti; non disabilita orari, appuntamenti o ordine geografico. Le eccezioni già presenti restano segnalate anche nei ricalcoli successivi.
- `TourEditModal.tsx`: errore leggibile nel footer, selezioni conservate dopo errore, stelle/rimozioni abilitano anche il comando manuale; blocco dei controlli durante il ricalcolo, tastiera/safe area, target44pt e nomi su due righe.
- `app/ai-tour.tsx`: doppio click protetto, stato editor dedicato; descrizione AI con attesa massima5s e riepilogo locale coerente. Per il ramo salvato l'UI viene confermata solo dopo `replaceTourPlan`; preview senza alcuna persistenza.
- Rimossa la vecchia raccomandazione testuale dopo un edit per non mostrare ancora il precedente numero di visite. Il riepilogo nuovo e le metriche descrivono il piano effettivo.
- `lib/aitour/ai.ts`: URL Edge Function ottenuto dalla configurazione Expo/env anziché fissato a un progetto specifico. Nessuna modifica agli env, al modello AI o all'autenticazione.

## Verifiche
- Testing agent iteration28: nuovo `tests/aitour/edit_plan.unit.ts` (12 casi) e suite AI Tour completa **6/6 gruppi PASS**. Suite segnalazioni **2/2 gruppi PASS**. Main ha rieseguito entrambe.
- Casi unit: AI/manuale, nuova obbligatoria, demozione/rimozione esplicita, vecchi metadati, appuntamenti, duplicati, consensi invalidati, routing fallback, percorso geografico, piano parziale, timeout e immutabilità.
- Il testing agent ha verificato anche il ricalcolo manuale nell'UI in sola lettura, ma non aveva completato il caso fuori zona.
- **Main UI completa (fixture soltanto browser, componente/app reali):**
  1. Login → brief → generazione di un'anteprima con una visita a Milano.
  2. Aggiunta di un secondo cliente come obbligatorio → **RICALCOLA CON AI PASS**, ritorno al risultato; stella rossa conservata (screenshot + unit).
  3. Aggiunta di un terzo cliente di Rozzano → applicazione manuale mostra **errore nel modal**, senza perdere modifiche.
  4. Conferma dell'eccezione sotto la tappa → **sequenza manuale PASS** con tre visite.
  5. Modifica della sola stella della prima visita → comando manuale utilizzabile e **PASS**.
- `OPERATIONAL_WRITES []`, `PAGE_ERRORS []`, overflow orizzontale assente nell'ultima prova. Nessun uso di click forzati: si attende il modal completamente in posizione e si usa lo scroll automatico.
- Lint dei quattro file modificati PASS. Typecheck mirato verificato a fine lavoro; rimangono i 11 errori TypeScript legacy fuori scope.
- Evidenza browser: `/root/.emergent/automation_output/20260912_122730/`; immagini temporanee `/tmp/edit-tour-outside-consent-pass.jpg`, `/tmp/edit-tour-complete-pass.jpg`.

## Precisazioni sui test (evitare falsi negativi)
- Il pulsante Modifica ha testID esistente **`aitour-edit-btn`**, NON `aitour-edit-open`. Nessun duplicato lasciato nel JSX.
- Entrambi i comandi hanno gli ID già usati: `aitour-recalc-ai-btn`, `aitour-apply-order-btn`; errore `aitour-edit-error`; consensi `aitour-edit-consent-<key>`.
- Gli screenshot intermedi del tester durante l'animazione slide non dimostravano un problema di layout. Main attende bounding-top0/altezza viewport prima delle interazioni; flusso completo riuscito senza alterare l'animazione.
- Le prime fixture main non avevano `customers.category='client'`; la simulazione OSRM iniziale usava Python `urlparse`, che interpretava i `;` delle coordinate come params e troncava la matrice. Risolto nel SOLO test usando `urlsplit`; non è stato necessario cambiare planner o regole di business per quei falsi negativi.

## Limiti
Nessun dato operativo reale scritto, nessun tour salvato/avviato, nessuna modifica ad account o autorizzazioni. La prova main usa clienti e risposte di rete isolati nel browser; l'app continua a usare i servizi reali. Resta la verifica dell'utente sul suo dispositivo/giro specifico.