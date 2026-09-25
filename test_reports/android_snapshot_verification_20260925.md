# Verifica sorgenti della build Android — 25 settembre 2026

## Richiesta confermata
«Verifica direttamente se la build sta usando sorgenti precedenti alla correzione».

Nessuna modifica a codice applicativo, dipendenze, infrastruttura, credenziali o dati durante questa verifica. Controllo deployment e diagnosi ripetuti in sola lettura.

## Riscontri certi

1. I log Android e i precedenti log iOS indicano **lo stesso UUID di versione codice**: `4bb87902-ca82-4a5d-8bbe-92ac439be61b`.
2. Entrambi terminano nel controllo preliminare EAS con `No lockfile found in the project directory`, prima della compilazione nativa. Il nuovo caso è Android app-bundle, versionCode271→272, non un errore MongoDB o Gradle.
3. Il workspace corrente contiene `/app/frontend/yarn.lock`, di452334byte, SHA256 `f95d3900bf35adf6bdd9936d931b40cfffc91880c03f5d515600c6624a33a4cd`, identico a quello verificato nell'iteration51.
4. **Il commit salvato `29eda92c` non contiene quel file.** `git ls-files -- frontend/yarn.lock` non restituisce righe; `git cat-file -e HEAD:frontend/yarn.lock` fallisce; la cronologia del percorso non contiene commit.
5. Le modifiche a `package.json` sono invece salvate: Supabase resta fissato a2.109.0. L'assenza del lockfile non dipende dalle regole Git controllate: `frontend/.gitignore:42:!/yarn.lock` ne consente l'inclusione; anche il file ignore della root contiene l'eccezione esplicita.

## Cosa NON è dimostrato

- Non abbiamo una mappatura verificabile tra UUID della piattaforma e commit Git, né accesso al contenuto integrale del nuovo archivio remoto. Non si può dichiarare che la build usi `29eda92c`, né che una nuova esecuzione abbia selezionato l'ultimo codice.
- Non è documentato se l'assenza derivi da selezione di uno snapshot precedente, salvataggio selettivo dei lockfile o altra logica di esportazione.
- La diagnosi tecnica ha suggerito «la piattaforma usa HEAD»: **questa conclusione non è provata** e non va ripetuta come fatto. I riscontri sul Git locale sono validi; l'associazione con il remoto resta sconosciuta.
- L'archivio locale dell'iteration51 dimostrava l'inclusione nel pacchetto locale, non nel commit automatico o nell'archivio della piattaforma. La precedente correzione è quindi verificata localmente ma **non consegnata/verificata end-to-end**.

## Esito e intervento necessario

**Problema di build ancora aperto.** Non basta rigenerare nuovamente il lockfile nel workspace: occorre garantire che il file venga salvato nello snapshot e consegnato a EAS.

Il controllo deployment ha riproposto `--tunnel` in Supervisor, che non spiega un file mancante nel preflight EAS; nessuna modifica infrastrutturale è stata applicata. La consultazione del supporto non ha fornito una procedura documentata per garantire l'inclusione di un lockfile generato in questo caso né una mappatura dell'UUID. Ha indicato l'assistenza della piattaforma per verificare salvataggio/esportazione, fornendo UUID e job ID.

Non sono stati eseguiti comandi Git di scrittura, né aggirati i controlli EAS, né aggiunti script di installazione o modifiche Docker. Nessuna nuova build remota è stata avviata.

### Evidenze da verificare prima di dichiarare risolto
- `frontend/yarn.lock` presente nel codice salvato/snapshot effettivamente selezionato.
- Stesso file presente accanto a `package.json` nel progetto estratto dal builder.
- Superamento del controllo lockfile EAS nella nuova esecuzione.
- Solo dopo questi punti: compilazione e firma Android/iOS, non dimostrate dall'export JavaScript locale.