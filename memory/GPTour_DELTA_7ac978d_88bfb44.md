# GPTour — analisi incrementale 7ac978d → 88bfb44

## Perimetro

Scelta esplicita dell'utente: **«Solo modifiche successive a 7ac978d: analizzo le differenze rispetto all'ultimo rapporto.»** Nessuna implementazione o modifica dati autorizzata.

- Repository: `Paolo73xmas/voom`, branch `main`.
- Base: `7ac978d7608bf71817b6adc0674cba38b28848ba` (01/10/2026 11:32:06 UTC).
- Nuovo HEAD: **`88bfb440d86ca4103016ed2b5c1ed3416ecf497a`**, **01/10/2026 13:23:26 UTC**; verificato via fetch e successivo ls-remote, invariato al ricontrollo.
- **1 nuovo commit, 6 file, 105 aggiunte e 8 rimozioni.**
- Oggetto: abilitazione GPTour ad `agent`/`agentcustom`, esclusivamente per il proprio giro; admin invariati.
- Consultati i diff e gli oggetti `origin/main` nel clone temporaneo `/tmp/voom-web-analysis`. Il working tree del clone resta alla base precedente: per riferimenti aggiornati usare lo SHA/origin/main, non assumere che i file del checkout siano aggiornati.
- Mobile: nessun commit applicativo frontend/backend successivo al riferimento `c06ef1c1`; consultati solo i punti necessari alla compatibilità.
- Analisi statica: nessun login operativo, nessuna chiamata AI/RPC/CRM, nessun test eseguito, nessuna migrazione. Scritture del progetto limitate a documentazione.

## 1. Cambiamenti effettivi

### Autorizzazione server: soggetto del giro

Nuovo `supabase/functions/ai-tour-gptour/authz.ts`, funzione pura `resolveGptourSubject`:

| Ruolo autenticato | Soggetto richiesto | Esito nel codice |
|---|---|---|
| `agent`, `agentcustom` | Proprio ID | Consentito, `effectiveAgentId = auth.uid()` |
| `agent`, `agentcustom` | ID altrui | Rifiutato, HTTP 403; non sostituito silenziosamente |
| `agent`, `agentcustom` | ID omesso/vuoto/non stringa | Consentito sul proprio ID |
| `admin`, `admincustom` | Agente selezionato | Consentito su quell'ID |
| `admin`, `admincustom` | ID omesso | Fallback sull'ID dell'admin |
| Altri ruoli, inclusi `supervisor` e `branch_admin` | Qualsiasi | HTTP 403 |

La Edge `index.ts` verifica ancora sessione e ruolo da Supabase; applica il controllo prima per il ruolo, poi per `agentInfo.agentId`, normalizza l'ID effettivo nel contesto AI e lo restituisce nella risposta. Il rifiuto dell'ID altrui precede la richiesta al modello.

### Contratto client/server

- `GPTourForm.tsx` ora invia `agentInfo.agentId`.
- `runGptour` tratta esplicitamente gli errori 403 e rifiuta la costruzione quando `effectiveAgentId` della risposta differisce dall'agente richiesto.
- Il controllo di uguaglianza client opera quando entrambi i valori sono stringhe: non è una negoziazione obbligatoria di versione/capacità. Una risposta senza il nuovo campo non viene rigettata per questo solo motivo.
- Il modello, il prompt commerciale e la struttura di TourIntent non sono cambiati.

### Interfaccia web

- `canGptour` abilita tab e pannello ad admin/admincustom/agent/agentcustom.
- Per gli agenti, `agentId` è quello dell'utente autenticato; il selettore staff non viene introdotto per loro.
- Badge da «beta · admin» a «GPTour · beta», nuovo test ID del badge e testo neutro relativo al portafoglio corrente.

### Test aggiunti

Nuovo `tests/aitour/gptour_agent_authz.unit.ts`: casi ruoli, ID proprio/altrui, ID assente o malformato, comportamento amministrativo e regressione del predicate «miei orfani».

È una suite di unit test su funzioni pure: **le asserzioni nel file non provano che il servizio pubblicato sia aggiornato, né l'intero isolamento RLS, la voce o il salvataggio**. File letto, non eseguito. I file `gptour_*.unit.ts` passano da 13 a 14.

## 2. Cosa cambia rispetto al precedente rapporto

| Voce precedente | Stato dopo questo commit |
|---|---|
| A — GPTour admin-only | **Superata nei sorgenti:** agent e agentcustom ora ammessi sul proprio giro; disponibilità runtime non verificata |
| B — Intent non integralmente persistito | Invariata: nessun nuovo metadato salvato |
| C/D — filtro iniziale, area rigida, espansioni | Invariate: nessuna modifica a predicate o selezione |
| E — completezza pool / dati sconosciuti | Invariata |
| F/G — follow-up end-to-end / conflitti dedup-eventi | Invariati |
| H/I — fallback/corridoio, fattibilità e saturazione multi-day | Invariati |
| J/K — editing fra giorni e salvataggio parziale | Invariati |
| L — base mancante con fallback geografico fisso | Invariata |

