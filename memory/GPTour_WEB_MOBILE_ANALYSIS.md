# GPTour web → mobile — analisi e piano, nessuna implementazione

## 1. Perimetro ed evidenze

Richiesta: usare l'ultimo `main` della web app come riferimento, comprendere il nuovo sistema di generazione AI Tour e proporre un porting mobile completo nelle regole, non soltanto nell'interfaccia. Autorizzazione corrente: **sola analisi**.

- Repository web: `https://github.com/Paolo73xmas/voom`, ramo `main`.
- HEAD verificato tramite Git all'inizio e alla fine della lettura: **`7ac978d7608bf71817b6adc0674cba38b28848ba`**, commit del **01/10/2026, 11:32:06 UTC**.
- Ultimo commit: `feat(ai-tour): GPTour, 'miei orfani' deterministici ...`.
- Mobile esaminato: **`c06ef1c1cdeaed527bc79d11b2f891a80101abdb`**.
- Copia web di consultazione: `/tmp/voom-web-analysis`. L'accesso Git autorizzato funziona in questo ambiente, nonostante il precedente 404 del canale pubblico. Nessuna credenziale riprodotta nel rapporto.
- Dallo storico riferimento `742a0f15` al main esaminato: 62 commit complessivi, 39 che toccano direttamente file GPTour. L'analisi si concentra su generazione, dati, planner, persistenza e impatto Live; non è un audit delle altre sezioni.
- Metodo: lettura statica di implementazioni, cronologia/diff, migrazioni SQL e test esistenti. **Nessuna chiamata AI, nessun accesso ai dati CRM, nessuna migrazione, nessun salvataggio/avvio tour o riprogrammazione follow-up.** Test web letti, non eseguiti. Nessuna certificazione runtime o nativa.
- Scritture nel progetto limitate a questo rapporto e all'aggiornamento del PRD. Frontend, backend, dipendenze, configurazioni e dati operativi invariati.

Nelle citazioni: **W** = repository web, **M** = repository mobile; numeri di riga riferiti ai commit sopra.

## 2. Conclusione

**GPTour è un terzo percorso di creazione del giro, affiancato a Genera Tour e Dillo all'AI, non una nuova veste del vecchio brief.** Attualmente il web lo espone soltanto ad `admin`/`admincustom`; anche la Edge Function applica questa limitazione. Un porting destinato agli agenti richiede quindi una decisione esplicita sui ruoli e un servizio che la applichi lato server.

La direzione consigliata è **aggiungere un motore GPTour separato con contratti condivisi e riuso mirato delle parti native esistenti**, lasciando funzionanti Genera Tour, Dillo all'AI V4.1, Settimana/Mese e Tour Live. Non sostituire in blocco `planner.ts`, `data.ts`, `tours.ts` o `LiveTourView.tsx` con i file web.

Il main introduce capacità importanti ma non garantisce ancora tutti i vincoli lungo l'intera catena. I punti della sezione 6 sono da risolvere/concordare, non da copiare automaticamente come regole desiderate.

## 3. Come funziona il nuovo GPTour

### 3.1 Percorso completo

1. Carica portafoglio e registro, zone agente, progetti, statistiche ordine/contatto e impostazioni.
2. Invia all'interprete conversazione, candidati TSV, giro effettivamente visualizzato, `TourIntent` corrente e contesto follow-up/proposte.
3. L'AI restituisce risposta, eventuale domanda, selezioni per chiave, giornate, patch dei criteri e azioni follow-up. Le chiavi devono esistere nel pool fornito.
4. Il client unisce la patch a `TourIntent` senza azzerare i criteri non menzionati.
5. Interroga gli eventi follow-up reali: se mancano decisioni, pone la domanda e sospende la costruzione del nuovo piano.
6. Deduplica e, con `wantAll`, aggiunge gli idonei omessi dalla proposta; può generare/ribilanciare giornate.
7. Il motore ordina le tappe e costruisce i percorsi con OSRM, salvo sequenza esplicitamente imposta; risolve rientri/pernottamenti.
8. Segnala conflitti; per un piano di un giorno può proporre integrazioni/corridoio, da accettare o rifiutare.
9. Mostra mappa/elenco editabile per giorno e salva i tour nelle tabelle esistenti.

