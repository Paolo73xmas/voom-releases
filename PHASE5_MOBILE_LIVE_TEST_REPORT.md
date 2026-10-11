# GPTour Orchestrator — primo collaudo live controllato

## 1. Esito e perimetro

**PASS per il percorso HTTP live e la logica condivisa del client mobile effettivamente eseguiti. NON è un collaudo nativo Android/iPhone.**

- Esecuzione reale: **11 ottobre 2026, 20:41:13–20:41:32 UTC** (22:41 Europe/Rome), dopo autorizzazione utente.
- Progetto principale VOOM: `gorwxfzzyzxmxnizmebw`; Edge Function `gptour-orchestrator`.
- Account: **Salvatore Pirone**, un solo login reale e verifica dell'identità tramite `auth.getUser()`. Nessuna impersonificazione, altro account o service_role.
- Risposte osservate: **contractVersion1.0**, **engineVersion gptour-orchestrator/0.2.0**. **v6 è la versione di riferimento dell'handoff, NON una versione di pubblicazione verificata indipendentemente:** le risposte/header ottenuti non espongono tale numero. Nessun accesso Management API o modifica al servizio per verificarlo.
- **7 invocazioni Edge complessive su25 autorizzate**, tutte con risposta. **18 non utilizzate**, senza estendere autonomamente il collaudo.
- Auth separata dal conteggio Edge: **1 POST password / HTTP200 +1 GET user / HTTP200**.
- Pilota dell'app ancora spento. Nessuna attivazione per agenti, visita a dashboard CRM o scrittura diretta a tabelle. Nessuna modifica al codice operativo frontend/backend, env, database/RLS/Edge/secret.
- Nessun push, merge, OTA, deployment o pubblicazione. Locale `main`; futuro remoto esclusivamente `conflict_170826_1303`, ancora subordinato ad autorizzazione.

## 2. Cosa è stato realmente testato

| Livello | Esito | Evidenza / limite |
|---|---|---|
| HTTP Supabase Auth reale | PASS | Unico login Pirone; email attesa e UUID coerente tra signIn e getUser, UUID valido. Segreti non registrati |
| HTTP Edge reale | PASS | Probe, conversazione, chiarimento, due piani, replay, recupero,409 |
| Moduli effettivi del client mobile | PASS | `createOrchestratorTransport`, `APPROVED_ORCHESTRATOR_BINDING`, `OrchestratorSession`, `SessionStore` eseguiti contro Supabase SDK reale |
| UI Expo/browser con traffico live | **NON ESEGUITA** | Non confondere con i precedenti screenshot offline |
| Android emulatore | **NON ESEGUITO** | `adb` non disponibile |
| Android dispositivo fisico | **NON ESEGUITO** | Nessun dispositivo collegato |
| iOS simulatore | **NON ESEGUITO** | `xcrun` non disponibile |
| iPhone fisico | **NON ESEGUITO** | Nessun dispositivo collegato |
| Parità esatta P1 Web/Mobile | **NON ESEGUITA** | In attesa della fixture completa fornita dall'AI Web |

Runtime del collaudo: Node/Vitest. SDK Supabase, password authentication, getSession e functions.invoke reali. Solo gli adattatori non disponibili in Node (modulo RN di bootstrap, AsyncStorage/Crypto) sono sostituiti nel test; il trasporto riceve il client Supabase autentico e il coordinatore usa storage locale isolato e UUID reali. **Nessuna risposta Edge o autenticazione simulata nel run live.**

## 3. Sequenza e registro delle7 chiamate Edge

