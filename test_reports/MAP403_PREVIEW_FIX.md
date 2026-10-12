# Blocco cartografia GPTour Orchestrator — preview browser

## Richiesta e ambito
L'utente mostra tile OpenStreetMap con "403 Access blocked / App is not following tile usage policy" e conferma che il problema avviene nella preview Expo browser. Percorso e marker erano già disegnati. Correzione limitata alla presentazione del client Mobile in preview; nessuna modifica a Edge/API1.0, pianificazione, CRM, sessioni, database, GPTour classico, credenziali o dipendenze.

## Causa e prova
Il precedente `MapSurface.tsx` usava `srcDoc` in un iframe `sandbox="allow-scripts"`. Il documento a origine opaca ometteva il **Referer**, richiesto dalla policy OSM per le mappe web.

Il confronto browser iter82 ha misurato il Referer assente in tre casi (srcDoc; srcDoc con meta/referrerPolicy; documento URL con sandbox) e presente nel controllo a origine normale. Pertanto non è stato applicato l'inefficace rimedio di aggiungere soltanto un meta tag. I quattro tile diagnostici qui rispondevano 200: il 403 visto dall'utente non è stato riprodotto con lo stesso IP, ma la violazione del requisito Referer è stata verificata direttamente.

La sola dimensione 256×256 di un'immagine, usata nel vecchio test, non certifica la cartografia: anche un'immagine di blocco può essere decodificata correttamente.

## Correzione
- Solo nella preview, Leaflet opera nel documento reale dell'app, in un `View` React Native Web con Shadow DOM per isolare **gli stili**, non i privilegi degli script. Niente iframe, proxy, header finti o cambio di fornitore per aggirare blocchi.
- Leaflet 1.9.4 invariato, JS e CSS fissati e verificati con SHA-384 SRI; loader unico con `noConflict`, retry esplicito e pulizia. Nessun `eval` o HTML eseguibile composto dai dati del server; nomi e popup sono testo.
- Tile dall'endpoint ufficiale `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, referrerPolicy `strict-origin-when-cross-origin`. È il browser a inviare la vera origine: nessun URL della preview codificato nel componente. Cache normale, nessun cache-buster/prefetch; fit prima dei tile, buffer fuori schermo zero.
- Coordinate, ordine tappe e geometria server invariati. Marker, selezione, fullscreen, cambio giornata e dettaglio restano disponibili. Nessuna nuova chiamata Orchestrator per manipolare la mappa.
- Il collaudo rigoroso ha rilevato un ulteriore errore Leaflet chiudendo il fullscreen durante lo zoom: un timer di animazione poteva accedere al pannello già distrutto (`_leaflet_pos`). Risolto con opzioni pubbliche `zoomAnimation:false` e `markerZoomAnimation:false`, non con attese nel test o soppressione degli errori. Lo zoom resta interattivo e la transizione del modal React Native resta attiva.

## Verifica finale main
Esecuzione: `/root/.emergent/automation_output/20261012_154630/console_20261012_154630.log`.

- **526/526 test PASS, 53 file**; TypeScript PASS; lint completo 0 errori, 148 warning residui; pre-build PASS; verificatore portabile aggiornato e `--check` PASS.
- Test browser sul renderer effettivo, cartografia OSM reale e geometria sintetica autorizzata. Catturato `Referer: https://voom-ios.preview.emergentagent.com/`, risposte `200 image/png`, cache headers, PNG e screenshot con cartografia vera. Nessun controllo basato solamente su naturalWidth.
- 390×844 e 320×568: linea/marker/P/R, click tappa, dettaglio, fullscreen/zoom/chiusura rapida, giorno 2 e assenza overflow verificati. **0 errori pagina**.
- Rifiuto HTTP403 tile imposto nel test: avviso visibile, retry locale ripristina la mappa. Blocco script in pagina appena aperta: errore visibile e retry funzionante, senza richieste business aggiuntive. Nessuna asserzione resa opzionale con try/except.
- **59 richieste cartografiche totali**, comprese quelle di errore controllato, entro il limite 60 del collaudo; nessun download in massa. **0 richieste business sconosciute**, Auth/Edge/REST simulati soltanto nei test. Nessuna chiamata live a dati/sessioni dell'utente.
- Gli esiti iniziali parziali nel report iter83 (67 richieste, test script-failure inconcludente) sono superati dal collaudo main: rimossi remount ridondanti e corretto il test che inviava un nuovo turno cancellando lo stato di errore recuperato.

Evidenze: `test_reports/artifacts_iter83/iter83_tile_proof.json`, `iter83_main_final_result.json`, `iter83_tile_sample.png`, screenshot `iter83_map_*.jpeg`. Script riutilizzabile: `tests/e2e/iter83_map403_fix.py`. Il precedente iter81 è stato adattato ai locator Shadow DOM e al riuso del loader JS.

## Snapshot e invarianti
- Snapshot sorgente locale: `test_reports/map403_fix/mobile-source-snapshot.tar.gz`, **426 file**, SHA-256 `26f51e049a78bb15e2ca274ed463a26ef7842318d7d9512c13d1e667759a6897`.
- Manifest `source-sha256.json`; estrazione verificata byte-per-byte e TSC, 526 test e pre-build rieseguiti sulla copia. Esclusi `.env`, credenziali/firma, dipendenze e cache.
- Confronto hash col precedente snapshot: `MapSurface.native.tsx`, documento HTML nativo, `TourMapView.tsx`, `gptour/Plan.tsx`, session/binding, app.json, metro.config.js, package.json e yarn.lock invariati. Modifiche di produzione circoscritte all'adapter preview, ai nuovi helper web, al passaggio di dati presentazionali e a un commento d'ingresso.
- Nessun Git write, Publish, build nativa, OTA o pubblicazione. Non è uno snapshot cloud certificato.

## Limiti dichiarati
Browser Chromium verificato. WebKit non eseguibile nell'ambiente per assenza del relativo binario; nessuna installazione toolchain o prova fisica Android/iPhone. Il renderer nativo non è stato modificato né certificato da questo intervento. La disponibilità futura di OSM resta un servizio esterno: errori di rete/fornitore vengono mostrati, non sostituiti da geometrie inventate.