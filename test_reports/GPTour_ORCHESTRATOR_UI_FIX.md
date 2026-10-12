# GPTour Orchestrator Mobile — correzione presentazione verificata localmente

## Perimetro e risultato
12 ottobre 2026. Solo workspace Mobile VOOM. Nessuna modifica alla Web App, Edge Function, contratto wire API 1.0, database/RLS, motore server, criteri commerciali, dati CRM, credenziali o dipendenze. Nessun Publish, build nativa, OTA, push/merge o pubblicazione store. Nessuna nuova chiamata live Auth/Edge/CRM.

### Causa della mappa assente / non utile
- **Provata in preview:** `ServerRouteMap.tsx` restituiva soltanto un avviso, non una mappa.
- **Provato nei sorgenti nativi:** `ServerRouteMap.native.tsx` usava `react-native-maps`, diversamente da `TourMapView` classico (Leaflet/WebView); mancavano fullscreen e selezione tappa, fit solo all'avvio. Il contenitore aveva già altezza 280, quindi non è stato attribuito falsamente il problema a un'altezza zero.
- Nel manifest locale non è configurata la chiave Google Maps Android. Questo è un limite del vecchio provider, **non prova della causa esatta sul dispositivo dell'utente**: non sono disponibili log/hardware della build installata.
- Ora entrambi gli ingressi usano la stessa presentazione Leaflet/OpenStreetMap del classico, isolata in `RouteMap`, `route-map-document` e `MapSurface`; Android/iPhone risolvono `MapSurface.native.tsx` con WebView già installata. Nessuna nuova chiave o configurazione Google.
- Mappa 220 punti, fullscreen con safe area, fit su tutta la geometria e tutti i marker, partenza/rientro distinti anche alle stesse coordinate, selezione con riga evidenziata e dettaglio apribile. Priorità visiva dei marker tappa evita che siano coperti dai marker base nella vista compatta. Cambio giorno/revisione rigenera la presentazione appropriata. Caricamento, timeout, errori cartografia/script e ricarica locale visibili.
- Nessun collegamento sintetico fra tappe: geometria server conservata nell'ordine originale; zero/un solo vertice non generano una polilinea. Avviso esplicito quando manca il percorso. Il test con una deviazione artificiale è **solo una fixture sintetica**, non un itinerario stradale reale certificato.

### Causa della risposta duplicata
- `binding.ts` riportava `raw.message` nel transcript e `raw.question.text` nelle domande; `OrchestratorScreen` mostrava indipendentemente entrambi, anche quando erano lo stesso testo dello stesso turno.
- Link interno `question.messageId = requestId + '-a'`, card unica messaggio/domanda con tutte le opzioni. Viene separato soltanto lo specifico segmento della domanda in quel messaggio, senza deduplicare globalmente testi uguali. Le righe follow-up sono mostrate una volta con i relativi comandi.
- Il metadato interno `message.question` conserva anche le domande diverse dal messaggio introduttivo quando entrano nello storico. Testi originali preservati, nessuna nuova proprietà inviata all'API.
- Per `get_plan`, che ha un nuovo requestId ma non è un nuovo turno, il link viene recuperato **solo** se revisione confermata, ID e testo della domanda coincidono con la cache precedente. Supportata la cache precedente priva del link; una revisione diversa non viene associata allo storico per sola somiglianza.
- Nessun doppio invio individuato nel coordinator: il blocco single-flight, salvataggio pending prima dell'invio, requestId/sessionId, expectedRevision, 409, retry identico e recupero restano invariati. In `session.ts` cambia soltanto il collegamento di presentazione delle domande durante il recupero.

### Parti del classico riutilizzate
- Importati senza modificarli: `GptButton`, `GptIcon`, `GptNotice`, `ui` e palette DS.
- Riprodotta la struttura di `gptour/Plan.tsx`: mappa sopra riepilogo/elenco, badge numerici 26 punti, righe compatte con nome/località/orari/tipo/ultimo ordine e obbligatorietà, foglio dettagli scorrevole. Comandi tappa solo tramite `ServerOptions` e contratto server.
- Portate **solo** parti grafiche di `TourMapView.tsx`: Leaflet 1.9.4, stesso provider cartografico, marker, polilinea, fit/fullscreen. NON importato il componente classico completo: nessun accesso tabaccherie/CRM, download ordini o watcher GPS.
- Riepilogo principale compatto; tutte le metriche server restano consultabili nel riepilogo completo. Selezione giornata mantenuta durante aggiornamento del piano nella stessa schermata/sessione.

