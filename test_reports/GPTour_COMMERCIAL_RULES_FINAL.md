# GPTour Android/iOS — correzione mirata delle regole commerciali

Verifica finale: **10 ottobre 2026, 13:48 UTC**. Ambito: esclusivamente GPTour e relativi test; nessuna modifica a database, Edge condivisa, autenticazione, ordini/prezzi/provvigioni, dipendenze o configurazioni.

## 1. Provenienza, branch e SHA

| Sorgente | Branch | SHA acquisito prima del lavoro | SHA remoto verificato alla fine |
|---|---|---|---|
| `Paolo73xmas/voom-releases` | `conflict_170826_1303` | `edb2852fcbaac9467cb6cb81f13c69b349adda62` | `edb2852fcbaac9467cb6cb81f13c69b349adda62` |
| `Paolo73xmas/voom` | `main` | `21b17f6496ed5af748c8e4da62bb2abc8e0c3c4d` | `21b17f6496ed5af748c8e4da62bb2abc8e0c3c4d` |

Acquisizione effettiva con `git ls-remote` e clone superficiale dei due rami in `/tmp/voom-commercial-mobile` e `/tmp/voom-commercial-web`. HEAD del workspace coincideva esattamente con il ramo mobile richiesto: **non è stata utilizzata una vecchia copia**.

**Distinzione importante:** il branch tecnico del workspace si chiama `main`, ma parte dal medesimo SHA del ramo mobile richiesto. HEAD iniziale e HEAD finale verificabile durante questa consegna sono entrambi `edb2852fcbaac9467cb6cb81f13c69b349adda62`; le correzioni sono nel working tree. Non è stato creato/pushato manualmente un commit: non attribuisco un falso SHA alle modifiche non ancora registrate in un commit. Il ramo remoto non è stato modificato.

Per identificare esattamente il codice verificato, manifest SHA-256 dei **26 file di codice/test modificati o aggiunti**, ordinati per percorso e hash del contenuto:
`414e1f7c519ee5347555de9f4918dd1e7de0e4a1af3c5b69a0abf7f74289ee64`.
Questo è un hash del contenuto della consegna, **non uno SHA Git**; documentazione e artefatti di esecuzione sono esclusi dal manifest.

## 2. Confronto iniziale: corretto e da correggere

### Già corretto e conservato
- Pipeline mobile Expo/RN esistente, motore itinerari, geografia/territori, multi-comune, routing e capienza, impostazioni personali, follow-up e gestione delle giornate.
- `loadLatestPurchases`: ordini annullati/eliminati esclusi, paginazione, nessun fallback dalle date salvate sul cliente.
- Rappresentazione e visualizzazione ultimo ordine, ricostruzione/salvataggio del contesto JSON del tour, identità/antiduplicazione.
- Controlli di agent binding, autorizzazioni server, esclusioni e rimozione delle tappe.

### Problemi effettivi
1. `allowedTypesFor(...,'fill')` restituiva `null` senza espansioni esplicite: la graduatoria poteva introdurre categorie non richieste.
2. Acquisti rappresentati globalmente (`requireOrderHistory`/`orderMinDays`, client/orphan), incompatibili con una richiesta mista comprendente nuovi punti.
3. Tipologie CRM usate come significati commerciali, senza distinguere chiaramente relazione esistente da ordini o da evidenza di mancata visita.
4. Forme equivalenti come «con ultimo acquisto almeno 30 giorni fa» non attivavano la verifica deterministica completa.
5. Mancava il chiarimento locale obbligatorio per «clienti inattivi negli acquisti» senza numero di giorni.
6. Patch/reset suggeriti dall’AI potevano alterare categorie, data o area durante modifiche conversazionali non pertinenti.
7. Il completamento di sviluppo escludeva clienti esistenti nel fallback di un giro misto; ora ammette entrambi i gruppi già richiesti, con gli stessi filtri verificati.

Non sono stati riscritti i moduli web nel mobile, né ricostruite funzioni server.

## 3. Regole commerciali implementate

### Mappatura senza cambiare le categorie del CRM

Le etichette tecniche `client`, `prospect`, `orphan`, `free`, `never` restano invariate. Un metadato GPTour registra invece la provenienza:

| Evidenza | Significato commerciale |
|---|---|
| Scheda del portafoglio agente (`customers` filtrato per agente), anche prospect o orfano proprio | Relazione propria esistente, anche senza acquisti |
| Orfano con scheda raggiunto tramite il percorso già autorizzato e incluso nel territorio | Relazione esistente di altro portafoglio; esclusa da «i miei clienti» |
| Riga del registro restituita dal loader autorizzato, `customer_id=null`, `stato_visita='non_visitato'`, `chiusa=false`, dentro il territorio | Nuovo punto verificato secondo il registro disponibile |
| Tipo tecnico senza provenienza, riga mancante/RLS non leggibile, stato nullo o contraddittorio | Sconosciuto, non promosso automaticamente a nuovo/cliente |
| Ordine valido riletto tramite `loadLatestPurchases` | Evidenza acquisto, distinta dalla relazione commerciale |

Un prospect con scheda/contatto attribuibile all’agente è quindi un cliente commerciale; **non diventa automaticamente un nuovo punto**. Una scheda cliente senza ordini è inclusa nel gruppo clienti generico, ma non in quello degli inattivi negli acquisti. Un orfano sconosciuto non è dedotto nuovo.

### Intent versionato e compatibile

Campo opzionale `commercialGroups`, versione 1, serializzato nel contesto JSON esistente:

```ts
{ version: 1, existing: boolean, newPoints: boolean,
  ownOnly: boolean, inactiveDays: number | null, needsDays: boolean }
```

- Nessuna migration o nuova colonna.
- Vecchi intent senza campo ancora leggibili; nessuna evidenza commerciale inventata per vecchi snapshot.
- Il campo è di proprietà del client: una patch AI non può autorizzare o cancellare i gruppi.
- **Nei tour misti `requireOrderHistory=false` e `orderMinDays=null` a livello globale.** La soglia resta esclusivamente in `commercialGroups.inactiveDays` per il gruppo esistente. Il loader e i riepiloghi usano tale valore scoped.
- Nei tour esclusivamente inattivi i campi legacy conservano la soglia per compatibilità.

### Scenari
- **A:** solo precedenti acquirenti con ordine verificato di almeno N giorni; soglia inclusiva. Nessun mai-acquirente o nuovo punto.
- **B:** relazioni esistenti anche senza ordini + nuovi punti verificati.
- **C:** precedenti acquirenti inattivi + nuovi punti verificati, senza applicare a questi ultimi la soglia acquisti.
- Se l’AI omette un gruppo esplicitamente richiesto, il completamento deterministico può recuperarlo dal **solo pool verificato**, senza inventare categorie, comuni o giorni. Il planner continua a controllare la capienza reale.
- Il fill, il corridoio, l’aggiunta manuale e le ricevute di accettazione passano dal controllo centrale; una proposta AI non costituisce consenso.
- Con quattro soli clienti idonei non si inseriscono nuovi punti per occupare il tempo libero. Il messaggio informa del tempo residuo e chiede di indicare esplicitamente le categorie da autorizzare.
- Un «sì» privo di un gruppo inequivocabilmente autorizzato non allarga il perimetro; «Sì, aggiungi nuovi punti vendita» è un’autorizzazione esplicita.

### Lingua naturale e conversazione
- Equivalenti riconosciuti: non comprano/ordinano da N giorni, senza ordini da almeno N, ultimo acquisto almeno N giorni fa, da un mese (**30 giorni**), anche forme compatte `da20giorni`.
- Inattività generica: domanda «Da quanti giorni…?» **prima di qualsiasi chiamata AI**, senza scegliere una soglia.
- «Parti alle/dalle 9:00», anche `alle09:00`, aggiorna l’ora senza azzerare i gruppi.
- «Aggiungi anche Opera» aggiunge il comune a Rozzano; mantiene data, soglia scoped e gruppi.
- «Lascia perdere i nuovi clienti. Solo quelli che non ordinano da 20 giorni» elimina davvero il gruppo nuovo.
- Le formulazioni di sviluppo/nuovi punti già supportate mantengono il perimetro esplicito; geografia inventata da una risposta AI non è utilizzata come autorizzazione.

## 4. File di codice e motivazione

Percorsi relativi a `frontend/`, salvo indicazione diversa:

