# Preparazione build iOS — lockfile mancante, 25 settembre 2026

## Errore causale nei log dell'utente

La preparazione si arresta in **STEP13, EAS CLI24.8.0**, prima dell'invio di una build iOS remota:

```text
No lockfile found in the project directory.
A lockfile is required to ensure deterministic dependency installation in EAS.
Error: build command failed.
```

La precedente installazione Yarn terminata con successo non prova l'esistenza di un lockfile. Un'installazione frozen, ad esempio, può installare senza crearlo se manca. Nei log allegati non è visibile il comando completo con i flag: non attribuire il comportamento a un flag non dimostrato.

**Riscontri locali prima della correzione:** `frontend/yarn.lock` assente dal filesystem e dalla cronologia Git consultata. Nessuna esclusione Git esplicita inizialmente rilevata e nessun `.easignore` presente. Il vecchio report Node20/Vitest attestava un lockfile locale, non la sua consegna nei successivi snapshot. Non è dimostrato se il file sia stato perso durante una precedente preparazione o escluso da un'esportazione: non inventare una causa interna della piattaforma.

## Correzioni nei sorgenti

1. **Ripristinato `frontend/yarn.lock`**, generato da Yarn1.22.22 nella stessa directory di `package.json`. Non scritto a mano e non sostituito con un file vuoto.
2. Inclusione esplicita del lockfile in `.gitignore` root e frontend, tramite `!/frontend/yarn.lock` e `!/yarn.lock`.
3. **Supabase fissato a `2.109.0`**, senza range aperto, tramite `yarn expo install @supabase/supabase-js@2.109.0 --yarn`. Questa è l'unica modifica al manifest rispetto al riferimento `d653795a`: `^2.101.1` → `2.109.0`. Nessuna modifica diretta a `package.json`; `main`, scripts e Vitest4.1.11 restano invariati.
4. Tre test di regressione per presenza/formato lockfile, pin compatibili e inclusione nei sorgenti (`frontend/tests/build_lockfile.test.ts`).

### Perché fissare anche Supabase

Ricostruendo le dipendenze in assenza del vecchio lockfile, il range preesistente `^2.101.1` selezionava Supabase2.117.2, che richiede **Node>=22**. Questo è un problema distinto dal lockfile mancante ed è stato **riprodotto**, non ipotizzato, con il worker Node20.19.4 già documentato per questo progetto:

```text
error @supabase/supabase-js@2.117.2: The engine "node" is incompatible with this module.
Expected version ">=22.0.0". Got "20.19.4"
```

Il registro del pacchetto conferma che2.109.0 supporta Node>=20 e blocca i sottopacchetti Supabase alla stessa versione. I log dell'utente mostrano Node24 nella preparazione, non la versione di un nuovo worker macOS: il controllo Node20 previene la regressione sul worker precedentemente usato, senza cambiare immagini o runtime.

Il lockfile è stato ricostruito perché l'originale non era recuperabile localmente; le dipendenze transitive seguono i range esistenti (ad esempio Expo54.0.37). Non sono state riscritte versioni runtime a mano né ignorati controlli engine.

## Verifiche effettivamente eseguite

**Iteration51**, copia nuova senza `node_modules` in `/tmp/frontend_node20_iter51_ppHT7n/copy/frontend`:

| Verifica | Esito |
|---|---|
| Node20.19.4 + Yarn1.22.22, `yarn install --frozen-lockfile --production false --non-interactive` | PASS, engine checks attivi |
| `yarn tsc --noEmit` | PASS |
| `yarn test:unit` | **116/116 PASS**,14 file |
| `yarn lint` | Nessun errore;63 warning preesistenti/non bloccanti |
| `CI=1 yarn expo export --platform ios --no-bytecode --clear --max-workers 2` con cache Metro isolata | PASS,2872moduli,66asset,bundleJS6.78MB |
| Hash manifest/lock prima e dopo install/test/export | Invariati nella copia e nei sorgenti |
| Archivio sorgente locale di prova | Include `frontend/package.json` e `frontend/yarn.lock` |
| Main: install frozen nella copia con Node24.19.0 | PASS, hash identici ai sorgenti |
| Anteprima login dopo installazione e riavvio | Render corretto, nessuna scrittura CRM |

