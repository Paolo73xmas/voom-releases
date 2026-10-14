# U2-b — Modello dei privilegi (perimetro esecutivo, revisione 2) e prova locale del modello dei ruoli

Stato: **perimetro proposto, U2-b non avviata.** Nessuna tabella/RPC `gptour_semantic_*` creata. Prova locale eseguita il 2026-10-13 sul laboratorio replay (`/tmp/voom-u2-replay`, PostgreSQL 15 + PostgREST 16.2 loopback) con oggetti di sonda `u2_role_probe.*` / `public.u2_role_probe_*`, **rimossi al termine**; credenziali sintetiche firmate con il segreto del laboratorio. Nessuna operazione remota; nessun segreto di produzione acquisito o usato. Evidenze: `tests/gptour-semantic/u2/schema_replay/evidence/role_probe_report.json` (**85/85**, revisione 2: 64 controlli + 21 della sezione R8 su estrazioni, helper e allowlist), `role_probe_extraction.md` (appartenenze, helper, allowlist in forma leggibile), `role_probe_removal_verification.txt`, `role_probe_run.log`; sorgenti in `tests/gptour-semantic/u2/schema_replay/role_model_probe/`.

## 1. Identità e ruoli

| Ruolo | Attributi | Appartenenze | Privilegi su `gptour_semantic_*` |
|---|---|---|---|
| `authenticated` / `anon` / `service_role` (client) | esistenti | ruoli **concessi a** `authenticator` (è `authenticator` il membro; appartenenze legacy hosted, non modificate) | **nessuno**: zero grant su tabelle, zero EXECUTE su RPC interne e di proiezione (revocato esplicitamente anche da `service_role`) |
| `gptour_semantic_backend` (backend fidato) | `NOLOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER` | ruolo **concesso a** `authenticator` (`GRANT gptour_semantic_backend TO authenticator`: `authenticator` ne è il membro, così PostgREST può fare `SET ROLE`) | **solo EXECUTE** su RPC interne e proiezioni; zero grant su tabelle; zero grant CRM (tabelle e RPC CRM negate: provato) |
| `gptour_semantic_owner` (proprietario oggetti) | `NOLOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER` | nessun membro | possiede tabelle, trigger e RPC `SECURITY DEFINER`; privilegi di default dello schema `public` revocati per owner e backend |
| ruolo migratore (`postgres`) | esistente | — | possiede l'helper di autorizzazione (§4) |

`PUBLIC`: `REVOKE EXECUTE` esplicito su ogni funzione creata (PostgreSQL concede EXECUTE a `PUBLIC` per default su ogni nuova funzione, trigger inclusi) e nessuna voce `=` nelle ACL — verificato (R1).

**Appartenenze (estrazione `pg_auth_members`, colonne `ruolo_concesso | membro`, R8):** `anon | authenticator`, `authenticated | authenticator`, `service_role | authenticator`, `gptour_semantic_backend | authenticator`; nessuna riga con `authenticator` come ruolo concesso (anon/authenticated non sono mai membri di `authenticator`); `gptour_semantic_owner` e il ruolo di laboratorio senza membri; nessuna `ADMIN OPTION`. Chiarimento della frase usata in precedenza («backend/anon/authenticated/service_role membri solo di authenticator»): intendeva che `authenticator` è l'unico membro di quei ruoli; le appartenenze legacy non sono state toccate.

## 2. Controllo del chiamante nel contesto PostgREST effettivo

