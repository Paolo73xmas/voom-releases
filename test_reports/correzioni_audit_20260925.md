# VOOM CRM — Correzioni audit verificate (25 settembre 2026)

## Perimetro concordato
Utente: «procedi con attenzione», conferma correzione dei problemi confermati per gruppi, con esclusione esplicita dei video. Corrette le anomalie F01–F06 e alcuni dettagli correlati confermati. **Video/backend media invariati. Nessuna scrittura ai dati operativi CRM.**

## Correzioni e prove

| Gruppo | Modifica | Verifica |
|---|---|---|
| F01 — Sostituzioni | Prezzi del dettaglio letti dai prodotti già associati alle righe, non dal catalogo del wizard; quantità zero/null gestite correttamente; prezzi mancanti distinti da zero. Indicata la base “listino attuale”. | Sessione amministrativa nuova, senza aprire creazione: importi reali **€25,60 / €24,00**, prima entrambi zero. Chiusura del dettaglio verificata. Test puri prezzo/quantità zero, dato mancante e righe legacy. |
| F02 — Venduto | Condivise le regole fiscali del dettaglio ordine; IVA zero, Estero, prefisso EST e accisa rispettati. Esclusi gli annullati, lettura paginata del mese completo, conteggi ordini reali. **Lordo merce: spedizioni escluse**, indicazione visibile. | Confronto indipendente sui dati reali di **36 ordini**: netto **€8.023,83**, accisa **€846,96**, IVA **€1.441,65**, lordo merce **€10.312,44**: tutti coincidenti con UI. Arrotondamento a livello ordine, come il dettaglio esistente. |
| F03 — Storici | Pagine da 50, conteggio totale, ricerca sul server, ordinamento stabile data+id. Rimossi i tetti complessivi 300/200/100. Protezione risposte obsolete, append senza duplicati, retry della pagina fallita. | Ordini: caricate **250 righe su 4.937**, ricerca Milano **1.062** risultati; sostituzioni: **150 su 345**, ricerca Milano **86**; ispezioni: **100 su 214**. Sono letture reali, conteggi variabili nel tempo. Ricerca con virgole, virgolette, parentesi, percentuale e underscore senza errori/allargamento involontario. Volume oltre300 ispezioni coperto da test puri. |
| F04 — Aggiornamento | Refresh dashboard rilegge anche ispezioni e badge Tour. Pulsante Aggiorna oltre al gesto esistente; richieste obsolete non sovrascrivono le risposte attuali. | Controllata una nuova richiesta ispezioni dopo Aggiorna. Verificati recupero e aggiornamento delle cinque schede. |
| F05 — Errori | Errori di caricamento separati dallo stato vuoto in dashboard, storici, rimborsi e reclami; Riprova; conservazione dati precedenti. Rimborsi senza dati leggibili: totale “—”, non zero inventato. | Guasti **503 simulati esclusivamente nel browser**: dashboard conserva5 schede senza invito a crearne; retry ripristina dati reali. Pagina2 ordini fallita conserva dati/conteggi; retry appende correttamente. Rimborsi errore iniziale → retry restituisce10 righe reali; reclami errore/retry verificati. |
| F06 — Note Ispezioni | Tutte le note del cliente/agente lette in pagine da50, senza limite30 prima del filtro delle note vuote. Dialogo immediato con caricamento, scorrimento virtualizzato, retry e chiusura durante lettura. | API reale cliente/agente:3 note lette. Test puro: prima nota utile dopo50 righe bianche e lettura51 note. **Componente reale in harness isolato con dati locali:**55 note, raggiunta l'ultima, chiusura390×844;320×568 chiusura durante fetch, nessuna riapertura tardiva, errore/retry. Nessun Tour Live operativo avviato. |

### Altri dettagli corretti
- Profilo: versione non più hardcoded; runtime Expo sui dispositivi, configurazione app per l'anteprima web. Verificato **3.0.1** e testo visibile sopra la barra inferiore su320×568.
- Ordini: spazio inferiore adeguato per non coprire il pulsante Carica altri risultati con la barra di navigazione.
- Reclamo approvato → Crea ordine: preserva cliente e apertura prodotti tramite il percorso già esistente. Verifica del codice/percorso puro; nessun ordine inviato da un reclamo reale.

