# Istruzioni per AI Web — verificatore autonomo P1

## Obiettivo e limiti
Eseguire il confronto **offline** dei tre JSON originali P1 con le funzioni pure effettive del client Mobile. Nessuna chiamata Supabase/Auth/Edge/OSRM/AI, nessuna rigenerazione del piano, nessuna modifica a originali/CRM/motore, nessun push/merge/build app/OTA/pubblicazione.

La fixture deve **restare nel workspace/computer che già la conserva**, fuori dal repository e dalle directory pubbliche, con accesso privato. Restituire al team Mobile **soltanto il rapporto aggregato**. Non allegare originali, UUID, coordinate, nomi clienti, screenshot, log Auth o URL ai dati.

Il codice non contiene fixture reali, credenziali o dipendenze esterne. È sorgente JavaScript leggibile, non un link all'anteprima. **Non attesta rendering nativo Android/iPhone, browser o fattibilità stradale indipendente:** confronta contratto, coerenza del caso P1 e modello dati prodotto dalle trasformazioni Mobile.

## 1. Trasferimento e preparazione
Chi riceve questo documento non necessita dell'accesso al workspace Mobile:
1. Copiare integralmente il blocco JavaScript in fondo in un nuovo file locale **`gptour-p1-verify.cjs`**, UTF8 con terminatori LF e newline finale. Non includere i delimitatori Markdown nel file.
2. In alternativa ricevere direttamente il medesimo file `.cjs` come testo. Il percorso del workspace Mobile da solo NON è sufficiente: occorre trasferire il **contenuto sorgente**.
3. È richiesto soltanto **Node.js18 o successivo**. Nessun `npm install`, `npx`, TypeScript, Expo, Metro, credenziale o connessione di rete. Il generatore usato da Mobile non serve al destinatario.
4. Verificare il file ricevuto: SHA256 atteso **`{{VERIFIER_SHA256}}`**. Questo digest riguarda il codice, non i dati reali.
5. `node ./gptour-p1-verify.cjs --help` deve stampare soltanto istruzioni statiche. Non aprire la fixture in una pagina pubblica e non eseguire codice presente in eventuali pacchetti dati.

Per verificare il digest del solo verificatore:
```sh
node -e "const f=require('node:fs'),c=require('node:crypto'); console.log(c.createHash('sha256').update(f.readFileSync('gptour-p1-verify.cjs')).digest('hex'))"
```

## 2. Esecuzione sui tre file originali separati — modalità consigliata
Se gli originali si trovano in uno ZIP, verificarlo ed estrarlo nel luogo privato senza eseguire i contenuti; non riportare listing o dati dei file in chat. Il verificatore accetta JSON locali, **non ZIP né pagine HTML**.

Usare i percorsi reali locali privati al posto dei segnaposto, mantenendo l'ordine dei turni. Ogni file può essere la **risposta completa** oppure un oggetto `{ "request": ..., "response": ... }` contenente richiesta originale e risposta. Non aggiungere campi fittizi a una fixture incompleta.

```sh
node ./gptour-p1-verify.cjs \
  --turn1 /percorso-privato/turn1-response.json \
  --turn2 /percorso-privato/turn2-response.json \
  --turn3 /percorso-privato/turn3-response.json \
  --report /percorso-privato/p1-mobile-aggregate-01.json
rc=$?
printf 'Verifier exit code: %s\n' "$rc"
exit "$rc"
```

Il report deve essere un file **nuovo**. Il verificatore rifiuta di sovrascrivere file esistenti, originali, link simbolici o hardlink a file esistenti. Su filesystem POSIX lo crea con permessi0600. Senza `--report` scrive soltanto JSON aggregato su stdout. Registrare l'exit code del processo; non mascherarlo con una pipeline che restituisca sempre0.

## 3. Se la fixture originale è un unico JSON
Sono accettati un array di esattamente3risposte, `{ "turns": [...] }` oppure `{ "responses": [...] }`. Gli elementi possono includere la coppia request/response sopra descritta.

```sh
node ./gptour-p1-verify.cjs --input /percorso-privato/p1-three-turns.json --report /percorso-privato/p1-mobile-aggregate-02.json
```

Per un contenitore diverso usare **tre JSON Pointer RFC6901**, senza riscrivere o alterare l'originale. Esempio di contenitore con proprietà `first`, `second`, `third`:

