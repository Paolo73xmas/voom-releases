# Fase5 — sei failure lockfile preesistenti, separati dalle regressioni applicative

## Riscontro finale
`frontend/tests/build_lockfile.test.ts`: **6 PASS / 6 FAIL**. Suite integrale: **432 PASS / 6 FAIL / 438**, 44 file.
La suite applicativa, escludendo soltanto questo file, passa **426/426**, 43 file.

I sei test falliti, sotto `pre-build: contenuto salvato, non solo esistenza del lockfile`:
1. `accetta file salvati identici e registro npm, senza scrivere Git`
2. `blocca il caso reale: HEAD ha ancora URL Yarn e locale ha URL npm`
3. `blocca un file di configurazione mancante nel commit`
4. `blocca qualsiasi differenza salvata in package.json`
5. `blocca qualsiasi differenza salvata in .yarnrc`
6. `blocca qualsiasi differenza salvata in yarn.lock`

Messaggio comune osservato: **`yarn.lock contiene ancora URL del vecchio registro Yarn`**.
Per il primo test è un'eccezione inattesa; negli altri cinque precede l'eccezione specifica che il test si aspetta. Non sono sei distinti guasti del nuovo Orchestrator.

## Provenienza e vincoli
- Già documentati prima dell'handoff in Fase5 iniziale (406PASS/6FAIL), confermati da iteration71 e dalla suite finale.
- `yarn.lock`, `package.json`, `.yarnrc`, script guard e test non modificati in questo intervento. Confronto contenuti rispetto a `f1e0e8762625a91233f895126955ef7b382d1881` invariato.
- Nessun aggiornamento dipendenze, sostituzione URL, installazione pulita remota, bypass del guard o test disabilitato nel runner integrale.
- **La suite integrale NON è verde.** L'esclusione nel run applicativo è esplicita; il run integrale viene comunque eseguito e conservato.
- Questo rapporto non certifica una build Android/iOS o l'archivio remoto. Correzione lockfile da incarico separato, non eseguita.

Log: `test_reports/phase5_handoff_final/vitest-full.log`, `vitest-app.log`; confronto storico `iteration_71.json`.