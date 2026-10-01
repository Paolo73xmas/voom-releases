# GPTour mobile — avvio implementazione e decisioni condivise

> AGGIORNAMENTO: l'utente ha approvato entrambe le proposte (namespace JSON opzionale/merge e sola bozza idempotenza NON applicata). Il porting software è stato implementato. Stato/evidenze/limiti correnti: `memory/GPTOUR_MOBILE_DELIVERY.md` (187test, exportJSentrambiplatform, prove native ancora da eseguire). Il punto «in attesa» nel testo storico sottostante non è più lo stato corrente.

## Autorizzazione ricevuta

L'utente autorizza il porting completo come modalità separata, senza impoverire Genera Tour, Dillo all'AI V4.1, Journey, Settimana/Mese o Tour Live. Usa la stessa Edge `ai-tour-gptour`, sessione Supabase, ruoli admin/admincustom/agent/agentcustom. Agenti solo sul proprio auth.uid; verifica obbligatoria dell'effectiveAgentId restituito. Filtri deterministici anche sulla selezione iniziale, completezza, orfani propri, follow-up per evento, multi-day/pernottamenti, saturazione, editor con ricalcolo globale, batch atomico, contesto versionato, compatibilità legacy.

Scelta sui test: **solo test isolati, nessuna scrittura sui dati CRM reali**. Niente pubblicazione. Le verifiche native reali vanno rendicontate separatamente, non dedotte da export o preview browser.

Fermarsi per decisioni che cambiano schema, sicurezza, contratto condiviso o comportamento commerciale. Nessuna migrazione condivisa applicabile senza approvazione.

## Basi verificate prima dell'implementazione

- Web `Paolo73xmas/voom`, `main`: **88bfb440d86ca4103016ed2b5c1ed3416ecf497a**. Nessun commit successivo al riferimento minimo nel controllo iniziale.
- Mobile `Paolo73xmas/voom-releases`, **conflict_170826_1303**: **cddc85274894eed1ebdbef4597ff1c33cb67c1ad**.
- Workspace `/app` HEAD iniziale **95493772**: discendente della base mobile richiesta; nessuna differenza frontend/backend fra base mobile e HEAD iniziale, soltanto documentazione successiva. NON è stato usato il main di voom-releases.
- SDK54, SupabaseJS2.109.0, Expo Audio, mappe e AsyncStorage già presenti. Integrazione da riusare: nessuna nuova chiave AI o secondo interprete.

## Punto di approvazione incontrato

I sorgenti web includono un `save_tours_batch(p_tours jsonb)` atomico: header/tappe/eventi di tutte le giornate nella stessa transazione. **Non contiene un request ID né una registrazione di idempotenza.** Se il server completa il salvataggio ma la risposta si perde, una seconda chiamata può creare altri tour. Bloccare il doppio tap non risolve il problema dopo timeout o riapertura.

Il campo `ai_tours.area_filter` è già JSONB ed è già trasportato dal batch e dal mobile. Consente metadati opzionali senza aggiungere colonne/tabelle. Ma introdurre `gptourContext` è comunque un'estensione del contratto condiviso: viene sottoposta all'utente prima di scriverla nell'app.

### Proposta A — contesto persistente opzionale nel JSON esistente

Percorso proposto: `ai_tours.area_filter.gptourContext`:

```text
version: 1
source: "mobile"
webReference: "88bfb440d86ca4103016ed2b5c1ed3416ecf497a"
groupId / dayIndex / dayCount
intent
followUpDecisions
lodgingRule
routingState
```

- Il resto di `area_filter` resta invariato; campi nuovi facoltativi.
- Nessuna migrazione DB per questo punto, nessun cambiamento RLS, nessuna riscrittura dei tour precedenti.
- Il mobile salva/ripristina il contesto e lo conserva in Live, con copia locale per la bozza.
- Il web attuale può leggere il tour grazie ai campi consueti ma **non applica le nuove regole GPTour persistite**: non viene dichiarata parità di editing web finché il produttore/consumer web non adotta il contratto.
- Il mobile deve riconoscere contesto mancante/non supportato o incongruente col piano ed esplicitare il limite, non inventare criteri o usarli alla cieca dopo una modifica esterna.
- Alternativa locale-only: contesto per agente/tour in AsyncStorage; funziona sul dispositivo che l'ha creato ma non garantisce riapertura su altro dispositivo, reinstallazione o round-trip completo. Non equivale alla proposta A.

### Proposta B — idempotenza server, solo progetto e bozza SQL da approvare

Preparare (NON applicare) una RPC aggiuntiva, es. `save_gptour_batch(p_request_id uuid, p_tours jsonb)`, che:

1. verifica sessione, ruolo e target senza indebolire RLS;
2. registra la richiesta con chiave univoca attore + request ID e fingerprint server del payload;
3. chiama l'esistente `save_tours_batch` nella stessa transazione;
4. conserva gli ID restituiti; una ripetizione identica ritorna gli stessi ID, un payload diverso con lo stesso ID viene rifiutato;
5. esegue rollback completo su errore e serializza richieste concorrenti.

Una piccola tabella delle richieste con RLS propria rende l'esito durevole. Questo è un cambiamento schema/RPC, quindi richiede approvazione separata prima di qualsiasi applicazione. Il batch esistente resta invariato per i flussi legacy.

**Finché la RPC idempotente non è disponibile:** il mobile può usare il batch esistente atomicamente, ma non deve ritentare alla cieca dopo un esito incerto. Deve mostrare «Esito da verificare» e offrire riconciliazione, non promettere retry automatici sicuri. Test isolati possono coprire entrambe le capacità; non certificano la disponibilità reale della nuova RPC.

Alternativa senza nessuna bozza schema: batch attuale + blocco dei retry ambigui, limite dichiarato. Non soddisfa una promessa di retry trasparente dopo risposta persa.

## Blocchi di sviluppo successivi alla decisione

1. Tipi, autorizzazione, adattatore Edge, Intent e suite pure; nessuna duplicazione prompt.
2. Caricamento dati con stati di completezza, contact-stats, proprietà orfani, filtri rigidi, identità e dataset ISTAT.
3. Motore GPTour isolato: completamento, ordine stradale, fasce/calendario, inserimento, saturazione, multi-day/pernottamento.
4. Orchestrazione follow-up per evento con conferma esplicita prima della RPC mutante; nessuna conferma anticipata.
5. UI React Native separata con conversazione, voce Expo Audio, criteri, mappa, giornate ed editor; ricalcolo globale dopo modifiche.
6. Persistenza approvata, batch, recupero degli esiti, metadati e integrazione nel Live esistente; test legacy.
7. Unit/integration/UI isolati, export iOS/Android, rendiconto limiti dispositivo e dipendenze non applicate. Stop prima della pubblicazione.

## Stato al punto di approvazione

Prerequisiti e basi Git verificati; playbook integrazione consultato. **Nessuna patch applicativa né SQL creata/applicata finora.** Sono state scritte solo questa proposta e la nota PRD. Attesa decisione sulle due estensioni prima di proseguire oltre il confine autorizzato.