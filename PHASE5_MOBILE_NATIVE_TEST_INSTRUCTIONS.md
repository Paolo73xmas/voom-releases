# GPTour Orchestrator — istruzioni pratiche Android e iPhone

## Procedura materiale proposta — verifica finale Fase5

**Raccomandazione: due app di collaudo separate, installate privatamente tramite build interne standalone.** Android:APK; iPhone:IPA firmata ad hoc sul dispositivo registrato. Non serve pubblicazione su store né invio tramite TestFlight. Non usare gli identificatori dell'app operativa: una variante separata deve avere nome, icona/scheme e package/bundle identifier distinti, così può convivere con VOOM senza sostituirla.

Questo è il percorso ufficiale Expo/EAS, da eseguire tramite un ambiente e un account autorizzati. **Non dichiara che qui siano già disponibili account, firma o pacchetti installabili. Nessun comando di build/registrazione dispositivo è stato eseguito.**

### Configurazione attuale letta, non modificata
- ExpoSDK54, ReactNative0.81.5, react-native-maps1.20.1 e keyboard-controller1.18.5.
- `expo-dev-client` non è fra le dipendenze dichiarate.
- `eas.json` ha `development` con `developmentClient:true` e **`ios.simulator:true`: quel profilo iOS è per simulatore, NON installabile su un iPhone fisico**.
- Il profilo `preview` ha già `distribution:internal` e `ios.simulator:false`; è il punto di partenza per un nuovo profilo test separato, non un'autorizzazione a costruire l'app corrente senza altre verifiche.
- Il profilo Android production produce AAB: per installazione diretta serve **APK**, non AAB.
- In `app.json` non risulta configurata la chiave Android Google Maps; un'eventuale configurazione esterna di firma/mappe non è stata verificata. Va predisposta/verificata sul package e certificato della **variante test** affinché la mappa funzioni nell'APK autonomo. La mappa iOS attuale non forza Google e può usare Apple Maps.
- Pilota Orchestrator spento; nessun telefono, `adb`, Xcode o `xcrun` disponibile in questo ambiente.

### Android — strada più semplice per il tester
1. Dopo nuova autorizzazione, predisporre variante **VOOM GPTour Test** e un profilo interno separato (nome proposto `pilot`, oggi non esistente), senza modificare il profilo operativo.
2. Verificare dipendenze/lockfile, firma e Google Maps del package test; limitare l'ingresso Orchestrator alla variante di collaudo e impedire scritture CRM/attività automatiche non autorizzate. Gli attuali6 errori lockfile restano un controllo da risolvere o chiarire **prima** di promettere una build riuscita, non sono stati corretti qui.
3. L'operatore autorizzato genera un **APK firmato** tramite EAS Build su un progetto/account controllato. L'APK standalone include il codice applicativo e non richiede Metro o Expo Go per l'avvio.
4. Si consegna l'accesso riservato al pacchetto al solo tester. Sul telefono: scaricare l'APK, consentire l'installazione da quella fonte quando Android lo richiede, installare **VOOM GPTour Test** e verificare che VOOM operativa sia ancora separata e invariata.
5. Avviare il collaudo concordato; l'installazione non autorizza nuove chiamate Supabase. Senza nuovo consenso live si usa un percorso offline isolato, non login automatico/CRM.

### iPhone — senza App Store né TestFlight
1. Servono accesso autorizzato al progetto Expo/EAS, un **Apple Developer Program** valido e disponibilità dell'iPhone del tester. Credenziali Apple e materiali di firma vanno gestiti tramite i flussi autorizzati, mai copiati in chat/report.
2. Dopo autorizzazione alla registrazione, l'operatore usa `eas device:create` e il tester segue sul proprio iPhone la procedura di registrazione UDID. L'UDID reale non va inserito nel repository o nel rapporto condivisibile.
3. Creare il provisioning ad hoc della variante test includendo quell'iPhone; usare il profilo interno per dispositivo reale, **non** quello con simulatortrue. Firma, certificati e identificatore dell'app test devono essere coerenti.
4. Generare l'IPA con EAS Build e fornire al tester l'accesso riservato di installazione. Aprire il collegamento sul dispositivo registrato e seguire la procedura. Non inviare a store e non sostituire l'app VOOM operativa.
5. Aprire **VOOM GPTour Test** e svolgere la stessa matrice Android, verificando specificamente mappe, tastiera, safe area e lifecycle iOS. Eventuali nuove registrazioni Apple possono richiedere attesa prima della firma; non promettere installazione immediata prima di aver verificato il profilo.

