# Fase5 — consegna verificatore offline autonomo P1

## Esito
**Verificatore pronto e collaudato. Fixture reale P1 NON eseguita nel workspace Mobile.** L'AI Web eseguirà il tool dove conserva già i tre JSON originali e restituirà soltanto il risultato aggregato.

### Materiale trasferibile
1. `tools/gptour-offline-verifier/gptour-p1-verify.cjs` — unico file JavaScript necessario,53678byte, Node18+, zero dipendenze esterne.
2. `tools/gptour-offline-verifier/TRANSFER_TO_AI_WEB.md` — istruzioni e **codice completo incorporato**, inoltrabile come testo, senza accesso al workspace Mobile.

SHA256 del file `.cjs`: **`71e7672d7d5a90727e5ebbb3bc98c9166d91d15bf38dd40aa9ae99c3544ef03e`**.

Il destinatario salva il blocco JavaScript del documento come file UTF8/LF con newline finale e ne confronta il digest. Non deve ricevere un link all'anteprima né scaricare una pagina HTML rinominata. Il codice non contiene originali P1, credenziali, sessioni o coordinate reali. La consegna come testo non richiede di rendere pubblica la fixture.

## Riutilizzo del codice Mobile
Il generatore riprende **10moduli puri effettivi** da `frontend/lib/aitour/orchestrator`: contratto, errori, coordinate, wire-contract, wire-actions, wire-response, presentation, request, view e binding. TypeScript è usato solo nel workspace Mobile per rimuovere le annotazioni/trasporre i moduli: il file consegnato non richiede compilazione o pacchetti.

Vengono realmente eseguiti `buildRequest`, `validateWireRequest`, `validateWireResponse`, `decodeOfficialResponse`, `presentPlan`, `presentQuestion`, `assertSnapshot` e le conversioni coordinate. Non viene importato il client Supabase o alcun modulo Auth/rete. I fingerprint delle sorgenti incluse sono nel rapporto; `generate.cjs --check` verifica che il sorgente portatile e l'handoff corrispondano alle funzioni Mobile correnti.

## Matrice funzionale
| Requisito | Implementazione |
|---|---|
|Tre turni originali locali|Tre file, array/contenitore unico o selezione con tre JSON Pointer; nessun ordinamento indovinato|
|Contratto API1.0|Validazione mediante funzioni Mobile effettive, engine0.2.0, correlazioni e revisioni|
|13tappe e identificativi|Unicità e ordine delle chiavi; confronto dettagli tappa e key delle azioni Mobile, senza esportarle|
|2704coppie coordinate|Uguaglianza completa tuple→modelloMobile, stesso ordine LAT/LNG; confronto fra i due piani|
|79,7km e totali|Aspettativa P1, controllo metriche visuali e somme dei tempi, senza chiamate routing|
|Partenza07→08|Start420→480, revisione/planId nuovi, stesso percorso e criteri; fine+60 e margine−60|
|Pause/follow-up/avvisi|Pausa totale30min, due follow-up correttamente associati, domande/opzioni/avvisi preservati; la pausa può cambiare tappa|
|Rapporto senza dati reali|Codici/turni/conteggi/totali/orari aggregati, nessun ID, nome, coordinate, domanda o avviso grezzo|
|Errori deterministici|Exit0PASS,1FAIL verifiche,2ERROR input/output; niente stack trace o valori input negli errori|
|Protezione originali|Solo lettura, confronto byte-digest prima/dopo, output esclusivo senza sovrascrivere file/link|

Se le richieste originali sono assenti, il tool lo dichiara tramite `requestCoverage`; le correlazioni generate in memoria non vengono spacciate per richieste reali verificate. Se presenti, sono validate e confrontate con il payload effettivamente accettato dal costruttore Mobile.

## Verifiche eseguite sul tool
- **50 test automatici PASS**, con dati **SINTETICI** e mutazioni negative; fixture reale non disponibile/usata.
- **476 regressioni applicative PASS**,44file; escluso esplicitamente soltanto `build_lockfile.test.ts`, con i6failure baseline già documentati e non modificati.
- TypeScript e lint mirato PASS; sintassi Node e corrispondenza sorgenti/handoff PASS.
- Esecuzione del **solo file `.cjs` copiato in una directory vuota**, senza node_modules o accesso ai sorgenti Mobile:PASS.
- Esecuzione del codice **estratto dal testo completo dell'handoff**, con digest uguale al file sorgente:PASS.
- Negative: versioni/identità/revisioni, duplicati, conteggi, geometry fuori range, mutazioni distanze/tempi/pausa/criteri/avvisi, input HTML/nonJSON, URL, dimensioni, pointer errati, output esistente/symlink/hardlink: codice nonzero verificato.
- Privacy: marker artificiali in nomi, ID, domande, avvisi e percorsi non compaiono in stdout/stderr/report, né in PASS né in FAIL/ERROR.
- Pausa sintetica spostata da prima tappa10 a prima tappa8:PASS, senza ipotesi errata di traslazione uniforme di tutti gli arrivi.
- Temporanei sintetici ripuliti; i test aggiornati li eliminano automaticamente dopo ogni caso. Nessun originale reale letto, copiato o modificato.

Evidenze: `frontend/tests/gptour_offline_verifier.test.ts`, `test_reports/iteration_76.json` (prima revisione41test), `test_reports/offline_verifier/app-regression.log`, `tsc.log`, `verification.json` (consolidamento finale50test).

## Limiti da non trasformare in PASS
- **P1 reale: in attesa dell'esecuzione da parte dell'AI Web** e restituzione dell'aggregato.
- **Rendering Android/iPhone/browser: NON eseguito.** Il tool confronta il modello dati delle trasformazioni condivise, non l'interfaccia o il renderer mappe.
- Provenienza/autenticità del JSON non attestata senza una fonte fidata esterna; il tool prova immutabilità durante il run e fedeltà Mobile allo stesso JSON, non che il JSON sia l'originale storico.
- `verified_routing/osrm` è il flag del server controllato come parte del profilo P1, non un nuovo calcolo stradale o una prova sul campo.
- Profilo strettamente P1: un altro piano valido per l'app può fallire queste aspettative. Non modificare originali o tolleranze per forzare PASS.

## Arresto e vincoli
**0 nuove chiamate live**, contatore storico fermo a7. Nessuna modifica al codice operativo del client, motore centrale, GPTour legacy, env/config, database o RLS. Nessun push/merge/build nativa/OTA/pubblicazione; futuro ramo remoto esclusivamente `conflict_170826_1303`.

Passo successivo: inoltrare **il contenuto testuale** di `TRANSFER_TO_AI_WEB.md`; ricevere solo il report aggregato e l'exit code. Nessun trasferimento della fixture reale è necessario.