Fonti: W `GPTourForm.tsx:76-244`, `gptour.ts:310-352,587-790`, Edge `ai-tour-gptour/index.ts:143-420`.

### 3.2 TourIntent e conversazione

Campi principali: tipi richiesti, soglie giorni contatto/ordine separate, fatturato min/max a 6 mesi, progetto, area, obbligatori/esclusi, tipi ammessi come espansione, opportunità rifiutate, consenso a finire prima, date, decisioni follow-up per evento, `wantAll`, `maxDays`, regola di pernottamento e `ownOrphansOnly`.

- Campi omessi dal turno successivo: conservati; `null` può cancellare un criterio.
- Rifiuti: unione delle chiavi; `allowLargeBuffer` resta attivo fino al reset.
- Decisioni follow-up: ultima decisione per `followUpId`.
- Il giro mostrato, comprese modifiche manuali, viene rimandato all'AI.
- Una risposta di chiarimento non deve cancellare l'anteprima precedente.
- **Persistente nella conversazione non significa persistito nel database:** nel main lo stato è React `useState`; non è salvato integralmente con il tour.

Fonti: W `gptour-intent.ts:16-92,119-211`, `GPTourForm.tsx:31-66,107-143,323-327`, `gptour.ts:151-165`.

### 3.3 Dati e significati commerciali

- Nuovi campi: `lastInspectionDate`, `lastPhysicalContactDate`, `daysSincePhysicalContact`, `isOwnOrphan`.
- Contatto fisico: massimo fra ultima visita e ultima ispezione nel caricamento; ordine separato.
- «Non visitati da almeno N giorni»: include N esatto e assenza di contatto noto; «non ordinano»: soglia separata ordine.
- «Clienti nuovi»: prospect + free + never. «Nuovi punti vendita»: free + never. «Clienti che non ordinano»: client + orphan nel contratto AI.
- «Miei orfani»: proprietà determinata dai dati dell'agente, non dal comune; nel pool i propri orfani possono essere visibili fuori zona, come i clienti di progetto. Le proposte automatiche di riempimento/corridoio restano invece limitate alle zone assegnate.
- Pool registro: fino a 2.500 punti; prompt TSV fino a 8.000 righe, non un portafoglio illimitato.

Fonti: W `data.ts:124-211,299-444`, `gptour.ts:193-196,226-307`, `gptour-criteria.ts:23-97`, Edge `index.ts:86-139,165-184`.

### 3.4 Follow-up

L'unità di decisione è l'**evento CRM**, non il cliente aggregato. Si caricano follow-up `scheduled` nelle date del giro e arretrati, si chiede quali mantenere/escludere/spostare, si caricano anche clienti confermati fuori dal pool iniziale e si introducono obbligatori datati. Le espressioni relative di data vengono risolte in codice usando `Europe/Rome`.

**Lo spostamento è una scrittura reale su `appointments`, effettuata durante la conversazione, prima di Salva giro.** Escludere un evento dal giro non equivale a cancellarlo/completarlo. Una futura UI mobile deve rendere questa distinzione inequivocabile.

Fonti: W `gptour-followup-flow.ts:58-142`, `gptour-followups.ts:105-138,187-254,284-315`, migrazione `20261001_ai_tour_reschedule_follow_up.sql`.

### 3.5 Multi-day, deduplica e pernottamento

- `wantAll`: completamento degli idonei presenti nel pool anche se l'AI ne dimentica alcuni.
- Deduplica globale per customer ID, tabaccheria ID, chiave e coordinate a 5 decimali + nome normalizzato; precedenza alle chiavi follow-up obbligatorie.
- Raggruppamento con capienza indicativa e raggio di 45 km dal centro del gruppo; ribilanciamento per evitare giornate poco piene. Sono euristiche, non una prova di fattibilità stradale.
- `maxDays` limita l'aggiunta di nuove giornate; se si raggiunge il limite il completamento può superare capienza/raggio e poi segnalare lo sforo, senza eliminare visite.
- Follow-up con data nel giro: non redistribuibili liberamente; arretrati mantenuti non bloccano da soli il ribilanciamento.
- Casa ogni sera, concatenazione fuori casa oppure regola condizionale per notte: distanza stradale casa → prima tappa reale del giorno successivo, confronto **strettamente `< N km`**.
- Due ipotesi casa/fuori e verifica finale per gestire il cambio della prima tappa. Distanza non disponibile dopo retry: `routing_unknown`, rientro prudenziale dichiarato. Soluzione instabile: `unstable`, scelta prudenziale dichiarata.

