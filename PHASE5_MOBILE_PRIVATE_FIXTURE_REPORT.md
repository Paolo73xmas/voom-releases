# Fase5 Mobile — ricezione fixture P1 e verifica finale offline

## Esito attuale: BLOCCATO DAL CONTENUTO DELL'ALLEGATO

L'allegato denominato `gptour-p1-pirone-real-fixture-2026-10-11 (1).zip` è stato scaricato una sola volta in una directory temporanea privata esterna al repository. **I byte ricevuti sono un documento HTML di caricamento, non un archivio ZIP né un JSON di fixture.**

Non è possibile verificare i tre turni o il rendering esatto senza il JSON originale. **Nessun confronto P1 è dichiarato superato e nessun dato mancante è stato ricostruito.** I precedenti test live e quelli su fixture sintetiche non sostituiscono questo confronto.

## Controlli sull'input effettivamente eseguiti

| Controllo | Risultato |
|---|---|
|Dimensione oggetto scaricato|1525byte, coerente con i metadati dell'allegato|
|SHA256|`f5d0504fdf03c769a0372b11b638d2d19fbd4520974f0b4f51ff5982c79c341e`|
|Firma/struttura ZIP|FAIL — `BadZipFile`, assenti struttura e indice ZIP|
|Contenuto JSON|Assente: documento non decodificabile come JSON|
|Struttura HTML|Presente, pagina di caricamento con script esterno|
|JSON incorporato / archivio incorporato|Non rilevati|
|Link diretti interni ZIP/JSON|Non rilevati|
|Esecuzione HTML/script del file|NON eseguita|
|Chiamate Supabase/Auth/Edge nuove|**0**|
|Chiamate Edge della precedente fase|**7**, registro storico invariato|
|Copie originali nel repository/bundle|**0**|

Si tratta di un blocco di acquisizione dell'input, **non di un difetto dimostrato del motore o del contratto mobile**. Non viene attribuita con certezza la causa al caricamento dell'utente o al sistema di esportazione: il fatto verificato è il contenuto HTML dell'oggetto ricevuto.

## Matrice di confronto richiesta

| Verifica sul medesimo JSON originale Web/Mobile | Stato |
|---|---|
|Tre risposte/turni, contratto e revisioni|NON ESEGUITA — JSON mancante|
|13tappe, ordine e identificativi|NON ESEGUITA — JSON mancante|
|2704coppie di coordinate, ordine LAT/LNG|NON ESEGUITA — JSON mancante|
|Arrivi/partenze e durate delle visite|NON ESEGUITA — JSON mancante|
|Distanze/tempi/rientro/totali|NON ESEGUITA — JSON mancante|
|Pause e cambio07:00→08:00|NON ESEGUITA — JSON mancante|
|Due follow-up e avvisi|NON ESEGUITA — JSON mancante|
|Rendering completo dei componenti mobile sullo stesso input|NON ESEGUITA su questa fixture|
|Android/iPhone su emulatori/dispositivi|NON ESEGUITI|

Appena disponibile il file valido: confronto di uguaglianza su tutti gli elementi, senza rigenerare il giro; rendering con dati iniettati esclusivamente a runtime in un ambiente di test privato, mai importando la fixture nel bundle. Eventuali screenshot/tracce con valori reali resteranno privati e temporanei, oppure non verranno prodotti; report solo aggregati. La prova browser/componente non sarà presentata come nativa.

## Privacy e pulizia
- Directory temporanea fuori `/app`, permessi0700; file0600; nessun endpoint pubblico creato per servirlo.
- Nessun UUID cliente/sessione o coordinata copiato in questo documento, nei nuovi test o nel bundle.
- Nessuna esecuzione dei contenuti caricati, nessun tentativo di seguire pagine/script per ottenere dati alternativi.
- Evidenze conservate: formato, dimensione, digest e stati della matrice, non il documento HTML.
- **Pulizia completata:** dopo aver verificato il salvataggio di digest e risultati aggregati, eliminati l'unico file scaricato e la relativa directory temporanea privata. Assenza del percorso verificata. Nessun originale trattenuto nel repository, bundle o directory servita pubblicamente.

## Stato v6 e installazione sui telefoni
L'utente comunica di aver verificato direttamente su Supabase che **v6 è attiva**, con contratto1.0 ed engine0.2.0. Questa conferma ha **provenienza utente**, non deriva da ulteriori chiamate del collaudo Mobile. Le sette chiamate precedenti non sono state ripetute.

Procedura di installazione privata e prerequisiti reali aggiornati in `PHASE5_MOBILE_NATIVE_TEST_INSTRUCTIONS.md`: APK Android e IPA iOS ad hoc, con variante di test separata e firma appropriata. Nessuna build generata né distribuita.

## Input necessario per proseguire
Occorre **il vero ZIP binario esportato dall'AI Web**, oppure il/i JSON originali contenenti le tre risposte complete. Non basta rinominare questa pagina HTML in `.zip` o `.json`. Il nuovo file verrà nuovamente verificato prima di essere estratto o usato.

STOP: nessuna nuova chiamata live, modifica motore/legacy, push, merge, build, OTA o pubblicazione.