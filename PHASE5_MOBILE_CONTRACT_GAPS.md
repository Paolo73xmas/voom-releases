# Fase 5 — compatibilità API 1.0 e gap residui

## Verifica finale P1 — aggiornamento input e provenienza v6
- **v6 attiva confermata direttamente dall'utente su Supabase**, con contratto1.0/engine0.2.0. Il client non ha ripetuto sonde o test live; resta distinta la fonte utente dall'evidenza HTTP precedente.
- La fixture completa è stata annunciata e allegata, ma il file ricevuto è **HTML1525byte invece di ZIP/JSON**. Nessun dato completo dei tre turni è estraibile; il gap di parità esatta13tappe/2704coordinate e rendering resta **APERTO per input non valido**, non un'incompatibilità dimostrata del client.
- Originale mantenuto solo in temporaneo privato fuori repository per controllarne formato/digest, evidenze solo aggregate e pulizia a fine controllo. Nessuna ricostruzione del piano o esecuzione dello script HTML.
- Rapporti: `PHASE5_MOBILE_PRIVATE_FIXTURE_REPORT.md` e `test_reports/phase5_private_fixture_intake.json`. Installazione privata su device specificata nella guida nativa; nessuna build o prova nativa eseguita.
- Restano inoltre cache/TTLserver, UI/lifecycle/mappe native e i6failurelockfile preesistenti. Nessuna nuova chiamata Supabase.

## Aggiornamento dopo primo live autorizzato — 11 ottobre2026
- Login/identità Pirone e accesso pilota sul Supabase principale verificati realmente,7invocazioniEdgecomplessive.
- API1.0/engine0.2.0 osservati nei percorsi reali: chiarimento follow-up, include_all,ready,secondoturno,idempotenza,get_plan,409. Nessuna incompatibilità bloccante del client riprodotta in questi casi.
- Piani server reali13tappe/79,7km/2704coordinate ricevuti; **NON equivale al confronto esatto con la fixture Web completa**, ancora attesa. Non ricostruita alcuna geometria artificiale.
- Rimangono: numero pubblicazionev6 non esposto e non riscontrato viaManagementAPI, durata cache/TTL server, errori/scenari non attraversati live, UI/mappe/lifecycle nativi, auditindipendente delle righe tecniche/assenza mutazioniCRMserver-side.
- Errore preparazione harness `SUPABASE_ANON_INVALID` dovuto al solo validatore JWT-only: corretto per chiavepublishable senza cambiareenv/chiavi/auth; nessuna chiamata era partita. Credenziali Pirone funzionanti nel successivo unico login reale.
- Dato nominale tappa6 con caratteri anomali e campi ultimoordine null ricevuti: riportati senza correzioni CRM né deduzioni ulteriori; non classificati come incompatibilitàdelwirecontract.

Riferimento: `PHASE5_MOBILE_LIVE_TEST_REPORT.md`. PilotaOFF; collaudo fermato, serve nuova istruzione per altre chiamate. La sezione offline sotto è mantenuta come storico.

## Stato aggiornato dopo l'handoff ufficiale — 11 ottobre 2026

**Handoff ricevuto, binding ufficiale implementato e verificato offline. Pilota operativo spento.**
Fonte prevalente: `MOBILE_API_HANDOFF.md` del pacchetto ufficiale; `CLIENT_CONTRACT.md` precedente non prevale. Copia consultabile in `frontend/tests/fixtures/official-handoff/gptour_mobile_handoff/`.
Non sono state effettuate chiamate Supabase/Auth/Edge reali. Nessun difetto del server pubblicato è dimostrato da questi test.

### Chiusura punto per punto delle richieste iniziali

| Punto storico | Esito / adeguamento mobile | Stato |
|---|---|---|
| 1. Envelope/versione/revisione/ID | Versione stringa `1.0`, revisioni intere non negative, ID ≤128, messaggio ≤2000; whitelist e validazione prima dell'invio | Risolto offline |
| 2. Otto azioni | `type`, campi esatti; `get_plan.planId` obbligatorio; follow-up usa `propose_reschedule` e non `reschedule`; nessuna scelta automatica | Risolto offline |
| 3. Risposta/stati/errori | Decoder strutturale completo; verifica session/request/plan ID e revisioni; 403 gateway ridotto distinto dai corpi completi | Risolto offline |
| 4. Piano/metriche/giorni | `plan`/`days[]`, minuti/orari, totali, ruoli/gruppi/ordini/pause, rientro e pernottamenti resi senza pianificare | Risolto offline |
| 5. Geometria/routing | `[lat,lng]` esplicito; conversione RN, ordine ricevuto; geometry vuota → sole connessioni visuali etichettate, come §6 handoff | Risolto offline; resa nativa da collaudare |
| 6. Idempotenza/reset | Stesso body/requestId per retry rete/5xx e replay422; reset è un turno server; nuova conversazione è reset locale con nuova sessione | Implementato; durata cache server non specificata |
| 7. Conflitto409 | Legge `sessionRevision` anche0; scarta richiesta obsoleta/piano, persiste revisione, nessun replay automatico; invio esplicito con nuovoID | Risolto offline |
| 8. Sessioni/TTL/transcript | Transcript locale24h, mai ricostruzione piano; `get_plan` solo con planId; nuova sessione al cambio target, pulizia al logout/account switch | Risolto offline; TTL server non specificato |
| 9. Target/pilota | Campo target solo UI admin/admincustom e omesso per giro proprio; UUID esplicito, autorizzazione server. Probe senza sessione dietro flag spento:400/403/503 | Risolto offline; account reali non verificati |
| 10. Versione/fixture/operatività | Contratto1.0 ed engine0.2.0 dai documenti; conferma solo locale; nessun salvataggio tour API | Versione live e parità Pirone non verificate |

