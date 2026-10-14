# U2-d — bloccato per sorgenti/baseline mancanti

L'utente autorizza correzioni e verifiche locali sulla baseline identificata da Codex, senza servizi reali, credenziali hosted, commit/push/deploy.

## Input verificato
- `incoming/verifica_codex_u2d.zip`, SHA-256 `244d8a3bad374d2fd3d4ce5b2d9e905d66c4d0de2c65f1e8d72b240571c95067`.
- Contiene soltanto `VERIFICA_U2D_FINALE.txt`, `archive-audit.json`, `probe-results.json`, `probes.mjs`. Nessun sorgente applicativo o suite originale.
- Il rapporto identifica l'archivio originale `gptour_u2d_final_delivery.zip`, 526622 byte, SHA-256 `0f347f3eba425e9cc4933750a0f0c616bf3e2149448b390977fa9f2bbc5c5df9`, e baseline repository `259ec92d`.

## Ricerca locale
Nessun `catalog-postgrest.ts`, `planner-core.ts`, `final_verify.sh` o `verify_protected.py` trovato in /app o /tmp (esclusi dipendenze/cache); nessun archivio U2-d precedente. La baseline `259ec92d` non esiste negli oggetti Git locali; nessuna storia locale per i percorsi Supabase citati. Fra i 66 allegati del job non risulta la consegna originale U2-d né la baseline; il vecchio handoff Mobile non è una baseline sostitutiva.

## Input necessario
Un albero completo dei sorgenti U2-d/U1/v7, test/harness, configurazioni di test e riferimento originale dei file protetti; oppure la consegna originale sopra insieme all'export del repository alla baseline `259ec92d`. Escludere credenziali e `.env` reali. Includere i file `*_modified_tracked` se separati.

Nessuna correzione applicativa eseguita, nessun probe/suite dichiarato rieseguito, nessuna approvazione anticipata. Non ricostruire il motore dai soli report. Stato NON "pronto per nuova verifica esterna di Codex" finché mancano gli input.