## Verifiche eseguite
| Controllo | Esito / ambito |
|---|---|
| Vitest completo | **523/523 PASS, 52 file**; baseline 508, 15 regressioni aggiunte |
| TypeScript | PASS sia workspace sia copia estratta dello snapshot |
| ESLint completo | PASS, 0 errori; 148 warning nel workspace, 147 nella copia sorgente senza file locali ignorati |
| Gate `check-build-lockfile.cjs` | PASS anche sullo snapshot estratto; manifest/.yarnrc/lock identici a HEAD, hash lock immutato |
| Verificatore offline portabile | Artefatti locali rigenerati; `generate.cjs --check` e 50 self-test PASS. Nessuna nuova verifica P1 reale/Web |
| Export JavaScript Android e iOS | PASS entrambi, `--no-bytecode`, nessuna build nativa. Source map conferma `ServerRouteMap.native.tsx` e `MapSurface.native.tsx`, esclude i corrispondenti `.tsx` preview |
| Browser 390×844 e 320×568 | Mappa Leaflet effettiva: tile OSM caricati, SVG non vuoto, parità geometria/numero marker, deviazione compresa nel fit, fullscreen e tocchi marker **reali, senza force o click DOM** |
| UI piano | Riga compatta 44–90 punti nel caso lungo, nome integrale nel dettaglio, campo ultimo ordine/motivazione, scorrimento e chiusura a 320, giorno 2 preservato dopo risposta server al cambio orario, nessun overflow orizzontale |
| Conversazione | Domanda/follow-up una volta, opzioni e decisione per riga, ripetizioni legittime tra turni, domanda distinta mantenuta nello storico e dopo reload |
| Richieste | Un invio per azione; require_stop con chiave server esatta; doppio tocco bloccato; retry503 identico; 409 nuovo ID/revisione; reload solo probe+get_plan, transcript conservato |
| Limiti/guasti mappa | Geometria realmente vuota e singolo punto testati separatamente; nessuna linea inventata. Errori tile e script con retry locale, nessuna richiesta Orchestrator aggiuntiva |
| Regressione classico / resto app | **306 file produzione/config/backend fuori Orchestrator confrontati byte-per-byte con baseline `9616ce8b4e47de354982b9469b3b1232a616c9de`: zero differenze**; suite legacy inclusa |

Il browser usa componenti/controller/binding/storage reali ma **Auth/Edge/CRM simulati esclusivamente nei test** e traffico business bloccato prima della navigazione. Il collaudo finale main ha 20 richieste sintetiche, 0 richieste business sconosciute, 0 errori pagina e 0 warning React per chiavi duplicate. Asset Leaflet e tile OSM sono reali. Questo NON certifica servizi live né rendering nativo.

Evidenza finale post-riavvio: `/root/.emergent/automation_output/20261012_145423/console_20261012_145423.log`; script riusabile `tests/e2e/iter81_orchestrator_presentation.py`. Esito machine-readable: `test_reports/orchestrator_ui_final/browser-final-result.json`, con verifica aggiuntiva che P/R non siano coperti. Immagini/log nella stessa cartella. Offset esclusivamente grafici dei simboli P/R, coordinate server immutate.

## Snapshot locale salvato e verificato
- `test_reports/orchestrator_ui_final/mobile-source-snapshot.tar.gz`: **419 file** frontend/tools di verifica/test, senza `.env`, dipendenze, cache, credenziali e materiale di firma.
- SHA-256 definitivo: `e0d9df62e3d63d20d579ec999be2aa4d41c0a0f4a0ed8602404f876e1a98dfe9`.
- Manifest file-per-file: `source-sha256.json`. Estrazione confrontata byte-per-byte, poi TSC, intera suite, lint e pre-build rieseguiti sulla copia. Dipendenze installate riutilizzate, non una nuova installazione frozen.
- Questo è uno **snapshot sorgente locale**, non un commit remoto o l'archivio di una futura pipeline cloud. Nessuna operazione Git write eseguita. Il primo archivio provvisorio escludeva erroneamente `secure-credentials.ts` per nome; corretto includendo il modulo sorgente invariato, non dati di credenziali. Soltanto l'archivio con hash sopra è quello validato.

## Verifiche ancora necessarie Android/iPhone
**NON ESEGUITE:** APK/IPA installato, WKWebView/Android WebView su hardware, tocchi/gesture e safe area reali, tastiera/back Android, rotazione, perdita connessione sul dispositivo, comportamento con la sessione live dell'utente. `adb` e `xcrun` non disponibili. I bundle JS non sono prove native e non includono verifica Hermes/firma/provisioning.

Nel collaudo autorizzato sui telefoni: aprire **Altro → GPTour Orchestrator**, verificare mappa e numeri/P/R, ingrandire/ridurre, selezionare una tappa e aprirne il dettaglio; passare giornata e aggiornare orario; chiudere/riaprire la conversazione con domanda pendente e verificare una sola domanda con opzioni. La cartografia necessita connessione a Leaflet/OSM; in assenza deve comparire l'avviso, non un percorso inventato. Nessun collaudo live aggiuntivo avviato qui.

## Salute preview al termine
Expo riavviato dopo i controlli. Verifica diagnostica read-only finale: URL pubblico preview HTTP 200, servizio RUNNING. Il controllo Python iniziale contro `EXPO_PACKAGER_PROXY_URL` aveva dato 403 perché è un endpoint interno protetto, non l'URL pubblico della preview. Gli errori storici `Cannot pipe to a closed or destroyed stream` sono cancellazioni HTTP del browser, non errori di rendering. Nessuna modifica a env/config per mascherarli; il collaudo browser finale ha 0 errori pagina.