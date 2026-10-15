# Mappe — posizione attuale senza ritorno al punto precedente

## Ambito e causa verificata nei sorgenti
Richiesta: nella scheda **Mappe** il pulsante posizione funziona in Expo, ma su Android sembra aggiornare e poi tornare al punto vecchio; iPhone non verificato. Non riguarda GPTour Orchestrator o U2-d.

Il pulsante precedente **non chiedeva una nuova posizione**: reinviava `userLocation`, acquisita una sola volta all'apertura con accuracy Balanced. Inoltre quel dato alimentava sia il documento HTML nativo sia le dipendenze di inizializzazione web: aggiornare semplicemente lo stato avrebbe ricreato la mappa, anziché aggiornare punto e camera. Il codice conferma questi difetti; non sono disponibili log GPS della build Android installata per attribuire ogni manifestazione hardware alla medesima causa.

## Correzioni
- Ogni pressione richiede un fix **foreground High recente**. Watch breve chiuso prima dell'uso del risultato, non tracciamento continuativo/background. Scartati dati più vecchi di 5 secondi, timestamp futuri anomali e coordinate invalide. Timeout 20 secondi; gestiti cancellazione, callback e handle tardivi, errori di permesso/servizio e cleanup senza lasciare la richiesta pendente.
- Bootstrap e sorgente WebView immutabili/memoizzati, separati dal fix più recente. Anche Leaflet web resta la stessa istanza durante nuovi fix, filtri e caricamenti dei punti.
- Aggiornamento atomico del punto blu e del centro. Comandi camera versionati, timestamp GPS controllati; messaggi vecchi/duplicati non ripristinano il centro precedente. Il medesimo evento Android document→window è elaborato una volta; listener iOS window preservato.
- Dopo un vero reload WebView vengono ripristinati fix e viewport correnti, non le coordinate iniziali. I messaggi bounds/viewport precedenti a un comando recente sono ignorati. Interrotte le acquisizioni pendenti quando viene scelta una località o un cliente.
- Animazioni zoom precedenti non possono sovrascrivere un nuovo centro GPS (`zoomAnimation` e `markerZoomAnimation` disattivate tramite opzioni pubbliche; zoom interattivo conservato).
- Pulsante con caricamento/disabilitazione single-flight e avvisi leggibili. Se il GPS fallisce **non ricentra sulla cache**. La posizione approssimativa è segnalata; un viewport predefinito senza permesso non è presentato come posizione dell'utente e non mostra un falso punto blu.
- Il collaudo ha individuato un problema aggiuntivo della combinazione SDK web installata: `expo-location` 19 usa `removeSubscription`, assente nell'EventEmitter web moderno. Non sono state cambiate dipendenze o nascosti errori con monkey-patch. L'adapter browser usa le API pubbliche `navigator.geolocation.watchPosition/clearWatch`; **Android/iOS continuano a usare Expo Location nativo** tramite `location-port.native.ts`.

## File principali
`frontend/app/(tabs)/map.tsx`, `components/map/leafletHtml.ts`, `components/map/styles.ts`, `hooks/useMapLocation.ts`, `lib/map/{fresh-location,location-port,location-port.native,viewport}.ts`.

## Verifiche con esito positivo
- **550/550 test, 59 file** (24 regressioni nuove): freshness, permessi/GPS spento, timeout, cleanup prima/dopo handle, callback tardivi, single-flight, bootstrap stabile, precisione, errori e retry, adapter browser/native, viewport e protocollo HTML Android/iOS.
- TypeScript PASS, lint completo 0 errori. Nella copia sorgente: 146 warning residui; nessun warning nei nuovi moduli/test.
- Pre-build lockfile/manifest/config PASS. Nessuna modifica a dipendenze o configurazioni protette.
- **Export JavaScript Android e iOS PASS**, con source map che conferma `location-port.native.ts` ed esclude l'adapter browser. Export locali `--no-bytecode`, non APK/AAB/IPA o test Hermes/hardware.
- Browser reale con Leaflet e cartografia caricati, ma **GPS, autenticazione e CRM simulati soltanto nei test**: A iniziale → campione vecchio ignorato → B attuale; callback A tardivo, zoom e cambio filtri non riportano indietro; doppio clic reale causa una sola richiesta; errore GPS mantiene B con avviso; retry acquisisce C; nessun overflow a 320 punti.
- Metriche finali: **5 watch, 5 clearWatch, 0 listener residui, 1 sola mappa creata, 0 errori pagina, 0 richieste business sconosciute**.

Evidenza finale: `/root/.emergent/automation_output/20261015_092629/console_20261015_092629.log`; risultato `test_reports/artifacts_iter85/main_final_result.json`; immagini B/errore/C e 320 nella stessa cartella. Script riusabile `tests/e2e/iter84_map_recenter.py`.

I report iniziali 84/85 erano parziali. Sono superati dal collaudo main: corrette le asserzioni TypeScript dei test, la simulazione permessi/timestamp, l'attesa circolare di un secondo clic mentre il pulsante era intenzionalmente disabilitato e il filtro di rete del test che negava erroneamente i sottodomini cartografici già usati dall'app. Nessuna asserzione di successo resa opzionale e nessun GPS/provider finto nel codice applicativo.

## Snapshot e invarianti
Snapshot locale `test_reports/map_recenter_final/mobile-source-snapshot.tar.gz`, **434 file**, SHA-256 `5aeb0d7129b703984b204d235911017be00eda6574ab31a103acf425f6e7ee07`. Manifest `source-sha256.json`; estrazione confrontata byte-per-byte, poi pre-build, TSC, tutti i 550 test e lint rieseguiti sulla copia. Esclusi credenziali, `.env`, dipendenze, cache e materiale U2-d.

Confronto con `1a2d4d5d`: configurazioni protette, package/lock, backend, GPTour classico, Orchestrator e relativi contratti invariati. Nessuna modifica/esecuzione di U2-d, nessun accesso Auth/CRM/Edge live, build nativa, OTA o pubblicazione effettuata.

## Limiti e collaudo sul dispositivo
**Non verificati fisicamente:** sensore Android, provider fused/GPS in movimento, permesso preciso/approssimativo del sistema, WebView su Android e iPhone. I test HTML simulano il protocollo, non un dispositivo; il bundle JS non certifica una build installata. **Non è stata prodotta o installata una nuova build sui telefoni.**

Su una versione contenente il fix: aprire Mappe al punto A, spostarsi al punto B lasciando la schermata aperta, premere posizione; controllare punto blu/centro B anche dopo qualche secondo, zoom/filtri e ritorno alla schermata. Provare GPS disattivato/permesso negato e poi riabilitato: deve apparire un avviso senza salto alla vecchia posizione, quindi funzionare la nuova lettura. Ripetere su iPhone quando disponibile.