# U2-0 / U2-a — blocco locale autorizzato

Base: `259ec92d`, piano revisione 3 conservato. Questo blocco NON è U2 completa.

## Implementato qui
- Laboratorio PostgreSQL **15** + PostgREST **16.2 aarch64** reale, loopback, database effimero fuori repository; bootstrap/avvio/verifica/arresto ripetibili.
- Nuovo modulo puro `_shared/gptour-semantic-transport/`: tipi condivisi 1.1, validazione strict request/response annidata, error policy, proiezione pubblica e bridge verso U1 **1.0 invariata**.
- Il bridge produce soltanto `persisted:false` e un candidato in memoria. Non dichiara commit, non offre un endpoint Edge, non implementa create_session/get_state/get_request/get_plan: ne definisce i contratti.
- Parametri del piano provvisori per fixture: non costituiscono approvazione a invii reali o retention di produzione.

## Esclusioni e simulazioni dichiarate
- **MOCKED:** catalogo CRM, clock, LLM, esiti di accesso/abilitazione dell'applicazione, snapshot/risposte committate, piani/gate, ricevute, lease e budget nei golden. Non c'è alcuna implementazione di queste dipendenze U2-b/c/d/e.
- Auth nel laboratorio = **JWT HS256 sintetici**, non login utenti reali e non GoTrue. PostgreSQL, PostgREST, RLS, ruolo per richiesta e pool locale sono reali.
- Nessuna tabella `gptour_semantic_*`, nessuna RPC claim/commit/budget, nessuna estrazione o chiamata del planner, nessun filtro commerciale e nessuna modifica ai client.
- Bootstrap usa solo `auth.users` sintetica, `auth.uid()` e `u2_lab.owner_probe`. Replay CRM/Fase4B/Fase6/catalog-scope del piano rinviato al blocco che ne richiederà gli adapter: NON certifica lo schema CRM reale. La futura migration U2-b non viene creata/applicata.
- Non è L3: Deno CLI non è Edge runtime; non testati gateway, GoTrue, pooling hosted, limiti Edge né PostgreSQL hosted17.6. Non dichiarare certificazione U2-f.
- Nessuna chiamata LLM/OSRM remota. Test senza permesso di rete Deno; soltanto verify locale parla al PostgREST su loopback.

## Prerequisiti e installazione controllata
Comandi dalla radice del repository, su Linux aarch64. PG15 e Deno sono già presenti in questo pod; non sono stati reinstallati. Non usare x86_64. Node/esbuild sono quelli già nel repository. Nessuna modifica package/lockfile.

```bash
export U2_DENO_BIN=/opt/deno/deno
export U2_PG_BIN=/usr/lib/postgresql/15/bin
export U2_PG_OS_USER=postgres
export U2_LAB_ROOT=/tmp/voom-u2-lab
export U2_TOOLS_DIR=/opt/voom-u2
export U2_POSTGREST_VERSION=v16.2
export U2_POSTGREST_BIN="$U2_TOOLS_DIR/bin/postgrest"
export PYTHONDONTWRITEBYTECODE=1

# Solo download ufficiale pubblico di un tool; nessun endpoint applicativo remoto.
python3 tests/gptour-semantic/u2/install_postgrest.py
bash tests/gptour-semantic/u2/local_up.sh
bash tests/gptour-semantic/u2/local_up.sh   # avvio ripetuto sullo stesso cluster
bash tests/gptour-semantic/u2/local_verify.sh
```

Il digest del tar aarch6416.2 verificato contro l'asset ufficiale GitHub è
`4c83974272acb56e6091e969ba4ee345fbc053cde457b0c8a9399e0d2a12c32d`.
Il controllo è SHA256 dell'asset pubblicato, non firma GPG indipendente. Ricevuta versione/binario in `$U2_TOOLS_DIR/installation.json`, nessun segreto.
Se un prerequisito manca, fermare il laboratorio e documentare il limite; continuare i test puri se i loro strumenti sono disponibili. MAI sostituire la destinazione con Supabase o produzione.