| # | Operazione | HTTP | Risultato |
|---|---|---|---|
|1|Probe `{contractVersion:"1.0"}`|400|Accesso pilota abilitato, risposta attesa dal contratto; nessuna sessionId nel probe|
|2|Nuova richiesta commerciale Milano/domani/misto|200|`needs_clarification`, revisione1, domanda su due follow-up|
|3|`answer` con optionId `include_all`|200|`ready`, revisione2, primo piano|
|4|Secondo turno: **«Parto alle8»**|200|`ready`, revisione3, nuovo piano; criteri commerciali/area/data preservati|
|5|Replay esatto della richiesta #4|200|Stesso requestId, revisione3, planId e contenuto JSON uguali; nessun nuovo turno osservato|
|6|Ricreazione del coordinatore → `get_plan`|200|Stesso piano della revisione3 senza rigenerazione|
|7|Azione con nuovo requestId e expectedRevision2 invece di3|409|Conflitto atteso, revisione server3; nessun retry automatico|

Il400 del probe e il409 controllato sono risultati attesi, **non guasti del servizio**.

Idempotenza: confronto dell'intero JSON canonicalizzato, non solo di tre campi. L'ordine testuale delle proprietà JSON può cambiare fra risposta originale e cache: per questo l'hash del testo HTTP grezzo differisce nel ledger, mentre il contenuto strutturato è identico. Nessuna modifica alle liste/valori viene ignorata dal confronto.

Recupero: il coordinatore viene distrutto e ricreato mantenendo lo storage isolato; initialize invia get_plan con il planId salvato. È una prova del ciclo del **coordinatore**, non di chiusura processo o AsyncStorage su telefono. Il server risponde `recupero senza rigenerazione`, `crmQueries:0`, `routingCalls:0`, `aiCalls:0`, revisione invariata e piano identico.

Conflitto: errore409 attraversa il vero trasporto mobile ed è tradotto in `CONFLICT` con revisione3. Non è stato eseguito un conflitto via interfaccia nativa né un successivo re-invio correttivo live.

## 4. Itinerario risultante, ricevuto dal server

Data scelta dal server per «domani»: **lunedì12 ottobre2026**, Europe/Rome. Nessuna data interpretata localmente.

| Campo | Primo piano / rev2 | Secondo piano / rev3 |
|---|---|---|
|Stato|ready|ready|
|Tappe|13: **8 clienti esistenti +5 nuovi punti**|Le stesse13, stesso ordine|
|Distanza complessiva|**79,7km**|**79,7km**|
|Partenza|**07:00**|**08:00**|
|Fine comprensiva di rientro|**15:53**|**16:53**|
|Limite giornata server|20:00|20:00|
|Visite|390min,30min per tappa|390min|
|Guida fra le tappe|77,2min|77,2min|
|Rientro|35,6min|35,6min|
|Attese|0min|0min|
|Pausa|**30min prima della tappa10**|**30min prima della tappa8**|
|Tempo totale|532,8min|532,8min|
|Margine server|247,2min|187,2min|
|Geometria|**2704 coordinate**, hash invariato fra i due piani|Stessa geometria|
|Routing|`verified_routing`, `routingSource:osrm`|`verified_routing`, `routingSource:osrm`|

Orari arrotondati al minuto soltanto per esposizione, con lo stesso formato del client. I valori frazionari originali sono conservati nel JSON del rapporto. **OSRM risulta disponibile secondo il servizio**, quindi non è un caso di routing stimato. Non è una verifica sul campo di traffico, apertura negozi o percorribilità effettiva.

### Tappe nell'ordine ricevuto