Fonti: W `gptour-complete.ts:16-135`, `gptour-identity.ts:11-81`, `gptour.ts:93-132,637-790`.

### 3.6 OSRM, corridoio e saturazione

- `optimizeVisitOrder`: nearest-neighbor, 2-opt e confronto di sequenze sensibili alle fasce orarie; non seleziona/rimuove clienti.
- Costo marginale: `A → candidato → B − A → B`; deviazione combinata ricalcolata, non semplice somma delle singole deviazioni.
- Priorità PRIMA del limite tecnico di 25 candidati per la matrice: tipo richiesto → prospect → nuovi punti → altri; dentro il livello, comune → comuni confinanti ISTAT → area più ampia → distanza preliminare.
- Saturazione iterativa: guida aggiunta + durata visite; arresto per soglia residua, sforo o esaurimento candidati. Massimo predefinito 8 proposte per passaggio.
- Nuovo `max_daily_buffer_minutes`, default 120: tempo libero residuo tollerato. **Diverso da `buffer_max_min`**, margine di sicurezza del planner esistente; non sostituire l'uno con l'altro.
- Proposte da confermare, rifiuti ricordati nella conversazione.
- Il fallback OSRM generale esiste ancora: la regola «nessuna distanza stimata spacciata per stradale» è implementata esplicitamente per il pernottamento, non significa eliminazione globale del fallback.

Fonti: W `planner.ts:176-263`, `gptour-insertion.ts:19-93`, `gptour.ts:375-578`, `osrm.ts:32-122`, `comuni-adjacency.ts`.

## 4. Confronto con il mobile corrente

| Ambito | Già nel mobile | Differenza GPTour / lavoro necessario |
|---|---|---|
| Creazione | Genera, Dillo all'AI V4.1, Settimana, Mese | Nuovo flusso conversazionale; non rimpiazzare i precedenti |
| Contratto AI | FastAPI `/api/ai-tour/parse-brief`, schema rigido, retry guidato, correzioni, memoria non bloccante | Edge `ai-tour-gptour`, output e contesto diversi; mantenere endpoint separati |
| Criteri | TourBrief, quote progetto/filler, selezioni esplicite, contraddizioni, anteprima | Aggiungere TourIntent cumulativo senza perdere ciò che il brief già esprime |
| Date/contatti | Regola recenti 15 giorni, eccezioni follow-up/appuntamenti rispetto alla data pianificata | Aggiungere ispezioni/contatto fisico e distinguere filtro ordine da filtro visita; non applicare automaticamente il vecchio filtro a ogni richiesta GPTour |
| Orfani | Propri/altrui già distinti nella Mappa; candidati AI Tour e dedup presenti | Manca `TourCandidate.isOwnOrphan` e il criterio conversazionale deterministico |
| Follow-up | Pannelli odierni/arretrati, orari/durate, impegni liberi, chiusura a fine giornata dopo visita/ispezione | Nuovo flusso per evento, decisioni datate, rinvio reale; mantenere chiusura same-day e impegni liberi |
| Aree | Journey ordinate, corridoi, aree include/exclude/prefer, zone disegnate e conferma località | GPTour ha criteri area più semplici e ranking ISTAT; non impoverire i vincoli già protetti |
| Pianificazione | Greedy, Or-opt/refill, fasce/giorni esclusi, ordinamento manuale e protezioni Live | Integrare optimizer GPTour e completamento; non sovrascrivere le ottimizzazioni mobili |
| Multi-day | Settori geografici, residui, consenso, date lavorative, partenza comune, massimo tecnico 6 | Aggiungere catena pernottamenti e completezza; concordare calendario, limiti e saturazione |
| Salvataggio | Batch atomico `save_tours_batch`, validazione prima di salvare/avviare | GPTour web salva per giorno e permette conflitti: scelta di prodotto, non semplice compatibilità di firma |
| Ripresa/Live | Ripristino `briefRequirements`/Journey, verifica integrità prima delle scritture, nessuna rimozione silenziosa | Manca trasporto completo Intent/decisioni/pernottamenti; i tour GPTour web non lo persistono già oggi |
| Voce/UI | Expo Audio, permessi, vocabolario agente, mappe native/WebView, editor RN | Riscrivere componenti web in RN; niente MediaRecorder DOM o drag-and-drop HTML |