Dentro una funzione `SECURITY DEFINER`: `current_user` = proprietario della funzione, `session_user` = `authenticator`; entrambi inutilizzabili per identificare il chiamante. Restano due segnali indipendenti, verificati empiricamente (R2):
1. `current_setting('request.jwt.claims', true)::jsonb->>'role'` — impostato da PostgREST **dopo** la verifica della firma;
2. `current_setting('role', true)` — riporta il ruolo scelto da PostgREST con `SET LOCAL ROLE` (nel test: `gptour_semantic_backend`, mentre `current_user` era l'owner).

Più una **allowlist per token** `backend_keys(jti, not_after, revoked_at)` controllata nella stessa funzione. Il controllo (`assert_backend_caller()`) è in aggiunta al grant di EXECUTE, che resta la prima barriera. Prove: backend ammesso (200); `authenticated` proprietario, `authenticated` con `user_metadata.role='admin'`, `anon`, `service_role` → 401/403 senza EXECUTE; claims falsificati con `role=backend` ma `SET ROLE authenticated` → `permission denied` dal grant; `SET ROLE backend` con claims non backend → rifiuto del secondo segnale; `jti` scaduto/sconosciuto/assente → 403.

## 3. RLS e proprietario: dichiarazione corretta

Il proprietario di una tabella supera la RLS salvo `FORCE ROW LEVEL SECURITY` (verificato: il ruolo owner legge la tabella con RLS abilitata e nessuna policy). Le RPC eseguono come owner, quindi **dentro le RPC la RLS non è una barriera**: la protezione dipende esclusivamente dai controlli espliciti di **ownership** (`owner_uid = p_caller_uid`), **autorizzazione attuale** (helper §4, incluso il kill-switch Fase 6: con accesso revocato anche il replay della ricevuta è negato) e **scadenza** (`clock_timestamp() >= response_expires_at` → non trovato), con esito non enumerante `PT404 → HTTP 404`. La RLS abilitata senza policy protegge solo dagli accessi diretti dei ruoli non proprietari, che comunque non hanno privilegi di tabella.

## 4. Helper di autorizzazione: privilegi minimi e proprietà

`gptour_semantic_is_authorized(p_uid, p_agent_id)` legge `profiles(id, role, is_active)` e `gptour_orchestrator_user_access(user_id, enabled)`.
- **Variante respinta (dimostrata negativamente, R4):** helper posseduto da `gptour_semantic_owner` con soli grant di colonna → `profiles` e `user_access` hanno RLS con policy basate su `auth.uid()`, che sotto la credenziale backend è NULL → l'helper restituisce `false` anche per un agente abilitato. I grant di colonna non bastano: il nuovo owner non acquisisce il bypass del proprietario.
- **Variante adottata:** helper posseduto dal **ruolo migratore** (proprietario di `profiles`/`user_access`, come `aitour_private.authorized_agent` e `gptour_orchestrator_is_active_admin`), `SECURITY DEFINER`, `search_path = ''`, EXECUTE **solo** a `gptour_semantic_owner` (chiamato dalle RPC), revocato a PUBLIC/anon/authenticated/service_role/backend. Esiti provati: A abilitato → `true`; B non abilitato → `false`; A per l'agente B → `false`. Parità con le funzioni esistenti da estendere in U2-b sulla fixture A/B/C/D/E.
- **Estrazione (R8):** proprietario `postgres`, `SECURITY DEFINER`, `proconfig = search_path=""`, firma `(p_uid uuid, p_agent_id uuid) → boolean`, ACL `postgres=X/postgres; gptour_semantic_owner=X/postgres` (definizione completa in `evidence/role_probe_extraction.md`). **Prove negative:** il ruolo backend non può chiamare l'helper direttamente (psql `permission denied`; PostgREST 403/42501), né lo può un JWT utente; l'owner non ottiene dati CRM attraverso l'helper (ritorna solo un booleano su uuid; `profiles.email/full_name`, `user_access.note`, `customers`, `appointments` → `permission denied` per l'owner).
- Il ruolo backend non ha alcun grant CRM: `customers`, `profiles`, `tabaccherie`, `agent_zones`, tabelle Fase 4B/6, RPC `ai_tour_catalog_area` e `gptour_orchestrator_my_access` → `permission denied` (R5). Le letture CRM restano con il **JWT utente** nella Edge.

## 5. Credenziale dedicata: emissione, scadenza, revoca