|#|Tappa|Gruppo|Visita primo piano|Visita secondo piano|Km dal punto precedente|
|---|---|---|---|---|---|
|1|Tabacchi di Simone Rugieri|Esistente|07:12–07:42|08:12–08:42|6,6|
|2|MIKY BAR DI HU ZHEN NI|Esistente|08:01–08:31|09:01–09:31|18,6|
|3|BAR TABACCHI DI SHI FRANCESCO|Esistente|08:38–09:08|09:38–10:08|4,1|
|4|DREAM CAFFE DI HU|Esistente|09:14–09:44|10:14–10:44|3,9|
|5|Bar Tabacchi La Colonna di Marco Guadagni|Esistente|09:52–10:22|10:52–11:22|3,6|
|6|Sarcafã¨ Di Hu Jie|Esistente|10:30–11:00|11:30–12:00|4,1|
|7|Tabaccheria di CASATI CHIARA|Nuovo|11:06–11:36|12:06–12:36|3,1|
|8|DITTA INDIVIDUALE GIULIANO ANTONIO|Nuovo|11:37–12:07|13:07–13:37|0,3|
|9|ZANZIBAR DI HU KEPANG|Esistente|12:09–12:39|13:39–14:09|0,7|
|10|Tabaccheria di COSTAGLIOLA MARIA GIUSEPPINA|Nuovo|13:09–13:39|14:09–14:39|0,3|
|11|MAMBO CAFE DI PATRUNO EMANUELE|Nuovo|13:44–14:14|14:44–15:14|2,1|
|12|Tabaccheria di HU ANGELA|Nuovo|14:14–14:44|15:14–15:44|0,3|
|13|O.S. TABACCHI|Esistente|14:47–15:17|15:47–16:17|1,2|

La colonna dei chilometri per tappa non include il tratto finale di rientro e non sostituisce il totale del server. Il nome con caratteri anomali alla tappa6 è **copiato dal servizio**, non corretto nel CRM né dal client.

### Follow-up e qualità dati
- Domanda reale sui due follow-up arretrati del9 ottobre, ore11:00 e16:00, visualizzati dal server come «Cliente» e «Pinco pallino».
- Risposta autorizzata `include_all`. Il server segnala entrambi **fuori dall'area del giro**: non li inserisce e non riserva tempo; restano da pianificare separatamente. I due avvisi sono presenti in entrambi i piani.
- Nessun follow-up marcato completato, spostato o riscritto dal client di collaudo. La decisione riguarda soltanto la pianificazione tecnica.
- Piano: `candidatesComplete:true`, `poolTruncated:false`, `purchasesVerified:true`, `registryVerified:true`,672 esclusioni motivate nel payload. Sono attestazioni del motore, non un audit indipendente delle anagrafiche.
- `lastOrderDate`/`daysSinceOrder` null per tutte le13tappe ricevute: non sono stati inventati ordini o giorni di inattività. L'esattezza storica degli ordini non è verificabile soltanto dal flag purchasesVerified.
- `outsideWindow:false` per tutte le tappe, nessun conflitto o decisione pendente nel piano finale.

## 5. Autorità server e controlli sui valori
- Nessuna query CRM diretta né chiamata OSRM dal client/harness: guard di rete ammette solo Auth token/user e la singola funzione richiesta, con redirect vietati.
- Parsing, clienti, date, orari, pause e routing sono ricevuti dal motore. Il client non riordina né amplia l'area.
- Assert live sull'ordine dei nomi delle tappe e sulle coordinate complete passate alla presentazione: corrispondenza esatta con il JSON server, senza inversioni LAT/LNG.
- Controllo successivo **offline** sui risultati già ricevuti: somme di guida/visite/pausa/attesa, transizioni arrivo→visita→trasferimento, rientro, durata totale e margine coerenti. Non produce un nuovo piano, non corregge dati e non esegue ulteriori richieste.
- La nuova pausa prima della tappa8, invece che10, proviene dal secondo piano server: non è stata ottenuta spostando localmente gli orari di un'ora.

## 6. Scritture tecniche e tracciabilità

Osservati nel protocollo:
- **1 sessione:** `76c6971d-3819-4f0b-9955-91d3cd2042dc`.
- **3 turni accettati:** revisioni1→2→3.
- **2 piani distinti:** `5992df0c-6d66-4196-9390-7ec98d762ae3` e `cc2d1c97-454f-4dcd-9ecb-3afc144f0957`.
- **5 requestId distinti trasmessi**, oltre alla sonda senzaID; uno è stato ripetuto una volta per idempotenza. Un ID appartiene al conflitto rifiutato.

