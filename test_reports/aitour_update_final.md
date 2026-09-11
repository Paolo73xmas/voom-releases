# AI Tour mobile — verifica conclusiva del 10/09/2026

## Ambito
Allineamento richiesto dall'utente ai commit web `01becd4` e `22cb583`. Vincolo esplicito: nessuna scrittura sui dati operativi reali durante i test.

## Risultati verificati
- Backend: **6/6 PASS**, `backend/tests/test_ai_tour_brief_v41.py`, eseguiti dal testing agent (iteration25 e26). Endpoint reale GPT Luna restituisce contratto4.1; conserva Lozano senza correggerlo autonomamente; copertura errori400/409/502 e JSON incompleto.
- Suite mobile adattata: **5/5 gruppi PASS** nell'ultima esecuzione main, dopo i follow-up all'iteration26: `tests/aitour/run_suite.sh`. Copre journey/planner, aree/clienti/saved places/sviluppo, normalizzazione/regola15/feasibility, guard salvataggio/Live, inserimento protetto.
- Regressione sintetica V4 precedente: **16/16 PASS** (`tests/v4_synthetic_test.ts` con dipendenze isolate), inclusi sweep multi-day, fuzzy, rientro flessibile e selezione.
- Lint: nessun errore nei file AI Tour aggiornati, nuovo backend, authStore e login. Corrette anche tre stringhe legacy non escaped in privacy-terms.
- TypeScript: nessun errore nei file modificati. **11 errori legacy fuori scope** rimangono in altri moduli; non dichiarare typecheck globale pulito.

## UI reale, preview 390×844 — main-tested
- Login completo con credenziali registrate → dashboard → AI Tour → Dillo all'AI → interpretazione: PASS. Nessuna iniezione manuale del token o modifica account.
- Privacy: tre checkbox corrette (`privacy-read-checkbox`, `privacy-terms-checkbox`, `privacy-data-checkbox`) → `privacy-accept` → login: PASS. Il test26 cercava `privacy-gps-checkbox`, che NON esiste, e non attendeva la corretta transizione a login. Nessuna modifica al contenuto legale o alla logica del consenso.
- Caso interpretazione: tre visite in provincia di Bari, nessun errore di sessione: PASS.
- Caso percorso: Milano sud → Rozzano → Pavia, geocoding Photon e route OSRM REALI, circa44km tra zone: PASS.
- Rendering effettivo mappa: **4 path visibili (3 regioni + percorso)**, conferma abilitata dopo map-ready, schermo intero/riduzione: PASS.
- Cambio direzione geografica invalida preview/conferma: PASS.
- Chiudi → attendi fine animazione → riapri tramite `aitour-open-brief`: richiesta e riepilogo azzerati, PASS.
- Overflow orizzontale: assente. Console `pageerror`: **[]** nell'ultima verifica mappa.
- Generazione con l'account principale di test: restituito correttamente “Nessun soggetto corrisponde alla richiesta”, senza inventare clienti. Non è una prova di generazione positiva con dati reali. Migliorata riapertura del brief in questo caso per consentire la correzione.

## Follow-up ai report25/26
- `saveTour`: preflight ora eseguito anche prima di `.from()`. Il contatore del test26 incrementava già su `.from()`, non su `.insert()`; la precedente validazione in `buildTourRow` precedeva comunque l'inserimento. Ora passa anche il requisito più restrittivo “nessun accesso al client prima della validazione”.
- Autenticazione: callback Supabase reso sincrono, lettura profilo rinviata fuori dal lock tramite setTimeout0, protezione da logout/cambio sessione. Mapping agente invariato (`profile.id`), nessun cambiamento RLS/storage/chiavi/account. Errori login visibili inline su web, avvisi nativi mantenuti.
- Credenziali: le prime prove manuali main fallite usavano un indirizzo/password sbagliati, NON quelli nel file credenziali. La verifica successiva con il file corretto è passata. Non usare tali tentativi come prova di account/sessione rotti. Credenziali NON modificate.
- Mappa: inizializzato il viewport Leaflet prima dei renderer SVG/canvas e dei listener dei puntini; aggiunta validazione bounds. Risolto errore `reading 'min'` durante il primo disegno. Aggiunto evento map-ready e blocco conferma finché la mappa non è pronta.

## Limiti dichiarati
- Nessun ordine, cliente, visita, tour, prenotazione stock o foto creato/modificato/eliminato sul DB operativo.
- Nei browser test sono consentiti auth e RPC esplicitamente di sola lettura; tutte le mutazioni operative sono bloccate.
- Salvataggi/operazioni Live provati in **test isolati con client Supabase/OSRM fittizi**, NON su tour reali. L'app non usa API simulate.
- GPS, microfono e prestazioni su Expo Go/build iOS/Android non validati su dispositivo fisico in questo ciclo.
- Non effettuato un test end-to-end positivo con scrittura e ripresa tour nel DB reale, per rispettare il vincolo dell'utente.

## Evidenze browser
- Screenshot output20:34: login + interpretazione.
- Output20:48: privacy/login/Photon/OSRM; iniziale automazione chiusura troppo precoce durante animazione, risolta nel test successivo attendendo stato hidden.
- Output20:54 (`/root/.emergent/automation_output/20260910_205415/`): mappa colorata, 4path, fullscreen, invalidazione, close/reopen, nessun errore console.
- Gli screenshot temporanei `/tmp/aitour-map-painted-final.jpg` e `/tmp/aitour-brief-final-verified.jpg` possono sparire dopo un fork; fare riferimento anche ai risultati sopra.