| File | Intervento |
|---|---|
| `lib/aitour/gptour-commercial.ts` **nuovo** | Validazione provenienza, gruppi, label, soglia scoped, rilevazione gruppo mancante |
| `lib/aitour/gptour-commercial-data.ts` **nuovo** | Lettura positiva e paginata per batch di evidenza registro; fail-closed |
| `lib/aitour/gptour-intent.ts` | Campo gruppi opzionale versionato |
| `lib/aitour/types.ts` | Solo metadato opzionale GPTour; nessun cambio di categoria CRM |
| `lib/aitour/gptour-data.ts` | Provenienza relazioni, territorio, evidenza nuovi e warning incompletezza |
| `lib/aitour/gptour-purchases.ts` | Marca acquisti verificati solo dopo il loader unico |
| `lib/aitour/gptour-purchase-intent.ts` | Parsing deterministico gruppi/soglie/chiarimenti/revoche; flags globali disattivati nel misto |
| `lib/aitour/gptour-criteria.ts` | Nessun fill illimitato; validazione commerciale centralizzata |
| `lib/aitour/gptour-registry.ts` | Consensi letterali, persistenza date/area/ownership/esclusioni |
| `lib/aitour/gptour-planning-pool.ts` | Verifica acquisti solo gruppo esistente, pool misto e istruzioni AI coerenti |
| `lib/aitour/gptour-purchase-summary.ts` | Riepilogo che distingue i nuovi dalla soglia ordini |
| `lib/aitour/gptour-development.ts` | Sviluppo non cancella gruppi misti; completamento per entrambi i gruppi autorizzati |
| `lib/aitour/gptour-request-area.ts` | Frasi acquisti non scambiate per località; aggiunta comune; geografia sviluppo |
| `lib/aitour/gptour-day-consent.ts` | Partenza esplicita e conservazione vincolo di giornata |
| `lib/aitour/gptour-acceptance.ts` | Invalida ricevute al cambiamento dei gruppi; non concede nuove categorie |
| `lib/aitour/gptour-context.ts` | Validazione campo gruppi nelle bozze/tour JSON |
| `hooks/useGptour.ts` | Orchestrazione chiarimento, stato persistente, verifiche scoped, fallback/completamento misto e avvisi |
| `components/aitour/gptour/UI.tsx` | Chip commerciali, senza duplicare filtri globali |
| `app/gptour.tsx` | Banner acquisti scoped e distinzione dei nuovi |
| `tests/gptour_fill_corridor.test.ts` | Aspettative del fill automatico corrette; test positivi solo con autorizzazione |
| `tests/gptour_accepted_fill.test.ts` | Ricevute subordinate al consenso di categoria; esclusioni, rimozione, JSON e legacy conservati |
| `tests/gptour_purchase_request.test.ts` | Provenienza fixture esplicita e prospect già clienti commerciali; controllo geografico/acquisti conservato |
| `tests/gptour_commercial.test.ts` **nuovo** | Classificazione, soglie, gruppi, consenso, serializzazione, planner |
| `tests/gptour_new_point_evidence.test.ts` **nuovo** | Registro positivo/contraddittorio/mancante, errori, batch |
| `tests/use_gptour_commercial.test.ts` **nuovo** | Hook e planner veri con IO isolato, conversazione, fallback e bozza |
| `/tests/e2e/gptour_commercial_isolated.py` **nuovo** | Smoke browser con API simulate e rete business reale bloccata |

`gptour-opportunities.ts` è stato verificato ma **non modificato**: già usa il filtro centrale, ora corretto, per fill e corridoio. Non occorre duplicare i vincoli nella graduatoria.

## 5. Test realmente eseguiti

| Esecuzione finale | Esito |
|---|---|
| `yarn tsc --noEmit` | **PASS**, exit 0 |
| Lint JS/TS sui moduli/test modificati e lint Python sullo smoke | **PASS**, nessun problema |
| `yarn test:unit --exclude tests/build_lockfile.test.ts` | **35 file, 368 test PASS** |
| `yarn test:unit` integrale | **374 PASS, 6 FAIL**, 36 file/380 test totali |
| Smoke browser isolato, viewport 390×844 | **PASS**, 8 risposte Edge simulate, 0 inoltri API reali |
| `git diff ... --check` | **PASS** |

**I sei FAIL integrali sono gli stessi errori di `build_lockfile.test.ts` riscontrati PRIMA delle modifiche** (baseline: 337 PASS, 6 FAIL, 343 totali). Riguardano il registro Yarn del lockfile già presente. Non ho modificato lockfile, dipendenze o quel test, e non dichiaro verde la suite integrale.

Copertura automatica effettiva:
- Soglie 15/20/30: N−1 escluso, N e N+1 inclusi, nessun ordine escluso; snapshot non verificato escluso.
- Cliente con ordini; scheda già visitata senza ordini; prospect contattato; orfano autorizzato con ordini/senza evidenza; nuovo verificato; dati incompleti; fuori territorio.
- Scenari A/B/C, global flags assenti nel misto, nuovi non rimossi dal filtro acquisti, nessuna terza categoria.
- Quattro clienti idonei non riempiti con altre categorie; fill/corridor/ricevute forgiate non autorizzano categorie.
- Chiarimento senza soglia e risposta numerica; alias linguistici; rifiuto di patch AI/reset/aree inventate.
- Conversazione Rozzano → ore 9 → Opera → rimozione nuovi; data invariata; persistenza JSON, smontaggio/rimontaggio hook e ricalcolo.
- AI senza tappe e AI legacy che omette i nuovi: recupero deterministico entro i gruppi autorizzati.
- Suite esistenti di geografia/comuni multipli, sviluppo, storico ordini, follow-up, giornate/pernottamento, bozze, accettazione e rimozione eseguite nel gruppo verde. Le suite purchase-request e tour-last-orders sono PASS.

