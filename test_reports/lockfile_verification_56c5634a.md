# Verifica lockfile — file locale valido, tracciamento Git ancora bloccato

## Perimetro

Intervento richiesto esclusivamente su lockfile, tracciamento e controlli software. Nessun nuovo test esteso su acceptedFillKeys. Nessuna operazione SQL/RPC/auth, migration, modifica alla proposta idempotenza, build/pubblicazione nativa o commit/push manuale.

Base locale all'inizio e al termine dei controlli: **56c5634a92497cccb2c087c0d5af3d5236a89843**. Ramo remoto `Paolo73xmas/voom-releases/conflict_170826_1303` controllato: **36fdcc7f58b8598332cfc3caaf5bee161f37e43b**. Il commit locale56c era già presente all'inizio della sessione; non è stato creato da operazioni Git di questo intervento.

## Causa accertata

- Yarn legge `frontend/yarn.lock` dal filesystem; non richiede che sia tracciato in Git. Per questo l'installazione frozen può riuscire mentre il commit remoto non contiene il file.
- Il file non è mai entrato nell'indice Git; `git status` restituisce `??`, `git ls-files` non restituisce righe e HEAD non contiene il percorso.
- Non è ignorato: le negazioni root `!/frontend/yarn.lock` e frontend `!/yarn.lock` sono corrette. Nessun global excludesfile, sparse checkout o `.easignore`; `.git/info/exclude` contiene soltanto commenti. Il file è regolare, non un symlink.
- Cambiare ancora `.gitignore`, rigenerare versioni o cambiare package manager non risolve l'assenza nell'indice.
- Gli snapshot precedenti hanno incluso sorgenti e test nuovi ma non questo lockfile: il criterio interno di selezione della piattaforma non è stato dedotto come fatto verificato. Il dato certo è l'assenza dall'indice/storia.

## Limite operativo

Per il tracciamento iniziale serve uno staging Git. **Staging da solo non equivale a commit/push ed è compatibile con il perimetro chiesto dall'utente.** Il limite è invece il workflow a disposizione della sessione: il supporto non ha indicato un percorso supportato per eseguire soltanto lo staging; Save to GitHub include commit/push e non viene avviato perché vietato dall'utente in questa fase.

Nessuna operazione Git di scrittura eseguita, né aggiramenti tramite indice alternativo o agenti delegati. **Il requisito «frontend/yarn.lock realmente tracciato» NON è stato raggiunto.** Non dichiarare risolto il problema remoto.

## Lockfile e configurazione

| Voce | Risultato |
|---|---|
| packageManager | yarn@1.22.22 con checksum già dichiarato |
| Yarn eseguito | 1.22.22 |
| Node locale | v24.19.0 |
| Lockfile locale | presente,452334byte,9833righe,v1 |
| SHA256 lockfile | f95d3900bf35adf6bdd9936d931b40cfffc91880c03f5d515600c6624a33a4cd |
| SHA256 package.json | 04ed95cf60d54b1be4114be9fc15a5c89a9045ed2ac48de2cdd852f106651bc7 |
| EAS | eas.json invariato,preview internal; nessun bypass lockfile |
| Dipendenze/pin | invariati; Supabase2.109.0,Vitest4.1.11 |

Il lock era già coerente. Non modificato né rigenerato artificialmente. L'installazione frozen conserva byte per byte manifest e lock. La risoluzione Expo54.0.37 è già quella del lock esistente (manifest~54.0.35); non è stato eseguito un aggiornamento.

## Evidenze Git richieste

```text
$ git status --porcelain=v1 --untracked-files=all -- frontend/yarn.lock
?? frontend/yarn.lock

$ git ls-files frontend/yarn.lock
(nessun output)

$ git cat-file -e HEAD:frontend/yarn.lock
fatal: path 'frontend/yarn.lock' exists on disk, but not in 'HEAD'

$ git diff -- frontend/yarn.lock
(nessun output: i file non tracciati non sono mostrati)

$ git diff --no-index --stat /dev/null frontend/yarn.lock
 /dev/null => frontend/yarn.lock | 9833 +++++++++++++++++++++++++++++++++++++++
 1 file changed, 9833 insertions(+)
```

Il git status completo contiene anche vecchi log non tracciati in manual/ e test_reports/artifacts_iter*; preesistenti, non modificati/rimossi. Nessuna modifica applicativa o di configurazione in questo intervento. Aggiornati soltanto il presente rapporto e la nota PRD.

## Installazione veramente pulita e frozen

- Nuova directory temporanea indicata da `/tmp/voom-lockfile-check-path`.
- Sorgenti copiati senza node_modules, .expo, cache, .env o .git.
- Verificato esplicitamente che node_modules NON esistesse prima dell'installazione.
- Eseguito `yarn install --frozen-lockfile --non-interactive`: **exit0**, completato in10.60s.
- Verificato che i pacchetti si risolvano effettivamente dentro la nuova node_modules, non da quella dell'app o globalmente.
- Manifest e lockfile identici ai file originali dopo installazione.
- Nessuna riga `No lockfile found` nel log. Warning peer preesistente: expo-audio1.1.1 richiede expo-asset@*; non introdotti nuovi pacchetti per correggerlo fuori perimetro.

Log: `/tmp/voom-lockfile-frozen-install.log`.

## Controlli richiesti, tutti sulla nuova installazione

| Controllo | Esito |
|---|---|
| Suite completa esistente | **250/250 PASS,20suite** |
| TypeScript --noEmit | PASS |
| Lint pertinente (test/gate lockfile) | PASS |
| Android export JavaScript --no-bytecode | PASS |
| iOS export JavaScript --no-bytecode | PASS |

Per gli export sono stati usati nella sola env del processo gli stessi valori frontend già configurati, senza copiare/modificare file protetti. Output esportati fuori dal repository.

Log: `/tmp/voom-lockfile-full-tests.log`, `/tmp/voom-lockfile-tsc.log`, `/tmp/voom-lockfile-lint.log`, `/tmp/voom-lockfile-android-export.log`, `/tmp/voom-lockfile-ios-export.log`. Bundle: `/tmp/voom-lockfile-android-js`, `/tmp/voom-lockfile-ios-js`.

Nessun nuovo test/browser esteso sulla funzionalità approvata. Non sono build APK/AAB/IPA né prove native: il limite hostARM/Hermesx86 precedente non è stato aggirato cambiando runtime. Il lint globale fuori perimetro non è stato modificato: precedente erroreBuffer e warning restano quelli già documentati.

## Stato finale

**Verifiche locali PASS; tracciamento Git NON risolto.** Nessun commit/push manuale o pubblicazione. Runtime save_tours_batch fermo in attesa del testo reale di definition; nessuna nuova introspezione, correzione SQL o applicazione della proposta idempotenza.