### Comandi previsti, NON eseguiti e NON ancora pronti all'uso
Solo dopo configurazione/approvazione del nuovo profilo `pilot`, su una macchina/account autorizzati:
```text
eas build --platform android --profile pilot
eas device:create
eas build --platform ios --profile pilot
```
Il profilo deve produrre APKAndroid e IPAiPhone interna; la separazione del package/bundleID è una configurazione della variante app, non avviene semplicemente cambiando il nome del profilo EAS. Nessun `eas submit`, nessun `eas update`, nessun push Git è parte di questi passi.

### EAS, development build e Expo Go: cosa serve davvero
| Opzione | Serve una nuova build? | Strumenti | Adeguatezza per questo collaudo |
|---|---|---|---|
|**EAS internal preview standalone**|Sì,APK/IPA|Account/progetto EAS; firma e UDIDApple per iPhone|**Consigliata**: tester apre app autonoma, senza Metro; expo-dev-client non necessario per questa modalità|
|Development build|Sì,una prima build dedicata|Percorso standard con expo-dev-client, Metro raggiungibile; EAS o tool locali|Utile per debugging/iterazioni; dipendenza/configurazione standard non ancora predisposte qui|
|Build locali|Sì|AndroidStudio/SDK/JDK; **Mac con Xcode per iPhone**|EAS cloud opzionale; richiede una macchina esterna configurata. Firma locale iPhone con PersonalTeam possibile con i suoi limiti; non equivale a distribuzione ad hoc cloud|
|Expo Go|Nessun binario custom|Expo Go compatibile con SDK54 e tutte le librerie native usate|Solo primo smoke se compatibile; non certifica configurazione/firma/mappe dell'app autonoma. Compatibilità dell'ExpoGo attualmente installabile su quel telefono non verificata: non promettere che basti il QR|

EAS è quindi **la proposta più semplice per evitare tool di compilazione locali**, non un requisito assoluto dell'app. La procedura ufficiale iOS ad hoc è un'alternativa a TestFlight; la documentazione sintetica della piattaforma consultata non era esaustiva su questa modalità.

### Separazione dagli agenti e protezione dati
- Variante distinta, non stesso package/bundleID; nessuna OTA, canale condiviso o aggiornamento dell'app operativa. Verificare/disabilitare gli aggiornamenti automatici nella sola variante test prima della build.
- Le URL EAS interne possono essere accessibili a chiunque possieda il link per impostazione predefinita: disabilitare **Unauthenticated access to internal builds** per richiedere account Expo autorizzato e condividere solo ai tester.
- La fixture reale **NON deve entrare nel sorgente, nell'archivio inviato a EAS, nel bundle JS, negli asset APK/IPA o nei log di build**. Escludere anche rapporti storici con dati reali, `memory/` e artefatti di test dall'archivio build e ispezionare il suo contenuto prima dell'invio, dopo consenso.
- Se successivamente si autorizza la fixture reale sul telefono, caricarla soltanto a runtime tramite un canale privato concordato, non distribuirla incorporata nella build. In alternativa, smoke nativo con dati sintetici dichiarati; ciò non vale come parità P1 esatta.
- Prima di qualsiasi fase live sul telefono concordare un nuovo budget e isolare le chiamate automatiche. Il consenso attuale permette solo offline; contatore della precedente fase resta7.

### Cosa manca e che cosa richiede autorizzazione
1. Vero ZIP/JSON della fixture: l'allegato ricevuto in questa fase è HTML, confronto esatto bloccato.
2. Approvazione della variante test/profilo dedicato e dei necessari adeguamenti di configurazione (nessuno applicato ora).
3. Accesso a un account/progetto EAS appropriato oppure a una macchina di compilazione esterna; configurazioni di firma, AppleDeveloper/iPhone da registrare e mappeAndroid.
4. Autorizzazione separata prima di inviare sorgenti a un servizio di build, registrare dispositivi, generare/distribuire pacchetti; successivo consenso per eventuali chiamate live.

Fonti ufficiali consultate:
- https://docs.expo.dev/build/internal-distribution/
- https://docs.expo.dev/develop/development-builds/introduction/
- https://docs.expo.dev/versions/v54.0.0/sdk/map-view/

---
## Matrice operativa precedente — da usare solo dopo i prerequisiti sopra