### Smoke visivo finale
Con dati esclusivamente fittizi, passando dai **loader reali**, dall’API reale del client, dal motore e dalla UI:
1. Rozzano: **2 precedenti acquirenti idonei + 1 nuovo**, esclusi cliente recente e scheda mai acquirente.
2. Ora cambiata alle **09:00**, filtri preservati.
3. Opera aggiunta: **4 tappe**, entrambi i comuni e stessa data.
4. Nuovi rimossi esplicitamente: **2 clienti inattivi**, nessun nuovo nascosto.
5. Indietro/riapertura: filtro e comuni recuperati senza ulteriori chiamate AI.
6. Payload misto: `requireOrderHistory=false`, `orderMinDays=null`, `commercialGroups.inactiveDays=20`. Dopo rimozione dei nuovi il flag legacy torna correttamente esclusivo.

Le API sono **MOCKED SOLO NEI TEST** (Auth/Supabase/Edge/OSRM); l’applicazione non contiene sostituzioni simulate. Le librerie statiche dell’anteprima non sono API CRM. Nessuna creazione account, scrittura CRM o chiamata AI reale.

Artefatti:
- `test_reports/commercial_isolated/browser.json` — asserzioni, payload sanitizzati, contatori e PASS.
- `mixed.jpeg`, `inactive-only.jpeg` — screenshot del piano nella stessa cartella.
- `vitest-app.log`, `vitest-full.log`, `tsc.log` — output finali.
- Report intermedi `iteration_68.json`/`iteration_69.json`: conservati come storico; il FAIL della forma compatta e le lacune di copertura sono superati dai test finali. La prima versione del test hook sostituiva troppa logica: quella finale usa motore, criteri, scope acquisti e proposte reali, con sole frontiere IO simulate.

## 6. Differenze residue rispetto al web

Sul web `main` acquisito restano i difetti equivalenti del fill permissivo, del filtro acquisti globale/client-orphan e del parser ristretto. **Non sono stati portati nel mobile per una falsa parità dei difetti.** Il web non è stato modificato.

La parità geografica, dei vincoli temporali e dei flussi preesistenti è preservata; le differenze intenzionali sono il nuovo contratto commerciale client-side, il filtro scoped e i consensi più rigorosi. L’Edge condivisa resta invariata: riceve campi legacy compatibili, gruppo opzionale e istruzioni sul pool verificato; il client valida comunque il risultato e recupera un gruppo richiesto omesso quando possibile.

Il repository web contiene anche versioni SQL più recenti per i nuovi punti. Sono state **lette come riferimento**, non applicate: la versione realmente installata dell’RPC condivisa non è stata verificata contro il servizio reale.

## 7. Limiti e problemi aperti

1. **Lockfile:** sei test preesistenti ancora falliti; fuori dal perimetro commerciale, nessuna correzione opportunistica.
2. **Dispositivi reali:** non eseguiti test nativi Android/iOS, condivisione PDF, GPS, tastiera/lifecycle nativi. Browser e TypeScript non li certificano.
3. **Integrazione reale:** per consenso dell’utente, nessuna chiamata CRM/AI reale; compatibilità della funzione installata e RLS di produzione non certificata da questi smoke isolati.
4. **Dati CRM:** il gruppo nuovo si basa su prova positiva del registro e sul contratto dell’RPC autorizzata, non su una pretesa visibilità di tutta la storia di ogni agente. Un’attività non registrata o contraddizioni non esposte dai dati non possono essere ricostruite. Dati nulli, illeggibili o mancanti rimangono sconosciuti/esclusi; avvisi di pool parziale mantenuti.
5. **Copertura territoriale:** i limiti/paginazione già esistenti del pool non sono stati rimossi; nessuna promessa di completezza di tutto il CRM.
6. Warning Vite ESM/CommonJS e deprecazioni RNWeb preesistenti annotati, senza migrazioni di configurazione fuori ambito.

**Esito:** correzioni commerciali implementate e verificate automaticamente e con smoke visivo isolato. Nessun guasto commerciale riprodotto resta aperto nei casi testati; la suite integrale e la verifica nativa/reale hanno i limiti espliciti sopra.