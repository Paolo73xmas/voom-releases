# GPTour P1 — verificatore offline autonomo

## Consegna al destinatario
- **`gptour-p1-verify.cjs`**: unico file eseguibile necessario, testo JavaScript autosufficiente; Node18+, nessun pacchetto da installare.
- **`TRANSFER_TO_AI_WEB.md`**: istruzioni, digest e **intero sorgente incorporato**, inoltrabile come testo. Non serve accesso al repository/workspace Mobile.
- Non trasferire fixture, rapporti live precedenti, credenziali o coordinate insieme al codice. Non utilizzare link di anteprima per scaricare il verificatore: copiare il sorgente come testo o estrarlo dal blocco JavaScript del documento.

Le risposte originali restano nel workspace Web. Il destinatario esegue il file localmente e restituisce solo il report aggregato e l'exit code. Il tool non rigenera alcun percorso, non usa servizi e non modifica gli originali. Rifiuta sovrascritture del report e limiti di input non conformi.

**Stato P1 reale: NON ESEGUITO qui.** Le prove nel workspace Mobile usano dati SINTETICI e mutazioni per verificare il comportamento del tool, non per ricostruire la fixture mancante. Android/iPhone/browser rendering non sono certificati dal verificatore; sono confrontati contratto e trasformazioni del modello dati effettivo del client.

## Manutenzione nel solo workspace Mobile
I file `checks.cjs`, `cli.cjs`, `generate.cjs` e `handoff-instructions.md` servono a generare e mantenere la consegna, **non sono dipendenze del destinatario**.

Il generatore usa TypeScript già disponibile nel frontend e trascrive automaticamente10moduli puri del client, senza modificarne i sorgenti o includere codice rete/Auth/Supabase. Non è una build dell'app o un aggiornamento OTA: produce soltanto testo JavaScript/Markdown del verificatore.

```sh
node tools/gptour-offline-verifier/generate.cjs
node tools/gptour-offline-verifier/generate.cjs --check
cd frontend
./node_modules/.bin/vitest run tests/gptour_offline_verifier.test.ts
```

`--check` fallisce se il file portatile o l'handoff testuale sono obsoleti rispetto alle funzioni pure e al codice del verificatore. Non modificare direttamente i file generati: cambiare il generatore/check/CLI appropriato e rigenerare, poi ripetere i test.

La suite verifica formato, invarianti P1, confronto completo Mobile/JSON, privacy degli errori, output0600, input immutati, file/report protetti e funzionamento del testo trasferito da una directory vuota. Tutti i dati delle prove sono artificiali e temporanei.