**Non è un conteggio SQL delle righe scritte.** Il collaudo non ha interrogato né modificato direttamente `gptour_orchestrator_*`; numero esatto di insert/update/cache row resta non osservabile da questi soli risultati. Il recupero effettivo del piano e il replay attestano persistenza tecnica del servizio. Non è stata effettuata pulizia server delle sessioni di prova.

Nessuna richiesta diretta verso clienti/ordini/appuntamenti/follow-up/territori/visite/tour. Il contratto del servizio limita le proprie scritture a tabelle tecniche. **Non è stato effettuato un diff indipendente del database prima/dopo**, quindi non si presenta l'assenza di scritture operative server-side come audit DB autonomo.

## 7. Errori incontrati e risolti nel solo harness

Prima del login, il primo avvio locale si è fermato con `SUPABASE_ANON_INVALID`: il controllo di sicurezza del harness accettava solo la vecchia chiave anon JWT, mentre la configurazione esistente usa una legittima chiave **publishable opaca**.

- Quell'avvio aveva **0 Auth /0 Edge**, non un'autenticazione fallita.
- Corretto soltanto il validatore del harness, senza cambiare chiave, env, account, auth dell'app o servizio. Rifiuto di `sb_secret_` e service_role preservato.
- Incidente originario conservato in `preflight-incident-original.json`, log e `iteration_74.json`. Ripresa consentita solo con prova di zero tentativi Auth/Edge; contatore mai azzerato.
- Login reale effettuato successivamente **una sola volta**, riuscito. Nessun errore applicativo live inatteso osservato.
- Runner ora fermato permanentemente per questa autorizzazione; non rilanciarlo o eliminare marker/ledger.

## 8. Verifiche ulteriori necessarie
1. UI e mappe reali, tastiera, safe area, touch, lifecycle e rete su Android/iPhone; istruzioni in `PHASE5_MOBILE_NATIVE_TEST_INSTRUCTIONS.md`.
2. Accesso a un client nativo di collaudo corrispondente a questi sorgenti e con accesso pilota circoscritto: **non preparato/attivato in questa fase**.
3. Fixture P1 completa dell'AI Web: il risultato live ha spontaneamente13tappe/79,7km/2704punti, ma la coincidenza dei totali **non certifica la parità esatta** con Web. Non sono stati ricostruiti artificialmente tappe o geometria.
4. Conferma amministrativa read-only della revisione di pubblicazione v6, se richiesta; engine0.2.0 osservato non ne è prova esclusiva.
5. Durata cache idempotenza/TTL server e retry su reali interruzioni di rete, non testati in questo run sano.
6. Eventuale audit DB delle sole scritture tecniche, da concordare senza accesso privilegiato o modifiche.
7. Qualità del dato nominale tappa6, solo segnalata; nessuna correzione CRM autorizzata.

## 9. Evidenze e controlli locali finali
- `test_reports/phase5_live_first/edge-ledger.json`:7 prenotazioni/7 risposte, status e hash, senza header sensibili.
- `live-result.json`: risultati e itinerari minimizzati; token/password/risposte Auth non conservati.
- `live-run-after-preflight-correction.log`:1 macro-test live PASS,8 controlli offline intenzionalmente esclusi da quel run.
- `dry-final.log`:9 test di guard/preflight PASS, test live escluso; nessuna rete. L'ultimo protegge anche il rapporto concluso da sovrascrittura/rilancio.
- `tsc-final.log`, `lint-final.log`:PASS. `regression-app-final.log`:426 regressioni applicative PASS, esclusione esplicita del solo file lockfile storico. I6 failure lockfile preesistenti non modificati; questa fase non li riapre.
- Controllo locale degli artefatti: nessuna password Pirone né JWT nei rapporti. Ordine/tempi del server e conteggio audit coerenti.
- Confronto Git readonly contro `2dc33be3c3323ab39661f64e6d7966ebbad9c6bc`: nessuna modifica ai moduli operativi frontend/backend/config; aggiunti soltanto harness e documentazione/report.

**Fase controllata conclusa. Nessun'altra chiamata, attivazione nativa o operazione Git/pubblicazione senza nuove istruzioni.**