**Documento operativo per la fase successiva, NON prove già eseguite.** Il primo collaudo si è fermato a7/25 chiamate Edge e ha usato un harness Node, non un telefono. I18 invii non utilizzati non vengono consumati automaticamente: concordare nuove istruzioni prima di procedere.

## 1. Prerequisiti bloccanti per entrambi i telefoni
1. Concordare operatore, dispositivi/modelli/versioniOS, account Pirone, orario, scenario e un budget **unico condiviso** fra dispositivi, sonde e retry. Un accesso alla schermata può già consumare una sonda; una ripresa sessione può inviare get_plan.
2. Disporre del **client nativo di collaudo già approvato e corrispondente ai sorgenti Fase5**, non della preview aperta in Chrome/Safari e non di una vecchia versione legacy. Usare un'app di sviluppo compatibile già disponibile o il pacchetto di prova concordato. Non sono stati generati/distribuiti nuovi pacchetti in questa fase.
3. **Oggi il pilota è spento.** Prima del test deve essere autorizzato e predisposto l'accesso soltanto per il client/account di collaudo. Se compare «Collegamento operativo non attivo», fermarsi: non cambiare il server, non usare legacy per simulare l'esito e non attivare globalmente gli agenti.
4. Prima del login, l'operatore tecnico verifica l'isolamento delle richieste automatiche dell'app. Consentire solo autenticazione/letture profilo necessarie concordate e gptour-orchestrator; bloccare scritture CRM, tracking, visite e heartbeat. **Questo isolamento non è ancora certificato sul bootstrap nativo.** Se non è garantibile, non procedere sul CRM condiviso.
5. Preparare un contatore delle invocazioni con logging privo di token/password, e registrare versione/fingerprint del client. Non esportare sessioni Auth o catture HTTP integrali con header di autorizzazione.
6. Accedere personalmente come Salvatore Pirone usando le credenziali tramite il canale già approvato. Non copiarle nel rapporto. Se il login fallisce: STOP, niente altri account, impersonificazione, reset password o tentativi ripetuti.

Non autorizza push, merge, OTA, deployment o pubblicazione. Se manca un client compatibile o l'accesso pilota circoscritto, segnalarlo: la guida non rende automaticamente eseguibile l'app attuale sui telefoni.

## 2. Telefono Android — procedura
1. Annotare modello, versione Android e versione del client; verificare che sia aperta un'app nativa e non il browser.
2. Avviare il client di collaudo approvato. Effettuare il login Pirone una sola volta e aprire la schermata dedicata **GPTour Orchestrator** tramite l'ingresso predisposto per il test.
3. Controllare che accesso/identità siano quelli concordati e che non vi siano attività operative o tracking. Contare la sonda Edge.
4. Toccare l'input, digitare:
   **«Organizzami un giro per domani a Milano, visitando clienti esistenti e nuove tabaccherie mai visitate.»**
   Inviare una sola volta. Verificare che tastiera e pulsante Invio restino utilizzabili.
5. Leggere la domanda reale prima di rispondere. Per follow-up proposti scegliere **«Includili tutti»**, come nello scenario concordato. Se il motore chiede una diversa decisione commerciale/data, non sceglierla automaticamente: concordarla.
6. Attendere il piano. Annotare data, revisione, tappe/km/orari, pausa, rientro e avvisi. **Non aspettarsi sempre13tappe/79,7km**: i dati live e «domani» possono cambiare.
7. Aprire/controllare la mappa nativa: numero e ordine marker, partenza/rientro, percorso ricevuto, zoom/pan/fit. Confrontare con il JSON dello stesso piano, non con un altro giorno. Se `planning/estimated_routing`, deve essere esplicitamente una bozza senza conferma.
8. Scorrere tutte le tappe, avvisi ed esclusi. I follow-up fuori area devono restare segnalati, non inseriti dal telefono. Non aprire schede operative, chiudere appuntamenti o modificare clienti.
9. Inviare **«Parto alle8»**: nuova richiesta, stessa sessione, revisione successiva. Verificare che data/gruppi/area restino quelli server e che pause/orari aggiornati siano quelli del nuovo piano, non uno spostamento locale.
10. Mettere l'app in background e riaprirla; poi, come prova separata, chiuderla e riaprirla. Contare eventuali get_plan. Verificare recupero coerente senza doppio invio o ricostruzione da transcript.
11. Provare tasto Indietro Android, tastiera aperta/chiusa, schermata piccola e rotazione se supportata. Nessun taglio del pulsante Invio o overflow.
12. Confermare il piano **solo se il pulsante dichiara conferma locale** e il contatore dimostra zero nuove richieste. Non avviare Live Tour o salvataggi operativi.
13. Fermarsi, annotare esiti/screenshots senza credenziali e consegnare il contatore finale. Nessuna cancellazione server automatica delle sessioni tecniche.