### Incompatibilità e limiti ancora aperti

1. **Nessuna incompatibilità bloccante riprodotta nei casi API1.0 offline verificati.** Questo non certifica il servizio v6 attualmente installato né tutti gli stati possibili in produzione.
2. **Fixture P1 incompleta:** l'estratto ready contiene segnaposto e non l'intero piano13tappe/2704punti. Il decoder lo rifiuta correttamente; nessuna geometria reale inventata per far passare i test. Per parità completa occorre JSON anonimizzato integrale oppure collaudo live autorizzato.
3. **Durata cache idempotenza/TTL server non indicata.** TTL24h riguarda il transcript client; una richiesta incerta conserva il body per evitare nuove operazioni involontarie. Prima di prove di retry a lunga distanza va chiarita la finestra server.
4. **422: precisazione documentale.** §4 suggerisce nuovo requestId per un nuovo turno, checklist§9 consente replay stessoID. Mobile distingue replay identico (può restituire lo stesso errore memorizzato) da nuovo invio esplicito/nuovoID. Test corretto per non simulare un falso successo del replay422.
5. **Nessuna API history/list o polling definita:** non inventati endpoint né polling. `planning` è una bozza stimata visualizzabile, non promessa di completamento automatico.
6. **Android/iPhone:** mappe native, tastiera, lifecycle/process kill e sessione reale restano non certificati. `adb`/`xcrun` assenti.
7. **Sei failure lockfile preesistenti:** fuori contratto, fuori perimetro; vedere rapporto separato `test_reports/PHASE5_LOCKFILE_BASELINE.md`.

Piano successivo, **non eseguito**: `PHASE5_MOBILE_LIVE_TEST_PLAN.md`. Nessuna attivazione senza nuovo consenso.

---
## Archivio: richieste iniziali prima della ricezione dell'handoff

Le righe seguenti sono lo storico della predisposizione precedente, NON lo stato attuale. Sono conservate per tracciabilità.

MOBILE_API_HANDOFF.md non presente nel workspace al controllo iniziale; utente conferma che è in preparazione.
Funzione `gptour-orchestrator` v6 e API1.0: dichiarate dall'utente, **nessuna chiamata reale autorizzata/eseguita**.

La base mobile è esattamente `879333badd5821c1fd5572ed54781818a2e6a3a7`, remoto operativo `conflict_170826_1303`. Nome locale `main` ora espressamente autorizzato. Nessun remote/upstream/pushurl locale configurato; ciò non certifica la destinazione usata dalla piattaforma per i push passati. Gli sviluppi precedenti sono antenati del medesimo commit remoto; le build Android/iOS pubblicate non sono deducibili da Git.

## Specifiche necessarie prima di collegare il client operativo
1. Richiesta completa ed esempi JSON API1.0: formato contractVersion; revision numerica/stringa, prima revisione; identificativi ammessi.
2. Ogni azione: discriminatore, payload, campi obbligatori, question/option IDs, date/orari, follow_up_decision(include/exclude/reschedule), require/exclude_stop, get_plan, reset.
3. Risposta completa: sessionId/requestId/revision/version, stato, messaggi autorevoli, domande/opzioni, warning/errori e identità dell'agente effettivo.
4. `plan.stops`/`plan.days`: schema di tappe, leg, visite, pause, attese, rientro, impegni, pernottamenti, unità delle metriche.
5. Geometria: formato GeoJSON/polyline/array, coordinate **ordine esplicito**, partenza/gps, routing verified/estimated e piano parziale.
6. Idempotenza: durata cache, retry stesso requestId, risposta di errore dopo commit server, duplicati concorrenti, effetto reset.
7. Conflitto409: payload e procedura di sincronizzazione; get_plan con revisione assente o ultima confermata? Non ritentare automaticamente una mutazione obsoleta.
8. Sessioni: creazione/ripresa/scadenza, eventuale list/get endpoint, reset mantenendo/cambiando sessionId, polling planning e Retry-After.
9. `targetAgentId`: quando necessario, assegnazioni consentite e come il client ottiene selezioni autorizzate senza replicare allowlist/ruoli.
10. Versione effettivamente pubblicata, fixtures gold web/mobile stesso contesto (inclusa ora Europe/Rome), procedura pilota e operazioni di salvataggio/avvio consentite.

## Implementazione intermedia consentita
- Envelope noto con whitelist, JWT dell'utente tramite client Supabase esistente.
- Coordinatore isolato di sessioni/richieste/retry, interfaccia mobile puramente presentazionale.
- Binding API **assente di default**: niente interpretazioni arbitrarie del JSON. I view model interni non sono il contratto API1.0.
- Test con binding/IO fittizi esplicitamente separati. Nessuna chiamata alla vecchia pipeline nel nuovo percorso.
- Nessuna attivazione, push, modifica backend/DB/Edge, OTA o rilascio.