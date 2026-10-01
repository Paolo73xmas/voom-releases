# Correzione puntuale acceptedFillKeys — verificata, senza commit/push

## Autorizzazione e perimetro

L'utente ha approvato esplicitamente `gptourContext.acceptedFillKeys?: string[]`, da popolare solo dopo accettazione manuale della proposta e da usare per accettazione, ricalcolo, persistenza/ripristino e test. Nessuna migration, nessuna modifica degli algoritmi, nessun allargamento dei criteri per categoria o del corridor.

Base mobile invariata: `Paolo73xmas/voom-releases`, `conflict_170826_1303`, **36fdcc7f58b8598332cfc3caaf5bee161f37e43b**. Il diff precedente fill/corridor resta nel workspace; nessun commit/push eseguito manualmente.

## Contratto implementato

```ts
gptourContext: {
  version: 1,
  // campi esistenti invariati
  acceptedFillKeys?: string[]
}
```

- Mancante/null → lista vuota. Formato malformato o key non rappresentate nei fatti salvati → errore esplicito, non una deroga.
- Solo il click Accetta usa la proposta attualmente visualizzata, verifica key presenti nel pool autorizzato e nell'ordine proposto e riesegue tutti i filtri fill.
- Le risposte AI e le patch TourIntent non possono popolare questo campo. `requestedEntityTypes` e `allowedExpansionTypes` non sono mutati.
- Durante preflight del piano/controlli di salvataggio, una key accettata usa la validazione fill; tutte le altre restano initial. Questo mantiene il default prospect15 e le espansioni esplicite oltre agli altri vincoli.
- Criteri geografici, progetto, fatturato, contatto, ordine, esclusioni, proprietà orfani, fasce e fattibilità restano obbligatori. Un'eventuale incompatibilità di una tappa accettata blocca il piano con messaggio; non la fa sparire silenziosamente.
- I filtri delle proposte corridor restano invariati, anche dopo l'accettazione di un prospect. Un'altra key dello stesso tipo non riceve il consenso.
- Dopo dedup/ricostruzione la lista è intersecata con le key effettivamente rimaste. Ogni contesto giornaliero salva solo le proprie key accettate.
- Rimozione esplicita/revoca del follow-up rimuove la key; Nuovo giro/reset azzera la lista. Un effettivo cambio dei tipi richiesti o delle espansioni la azzera; messaggi che ripetono gli stessi tipi o modificano altri criteri la conservano per la nuova validazione.
- Bozza locale usa lo stesso namespace opzionale v1. Aggiunta protezione puntuale `loadedDraftKey`: durante cambio account/agente i dati della vecchia bozza non vengono scritti nel nuovo namespace prima che la nuova bozza sia stata caricata. Nessuna modifica alle autorizzazioni.
- Il ripristino e il normale preflight Live riusano il contesto tramite le funzioni esistenti. Nessuna modifica a LiveTourView, liveops o agli algoritmi Live.

## File di questa estensione

Aggiunti:
- `frontend/lib/aitour/gptour-acceptance.ts`: funzioni pure di accettazione, convalida della lista, invalidazione e conservazione delle sole key presenti.
- `frontend/tests/gptour_accepted_fill.test.ts`: 33 regressioni.

Modificati:
- `frontend/hooks/useGptour.ts`: stato locale e bozza, registrazione solo al click, propagazione ai controlli, revoca e reset.
- `frontend/lib/aitour/gptour-engine.ts`: esclusivamente parametro opzionale e validazione delle key accettate; nessuna modifica a ordine, dedup, wantAll, grouping, multi-day o pernottamento.
- `frontend/lib/aitour/gptour-context.ts`: campo opzionale, merge/salvataggio per giornata, controlli di coerenza e preflight.

La patch precedente mantiene `gptour-criteria.ts`, i test fill/corridor e payload batch e il gate lockfile. Nessuna ulteriore modifica a Edge/prompt, RPC, RLS, ruoli, orfani, TourIntent, quote, geografia, OSRM, algoritmi o SQL idempotenza.

### Diff stat finale rispetto alla base36fd (file già tracciati)

```text
 frontend/hooks/useGptour.ts            | 43 ++++++++++++++++++++++------------
 frontend/lib/aitour/gptour-context.ts   | 11 ++++++---
 frontend/lib/aitour/gptour-criteria.ts  | 17 ++++++++++----
 frontend/lib/aitour/gptour-engine.ts    | 20 ++++++++++------
 frontend/tests/build_lockfile.test.ts  |  8 +++++++
 memory/PRD.md                         | 17 ++++++++++++++
 6 files changed, 87 insertions(+), 29 deletions(-)
```

Come già dichiarato, questo comando non include i nuovi file non tracciati: modulo acceptance, test accepted-fill/fill-corridor/batch-payload, gate lockfile, report e il lockfile locale preesistente. Nessun git add eseguito per modificarne lo stato. Verifica finale dei file fuori perimetro effettuata con gitdiffexit-code0: immutati anche authStore, tours, Edge adapter, Intent, proposte, routing, Live e configurazioni.

