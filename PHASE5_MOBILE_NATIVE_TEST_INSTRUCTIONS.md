# GPTour Orchestrator — istruzioni pratiche Android e iPhone

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
- SessionId e planId (identificatori tecnici, **non** JWT), revisioni e requestId dei soli passaggi da confrontare.
- Stato `ready/planning/...`, routing source, tappe, km, orari, pausa, avvisi.
- Esito mappa/tastiera/lifecycle/retry; screenshot minimizzati.
- Invocazioni Edge dispositivo / cumulativo, scritture tecniche osservate, anomalie.
- Esito distinto **PASS / FAIL / NON ESEGUITO**, senza trasformare un test incompleto in successo.

Confronto P1 esatto solo dopo ricezione/validazione della fixture completa AI Web e sul medesimo JSON; non adattare artificialmente il piano live ai totali storici.

**STOP** su login fallito, identità errata, traffico o scritture operative inattese,429, errore contrattuale o budget raggiunto. Restituire risultati e attendere nuove istruzioni; nessun rilascio o intervento sul motore centrale.