Riferimenti mobili principali: `app/ai-tour.tsx:918-1055,1069-1330,1380-1430,1550-1595`; `components/aitour/BriefModal.tsx:120-275`; `lib/aitour/{types,data,brief-v4,brief-feasibility,brief-live,followups,tours,liveops}.ts`; `lib/api/appointments.ts:17-42`.

La vecchia analisi del 10 settembre NON descrive lo stato mobile attuale: Journey, revisione clienti/località, regola recenti, quote, schema e memoria sono stati successivamente portati. Non vanno conteggiati come interamente mancanti.

## 5. Dipendenze e impatto backend/dati

### Presenti nei sorgenti web, disponibilità runtime NON verificata

1. Edge Function `ai-tour-gptour`: modello dichiarato `gpt-5.6-luna`, sessione Supabase, ruoli admin/admincustom, `OPENAI_API_KEY` lato server; retry provider/client e messaggi ripuliti dall'HTML.
2. RPC read-only `ai_tour_contact_stats(uuid[])`: usare la versione autorizzata della migrazione **20260930**, non la prima del 20260929.
3. Colonna `ai_tour_settings.max_daily_buffer_minutes`, migrazione `20260929_ai_tour_max_daily_buffer.sql`.
4. RPC mutante `ai_tour_reschedule_follow_up`: verifica evento/cliente/stato/autorizzazione/data, conserva l'ora se non cambiata, usa Europe/Rome e restituisce il record aggiornato.
5. Dataset `public/data/comuni-adiacenti.json`, circa 756 KiB: nel mobile serve asset locale o servizio accessibile, non il percorso web `BASE_URL/data/...`.
6. Tabelle tour/tappe/eventi e RPC batch già usate dal mobile: nessuna nuova tabella GPTour richiesta dal main; **persistenza conversazione/metadati completa da progettare**, non già fornita da queste migrazioni.

Non applicare SQL dal solo fatto che è in Git. Nella fase autorizzata successiva: verifica disponibilità/firma/permessi in ambiente controllato, poi eventuali interventi condivisi web/backend. Non occorre modificare MongoDB per i dati CRM GPTour.

Per l'interprete è preferibile evitare due implementazioni divergenti del contratto. Proposta: servizio GPTour condiviso e versionato, con autorizzazione per l'agente target definita prima. Il parser mobile V4.1 e la sua trascrizione restano distinti. Nessuna nuova integrazione/chiave è stata configurata in questa analisi.

## 6. Criticità da non ereditare ciecamente

Sono **riscontri statici**, non incidenti riprodotti su dati reali. P0 indica prerequisito al futuro porting, non indisponibilità generale dell'app.

### P0 — accesso e persistenza

**A. GPTour è admin-only.** W `pages/AITour.tsx:80-81,1378,1567-1573`; Edge `index.ts:12-13,146-156`. Esporre il pulsante agli agenti senza cambiare il contratto autorizzativo produce 403. Non aggirare la limitazione passando da un altro backend privo delle medesime verifiche.

**B. Intent non salvato; compatibilità Live incompleta.** W `GPTourForm.tsx:41-43,281-327`; `gptour.ts:621-634`; `tours.ts:59-91,127-151`. Si salvano tappe, punti di partenza/arrivo, orari e obbligatori generici. Non si conservano integralmente criteri commerciali/geografici, rifiuti, eventi follow-up collegati, identità del gruppo multi-day e motivazione/regola del pernottamento. Nel mobile «Più Visite»/ricalcolo non possono ricostruire criteri mai trasmessi. Serve contratto condiviso di metadati versionati prima del porting UI.

### P1 alta — invarianti della selezione

