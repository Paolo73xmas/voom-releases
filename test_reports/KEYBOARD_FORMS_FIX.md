# VOOM Mobile — moduli e tastiera tablet Android

## Stato finale
Correzione del codice Mobile e collaudo locale completati. **Tastiera/IME e rendering su tablet Android fisico e iPhone NON verificati.** Nessuna build, pubblicazione, OTA o operazione Git di scrittura eseguita. App installate sui dispositivi non aggiornate da questo intervento.

## Problema e perimetro
Gli utenti segnalano campo di scrittura perso, sovrapposizioni e controlli inutilizzabili quando compare la tastiera Android, in anagrafica e altre schermate. Il codice presentava gestioni diverse: KeyboardAvoidingView RN con altezza, moduli senza scorrimento verso il cursore, campi follow-up senza gestione e finestre con corpo a dimensioni rigide. Questi difetti di struttura sono stati corretti; non sono una diagnosi hardware definitiva senza log/dispositivo.

Modificati 9 file UI esistenti: anagrafica, customer/[id], inspection/new, order-collection-v2, rimborsi, rivendite-no-mappa, substitutions, AppointmentForm e ShippingMethodStep. Aggiunto `components/forms/KeyboardForm.tsx`.

## Intervento
- Unico KeyboardProvider già presente, stessa libreria 1.18.5, nessuna dipendenza/configurazione aggiunta.
- Scroll dei moduli affidato a KeyboardAwareScrollView: cursore seguito, spazio della tastiera gestito una sola volta, tocchi ai controlli mantenuti, clipping disattivato. Nessun KeyboardAvoidingView attivo intorno a questi scroller.
- Barre di navigazione mantenute tramite KeyboardStickyView: sola traslazione senza ridimensionare il corpo; altezza effettiva misurata per lasciare il campo sopra barra e tastiera, con margine 12 e inset esterno dove presente.
- Scope indipendenti per finestra/modal; schede di modifica alte 85% del viewport invece di cap rigidi. Input e selezioni conservati ai cambi passo, tastiera chiusa esplicitamente nella navigazione.
- Liste di ricerca con input in alto: KeyboardAvoidingView del controller + lista ordinaria, senza KASV annidato. In ordini questo schema è attivo SOLO nei passi 1–3; spedizione/riepilogo usano SOLO scroller consapevole e footer traslato.
- Editor prezzo non racchiuso in TouchableOpacity che intercetta l'intera superficie. Sostituzioni: eliminata FlatList non virtualizzata dentro scroller, stessi 50 elementi limite, business logic invariata.
- Anagrafica: evidenza visiva del campo attivo senza variazione delle dimensioni, gestione inclusa nei campi follow-up.
- Trovata e riprodotta una regressione specifica della preview: RN Web interpreta ogni scroll come drag e sfoca l'input quando `keyboardDismissMode=on-drag`. Correzione: `none` sul web; `on-drag` conservato Android/iOS. Non è una prova del comportamento IME nativo.

## Verifiche definitive
- Vitest: **561/561 PASS, 61 file** (11 test aggiunti: 6 guard sorgente e 5 test eseguiti sui componenti con hook/host controllati).
- TypeScript PASS; lint completo **0 errori / 147 warning**; lint Python script nuovi PASS.
- Controllo lockfile esistente PASS (sola lettura, non build).
- Confronto byte con baseline locale `471ef1df`: solo i 9 file UI esistenti sopra differiscono. Backend, GPTour classico/Orchestrator, auth, contratti, manifest, Metro, dipendenze e lock invariati. Digest dei due .env invariati rispetto a inizio lavoro.
- Expo riavviato; replica finale screenshot-tool `20261015_102434` PASS.
- Controllati i log Expo: il file stderr accumulato contiene rifiuti CORS di richieste esterne `app.emergent.sh` e stream chiusi. Analisi read-only li attribuisce al middleware di sviluppo, non ai moduli né all'autenticazione dell'app. L'origine della preview verificata compila/renderizza e non produce errori pagina. Nessuna modifica alle protezioni CORS/Metro/config.
- 10 gruppi di prove browser, con UI reale e **dati/rete di test sintetici**: 43 richieste tutte intercettate, 0 richieste business sconosciute, 0 tentativi di scrittura CRM, 0 errori pagina. Nessuna credenziale reale usata.

