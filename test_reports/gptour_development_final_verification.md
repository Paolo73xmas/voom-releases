# GPTour sviluppo — verifica finale del 7 ottobre 2026

## Perimetro
Parità client con web `7bd72c4c` e `a57b8e3e`. Utente autorizza test automatici, preview e pool reale in sola lettura; nessun salvataggio tour, modifica Edge Function, RLS o migration. Credenziali solo in `memory/test_credentials.md`.

## Implementazione presente e verificata
- `frontend/lib/aitour/data.ts`: pagine RPC 0–999, 1000–1999, 2000–2499, `p_limit=2500` costante; errore su pagina successiva non restituisce il prefisso come pool completo.
- `gptour-data.ts`: mantiene il limite intenzionale di 2500 con avviso di copertura parziale; errori visibili. La modalità strict Brief continua a respingere il raggiungimento del limite, non è stata rilassata globalmente.
- `gptour-development.ts` e `gptour-capacity.ts`: logica del riferimento web; confronto sorgenti conferma differenze solo di import/tipi, commenti e formattazione. Supporti `requestedComuniNorm` e `IdentitySet.fromKeys` portati negli appositi moduli.
- `hooks/useGptour.ts`: normalizzazione intenzione sviluppo, completamento dopo preparazione, fallback `needsInfo` con domani/dopodomani, vincoli follow-up e nessun riempimento automatico nelle rimozioni manuali.
- `gptour-engine.ts`, `gptour-api.ts`, route `app/gptour.tsx` e Metro identici alla baseline mobile `a84d8419`.

## Correzione delle diagnosi preliminari
I report `iteration_63.json` e `iteration_64.json` sono conservati come storico, NON esito finale.
1. La prima fixture cercava `body.agentId`; il contratto corretto è `body.agentInfo.agentId`.
2. Dopo questa correzione, il client inviava realmente l'ID fixture target `22222222-2222-4222-8222-222222222222`. La diagnosi iteration64 di mancata propagazione agente è **smentita dalla richiesta catturata**.
3. La causa del piano assente era la risposta OSRM della fixture: un solo `leg` per un giro con numerose tappe. Avviso catturato prima della scomparsa: «Percorso incompleto: nessuna tappa è stata rimossa. Riprova.» Corrette soltanto le risposte del test, generando N−1 tratti da N coordinate. Evidenza: `automation_output/20261007_153929`.
4. Aggiunta alla fixture la lettura mappa `tabaccherie_points_in_bbox`, precedentemente bloccata correttamente come RPC non prevista.
5. L'ipotesi secondo cui sarebbero necessarie contemporaneamente righe free e never è errata: il filtro ammette entrambe le categorie, non impone che entrambe abbiano risultati. Nessuna modifica arbitraria al motore o ai dati di assegnazione.