**C. La selezione iniziale AI non passa tutta dal filtro deterministico.** `candidateMatchesTourIntent` è usato in fill/corridoio e nel calcolo dei mancanti per `wantAll`; `buildGptourPlans.resolve` controlla presenza/dedup ma non l'Intent. Un candidato esistente ma fuori criterio nella selezione iniziale non viene necessariamente rimosso/segnalato. Vale anche per `ownOrphansOnly`. Fonti W `gptour.ts:648-673`, `gptour-complete.ts:28-57`, `gptour-criteria.ts:60-97`. Proposta: validazione unica su selezione iniziale, integrazioni, editor e salvataggio, con eccezioni obbligatorie esplicite.

**D. Area e tipologie hanno semantiche non completamente rigide.** Il predicate non verifica comune/zona; provincia nome vs sigla o provincia mancante è ammessa (`provinceMatches`). Il comune guida un ranking, non un confine obbligatorio. Nel fill `allowedExpansionTypes=[]` consente la scala progressiva, non «nessuna espansione». Fonti W `gptour-criteria.ts:31-54,95-97`; `gptour.ts:507-578`. Esplicitare «solo in questo comune» vs «zona preferita», e «solo orfani» vs «accetto integrazioni», senza reinterpretazione silenziosa.

**E. Completo significa completo rispetto al pool caricato.** Cap registro/prompt, errori lettura zone/registro trasformati in liste vuote e errori contact-stats tollerati rendono improprio promettere completezza assoluta. Anche alcuni candidati orfani da registro non ricevono gli stessi campi di contatto dei clienti propri. Fonti W `gptour.ts:226-276`, `data.ts:133-146,349-402`, Edge `index.ts:165-183`. Distinguere assenza storica vera da dato non disponibile; riportare paginazione/troncamenti e non dichiarare «tutti» su un insieme incompleto.

### P1 alta — follow-up e calendario

**F. La garanzia deve coprire eventi, date e orari end-to-end.** `exclude` registra la decisione ma non costituisce da solo un filtro generale sulla selezione; i keep arretrati non vengono reinseriti deterministicamente con la stessa regola dei datati nel giro. Il completamento può aggiungere giorni DOPO il caricamento follow-up, senza un nuovo controllo degli eventi di quelle date. Fonti W `gptour-followup-flow.ts:65-142`, `gptour-followups.ts:238-253`, `GPTourForm.tsx:124-160`.

Inoltre il passaggio da decisione datata a candidato non imposta sistematicamente `isFollowUp`, slot orario/durata o source event ID; il planner GPTour lavora sulle `preferredSlots`, mentre il TSV tronca l'appuntamento alla sola data. Dopo un rinvio occorre riallineare anche il candidato e le finestre orarie, non solo il testo della chat. Fonti W `gptour.ts:279-305,663-673`, `planner.ts:10-32,757-793`.

**G. Dedup globale e due follow-up dello stesso cliente possono confliggere.** Dedup per identità su tutte le giornate non deve eliminare silenziosamente un secondo evento esplicitamente confermato in altra data. Il criterio attuale privilegia chiavi, non la coppia evento/data. Definire il conflitto e far decidere l'agente; non risolverlo cancellando dati CRM.

### P1 — routing, editor, salvataggio

**H. Non tutte le deviazioni sono garantite stradali.** `buildInsertionProposal` usa `getMatrix` senza propagare `fallback`. Il prefiltro corridoio misura distanza da partenza/tappe/arrivo, non dall'intera polilinea OSRM: può perdere opportunità a metà di una tratta lunga. Fonti W `gptour.ts:368-420,429-465`, `osrm.ts:49-60`. Separare stima/tempo stradale; mai decidere la soglia pernottamento su fallback. Testare il corridoio su geometria reale, non solo vicinanza alle tappe.

**I. Multi-day non è ancora una verifica globale di fattibilità.** Capacità euristica, date consecutive, raggio 45 km e limiti non garantiscono fasce, giorni lavorativi, pranzo e ore effettive; il pranzo entra nella stima di capacità ma non come pausa esplicita nella timeline `planFixedOrder`. `maxDays` limita l'espansione dei mancanti, non convalida da solo ogni risposta AI con troppe giornate. La proposta fill nella UI scatta solo per `built.length === 1`; il ribilanciamento multi-day è un meccanismo diverso. Fonti W `gptour-complete.ts:20-135`, `gptour.ts:587-634`, `GPTourForm.tsx:181-234`, `planner.ts:758-825`. Non equiparare l'euristica a un giro fattibile.