### Flussi provati
1. Anagrafica: visita telefonica, tutti i campi obbligatori validi, digitazione carattere per carattere/focus, ricerca chiusa senza perdita dati, progetto/tipo, riepilogo, follow-up, ritorno/avanti con conservazione.
2. Anagrafica: 390×844, 320×568, 800×1280, 800×650, note raggiungibili/footer nei limiti/no overflow orizzontale.
3. Cliente: modifica contatto/indirizzo/fiscali, input finale e annullamento senza scritture.
4. Rimborsi: importo/descrizione/categoria con un tocco, chiusura/reset/riapertura, matrice 390/320/800 ridotto.
5. Ispezione: ricerca cliente, selezione precisa con un tocco, note e azione finale raggiungibili (GPS negato SOLO nel test).
6. Sostituzioni: tutti i passi fino a motivo/note/conferma, senza invio finale.
7. Rivendita no mappa: campi validi + coordinate manuali sintetiche; passo foto raggiunto senza permessi/foto/registrazioni reali.
8. Ordini: ricerca cliente/prodotto, prezzo modificato nel solo carrello locale, ricerca pacchetto, pagamento, spedizione/indirizzo, note riepilogo, stato conservato e footer nei limiti alle quattro dimensioni. Nessun ordine o PDF inviato.
9. Appuntamento: impegno libero/tutti i campi, passaggio a cliente e selezione, annullamento, footer verificato 390/320/800 ridotto.
10. Sostituzioni: finestra annidata ricerca prodotto, digitazione e selezione al primo tocco; ritorno al wizard con prodotto giusto.

## Rettifica rapporto iteration_86
Rapporto preliminare, non esito definitivo. I sei test introdotti erano guard testuali, non test comportamentali nativi. La percentuale 70% non è una misura utile della copertura e non viene adottata.
- Anagrafica: il vecchio script compilava solo parte dei campi richiesti e forzava click sul pulsante disabilitato. Validazioni corrette, NON modificate.
- Sostituzioni: un selettore per prefisso sceglieva la ricerca anziché il cliente; lo script cercava inoltre Avanti nel passo finale dove esiste Crea Richiesta. Con selettori esatti e attesa dei risultati il percorso passa, senza modifica delle regole.
- Rivendite: mancavano coordinate/GPS e veniva usata una P.IVA segnaposto. Prova corretta con coordinate manuali e input valido passa; controlli mantenuti.
- Rimborsi: aggiunto testID/accessibilità al FAB reale; nessun click per coordinate necessario.
- Vecchi 42 request-block non dimostravano errori di integrazione: molte erano risorse Cloudflare classificate erroneamente come business. La nuova fixture separa risorse statiche, API esplicite e blocca ogni endpoint non previsto.
- Tutte le prove finali evitano click forzati, selettori ambigui, attese arbitrarie delle animazioni e assert opzionali.

## Evidenze e ripetibilità
- `tests/e2e/keyboard_forms_fixture.py`: sessione sintetica, guard rete prima della navigazione e GPS negato; nessun login reale.
- `tests/e2e/keyboard_forms_browser.py`: `run` e `run_extra` prendono URL preview e cartella output. Da eseguire con browser isolato e senza credenziali; non usare vecchi harness live.
- `test_reports/keyboard_forms_final/result.json` e `extra-result.json`: risultati finali, screenshot nella stessa cartella.
- `test_reports/keyboard_forms_main/{vitest,typescript,eslint,lockfile}.log`: controlli codice. Screenshot failure nella cartella main sono diagnostici preliminari, non risultati finali.

## Collaudo fisico ancora necessario (P1)
Sul tablet con la versione aggiornata autorizzata dall'utente:
1. Aprire anagrafica; compilare campi iniziali/intermedi/finali, passare fra lettere/numeri/email e digitare note lunghe.
2. Selezionare/copiare testo; controllare cursore visibile, nessun salto o tastiera che si chiude da sola. Scorrere e toccare un comando una sola volta.
3. Aprire/chiudere ricerca, progetto/tipo, modifiche cliente, rimborso con foto già presente, editor prezzo e selettore prodotti annidato.
4. Provare avanti/indietro con tastiera aperta, chiusura via Back Android e successiva riapertura; verificare assenza di buchi/spostamenti doppi e conservazione campi.
5. Provare tablet in finestra ridotta/split-screen, tastiera flottante/separata e hardware se usate; ripetere su iPhone per regressione.

**Non certificato qui:** animazioni IME native, cursore in tastiere flottanti/separate, Android Dialog/Fabric, foto reali o GPU, rotazione fisica, finalizzazione/salvataggio nei servizi reali. Nessun flusso locale verificato rimane fallito; la segnalazione su hardware richiede ancora conferma utente.