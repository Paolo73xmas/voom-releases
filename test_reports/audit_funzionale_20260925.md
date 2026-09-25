# VOOM CRM — Audit funzionale del 25 settembre 2026

## Esito

**L'app si avvia e i percorsi verificati sono utilizzabili, ma non tutto funziona come previsto.** Sono emersi difetti nei valori economici visualizzati, limiti non dichiarati dello storico, gestione ambigua di alcuni errori e un difetto nel download parziale dei vecchi tutorial.

Audit richiesto dall'utente **con rapporto, non con correzioni**. Nessuna modifica al codice applicativo, alle dipendenze, alle configurazioni o ai dati operativi. Aggiunti soltanto documentazione, prove e relativo test backend. Nessun ordine, tour, ispezione, appuntamento, rimborso o sostituzione inviato; nessuna modifica a stock o GPS.

Riferimento codice: `2f345ef2`. Confronto finale byte-per-byte tramite hash: **185 file versionati di codice/configurazione frontend e backend controllati, zero modificati**. Ambiente: preview collegata al Supabase esistente. Non è un audit di sicurezza e non certifica l'esecuzione su dispositivi fisici né l'app installata dagli agenti.

## Verifiche eseguite

| Controllo | Risultato e livello di prova |
|---|---|
| TypeScript | `tsc --noEmit` superato |
| Lint iniziale | Nessun errore riportato sui file schermate frontend e moduli Python backend controllati |
| Test unitari frontend | **82/82 superati**, 11 file |
| Suite AI Tour | **6/6 gruppi superati**: planner, aree/clienti, normalizzazione/15 giorni, editor, guardie Live/salvataggio, operazioni protette |
| Suite segnalazioni cliente | **2/2 gruppi superati** |
| Backend reale | **7/8 superati**; unico fallimento: richiesta degli ultimi byte di un vecchio tutorial |
| Interpretazione AI | Due richieste reali con risposta contratto 4.1; richiesta vuota rifiutata correttamente |
| Trascrizione | Audio italiano locale inviato realmente: risposta 200 e testo non vuoto. Gli errori storici nei log non si sono riprodotti |
| Accesso | Login reali agente, amministratore e agente con ispezioni; nessuna modifica all'autenticazione |
| Ispezioni | Dashboard con 5 schede, elenco, filtri/ricerca, dettaglio e foto ingrandite. Nell'ultima lettura l'agente con storico aveva 211 ispezioni |
| Errori Ispezioni | Errore HTTP 503 **simulato solo nell'automazione**: riprodotto messaggio ingannevole di storico vuoto. Ripristinata la rete, tornano 5 schede reali |
| Raccolta ordine | Percorso reale cliente → prodotti → pagamento → spedizione → riepilogo, **senza invio**, sia Italia sia Estero |
| Metodi gestionali | Italia: 9 pagamenti e 5 spedizioni; Estero: CONTANTI e 2 spedizioni (`RITIRO IN SEDE EST`, `Cassiopea 3%`). Dati letti dal servizio reale |
| Calendario | Apertura form, passaggio a impegno libero e chiusura effettiva su **390×844 e 320×568**; test puri su orario locale/follow-up superati |
| Prodotti | Catalogo caricato, 266 prodotti attivi e 6 categorie nella lettura effettuata; stock letto anche nel wizard ordine |
| Scadenziario | Caricamento reale, ricerca e toggle settimana/mese; nessuna chiamata o generazione sollecito/PDF |
| Sostituzioni | Caricamento di 100 righe, ricerca e dettaglio reale: confermato difetto economico F01 |
| Rimborsi | Lettura di 10 richieste per l'account amministrativo e filtri Pagato/Tutti; nessun invio o eliminazione |
| Bozze | Schermata vuota corretta in sessione isolata; test puri su persistenza/serializzazione/errori superati. Le selezioni ordine restano solo nel browser di prova |
| Profilo/Privacy | Consultazione e apertura/chiusura della privacy in sola lettura |

