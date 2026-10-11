# Fase 5 — richieste di integrazione per AI WEB (non difetti server dimostrati)

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