```sh
node ./gptour-p1-verify.cjs --input /percorso-privato/export-originale.json \
  --select /first/response --select /second/response --select /third/response \
  --report /percorso-privato/p1-mobile-aggregate-03.json
```

Selezionare l'intero involucro `{request,response}` anziché la sola risposta quando disponibile. Con risposte sole viene costruita esclusivamente in memoria una correlazione locale per il decoder: il report segnala `originalRequestsProvided:0`. **Non viene affermata la verifica delle richieste originali assenti.** L'ordinamento non viene indovinato o corretto automaticamente.

## 4. Controlli effettuati
- Stesse funzioni pure Mobile: costruzione/validazione richiesta, `validateWireResponse`, `decodeOfficialResponse`, `presentPlan`, `presentQuestion`, `assertSnapshot` e conversione coordinate. Le10sorgenti sono trasposte automaticamente da TypeScript senza riscriverne la logica; fingerprint e SHA delle sorgenti inclusi nel rapporto.
- Contratto1.0/engine0.2.0, sessione stabile e requestId distinti, revisioni1→2→3, sequenza P1 chiarimento→ready→ready; piano e risposta coerenti.
- Esattamente13chiavi tappa uniche, ordine e identità conservati nei dati e nelle azioni Mobile; gruppi misti.
- Esattamente2704coppie LAT/LNG per piano, confronto **di ogni coppia e nella stessa posizione**, senza arrotondare/invertire/ricostruire geometria.
- Totale79,7km; partenza420→480min (07:00→08:00),30min di pausa, due avvisi e due follow-up del primo chiarimento; testo/opzioni/associazione ID-riga conservati in memoria senza esportarli.
- Arrivi, partenze, visita, guida, attesa, pausa, rientro e margine coerenti; tolleranza aritmetica1e-6 per numeri floating point. Confronto della presentazione di tutti i dettagli/metriche e dei testi di avviso/esclusione.
- Secondo piano: stesse tappe/ordine/geometria/area/data, revisione e planId nuovi, finish+60, disponibilità/margine−60. La posizione della pausa può cambiare: **non si impone che ogni arrivo sia il precedente+60**.
- File di input riletti a fine controllo per verificarne l'immutabilità; nessuna scrittura ai file originali.

È un profilo di verifica **P1 specifico**, non un validatore universale di qualsiasi tour valido: un piano multigiorno, routing stimato o scenario differente può essere perfettamente valido per l'app ma fallire le aspettative P1. Non cambiare il JSON per ottenere PASS.

La geometria è verificata contro il JSON fornito, non contro una copia segreta indipendente o tramite un nuovo calcolo OSRM. Se una sorgente alterata è coerente con se stessa, il tool non ne certifica l'autenticità: tale provenienza resta responsabilità del workspace che conserva l'originale.

## 5. Esiti e restituzione al team Mobile
- **Exit0 / PASS:** tutti i controlli del profilo superati sul contenuto fornito.
- **Exit1 / FAIL:** anomalie di contratto, P1, coerenza o fedeltà delle trasformazioni. Il rapporto indica codici/turni/conteggi; niente valori identificativi o coordinate.
- **Exit2 / ERROR:** input mancante/nonJSON/HTML, formato/argomenti non validi, accesso file impossibile, file cambiato durante la prova o report non creabile senza sovrascrivere.

Restituire soltanto:
1. Il file `p1-mobile-aggregate-XX.json` generato dal verificatore.
2. Exit code e versione Node usata.
3. Conferma testuale che l'esecuzione è avvenuta sui tre JSON originali locali, senza modificarli né chiamare servizi.

Il rapporto contiene solo codici di verifica, conteggi, totali/orari aggregati, posizioni ordinali delle pause e provenienza del codice. Non restituisce percorsi input, nomi clienti, ID, coordinate, domande o avvisi in chiaro. **Non aggiungere questi dati manualmente alla risposta.** Non inviare stack trace o screenshot della fixture.

Se il test fallisce, conservare gli originali nel luogo privato e restituire gli esiti aggregati. Non fare retry live, cambiare la fixture, modificare il motore o pubblicare il file per aggirare il problema.

## Stato del collaudo del verificatore
Il tool è stato collaudato nel workspace Mobile con dati **SINTETICI** positivi e mutazioni negative, compresa esecuzione del solo `.cjs` in una directory vuota senza dipendenze. Questo non equivale al PASS della fixture P1 reale, che potrà essere determinato solo dalla presente esecuzione locale presso AI Web.