**J. Editing manuale locale alla giornata.** L'editor esclude soltanto le key già in quel giorno e `updateDay` cambia solo quel piano; non applica dedup globale, criteri Intent o ricalcolo dei pernottamenti dei giorni dipendenti. Fonti W `GPTourDayEditor.tsx:28-69`, `GPTourForm.tsx:325-327`. Sul mobile aggiunta/rimozione/spostamento devono riallineare Intent, obbligatori e dipendenze multi-day.

**K. Salvataggio parziale e fattibilità differiscono dal mobile.** GPTour passa `skipFeasibility:true` e salva ogni giorno separatamente; se alcuni giorni riescono imposta `savedIds`, e il bottone diventa «Salvato»/disabilitato anche se altri sono falliti. Il singolo `saveTour` inserisce header e poi tappe con richieste distinte. Fonti W `GPTourForm.tsx:281-320,439-445`, `tours.ts:95-112`. Non sostituire il batch atomico mobile senza scelta esplicita; prevedere esito per giorno, retry idempotente e nessun header orfano. Separare «salvabile con avviso» da «pronto per avvio/ricalcolo»: il mobile attuale protegge gli obbligatori con `assertMandatoryFeasible`.

**L. Base mancante.** W `GPTourForm.tsx:51-54` ripiega su coordinate fisse a Milano se mancano Casa/Sede. Nel mobile mantenere selezione/conferma base o GPS, non importare una posizione inventata.

## 7. Piano di implementazione proposto — da approvare

### Fase 0 · P0 — contratto e decisioni prima delle patch

- Congelare SHA web di riferimento e matrice regole: selezione automatica vs obbligatoria, «solo» vs espansioni, «tutti», date di riferimento, 15 giorni, conflitti e sfori.
- Decidere destinatari GPTour: stesso pilot admin del web oppure agenti proprietari. Non estendere i ruoli implicitamente.
- Stabilire contratti versionati per Intent, risultato, eventi follow-up, gruppo/giorno e metadati salvati. Campi opzionali e compatibilità con tour precedenti; nessuna riscrittura degli storici.
- Concordare salvataggio atomico (raccomandazione iniziale) vs parziale idempotente e consenso agli sfori, senza indebolire il vecchio percorso.
- Definire confine scritture: normale anteprima senza mutazioni; rinvio follow-up con conferma distinta perché modifica subito il calendario.
- **Uscita:** specifica approvata e casi di accettazione. Nessuna UI nuova prima della chiusura di questi punti.

### Fase 1 · P1 — dati e filtri deterministici

- Estendere in modo compatibile `types.ts` e `data.ts`; integrare contact-stats, proprietà orfani e distinzione evento/appuntamento.
- Portare `gptour-intent`, `gptour-criteria`, `gptour-identity`, normalizzazioni territoriali e dataset adiacenze con adattatori Expo.
- Rendere espliciti errori/incompletezza del pool; paginazione e conteggi, stato «non noto» distinto da «mai visitato».
- Applicare gli stessi filtri a tutte le entrate, non solo ai riempitivi; eccezioni obbligatorie tracciate, nessun allargamento silenzioso.
- **Uscita:** suite pure su dati sintetici; nessuna scrittura CRM; parità verificata per soglie, progetti, orfani e dedup.

### Fase 2 · P1 — motore giornaliero/multi-day

- Integrare in moduli separati completezza `wantAll`, `maxDays`, raggruppamento, optimizer slot-aware, insertion/saturazione e regole notte.
- Riutilizzare OSRM e timeout Hermes mobile, distinguendo dati stradali da stime; gestire matrici grandi e cache per il budget rete.
- Conservare ottimizzazioni Or-opt/refill del percorso esistente, quote, Journey ordinate, obbligatori e finestre.
- Ricalcolare dipendenze notte/giorni dopo editing; verificare calendario, pranzo, orari, insieme tappe e unicità globale.
- **Uscita:** motore testabile senza UI e senza dati reali; scenari routing fallito/instabile espliciti, nessuna tappa persa.