I test automatici puri includono stub di dipendenze e casi di errore: **non equivalgono a salvataggi reali sul CRM**. Le API dell'app non sono state sostituite. Le prove browser supplementari hanno bloccato preventivamente scritture non autorizzate e registrato **zero tentativi di mutazione CRM**.

## Problemi prioritari

### F01 — ALTA — Sostituzioni: prezzi e totali del dettaglio a zero

**Confermato con dati reali e schermata.** Aprire Sostituzioni da una sessione nuova e aprire una richiesta esistente, senza aprire prima “Nuova Sostituzione”. Nel campione controllato il servizio restituiva due pezzi a €12,80 per il ritiro e due a €12,00 per l'invio; il dettaglio mostrava **€0,00/pz e totali €0,00**, anziché €25,60/€24,00 secondo quei prezzi.

- Causa: `frontend/app/substitutions.tsx:61,112-119,135,233-234,278,289`. Il dettaglio usa `getProductPrice()` sullo stato `products`, inizialmente vuoto e caricato soltanto aprendo il wizard di creazione. I prezzi sono invece già disponibili negli oggetti prodotto delle righe lette dall'API.
- Impatto: rappresentazione economica errata, dipendente dal percorso di navigazione. **Non è stata rilevata né provocata una modifica degli importi registrati.**
- Intervento proposto: usare la fonte prezzi appropriata nel dettaglio e rendere esplicito se si mostrano prezzi attuali o storici; aggiungere regressione apertura diretta.
- Evidenza: `automation_output/20260925_103525`, `audit-substitutions-detail-values.jpeg` e output API/UI della prova.

### F02 — ALTA — Dashboard: IVA/lordo del venduto non coerenti con il dettaglio ordine

**Difetto confermato nel codice; non quantificato su tutti gli ordini reali.**