## Test

### Automatici

- **250/250 PASS,20suite** complete, anche nella copia con installazione pulita precedentemente verificata usando Yarn1.22.22 `--frozen-lockfile`.
- **133 GPTour +4 lockfile =137/137 PASS**,6suite mirate.
- **33 nuovi test**: consenso esatto e non inferibile dall'AI, tipi non allargati/corridor invariato, altri prospect esclusi, default15, criteri aggiornati in conflitto, orfani altrui, mancata disponibilità, clear/reset/pruning, wantAll invariato, JSON bozza, serializer batch reale, merge degli altri campi area, riapertura, normale preflight Live, metadati legacy/malformati, distribuzione fra giornate.
- TypeScript: PASS.
- ESLint dei file nuovi/modificati: PASS.
- ESLint globale: ancora1errore preesistente `Buffer` in `scripts/aitour_inspection_rls_probe.mjs` +132warning (stessa situazione documentata nel report precedente); nessun refactoring fuori perimetro.

### Browser isolato — percorso reale della UI

La prima verifica indipendente (`iteration_54.json`) era bloccata da fixture errate, NON da un errore applicativo: orphan_config restituito come array anziché oggetto `.single()`, e alcune letture dashboard non intercettate, respinte con401 usando il token sintetico. Nessuna scrittura CRM operativa.

RCA effettuata; corretta soltanto l'intercettazione del test. La successiva verifica principale ha intercettato **tutte le76 richieste API**, usando fixture per auth, REST, Edge e OSRM, senza cambiare l'app o usare un account operativo.

Risultati:
1. Agentcustom, pool proprio orfano + prospect, Intent orphan-only/ownOnly: PASS.
2. Piano iniziale1tappa, proposta prospect, click Accetta → **2tappe** e bozza con la sola key prospect: PASS.
3. Riordino, uscita dalla schermata, riapertura bozza e Ricostruisci → **2tappe mantenute**: PASS.
4. Nuovo criterio fatturato900 mentre prospect vale700 → errore di conflitto, salvataggio disabilitato, nessuna rimozione silenziosa: PASS.
5. Criterio riportato a500 → piano nuovamente valido: PASS.
6. Salvataggio: **1sola RPC simulata**,2tappe, acceptedFillKeys=[keyProspect], requestedEntityTypes=['orphan'], allowedExpansionTypes=[], ownOrphansOnly=true nel payload del serializer reale: PASS.
7. Nuovo giro → lista consensi vuota e piano rimosso: PASS.

Numeri:3chiamateEdge simulate,1batch simulato,2tappe,0scrittureCRMreali. Screenshot `/tmp/gptour-accepted-kept.jpg`, `/tmp/gptour-accepted-saved.jpg`; log `/root/.emergent/automation_output/20261001_161152/console_20261001_161152.log`.

### Export

- Android JavaScript `expo export --platform android --no-bytecode`: PASS, `/tmp/gptour-accepted-android-js`.
- iOS JavaScript `expo export --platform ios --no-bytecode`: PASS, `/tmp/gptour-accepted-ios-js`.
- Nessuna build nativa o pubblicazione. Rimane il limite Hermes x86-64 sull'hostARM64 già diagnosticato; motore runtime invariato.

Log finali: `/tmp/gptour-accepted-final-tests.log`, `/tmp/gptour-accepted-final-targeted.log`, `/tmp/gptour-accepted-final-tsc.log`, `/tmp/gptour-accepted-targeted-lint.log`, `/tmp/gptour-accepted-android-export.log`, `/tmp/gptour-accepted-ios-export.log`.

## Stato dei blocchi separati

1. **save_tours_batch runtime**: l'utente ha selezionato l'invio del risultato ma non ha ancora fornito il contenuto della colonna definition. Controllati anche gli allegati: nessun nuovo outputSQL, soltanto53assetstorici. Rimane l'evidenza precedente exec_sql403/42501. Nessuna nuova query operativa e nessuna migration correttiva preparata/applicata. Il clientserializer invia correttamente is_follow_upfalse/true, ma questo non certifica la funzione installata.
2. **Lockfile**: presente/coerente localmente, hash invariato **f95d3900bf35adf6bdd9936d931b40cfffc91880c03f5d515600c6624a33a4cd**, ancoraNONtracciato inGit/HEAD. Nessuna affermazione di problema remoto risolto.
3. Nessun commit/push manuale, nessuna pubblicazione, nessuna modifica alla bozza `proposals/gptour_idempotency_v1_NOT_APPLIED.sql`.

**Esito:** il bug accettazione→ricalcolo→salvataggio/ripresa è corretto e verificato in modo isolato. I blocchi runtimeRPC e Gitlockfile sono separati e restano aperti.