### Fase 3 · P1 — follow-up e contratto AI

- Collegare servizio GPTour condiviso/versionato con ruoli autorizzati; lasciare invariato `/parse-brief` V4.1.
- Orchestrare eventi reali per ID, decisioni, ambiguità e conferma rinvii; aggiornare slot/candidati dopo scrittura confermata.
- Ricaricare follow-up quando cambiano le date, anche per giornate aggiunte dal completamento; gestire arretrati ed eventi multipli per cliente senza perdita.
- Preservare chiusura fino a fine giornata dopo visita/ispezione, stato completed e calendario libero del mobile.
- Errori AI/rete con retry limitato, annullamento, protezioni da risposte tardive e conservazione del piano precedente; memoria/log non bloccanti.
- **Uscita:** test con dipendenze iniettate; prove RPC mutanti solo su ambiente/test autorizzati separatamente.

### Fase 4 · P1 — UI mobile nativa

- Aggiungere GPTour come ingresso distinto dentro AI Tour, non un quinto blocco compresso nella stessa form.
- Chat testo/voce con riuso Expo Audio e vocabolario, riepilogo criteri sempre consultabile, richiesta follow-up e proposte accetta/rifiuta.
- Selettore giorni, anteprima elenco/mappa, indicatori origine/rientro/notte, conflitti, modifiche e salvataggio.
- Riutilizzare mappa/editor native; riordino accessibile, safe area, tastiera, target 44 pt e testID univoci. Niente componenti web copiati.
- Stato conversazione isolato per agente; definire bozza/ripristino e cancellazione senza mescolare account.
- **Uscita:** flussi completi su anteprime isolate e piccoli schermi; microfono/background poi su device.

### Fase 5 · P1 alta — persistenza, web↔mobile e Tour Live

- Salvare metadati versionati del gruppo/giorno, Intent, decisioni/eventi, vincoli e stato routing insieme al piano, con strategia approvata in Fase 0.
- Coordinare il produttore web: il mobile non può preservare dati che il web non salva.
- Ripristinare metadati in I miei Tour; applicarli a modifica, avvio, ricalcolo, riordino, aggiunta e «Più Visite».
- Gestire tour legacy privi di Intent senza inventarne uno dal riepilogo AI; preservare protezioni Live, cestino e ispezione obbligatoria.
- Salvataggi/riprogrammazioni idempotenti, esiti affidabili e niente duplicati dopo timeout.
- **Uscita:** round-trip web→mobile→mobile/web su fixture autorizzate; zero perdita di vincoli. Questa fase è obbligatoria per considerare il porting completo.

### Fase 6 · P1/P2 — regressione e validazione sul campo

- Regressioni dei percorsi preesistenti e nuovi test indicati sotto.
- Test E2E su dati controllati solo dopo autorizzazione; nessuna prova sui Live reali protetti.
- Device iOS/Android: voce, permessi, GPS, sospensione/ripresa, tempi e memoria con pool grandi.
- P2 dopo correttezza: confronto spiegabile prima/dopo, telemetria aggregata dei motivi di esclusione, latenza/matrici e ripresa bozze migliorata.
- **Uscita:** evidenze separate per test puri, integrazione e dispositivo; approvazione utente, non dichiarazione basata soltanto sulla preview.

## 8. Matrice minima di accettazione proposta