- `frontend/app/(tabs)/index.tsx:114-156` ignora `is_foreign`, applica `iva_percentage || 22` (quindi trasforma un'aliquota valida di 0 in 22), calcola l'IVA senza accisa e non applica le regole dei prodotti `EST-`.
- `frontend/lib/order-totals.ts:8-24` usa invece aliquota zero/estero e base imponibile comprensiva di accisa secondo le regole attuali dell'app.
- Controesempio: netto €100, accisa €10, IVA 22% → dashboard IVA €22/lordo €132; dettaglio IVA €24,20/lordo €134,20, a spedizione zero. Con aliquota zero, netto €100/accisa zero → dashboard €22 IVA anziché zero.
- La query non esclude inoltre gli ordini annullati. La selezione degli stati da includere nel “venduto” va definita esplicitamente, senza riscrivere lo storico.
- Intervento proposto: condividere regole fiscali/criteri del riepilogo e testare estero, aliquota zero, accisa e annullamenti. Questi errori riguardano la dashboard: **il wizard Italia/Estero ha raggiunto correttamente il riepilogo nella prova effettuata**.

### F03 — MEDIA — Storici e ricerche incompleti oltre limiti non dichiarati

**Limiti confermati nel codice; prova con oltre 300 ispezioni non eseguita.**

- Ispezioni: `frontend/app/inspections.tsx:33-55`, `limit: 300`, ricerca soltanto sui risultati ricevuti. Anche “Tutte” può omettere ispezioni più vecchie senza avviso né paginazione.
- Ordini: `frontend/lib/api/orders.ts:12-34`, limite 200; `frontend/app/(tabs)/orders.tsx:133-149`, ricerca locale. La dashboard usa inoltre la lunghezza di questa lista come conteggio ordini (`index.tsx:94-99`).
- Sostituzioni: `frontend/lib/api/substitutions.ts:48-59`, limite 100; ricerca locale in `app/substitutions.tsx:121-125`. La lettura reale dell'audit ha restituito esattamente 100 righe; non è stato misurato il totale complessivo.
- Intervento proposto: paginazione e ricerca server-side, totale separato e indicazione esplicita dei risultati parziali.

### F04 — MEDIA — Dashboard: aggiornamento manuale non aggiorna le ispezioni

**Confermato dal percorso del codice.** `frontend/app/(tabs)/index.tsx:264-271` aggiorna statistiche, bozze, appuntamenti, scadenziario e follow-up, ma non chiama `loadLastInspections()` né aggiorna il badge tour.

Una nuova ispezione inserita altrove può quindi non comparire dopo il gesto Aggiorna. Cambiare schermata e rientrare richiama invece il caricamento al focus. Non è stata creata un'ispezione reale per questa prova.

### F05 — MEDIA — Errore di caricamento scambiato per assenza di dati

**Dashboard Ispezioni riprodotto con guasto controllato solo nel test.** Una risposta 503 produce “Nessuna ispezione registrata · tocca per crearne una”. Ripristinando le risposte reali e tornando in dashboard compaiono nuovamente le cinque ispezioni.

- Causa: `frontend/app/(tabs)/index.tsx:219-227,559-570`: errore soltanto nei log, caricamento terminato e lista vuota.
- Analogo rischio confermato nel codice dei rimborsi: `frontend/lib/api/rimborsi.ts:61-65,84-88` restituisce `[]` dopo un errore; la schermata non può distinguerlo da assenza di richieste/categorie. Nei reclami e nelle sostituzioni alcuni errori sono soltanto loggati.
- Intervento proposto: stato errore separato, conservazione dei dati precedenti e comando Riprova. Non suggerire la creazione di nuovi record quando il problema è la connessione.

### F06 — MEDIA — Note da Ispezioni: limite applicato prima di scartare le note vuote

**Confermato dal codice, scenario di volume non riprodotto sul CRM.** `frontend/lib/api/inspections.ts:184-200` legge le ultime 30 ispezioni e soltanto dopo elimina le note vuote.

Se le ultime 30 non hanno note ma la 31ª sì, il popup può dichiarare assenti le note precedenti. Lo storico oltre 30 non è comunque consultabile dal popup e il limite non è indicato.

Intervento proposto: selezionare prima le note significative e paginarle, oppure dichiarare la finestra e consentire di caricare le precedenti.

### F07 — MEDIA — Vecchi tutorial: richiesta degli ultimi byte gestita male

**Riprodotto tramite HTTP reale.** `GET /api/video-tutorial/1`, header `Range: bytes=-2`, restituisce i primi tre byte (`0-2`) anziché gli ultimi due.

- Causa: `backend/server.py:151-183`: primo numero assente interpretato come inizio 0, non come lunghezza del suffisso.
- Impatto: letture parziali/riprese dei player che utilizzano questa forma non affidabili. Non dimostra che ogni riproduzione del video fallisca.
- Il nuovo endpoint della guida Pirone è distinto e supporta HEAD nel codice corrente; non applicare la vecchia nota di handoff “HEAD=405”.
- Intervento proposto: riutilizzare la gestione Range corretta e testare suffissi, intervalli aperti, intervalli non validi e ripresa.
- Evidenza: `backend/tests/test_backend_readonly_iter48.py::test_video_tutorial_suffix_range_last_two_bytes` e log pytest.

## Altre limitazioni e rischi

- **Profilo — BASSA:** versione mostrata `1.0.0` (`profile.tsx:146,160`), diversa da `3.0.1` in `app.json`. Può confondere assistenza e verifica versione.
- **Profilo — funzione non disponibile, non guasto login:** Modifica Profilo e Cambia Password sono avvisi di rinvio all'amministratore; Notifiche annuncia una funzione futura. Il messaggio password cita “Password dimenticata”, ma la schermata login non offre quel percorso. Queste azioni non sono funzionalità autonome completate.
- **Ispezioni — rischio di concorrenza da riprodurre:** richieste preset senza cancellazione/identificatore (`inspections.tsx:33-49`); una risposta vecchia lenta può sostituire quella del filtro corrente. Non dichiarato bug riprodotto.
- **Sostituzioni — rischio di concorrenza da riprodurre:** numero richiesta derivato da conteggio+1 nel client (`lib/api/substitutions.ts:129-147`), non da assegnazione atomica. Invii simultanei/cancellazioni/RLS possono creare collisioni; schema e concorrenza non testati con scritture.
- **Reclami — perdita contesto nel codice:** “Crea Ordine” su richiesta approvata apre il wizard senza `customerId` (`orphan-claims.tsx:66-70`). L'utente deve riselezionare il cliente; non è stato premuto su un reclamo reale.
- **Manutenibilità/testabilità:** file molto estesi e diversi controlli legacy senza testID/accessibilità esplicita; warning Expo su quattro patch di dipendenze e deprecazioni già presenti. Nessun aggiornamento eseguito, nessun crash nativo dedotto da tali warning.

## Rettifiche al rapporto preliminare iteration_48.json

1. **Calendario: falso positivo eliminato.** Il pulsante `appointment-cancel` è visibile e chiude il modale su 390×844 e 320×568 con normali click auto-attesi, senza `force`. Il tester lo cliccava troppo presto forzando l'azione durante l'animazione.
2. **Range video: gravità MEDIA, non blocco critico globale.** Problema reale ma circoscritto al parser dei vecchi media.
3. La percentuale frontend “78%” del preliminare non ha una matrice sufficiente a supportarla: **non utilizzarla come indice di salute complessiva**.
4. I percorsi screenshot del preliminare con estensione `.jpg` sono inesatti: gli artefatti sono `.jpeg`.
5. Un blocco nel controllo supplementare di Scadenziario dipendeva da due selettori “Settimana” (uno di schermata nascosta) e da ritorno di navigazione saltato nel test. Corretto il test, toggle/ricerca verificati; nessuna patch app necessaria.
6. Il tasto Escape nel browser non è una prova della chiusura nativa del dettaglio sostituzione. L'attesa di uno stato vuoto nei Reclami non è una prova di errore quando l'account può avere richieste. Questi tentativi non sono inclusi tra i difetti confermati.

## Copertura ancora mancante

- Invio e persistenza finali di ordini, visite/ispezioni/foto, appuntamenti, rimborsi, sostituzioni; prenotazione e scarico stock; ripresa dopo interruzione durante scrittura.
- Tour Live reale: avvio, GPS/heartbeat, esiti, salti, pausa, cestino e chiusura automatica dopo ordine. Non eseguiti per non modificare il lavoro degli agenti. Guardie e regole coperte soltanto dalle suite pure; il popup note non è stato rieseguito end-to-end nel Live in questo audit.
- Mappa e anagrafica completa: non ripercorse end-to-end in questa iterazione. Non estendere automaticamente gli esiti delle verifiche storiche al codice attuale.
- Isolamento cross-agente: filtro applicativo presente e prova storica iteration47 disponibile; non eseguita una nuova verifica diretta cross-agente in iteration48.
- Dispositivo fisico iOS/Android: foto ad alta risoluzione/memoria Android, microfono e permessi, GPS, biometria, tastiera reale, condivisione PDF, comportamento in background e rete mobile.
- Ruoli filiale/magazzino e utenti non attivi, grandi volumi, offline prolungato/concorrenza multiutente.

**Conclusione:** audit con evidenze completato nel perimetro di sola lettura; non certificazione universale di tutti i flussi. Priorità proposta: F01/F02 (importi) → F03/F04/F05/F06 (storico/affidabilità) → F07 e limitazioni minori. Le correzioni restano da eseguire e verificare in un intervento successivo.

## Artefatti

- Preliminare e test: `test_reports/iteration_48.json`, `test_reports/artifacts_iter48/`, `test_reports/pytest/pytest_iter48_backend.xml`.
- Calendario/prodotti: `/root/.emergent/automation_output/20260925_103021/`.
- Scadenziario/bozze/profilo: `/root/.emergent/automation_output/20260925_103259/`.
- Sostituzioni/rimborsi: `/root/.emergent/automation_output/20260925_103525/`.
- Checkout reale senza invio: `/root/.emergent/automation_output/20260925_103736/`.
- Errore controllato ispezioni e ripristino reale: `/root/.emergent/automation_output/20260925_103853/`.

Gli artefatti tecnici possono contenere dati CRM delle schermate consultate: non pubblicarli come materiale dimostrativo. Nessuna credenziale inclusa in questo rapporto.