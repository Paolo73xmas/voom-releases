# GPTour Orchestrator — piano di collaudo Android/iPhone

**SOLO PIANO. Nessuna prova qui descritta è stata eseguita. Richiede nuova autorizzazione esplicita.**

## 1. Consenso e preparazione
Prima di procedere concordare: account pilota autorizzato, eventuale admin→agente destinatario, date/scenari, dispositivi, finestra temporale e budget massimo di chiamate. Proposta iniziale: massimo25 invocazioni Orchestrator totali per un pilota su una piattaforma; replica sulla seconda solo con budget separatamente approvato. Non creare account o cambiare allowlist autonomamente.

Autorizzazione richiesta anche per login/refresh, probe e letture CRM tramite Edge. I turni Orchestrator **creano/aggiornano sessioni e cache tecniche server**, pur non modificando clienti/ordini/follow-up: questa persistenza tecnica va approvata esplicitamente. Se non è ammessa alcuna scrittura server, limitarsi ai test isolati già eseguiti.

Verificare senza pubblicare: pacchetto mobile concordato e fingerprint sorgenti, contratto1.0/engine0.2.0 dichiarati, account esistente e sessione coerente, UI pilota abilitata soltanto nell'ambiente di collaudo approvato. Nessuna build remota, OTA, push o pubblicazione implicitamente autorizzata dal consenso al test.

Non transitare in Live Tour legacy né schermate che chiudano follow-up o avviino tracking. Vietati salvataggi tour/ordini/clienti, spostamenti appuntamenti, visite/ispezioni, heartbeat/GPS CRM e modifiche backend/RLS/Edge. Usare solo endpoint auth concordati e `gptour-orchestrator`; interrompere su traffico operativo inatteso. Nessun token/password nei log.

## 2. Matrice delle prove

| Prova | Emulatore Android / simulatore iOS | Dispositivo fisico Android + iPhone | Risultato atteso |
|---|---|---|---|
| Accesso/probe/ruoli | Sì, con account autorizzato | Conferma necessaria su entrambi | Probe400 abilitato senza sessione;403/503 informativi, nessun cambio motore automatico |
| Conversazione multi-turno | Sì | Sì | ID sessione stabile, requestId nuovi, revisioni server; testo originale inviato senza regole locali |
| Clienti15/20/30, misti, aggiungiOpera, cambiaora/data | Sì | Campione su entrambi | Criteri server preservati; nessun ampliamento locale; eventuali chiarimenti obbligatori |
| Follow-up aggregati e individuali | Sì | Sì | EventID esatti; indecisi riproposti; proposta riprogrammazione senza modifica CRM |
| ready/planning/infeasible/blocked/failed | Meglio fault injection isolata per errori rari | Verifica messaggi e non confermabilità | Bozza stimata visibile ma non confermabile; conferma ready solo locale |
| Retry dopo risposta persa | Sì con proxy controllato | Necessario Wi-Fi/mobile/airplane mode | Stesso body/requestId; nessun turno doppio. Prima chiarire durata cache server |
| Conflitto409 | Due client sulla medesima sessione **di test**, se approvato | Campione | Revisione aggiornata, nessun replay automatico, nuovoID soltanto dopo decisione utente |
| Ripresa get_plan | Sì | Necessario chiusura processo/riapertura | planId richiesto e piano identico, transcript locale non ricostruisce il percorso |
| Cambio account/agente/logout/TTL | Sì, inclusa simulazione tempo in harness | Necessario lifecycle nativo | Nessun transcript del precedente account; cambio agente nuova sessione; nessun risultato tardivo |
| Mappa geometria/ordine | Verifica iniziale renderer/provider | **Obbligatoria su entrambi** | Marker numerati, LAT/LNG non invertite, geometry server, partenza/rientro, fit e cambio giorno |
| Multigiorno/pernottamento | Fixture nativa isolata; live se scenario autorizzato | Sì | Nessun giorno inventato, warnings/ritorno/pernottamento come server |
| Tastiera/safe area/scorrimento/touch | Sì su schermi piccoli e grandi | **Obbligatoria**, tastiere reali/notch/rotazione | Input e invio raggiungibili; nessun overflow; avvisi e ultimo escluso leggibili |
| Background/foreground/rete lenta/doppio tap | Simulabile in parte | **Obbligatoria** | Una richiesta pendente, retry sicuro, nessun piano obsoleto confermabile |
| 401/403/409/422/500/503 | Mock/proxy di test; non guastare server condiviso | Smoke su errori naturalmente ottenibili | Recovery corretto,401 senza loop,403 senza retry automatico,422cached≠nuovoturno |
| Conferma piano | Sì | Sì | Solo stato UI, zero ulteriori chiamate/salvataggi CRM |

Mappe native/tastiera/lifecycle non possono essere certificati da screenshot browser. L'emulatore non sostituisce prove di rete, cold start e provider mappe su device. GPS acquisizione, voce/PDF/share e navigazione operativa non sono nuove funzioni di questo percorso e restano fuori perimetro.

## 3. Confronto WEB/MOBILE P1 Pirone
Chiedere prima una fixture completa anonimizzata (13 tappe e tutte le2704 coordinate) oppure approvare la generazione di un nuovo caso equivalente. Il valore storico **13 tappe /79,7km /07:00–15:53** non va imposto a dati CRM/agenda cambiati.

Per prova esatta usare **lo stesso JSON piano** su web e mobile: confrontare planId, revisione, ordine/key/coordinate delle tappe, geometry, date/minuti, metriche e avvisi. Per prova end-to-end usare stesso agente, contesto temporale Europe/Rome e versione, documentando eventuali differenze della snapshot. Non inviare `targetAgentId` dall'account agente. Test amministrativo separato con UUID approvato.

## 4. Stop e criteri di uscita
- Interrompere immediatamente per scritture CRM, account/target errato, versione diversa non compatibile, risposta malformata, leakage dati, 429 o retry ripetuti senza risultato.
- Per indisponibilità reale non modificare server/allowlist/RLS e non sostituire automaticamente con legacy.
- Conservare risultati distinti per Android/iOS, emulatore/device, OS/versione app, scenario, ID anonimi e numero richieste; non dichiarare un'intera piattaforma verificata da un solo browser.
- Uscita: matrice approvata PASS, nessuna scrittura operativa, confronto piano documentato e problemi residui espliciti. Restituire report e **fermarsi nuovamente**, senza push/OTA/pubblicazione.

## 5. Vincolo Git permanente
Locale `main` consentito; eventuale futura destinazione **esclusivamente `origin/conflict_170826_1303`**, fast-forward/no force, dopo nuova autorizzazione e controllo remoto. Nessun push su `origin/main`, merge, reset o cambio branch in questo piano.