SHA256 del lockfile finale:
`f95d3900bf35adf6bdd9936d931b40cfffc91880c03f5d515600c6624a33a4cd`

SHA256 manifest finale:
`04ed95cf60d54b1be4114be9fc15a5c89a9045ed2ac48de2cdd852f106651bc7`

Nessun `EAS_BUILD_SKIP_LOCKFILE_CHECK`, nessun `--ignore-engines`, nessun postinstall che maschera la mancanza del lockfile.

## Elementi non causali e file invariati

- Signing iOS validato e progetto EAS collegato nei log: nessuna modifica alle credenziali.
- La riga `expo: command not found` riguarda un comando globale nella preparazione; la pipeline prosegue fino aSTEP13. Il CLI locale `yarn expo` funziona nei test. Nessuna modifica a script della piattaforma o installazioni globali introdotta come presunta cura.
- Warning npm/Yarn sulle deprecazioni o peer dependency non sono l'errore terminale. Non giustificano un aggiornamento generalizzato del codice.
- MongoDB Atlas non è coinvolto nella verifica lockfile, che precede l'esecuzione dell'app. Nessuna modifica a database, migrazioni, CORS o backend.
- Il primo controllo di deployment ha proposto `--tunnel` in Supervisor: è una segnalazione generica sull'anteprima, non una spiegazione del preflight EAS allegato. Non applicata; il server preview è raggiungibile e l'app esporta per iOS senza tale modifica.
- **Invariati:** Docker/image/Kubernetes, entrypoint, Supervisor, Metro, `.env`, `app.json`, autenticazione applicativa, endpoint media/video, dati operativi reali. Verifica hash dei principali file applicativi rispetto a`d653795a` eseguita.

## Limite della verifica e prossimo controllo

La preparazione iOS è verificata localmente e il lockfile è incluso nell'archivio locale di prova. **Non è stata avviata una nuova build EAS remota né generata un'IPA firmata.** L'esportazione JS `--no-bytecode` evita solo l'incompatibilità del binario Hermes x64 nel sandbox LinuxARM; non cambia Hermes nell'app e non equivale a Xcode/signing.

Una nuova esecuzione dal codice aggiornato dovrà confermare che il lockfile arriva anche nell'archivio della piattaforma e che il controllo diSTEP13 viene superato. Se ricompare lo stesso errore, controllare prima versione del codice e presenza effettiva di `frontend/yarn.lock` nell'archivio remoto, senza aggirare il controllo EAS.

Evidenze: `test_reports/iteration_51.json` e `test_reports/artifacts_iter51/`.

## Secondo controllo deployment: risultato generale non validato

Il controllo è stato rieseguito dopo il fix e ha restituito ancora `fail` generico per:
1. assenza del flag `--tunnel` nel Supervisor dell'anteprima;
2. presunta assenza di `.gitignore` con rischio di includere le credenziali;
3. URL di anteprima nelle variabili packager.

Riverifica diretta: `/app/.gitignore` **esiste**, contiene `memory/test_credentials.md` alla riga85; `git check-ignore` conferma l'esclusione e `git ls-files` conferma che il file credenziali **non è tracciato**. Il lockfile è presente e la regola negata `!/yarn.lock` ne conferma l'inclusione. Expo/backend risultanoRUNNING e l'anteprima risponde200. I log forniti dall'utente mostrano già la sostituzione automatica preview→produzione prima delloSTEP13.

Non sono state applicate modifiche non causali a Supervisor o `.env`, né riscritto un `.gitignore` esistente. **Non si dichiara PASS del controllo deployment generale**, ma la correzione del blocco specifico è verificata dalle installazioni congelate e dall'export iOS. L'IPA firmata e l'archivio remoto rimangono da confermare con una nuova esecuzione.