## 3. iPhone — procedura
1. Annotare modello, versione iOS e versione del client. Aprire il client nativo di collaudo approvato: **Safari non equivale a iOS nativo**.
2. Ripetere i punti2–10 della procedura Android, in una **nuova sessione tecnica** e dentro il budget condiviso concordato. Non riutilizzare una sessione di un altro account.
3. Verificare notch/Dynamic Island, safe area inferiore e home indicator; input e Invio devono restare raggiungibili con la tastiera iOS aperta.
4. Controllare la mappa sul renderer/provider effettivamente usato da iOS: marker, geometria, zoom/pan e ritorno dalla mappa. Una mappa corretta su Android non certifica iPhone.
5. Verificare gesture di ritorno, background/foreground, blocco/sblocco schermo e chiusura/riapertura. Segnalare qualsiasi piano precedente mostrato come attuale senza conferma server.
6. Eseguire la conferma solo locale e raccogliere esiti separati da Android, con conteggio delle proprie chiamate e totale cumulativo.

## 4. Rete, retry e conflitti — prove assistite
- **Rete assente:** disattivare la rete prima di un unico invio, attendere l'errore, riattivare e usare «Riprova la stessa richiesta». L'operatore confronta requestId/body; non creare una nuova conversazione per aggirare l'attesa. Questa prova verifica la ripresa, non necessariamente la cache server se il primo invio non è mai arrivato.
- **Risposta persa dopo ricezione server:** serve fault injection/proxy di collaudo controllato. Non guastare il servizio condiviso e non consumare retry alla cieca. Confrontare stessoID/revisione/planId; TTL cache da chiarire prima di prove a lunga distanza.
- **Conflitto409:** serve un operatore tecnico con due richieste controllate sulla stessa sessione di test e revisioni note; non esiste una manovra affidabile solo a doppio tap. Attendersi aggiornamento revisione e richiesta di nuovo invio esplicito, non fallback legacy. Questa prima fase ha già verificato409 HTTP, **non** la presentazione nativa.
- Login scaduto,403/422/500/503 e multigiorno possono essere verificati con fixture native isolate o casi reali concordati. Non provocare intenzionalmente guasti server, modifiche permessi o cambio allowlist.

## 5. Emulatori e dispositivi fisici: registrare separatamente

| Ambito | Emulatore Android / simulatore iOS | Telefono Android / iPhone |
|---|---|---|
|Layout, testo, domande, stati, scorrimento|Utile|Conferma necessaria|
|Mappe e geometria|Primo controllo|Obbligatorio sui due sistemi|
|Tastiera, gesture, safe area|Parziale|Obbligatorio|
|Cambio Wi-Fi/mobile, sospensione, chiusura processo|Simulazione parziale|Obbligatorio|
|Risposta persa/conflitto|Strumentazione controllata|Campione assistito|

In questo workspace non erano presenti `adb`/`xcrun` o device collegati: tutte le caselle native sono ancora **NON ESEGUITE**. Nessuna equivalenza con screenshot browser o runner Node.

## 6. Scheda da compilare
- Dispositivo / emulatore, modello, OS, client/fingerprint e data/ora Europe/Rome.
- Scenario e risposte alle domande; eventuali decisioni non ancora autorizzate.
- Nel rapporto condivisibile: revisioni, conteggi e risultati aggregati. Eventuali identificatori tecnici necessari all'indagine restano soltanto in un'area privata temporanea, mai in commit, bundle o report condivisi.
- Stato `ready/planning/...`, routing source, tappe, km, orari, pausa, avvisi.
- Esito mappa/tastiera/lifecycle/retry; screenshot minimizzati.
- Invocazioni Edge dispositivo / cumulativo, scritture tecniche osservate, anomalie.
- Esito distinto **PASS / FAIL / NON ESEGUITO**, senza trasformare un test incompleto in successo.

Confronto P1 esatto solo dopo ricezione/validazione della fixture completa AI Web e sul medesimo JSON; non adattare artificialmente il piano live ai totali storici.

**STOP** su login fallito, identità errata, traffico o scritture operative inattese,429, errore contrattuale o budget raggiunto. Restituire risultati e attendere nuove istruzioni; nessun rilascio o intervento sul motore centrale.