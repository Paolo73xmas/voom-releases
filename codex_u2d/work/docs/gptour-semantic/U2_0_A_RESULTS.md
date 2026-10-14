# U2-0 / U2-a — esiti e limiti della consegna

Verifica finale: **2026-10-13 UTC**, base `feature/gptour-semantic-interpreter` / `259ec92d`. Nessun commit eseguito.

## Cambiamenti effettivi (diff additivo)
- Nuovi sorgenti soltanto in `supabase/functions/_shared/gptour-semantic-transport/`.
- Nuovi test/script/fixture in `tests/gptour-semantic/u2/` e documentazione U2-0/a.
- `PHASE_U2_PLAN.md` revisione3 preesistente incluso come riferimento, **non modificato** da questo blocco.
- Nessuna modifica a sorgenti/test U1 originali, planner/orchestratore v7, client Web/Mobile, package/lockfile, migration di prodotto o configurazione remota.
- Deno e PostgreSQL già presenti; installato solo PostgREST fuori repository, verificandone il digest ufficiale. Dataset e segreto HS256 esclusivamente in `/tmp/voom-u2-lab`.

## Test realmente eseguiti
| Verifica | Esito finale |
|---|---|
| U1 Node, suite originali SA/SC/SD/SE | **232/232**: 129 + 43 + 39 + 21, fail0 |
| Stesse quattro suite U1 sotto Deno senza rete | **232/232**, fail0 |
| Contratto U2 Node e Deno | **368 controlli per runtime**, fail0; 41 golden pubblici |
| Adapter U2→U1 Node e Deno | **31 controlli per runtime**, fail0 |
| Regressioni negative ricevute/esiti Node e Deno | **10 controlli per runtime**, fail0 |
| Totale U2 | **409 controlli per runtime**; non 818 casi distinti |
| PostgreSQL/PostgREST locali reali | **23 controlli**, fail0, incluse 24 letture concorrenti A/B |
| Avvio ripetuto sullo stesso cluster | PASS |
| Arresto → riavvio → verifica locale ripetuta | PASS, 23 controlli ancora verdi |
| Deno check dei moduli e tre suite U2 | PASS |
| Bundle browser del contratto condiviso | PASS; nessun client modificato |
| Sintassi Python e bash dei nuovi script | PASS |
| Diff di tutti i file tracked rispetto a259ec92d | Vuoto |
| SHA256 cumulativo dei 40 file protetti | Invariato |

Toolchain usata: Node20.20.2, Deno2.9.7 aarch64 / TypeScript6.0.3, PostgreSQL15.19, PostgREST16.2 aarch64.

### QA indipendente e correzioni
Il rapporto `iteration_64.json` documenta test indipendenti superati e **due difetti inizialmente trovati** nel nuovo response validator:
1. ricevuta pending non scaduta ammessa come non recuperabile;
2. risposta not_accepted ammessa con metadati di accettazione.

Entrambi corretti; aggiunte regressioni eseguite su Node/Deno. Il suggerimento generico di vietare le date in OGNI risposta non committata non è stato applicato: acceptedAt e responseExpiresAt sono metadati di accettazione e restano legittimi in una request recuperabile già accettata. Test positivo specifico presente. Aggiunti controlli su finestra temporale, politica retry/esito e HTTP originario della ricevuta.
Il report originale viene mantenuto come evidenza, non riscritto per nascondere i fallimenti. I log finali post-correzione ne documentano la risoluzione. Un errore TypeScript iniziale in una nuova fixture di test è stato corretto prima del QA; nessuna correzione a U1.

## Comandi effettivi ripetibili
Esportare le variabili elencate in `U2_0_A_README.md` (solo percorsi/parametri locali).

```bash
python3 tests/gptour-semantic/u2/install_postgrest.py
bash tests/gptour-semantic/u2/local_up.sh
bash tests/gptour-semantic/u2/local_up.sh
bash tests/gptour-semantic/u2/local_verify.sh
bash tests/gptour-semantic/u2/local_down.sh
bash tests/gptour-semantic/u2/local_up.sh
bash tests/gptour-semantic/u2/local_verify.sh
bash tests/gptour-semantic/u2/run_contract.sh
bash tests/gptour-semantic/run_all.sh
for t in tests/gptour-semantic/*.unit.ts; do
  "$U2_DENO_BIN" run --no-config --no-lock "$t"
done
git diff --exit-code 259ec92d
git diff --cached --exit-code
```
Nessuna suite SB che chiama modelli reali è stata eseguita. Nessun browser aperto sul CRM: nessuna UI cambia e questo evita letture remote accidentali.

## Impronte della base
SHA256 cumulativo dei 40 file originali protetti (path UTF8 + NUL + bytes + NUL, ordinati):
`47b38f9561c4420ac09a894697144a63f848e98877039e011cff4ee6c5d7d30f`.

SHA256 documento revisione3:
`a0b429bf51431777c5c531149f6aa0b022d317535ef52d007b9049a2ae214701`.

Manifest individuale incluso nell'archivio. La copia della base è per riproducibilità, non costituisce diff/modifica dei file originali.

## Limiti da non confondere con test passanti
- **MOCKED:** LLM, CRM, clock, auth/gate applicativi, planner, storage/ricevute/commit, lease/budget nei golden. Nessuna chiamata reale LLM/OSRM o API produzione.
- RLS/JWT locali sono reali sul database sintetico; non sono prove di Supabase Auth/GoTrue, schema commerciale o policy hosted.
- U2-0 qui prepara il laboratorio minimo. Replay dei DDL CRM/Fase4B/Fase6/catalog-scope e migration U2 sono rinviati; non necessari ai test del contratto isolato, non presentati come eseguiti.
- Contratti di create_session/get_state/get_request/get_plan implementati come tipi/validatori/fixture, **non come endpoint funzionanti**. Nessuna Edge U2-d aggiunta o collegata.
- I testT01–T40 dell'intero piano NON sono tutti eseguiti: questo blocco copre i sotto-casi di contratto/mapping/proiezione/parità e isolamento, non transazioni U2, lease, retention o client reali.
- Nessuna persistenza U2-b né U2-c, planner v7 non estratto. Nessuna capacità commerciale abilitata. Nessun job di pulizia di produzione.
- Le finestre/budget del piano sono provvisori in fixture, non approvazione di costi o retention in produzione.

**Arresto del lavoro:** questo blocco termina qui. U2-b, ambiente Edge, accessi remoti e client richiedono ulteriori autorizzazioni esplicite.