La conclusione è limitata al delta: i moduli sottostanti non sono stati nuovamente certificati o corretti. Il precedente rapporto resta la base per i loro dettagli.

## 3. Impatto mobile

1. **L'abilitazione server agli agenti non va più pianificata come funzionalità mancante nel main.** La fase iniziale diventa recepire/verificare la nuova matrice ruoli, non inventarne una diversa.
2. Il futuro client mobile deve inviare `agentInfo.agentId`, usare la sessione Supabase e gestire 403/ID effettivo coerentemente. Non usare `Profile.agent_id` come scorciatoia: l'AI Tour mobile corrente deriva l'agente da `user.id`, popolato con `profile.id` (`app/ai-tour.tsx:206`, `store/authStore.ts:91-101`).
3. **`agentcustom` manca nella union `UserRole` mobile** (`frontend/store/authStore.ts:7`). Va allineata in un futuro intervento insieme alle condizioni di accesso interessate. È una differenza di contratto/tipizzazione accertata, NON una prova che oggi il login di quel ruolo fallisca.
4. La trascrizione web riusata da GPTour (`ai-tour-brief`) ammette già `agent` e `agentcustom` nei sorgenti. Nessuna nuova modifica voce nel delta; flusso nativo sempre da verificare separatamente.
5. Nessuna migrazione DB, modifica OSRM, nuova impostazione o sostituzione del parser V4.1 viene introdotta da questo commit.
6. GPTour non compare automaticamente nel mobile: restano da implementare UI nativa, motore e collegamenti/persistenza descritti nel piano precedente, solo dopo autorizzazione.

### Limite da considerare nella verifica del contratto

`effectiveAgentId` certifica quale ID il resolver ha autorizzato, **non che ogni candidato sia stato riletto/validato dal server sul CRM**. La Edge continua a ricevere `candidatesText`/`candidates`, Intent e contesto dal client; `validKeys` deriva da quelle righe, non da una nuova query del portafoglio per ID effettivo. Il delta non aggiunge questa convalida. Non dedurre quindi dai nuovi unit test una verifica end-to-end di tutti i dati e delle scritture. Non sono state eseguite prove di accesso a dati altrui.

## 4. Aggiornamento puntuale del piano

- **P0 contratto:** recepire quattro ruoli ammessi, proprietà del giro, ID effettivo e comportamento in caso di risposta non coerente/servizio non aggiornato. Definire un contratto versionato invece di basarsi solo sul campo facoltativo.
- **P1 mobile:** allineare ruolo agentcustom e futuro adattatore GPTour; aggiungere visibilità coerente del nuovo ingresso. Nessun ampliamento implicito a supervisor/branch_admin.
- **P1 invariato:** dati/filtri → motore/OSRM/multi-day → follow-up/AI → UI → persistenza condivisa e Live → regressioni/device. Persistenza Intent e integrità del giro restano prioritarie.
- Non serve riaprire né duplicare tutto il rapporto: questa appendice sostituisce solo la conclusione admin-only e aggiorna il contratto di accesso.

## 5. Verifiche aggiuntive proposte, NON eseguite

1. `agent` e `agentcustom`: richiesta propria consentita; ID di un altro agente rifiutato; nessuna chiamata al modello nel ramo rifiutato.
2. `admin`/`admincustom`: agente selezionato conservato; supervisor/branch_admin non abilitati.
3. Sessione assente/scaduta: 401; ruolo non ammesso: 403; errori presentati senza distruggere l'anteprima precedente.
4. Risposta con `effectiveAgentId` non coerente: nessuna costruzione/salvataggio del nuovo piano; risposta senza campo gestita secondo il contratto approvato.
5. Cambio account mentre una richiesta è in corso: risposta vecchia ignorata e nessuna contaminazione di Intent/pool/piano.
6. Verifica del contesto candidato e dei permessi sui dati, non soltanto del campo agentId, con fixture autorizzate.
7. Voce e salvataggio con entrambi i ruoli agente; regressione miei orfani e vecchi flussi mobile.

## Esito

Unico cambiamento funzionale nuovo: **GPTour aperto agli agenti sul proprio giro, con controlli del soggetto lato server e client**. Nessuna correzione alle criticità algoritmiche/persistenza precedenti è contenuta in questo intervallo. Stato del servizio reale non verificato; nessuna implementazione mobile avviata.