## Risultati automatici
- **104/104 test frontend superati** in13 file:82 precedenti +22 nuove regressioni.
- TypeScript `tsc --noEmit`: PASS.
- Lint dei file modificati: PASS.
- **6 suite AI Tour +2 suite segnalazioni cliente**: PASS, prove pure senza scritture CRM.
- L'agente di test iteration49 ha confermato **22/22** regressioni mirate, ma ha completato solo una parte delle prove UI. La matrice sopra è stata completata tramite verifiche dirette successive; non attribuirla interamente all'agente.

## Rettifiche e problemi incontrati durante i test
- Il blocco Privacy/Login segnalato dall'agente49 era del percorso/attesa dell'automazione. Login reali ripetuti su `/login` riusciti; **nessuna modifica ad auth o privacy**. Il consenso al primo avvio non è stato rivalidato end-to-end. Non usare il40% preliminare come metrica di qualità.
- La prima asserzione Milano=1022 confrontava una query di prova con due soli campi cliente; la ricerca dell'app ne include altri e restituisce1062. Verificata ricerca completa, non modificata per soddisfare un conteggio errato.
- Una prova monetaria arrotondava ogni riga anziché ogni ordine: correggendo il criterio del test per corrispondere al dettaglio, tutti i valori reali coincidono. Nessuna alterazione delle regole fiscali esistenti per far passare la prova.
- Individuato e corretto il footer ordini coperto dalla barra inferiore. Un tentativo intermedio con hook altezza barra incompatibile è stato rimosso; il file finale usa lo spazio inferiore già adottato nell'app. Navigazione e caricamento fino250 ordini riprovati senza errori JS.
- Nel popup isolato la lista renderizza le celle progressivamente: per raggiungere la nota55 il test deve avanzare con il caricamento delle celle, non saltare una sola volta al fondo del primo blocco. Nessuna modifica applicativa necessaria per questo punto.

## Integrità e limiti
- Nessun ordine, ispezione, visita, follow-up, rimborso, sostituzione, tour o GPS salvato/modificato/eliminato durante queste verifiche. Nei test browser operativi: **zero tentativi di mutazione CRM**; consentiti login e letture.
- API dell'app reali. Le fixture del popup e i guasti503 sono **solo prove isolate**, non dati o integrazioni sostitutive nell'app. Harness sotto `test_reports/artifacts_iter49/`, non importato da alcuna route Expo.
- Nessuna modifica a schema/RLS, credenziali, auth/privacy, dipendenze, Metro o configurazione app. Il backend e gli endpoint video restano esclusi.
- **Resta fuori scope F07 video**, come richiesto: l'anomalia Range precedente non è stata corretta né ritestata.
- Non aggiunte le funzioni mancanti di modifica profilo/password/notifiche. Numerazione concorrente sostituzioni resta un rischio da approfondire, non una correzione approvata/riprodotta.
- La verifica non certifica GPS, fotocamera, biometria, microfono, processi in background o salvataggi reali su dispositivi iOS/Android. Il Tour Live operativo e i suoi esiti non sono stati eseguiti.

## Evidenze principali
Cartelle screenshot/script/log sotto `/root/.emergent/automation_output/`:
- `20260925_111735`: importi sostituzioni reali.
- `20260925_113425`: paginazione ordini250/sostituzioni150, ricerca e retry pagina2.
- `20260925_113928`: confronto36 ordini reali, refresh/errori dashboard, ispezioni100, gara fra preset7/Tutte con risposta ritardata.
- `20260925_114029`: rimborsi/reclami errori e recupero.
- `20260925_114504`: componente popup isolato,55 note e prove390/320.
- `20260925_114659`: profilo leggibile320 e saldi rimborsi non inventati.

Gli artefatti con schermate reali possono contenere dati CRM: non pubblicarli come materiale dimostrativo. Nessuna credenziale contenuta in questo rapporto.