## Isolamento e credenziali
- Gli script non leggono `.env`, credenziali VOOM, token Supabase o URL dell'app. Porte effimere allocate e salvate in `lab.json`; socket PostgreSQL privato. TCP PostgreSQL rifiuta login; PostgREST espone soltanto loopback.
- Processi come utente OS non-root; directory runtime0700, chiave/config0600. Eseguire startup come root (runuser) o come l'utente OS configurato.
- JWT creati in memoria nel verify, durata600s, audience locale; mai stampati. Firma errata, token scaduto, audience errata, ruolo postgres/service_role sono test negativi.
- Solo UID sintetici A=`11111111-1111-4111-8111-111111111111`, B=`22222222-2222-4222-8222-222222222222`; nessuna email/password/login reale.
- Non archiviare runtime PG, `jwt.secret`, `postgrest.conf`, log privati o file credenziali del progetto.

## Test riproducibili
```bash
bash tests/gptour-semantic/u2/run_contract.sh
bash tests/gptour-semantic/run_all.sh   # 232 controlli U1 originali, senza modificare la suite
"$U2_DENO_BIN" check --no-config --no-lock supabase/functions/_shared/gptour-semantic-transport/index.ts
bash tests/gptour-semantic/u2/local_down.sh
bash tests/gptour-semantic/u2/local_up.sh
bash tests/gptour-semantic/u2/local_verify.sh
# A fine uso, rimozione ESCLUSIVA del cluster marcato sotto /tmp:
# bash tests/gptour-semantic/u2/local_down.sh --destroy
```
`run_contract.sh` esegue gli stessi test su Node ed esecuzione Deno senza rete, oltre al check TypeScript. Non rigenera i golden: `write_goldens.ts --write` è un'utilità esplicita di authoring da NON eseguire per far passare un test rotto.

## Decisioni di raccordo in questo blocco
- UUID canonici minuscoli per session/request; id di domande/eventi/stop rimangono stringhe U1. Non si trasportano ruoli o stato autorevole.
- `grant_consent` nel trasporto richiede questionId, e date esatte per non_working_day; il bridge controlla domanda/tipo/date e rimuove questionId solo prima della chiamata U1.
- GPS: struttura errata/chiavi sconosciute →400; dati tipizzati ma semanticamente inutilizzabili → notice e nessuna adozione. Partenza esplicita mantiene precedenza. Il risultato è una proposta, non una scrittura.
- `acceptedAt` è un argomento fidato dell'adapter, mai accettato dal payload client. Nel test è fisso; la futura origine DB non è implementata.
- `ERROR_POLICIES` descrive l'esito FUTURO richiesto; la parola committed nei golden è una fixture, non un salvataggio eseguito. Scelta recuperabile/terminale per timeout richiede decisione esplicita della dipendenza futura, non un contatore finto.
- `acceptedAt`/`responseExpiresAt` sono metadati di ACCETTAZIONE, non una prova di commit: vietati in `not_accepted`, ammessi in `recoverable` quando noti. Non si applica il divieto a tutti gli esiti non committati. La ricevuta pending non scaduta è recuperabile; pending oltre deadline dichiara `processingExpired` senza inventare done.
- Il response validator controlla shape pubblica, leakage, ID/revisioni, ricevute e gate. Non prova fattibilità di un piano mock o durata/idempotenza nel DB.

## Consegna
Archivio previsto con nuovi sorgenti/test, golden, documenti di questo blocco, copia della base U1/v7 necessaria ai test (invariata), diff additivo, manifest SHA256, comandi/esiti realmente eseguiti. Dipendenze node_modules, database runtime e segreti esclusi.
Fermarsi dopo questo blocco. U2-b richiede nuova autorizzazione; nessun comando di questa guida la avvia.