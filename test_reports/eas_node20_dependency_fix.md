# Verifica blocco installazione iOS — 12 settembre 2026

## Errore effettivo
Build EAS `53fce907-b255-4ec1-9b85-e4d4fb5db0f0`, fase `INSTALL_DEPENDENCIES`:
`vitest@5.0.0` richiede Node `^22.12.0 || ^24.0.0 || >=26.0.0`, mentre il worker macOS usa `20.19.4`.
Il comando fallito era `yarn install --frozen-lockfile --production false`.
La preparazione Node24 era riuscita; il messaggio "iOS BUILD PROCESS COMPLETE" indicava solo l'invio della build a EAS, non la creazione dell'IPA.

## Correzione minima
- `frontend/package.json`: Vitest da `^5.0.0` a **`4.1.11` esatto**.
- `frontend/yarn.lock` aggiornato tramite package manager, senza cancellare/rigenerare indiscriminatamente tutte le dipendenze.
- Vite resta `^8.3.0`: il registro npm conferma Node `^20.19.0 || >=22.12.0`; non è incompatibile con20.19.4.
- Vitest4.1.11 supporta Node `^20.0.0 || ^22.0.0 || >=24.0.0` e Vite6/7/8.
- Verifica automatica confronto manifest prima/dopo: **dependencies runtime, main e scripts identici**.
- Nessun cambiamento a Docker, entrypoint, EAS image, supervisor, Metro, .env, autenticazione o database.

## Prove eseguite con Node esatto20.19.4
Installazione isolata in `/tmp/voom-eas-node20-Nz1AME`, senza node_modules preesistenti, Yarn1.22.22:

1. `yarn install --frozen-lockfile --production false --non-interactive` -> **exit0**, engine checks abilitati. Nessun `--ignore-engines` e nessun `NODE_ENV=production` per saltare devDependencies.
2. `yarn test:unit` nella copia pulita -> **17 test PASS**, Vitest4.1.11.
3. `yarn tsc --noEmit --pretty false` nella copia pulita -> **PASS**.
4. `expo export --platform ios --no-bytecode` nella copia pulita, Node20.19.4 -> **PASS**,2866moduli,66asset,bundle JS6.62MB.

Log temporanei: `/tmp/voom-eas-node20-install.log`, `/tmp/voom-ios-enginecheck-export-js.log`.
Lockfile SHA256 finale: `8fee10c56ecad526cfae1cd7c2df35894d8d3518ee88e718128dceaf44da226e`.

## Limiti e segnalazioni non pertinenti
- Il sandbox Linux è ARM64; il compilatore Hermes Linux incluso nel pacchetto React Native è x86_64 (ELF e_machine0x3E). L'export standard ha quindi fallito all'esecuzione del binario, DOPO il bundling JS. `--no-bytecode` è stato usato **solo nel comando di verifica**, senza disattivare Hermes nell'app. Non equivale a una build macOS/Xcode firmata.
- Avvisi EAS CLI deprecazioni, TypeScript peer-range ed expo-asset non hanno impedito l'installazione riprodotta. MongoDB Atlas non è coinvolto nel fallimento prima dell'esecuzione dell'app.
- Il primo health check generico proponeva di modificare URL packager/supervisor e tracciare .env. Non applicato: sono configurazioni protette, estranee all'errore Node, e i log mostrano che preparazione, sostituzione URL, firma e invio EAS erano riusciti. EAS usa la root frontend senza Git, dove `.gitignore` non esclude `.env` (solo `.env*.local`).
- Non è stata lanciata una nuova build remota: esito completo IPA da confermare con nuova esecuzione EAS.

## Secondo controllo statico
Il controllo è stato rieseguito dopo la correzione. Restituisce ancora `fail` per due segnalazioni generiche: `.gitignore` della root esclude `.env` e il comando Supervisor del sandbox non contiene `--tunnel`. Non ha riportato nuovi errori di compilazione. Queste segnalazioni non spiegano la fase EAS `INSTALL_DEPENDENCIES` documentata e richiederebbero modifiche fuori dal perimetro autorizzato; non sono state applicate. **Non si dichiara quindi un health check generale PASS**, ma la rimozione del preciso errore Node/Vitest è verificata riproducendo con successo il comando fallito sotto Node20.19.4.

## Riverifica 13 settembre 2026 — stessi log riproposti
- Log build53fce907 del12settembre17:12UTC, fix commit55d260d3 del12settembre17:39UTC. La nuova segnalazione contiene la stessa build antecedente alla correzione, non una nuova esecuzione fallita con Vitest4.1.11.
- Richiesto ed eseguito nuovamente deployment-agent: stesse due segnalazioni generiche non causali/protette; RCA indipendente conferma la correzione presente. Nessuna modifica superflua al codice o configurazioni.
- Nuova copia isolata `/tmp/frontend_node20_iter36_20260913_082253`, Node20.19.4 e Yarn1.22.22. Install frozen con devDependencies ed engine checks PASS,17unitPASS,TypeScriptPASS,JSexportIOSPASS (2866moduli,66asset,6.62MB). Originale e copia: manifest e lock identici prima/dopo.
- Verifica main aggiuntiva dalla copia installata: `CI=1`, `METRO_CACHE_ROOT` dedicata nella copia (solo variabile di processo), `yarn expo export --platform ios --no-bytecode --clear --max-workers 2 --output-dir /tmp/frontend_export_iter36_nocache` PASS41s. Log riporta esplicitamente cache vuota e rebuild2866moduli. Bundle `entry-6e77d4b6e6d10afce705a534f522d92e.js` identico al precedente.
- Evidenze persistenti tester: `test_reports/iteration_36.json`, `test_reports/artifacts_iter36/iter36_{metadata.json,yarn_install.log,vitest.log,tsc.log,expo_export.log}`. Log main aggiuntivo: `/tmp/voom-ios-iter36-nocache.log`.
- Restano warning non bloccanti toolchain (peer ranges, futura configurazione Vite); non modificati perché non impediscono questi test. Il flag `--non-interactive` non supportato in expo export era solo nel comando tester; main lo ha sostituito con CI=1 e rieseguitoPASS, nessun problema nel codice app.
- **Esito circoscritto:** errore Vitest5/Node20 risolto nel codice attuale; no regressione osservata. Nessuna nuova build remota/IPA eseguita: conferma completa richiede nuova build dal codice aggiornato, con ID diverso da53fce907.