# Smoke GPTour — Igor Cinquegrani, 09/10/2026

## Esito
**PASS per il flusso principale richiesto**, con un rilievo sulla formulazione alternativa descritto sotto. Prova reale via amministratore, anteprima mobile 390×844; nessun salvataggio/avvio tour o modifica CRM. Nessun codice applicativo, configurazione, dipendenza o servizio modificato.

## Territorio e dati reali
- Profilo Igor selezionato realmente; identità richiesta/risposta Edge confrontata con l'agente selezionato in tutte le quattro chiamate della verifica finale.
- 1 zona assegnata; **2.237 candidati caricati**. Pool dichiaratamente parziale: registro limitato a 2.500 righe e alcuni storici non verificati. Non equivale a tutto il territorio CRM.
- Discovery con le vere `getSettings`, `loadGptourPool`, `pointInZones` e `loadLatestPurchases`, client Supabase autenticato e guard sola lettura.
- Scelto **Treviso**, nel territorio verificato: **8 idonei con acquisto almeno 30 giorni prima**, 7 clienti + 1 orfano nello snapshot della discovery. Le query ultimi acquisti escludono ordini eliminati/annullati; nessun fallback dalle date cliente.

## Prova finale con asserzioni
1. Richiesta: «Tabaccherie di TREVISO che non comprano da 30 giorni. Per il prossimo lunedì, una sola giornata, massimo 5 tappe. Niente follow-up, nessuna modifica agli appuntamenti.»
   - Giro di lunedì 12 ottobre: **5 tappe tutte a Treviso, 37 km, 07:00–10:29**.
   - Banner «Ultimo acquisto da almeno 30 giorni · Clienti e orfani con storico acquisti · TREVISO» presente.
2. Secondo messaggio: «Parti alle 09:00».
   - **5 tappe, 37 km, 09:00–12:29**; filtro 30 giorni e comune mantenuti.
   - Tutte le 5 tappe mostrano ultimo ordine; età degli ordini **87, 228, 43, 31, 31 giorni**. Numero ordine/link visibile. Condivisione/download PDF nativi non esercitati.
   - Quattro richieste Edge complessive, tutte HTTP200, con soggetto Igor corretto. Passaggi verificati con `requireOrderHistory=true` e `orderMinDays=30`.
3. Indietro → riapertura → nuova selezione Igor:
   - Nessuna schermata bianca; filtro e conversazione recuperati dalla bozza locale.
   - Nessuna chiamata AI aggiuntiva per la riapertura. Non salvato alcun tour sul server.
   - Caricamento Igor circa **10,6 s**, sia iniziale sia riapertura. L'account admin predefinito richiede circa 22–24 s. Il precedente sospetto di caricamento infinito **non è riprodotto**.
4. Protezioni:
   - **0 scritture CRM inoltrate**, nessuna richiesta bloccata nella verifica finale.
   - RPC lettura mappa `tabaccherie_points_in_bbox` consentita dopo verifica della funzione client: precedenti warning di rete dovuti al guard troppo restrittivo, non prova di guasto applicativo.
5. Regressioni locali:
   - `gptour_purchase_request.test.ts` e `tour_last_orders.test.ts`: entrambe PASS.
   - TypeScript `tsc --noEmit`: PASS. Lint test Python: PASS.

## Rilievo residuo: formulazione alternativa
La precedente prova usava «con ultimo acquisto almeno 30 giorni fa», NON «che non comprano da 30 giorni». Ha prodotto un piano a Treviso e il criterio `orderMinDays=30`, ma **senza banner acquisti e senza il secondo passaggio verificato**. Il parser deterministico attuale riconosce forme come «non comprano/acquistano/ordinano da N giorni», non questa forma alternativa; la risposta AI non ne ha attivato il percorso `requireOrderHistory`.

Il conteggio di due chiamate in quel caso **non è da solo un errore**: quattro era un limite massimo del test, non un requisito funzionale universale. Rimane da uniformare/verificare il comportamento della formulazione alternativa. **Non corretta in questo incarico di smoke test**; nessun cambiamento alle regole di parità web introdotto autonomamente.

## Rettifiche delle prove preliminari
- Iteration66: «Bacoli» era una scelta errata del test, fuori dal territorio individuato; non usata come prova positiva territoriale.
- Iteration67 preliminare: valido per discovery, giro breve e tempi riapertura, non per certificare il percorso acquisti verificato nella formulazione alternativa.
- RCA preliminare chiamava erroneamente la base «Trevignano Romano»: la base letta è **Trevignano (TV)**. Scelta Treviso confermata da geometria delle zone, non dedotta dalla sola base.
- Warning Metro1006 durante sessione lunga e deprecazioni RNWeb: annotati, non hanno impedito il flusso. Nessuna pretesa di certificazione nativa o stabilità assoluta della connessione.

## Evidenze
- Discovery: `test_reports/artifacts_iter67/iter67_igor_territory_discovery.json`.
- Prova preliminare alternativa: `test_reports/artifacts_iter67/iter67_gptour_igor_run.json`.
- Prova finale autorevole: `test_reports/artifacts_iter67/igor_literal_purchase_verification.json`.
- Screenshot: `igor_literal_plan.jpeg`, `igor_literal_second_turn.jpeg`, `igor_literal_reopen.jpeg` nella stessa cartella.
- Script ripetibile aggiornato: `tests/e2e/iter67_gptour_igor_territory.py`; credenziali lette esclusivamente dal file dedicato.

**Limiti:** browser preview, non dispositivo Android/iOS; nessun GPS, microfono, PDF share nativo, salvataggio o Live operativo testato. Totale AI: 4 chiamate dichiarate dalla prova66 (non completamente documentate), 2 persistite nella prova67 alternativa, 4 nella verifica finale; non confondere i conteggi.