| Scenario | Risultato atteso |
|---|---|
| «Prospect non visitati da 30 giorni» → «aggiungi due vicini» | Soglia 30 e altri criteri conservati; non ritorno implicito a 15 |
| Contatto 29/30/31 giorni, visita vs ispezione, dato sconosciuto | Confine inclusivo N; errore dati non scambiato per mai visitato |
| Ordine ieri, ultima visita 40 giorni fa | «Non visitati» e «non ordinano» producono risultati distinti; regola legacy invariata nel vecchio flusso |
| «Tutti i miei orfani» con orfani altrui nella risposta AI | Proprietà verificata su ogni selezione, compresa quella iniziale; eccezione territorio per propri orfani esplicita |
| «Solo comune X» / sigla provincia / nome esteso | Nessuna fuga territoriale; differenza da area preferita dichiarata |
| Quote FED/DoctorVape e filler, journey ordinata | Nessuna regressione rispetto al brief; vincoli non rappresentabili non ignorati |
| AI omette idonei / propone chiavi false / pool troncato | Completamento solo su pool completo; chiavi false rifiutate; risultato parziale dichiarato |
| Cliente/prospect/orfano/registro riferiscono stesso luogo | Una identità, priorità esplicite; eccezioni per eventi multipli gestite consapevolmente |
| Due follow-up dello stesso cliente | Decisioni per evento/data, nessun evento perso per dedup |
| Mantieni/escludi/rinvia; errore RPC; data ambigua | Effetto reale coerente, niente falsa conferma o scrittura inventata |
| Nuovo giorno creato da «tutti» | Nuova verifica dei follow-up di quel giorno prima di confermare il piano |
| Visita 07:45, follow-up 09:00 odierno e domani | Quello odierno chiuso, domani aperto; salvataggio visita non bloccato da errore chiusura |
| Europa/Roma, mezzanotte, cambio ora, dispositivo in altro fuso | Stesse date commerciali web/mobile e nessun rinvio involontario |
| «Tutto in un giorno», capacità superata | MaxDays rispettato anche contro risposta AI incoerente; avviso/consenso senza visite eliminate |
| Gruppi distanti, pranzo, fascia pomeridiana, giorni esclusi | Timeline completa e conflitti dichiarati; nessuna pretesa di fattibilità dalla sola capienza |
| Soglia pernottamento 49/50/51 km con N=50 | Casa solo sotto 50; uso prima tappa reale; ricalcolo a ogni modifica rilevante |
| OSRM assente/timeout e ipotesi notte oscillante | `routing_unknown`/`unstable` visibili; stime non presentate come distanze reali |
| Candidato vicino al centro di una lunga tratta | Corridoio valutato sulla strada; costo A→C→B−A→B e deviazione combinata corretti |
| 26+ candidati al riempimento | Priorità commerciali/geografiche prima del cap matrice, non solo distanza |
| «No, finisco prima», poi altro messaggio | Proposta rifiutata non ripresentata e consenso buffer conservato |
| Aggiungi/riordina/rimuovi tra giorni | No duplicati globali; Intent, obbligatori e pernottamenti coerenti |
| Errore salvataggio G2 dopo G1; retry dopo timeout | Strategia atomica o parziale rispettata, niente duplicati/header senza tappe/falso «Salvato» |
| Salva web → riapri mobile → ricalcola/Più Visite | Criteri, date e obbligatori conservati; legacy gestiti esplicitamente |
| Utente agente vs admin; cambio account a chiamata in corso | Autorizzazione corretta e nessuna contaminazione del piano tra agenti |
| Form classica, V4.1, Settimana/Mese, Live, foto e reminder | Nessuna regressione dei flussi esistenti |

Il web contiene **13 file di test `gptour_*.unit.ts`** utili come riferimento (intent, criteria, identity, followups, complete-all, order, insertion, fill, saturation, preselection, geografia, lodging, own-orphans). Non bastano da soli: aggiungere soprattutto le prove trasversali selezione iniziale→Intent→editing→save→reload→Live. **Non eseguiti in questa fase.**

## 9. Decisioni da sottoporre all'approvazione del piano

1. Porting prima admin-only come main oppure fruibile dagli agenti proprietari? Raccomandazione: non abilitare nuovi ruoli implicitamente.
2. Conservare batch atomico mobile o replicare salvataggio parziale con retry idempotente? Raccomandazione: preservare atomicità finché non viene richiesto esplicitamente altro.
3. Quali conflitti ammettere in un piano salvato e quali impediscono l'avvio? Raccomandazione: nessuna deroga globale ai controlli; distinguere orario di fine da impossibilità/coordinate/eventi mancanti.
4. Conferma che rinviare dalla chat modifica subito il calendario, separatamente da Salva giro; proposta di conferma data/ora prima dell'operazione.

**Stato finale:** analisi dei sorgenti aggiornata completata e piano proposto. Nessuna implementazione autorizzata o avviata. Nessuna affermazione di funzionamento runtime dei nuovi servizi. Interventi build, video, Monitoring/GPS staff e altre sezioni restano fuori ambito.