## Verifica automatica e preview isolata
- TypeScript: PASS. **341/341 test, 31 suite**, compreso il porting delle **36 asserzioni web** e 7 test di paginazione.
- Lint TypeScript dei moduli modificati e Python fixture: PASS.
- Script riutilizzabile: `tests/e2e/iter63_gptour_development_fixture.py` (Supabase/Auth/Edge/OSRM intercettati soltanto nel test; non modifica l'app né il CRM).
- Replay finale dopo riavvio Expo: `automation_output/20261007_154530/console_20261007_154530.log`.
- Admin seleziona effettivamente DELLA VOLPE VINCENZO, header e payload verificati; pool sintetico 2502 = 2500 registro + 2 orfani.
- Richiesta letterale sviluppo: **19 tappe** = 15 Bacoli (2 orfani + 13 registro) + 4 Monte di Procida; Caserta esclusa; criteri free/never visibili.
- Rimozione manuale: **18 tappe**, nessun reinserimento automatico.
- Risposta AI `needsInfo`: fallback **17 tappe** free/never; data **domani** verificata sul titolo del piano singolo.
- Reset + «i miei orfani di Bacoli», `ownOrphansOnly=true`: **2 tappe**, nessuna aggiunta sviluppo e nessun chip free/never.
- Azioni follow-up: nessun fallback improprio. Follow-up non decisi: piano bloccato con domanda visibile.
- **0 page errors, 0 API sconosciute, 0 tentativi di salvataggio CRM** nel replay finale. Mappe/GPS/audio/tastiera native non certificati dal browser.

## Pool Supabase reale: misura autorevole
Il probe iniziale del tester misurava prevalentemente righe RPC, omettendo parte degli orfani e i filtri territoriali finali; `estimated_candidate_total=2500` NON è il pool effettivo dell'app.

La verifica finale usa **le vere funzioni mobili** `getSettings` e `loadGptourPool`, compilate senza cambiare il sorgente, con client Supabase autenticato reale e whitelist fail-closed delle sole letture. Non duplica l'algoritmo in Python. Script: `tests/e2e/iter64_actual_pool.cjs`. Nessuna sessione/token o scheda cliente salvata negli artifact.

Artifact autorevole: `test_reports/artifacts_iter64/actual_client_pool_verified.json`, ore 15:44 UTC.

| Misura | Vecchia risposta limitata a 1000* | Paginazione attuale |
|---|---:|---:|
| Candidati dopo filtri/deduplica | 865 | **2060** |
| Bacoli | 6 | **14** |
| Monte di Procida | 2 | **3** |
| Orfani nel pool | 69 | 69 |
| Free nel pool | 796 | 1991 |

\* Confronto sullo stesso snapshot: replay in memoria delle risposte reali, emulando il taglio a 1000. L'istante delle query temporali è fissato fra i due caricamenti; nessuna seconda richiesta CRM nel replay baseline. La prima prova `actual_client_pool.json` aveva due cache miss su query temporali: non usarla come evidenza conclusiva del confronto; risolto nel replay verificato.

- RPC reale: **1000 + 1000 + 500 righe**; Bacoli per pagina 4+6+2, Monte 2+1+0. Tutte le 2500 righe di QUESTA risposta hanno `assigned=false`; ciò non prova che non esistano assegnazioni nell'intero database.
- Pool finale con una zona agente, limite intenzionale e avviso sugli storici parzialmente non verificati. Non è l'intero territorio e non viene presentato come completo.
- I conteggi storici web ~2495/Bacoli15 **non sono stati confermati** nello snapshot attuale. Non forzati né sostituiti ai valori osservati.

## Unica chiamata AI reale
Alle 15:42 UTC effettuata **una sola** chiamata `ai-tour-gptour` tramite `runGptour` mobile, stesso agente e pool reale. Risposta validata e agente effettivo corretto:
- successo, `needsInfo=false`, 15 elementi originari;
- completamento puro: +5, totale selezione 20, comuni aggiunti Bacoli/Pozzuoli;
- data 8 ottobre 2026, nessuna azione follow-up nella risposta;
- nessun routing finale, nessuna scrittura, nessun salvataggio eseguito.

Evidenza AI: `actual_client_pool.json` sezione `ai` (distinta dal confronto baseline corretto successivamente). Il precedente 429/credito esaurito **non si è ripresentato in questa chiamata**; non è una garanzia sulla disponibilità futura.

## Limiti e backlog
- **P0:** nessun difetto client confermato rimasto nel perimetro verificato.
- **P1:** conferma utente sull'app installata Android/iOS e, se desiderato, anteprima reale completa con routing; salvataggio reale non autorizzato e non testato.
- **P2:** il controllo truthy delle coordinate zero è ereditato identico dal web, non rilevante per Bacoli/Italia e lasciato invariato per fedeltà alla patch; eventuale generalizzazione geografica separata. Nessuna espansione automatica oltre il limite concordato 2500.
- In questa continuazione modificate soltanto fixture/runner/report/memoria. Il precedente passaggio aveva già modificato `backend/server.py` per il suffix range video: modifica preesistente, non parte della verifica GPTour, non ulteriormente modificata o usata come prova di questa consegna.