- La chiave è un JWT HS256 con `role: gptour_semantic_backend`, `jti` univoco, `exp` finita (proposta: ≤ 90 giorni), conservata come Edge secret `GPTOUR_SEMANTIC_BACKEND_KEY`; non è la service role, non è consegnata ai client. Nel laboratorio è firmata col segreto locale.
- **Revoca a due livelli, entrambe provate (R3):** (a) per singolo token tramite `revoked_at`/`not_after` nella allowlist `jti` → respinto immediatamente anche se crittograficamente valido; (b) totale tramite `REVOKE gptour_semantic_backend FROM authenticator` → PostgREST non può assumere il ruolo e nessun token backend funziona più. Un nuovo `exp` su un nuovo token **non** invalida il precedente: per questo la allowlist è obbligatoria e la rotazione = nuovo `jti` + revoca del vecchio.
- **Gestione della allowlist `jti`:** tabella `backend_keys` posseduta da `gptour_semantic_owner`, **senza alcun grant** a backend/authenticated/service_role e non esposta da PostgREST; nessuna RPC backend la scrive (verificato sul catalogo delle funzioni). La gestisce **solo il ruolo migratore/DBA** tramite migration o runbook operativo (futuro, da autorizzare); il backend **non può autorizzarsi nuovi token** né riattivare `jti` revocati (R8: INSERT/UPDATE → `permission denied`, HTTP → schema non esposto, nessun `jti` creato).
- **Da verificare e autorizzare in L3 (E3):** metodo di emissione nell'ambiente hosted (richiede il segreto JWT del progetto o un meccanismo equivalente offerto dalla piattaforma), possibilità di `CREATE ROLE`/`GRANT … TO authenticator` da migration, compatibilità del `SET ROLE` con il gateway. Nessuna di queste operazioni è stata eseguita o simulata contro produzione.

## 6. Write-once e cancellazione controllata (trigger `BEFORE UPDATE`/`BEFORE DELETE`, codici `U2W01–U2W07`)

| Colonna | NULL→valore | valore→valore diverso | valore→NULL |
|---|---|---|---|
| `context`, `llm_output` | solo con `status='pending'` | mai | solo nello stesso UPDATE `pending→done/expired` o a stato già terminale |
| `response_body` | solo nello stesso UPDATE `pending→done` | mai | solo `done→expired` con `clock_timestamp() >= response_expires_at` (tombstone; `http_status`, esito, revisioni, contatori, hash e ID restano) |
| `status` | — | solo `pending→done`, `pending→expired`, `done→expired` | mai |
| `owner_uid`, `http_status` (una volta scritto) | — | mai | mai |
| `llm_dispatches_reserved` | — | solo crescente, ≤ 2 | mai |
| righe | INSERT | — | **nessun DELETE** applicativo (trigger), anche per chi ha il privilegio |

Dopo la finalizzazione nessun `NULL→valore` è più ammesso (lo stato non è `pending`): la cancellazione alla finalizzazione e alla scadenza non riapre la sostituzione. **Distinzione provata (R7):** la prova del trigger usa un ruolo di **solo laboratorio** `u2_probe_writer` con `UPDATE/DELETE` e una policy permissiva, così da escludere privilegi e RLS: ogni violazione termina con l'eccezione del trigger (`U2Wxx`), mentre le transizioni legittime passano; `service_role` fallisce invece per `permission denied` e **non** costituisce prova del trigger. Nessun privilegio aggiuntivo verrà concesso in produzione per questa prova.

## 7. Test via PostgREST già dimostrati (sonda) e richiesti in U2-b

Dimostrati sulla sonda (R2, R6): proprietario della sessione → nessuna RPC interna invocabile (403/42501), nessuna lettura di tabelle interne (schema non esposto e nessun grant: `lease_token`/`context`/`llm_output` irraggiungibili), nessun INSERT/UPDATE diretto (piano o output arbitrari) con `authenticated`, `user_metadata.role='admin'`, `anon`, `service_role`; proiezione backend con insieme **esatto** di chiavi di contratto. In U2-b gli stessi test vanno ripetuti su ogni RPC reale (`create_session, claim, renew_lease, store_context, begin_llm, store_llm, commit_success, finish_error, release_recoverable, get_state, get_request, get_plan`) e su ogni tabella.

## 8. Effetti sul perimetro U2-b già presentato

Invariati: tabelle, RPC, ordine lock, matrice T01–T39 a livello SQL, Fase 4B/6, v7, U1, `semantic-1.1`, policy legacy (`profiles`/`user_metadata.role` rilievo ancora aperto). Modificati: grant client = nessuno; letture solo via proiezioni backend; nuovi ruoli owner/backend; helper posseduto dal ruolo migratore; allowlist `jti`; nuovo Edge secret esplicito (U2-d, autorizzazione E3); codici `PT404` non enumeranti. Resta a U2-c/U2-d: handler con due client (utente per CRM, backend per store), rinnovo lease, budget LLM, bridge.
