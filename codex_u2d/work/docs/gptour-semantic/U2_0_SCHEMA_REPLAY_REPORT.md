# U2-0 — Replay locale dello schema reale VOOM: esiti, report SQL/RLS, divergenze e prerequisiti U2-b

**Esecuzione finale: 2026-10-13 UTC.** Base `feature/gptour-semantic-interpreter` / `259ec92d`. Nessun commit, push, merge, deploy; nessun accesso a database/Edge/Supabase di produzione; nessuna chiamata LLM; U1, planner v7, `semantic-1.1` e client Web/Mobile invariati.

**Revisione 2 (stessa data):** aggiunta la sonda S7 (§2.1) sul claim `user_metadata.role`, 111 controlli; corretta la dicitura sullo stato di U2-a (log ricevuti dal proprietario, sorgenti e test non ancora verificati da lui); consegna integrata con sorgenti/test U2-a, laboratorio sintetico e `git status` completo (§7).

Questo documento completa U2-0 rispetto al piano rev.3 (§U2-0: «replay schema CRM, Fase 4B, Fase 6, `20261029_gptour_catalog_scope.sql` soltanto sul DB locale»). Sostituisce il laboratorio «sintetico» di U2-0/U2-a come base dati per i futuri test U2; non ne modifica i file (il laboratorio sintetico resta disponibile e valido per i test di contratto).

## 1. Che cosa è stato replicato e da quale fonte

Il repository **non contiene** il DDL `CREATE TABLE` delle tabelle CRM di base (`customers`, `profiles`, `tabaccherie`, `agent_zones`, `orders`, `appointments`, …): esiste solo nel database hosted. Contiene però tre fonti reali, usate qui a strati, senza modificarne un byte:

| Strato | Fonte nel repository | Natura | Esito locale |
|---|---|---|---|
| L0 shim piattaforma | `tests/gptour-semantic/u2/schema_replay/local_env.sql` | **SHIM dichiarato**: ruoli PostgREST (`authenticator/anon/authenticated/service_role`), estensioni (`postgis 3.3.2`, `pgcrypto`, `uuid-ossp`, `pg_trgm`, `unaccent`), schema `auth` minimo (`auth.users`, `auth.uid()/role()/jwt()/email()` dai claims), privilegi di default hosted sullo schema `public`, pubblicazione `supabase_realtime` | PASS |
| L1 baseline tabelle | `src/lib/supabase/database.types.ts` (snapshot tipi generato da Supabase, commit `3c891f99`, 2026-09-06) → `gen_baseline.py` | **DERIVATO**: 193 tabelle con colonne/nullabilità reali; tipi SQL per euristica (uuid/timestamptz/numeric/jsonb/text), 547 default locali segnaposto per colonne NOT NULL opzionali in `Insert`, PK su `id`, 244 FK ricostruite dalle `Relationships`; 1 override documentato (`crm_commission_configs.agent_id` text) | PASS; 3 FK non ricostruibili per tipo (`product_links` ×2, `supplier_orders.shipping_carrier`) |
| L2 snapshot produzione 2026-03-24 | `docs/backup/*_backup_20260324_043722.sql` | **REALE** (dump hosted committato): 146 funzioni non-PostGIS (754 funzioni PostGIS saltate perché appartengono all'estensione), 58 funzioni trigger, 111 trigger, 632 indici, stato RLS per tabella, **480 policy RLS** | funzioni 146/146, trigger 58/58 + 111/111, indici 629/632 (3 su vista `supervisor_agents_map` non versionata; 110 `_pkey` già presenti dalla baseline), policy **480/480** |
| L3 migrazioni reali successive | 69 file elencati in `replay_set.txt` (`supabase/migrations/*` dal 2026-05 al 2026-10 nel perimetro GPTour/ai_tour/tabaccherie/customers/RLS core + `orchestrator-pending/phase4b/01_migration.sql` + `phase6/01_access_migration.sql`) | **REALE, invariato**, ogni file in un proprio `psql -v ON_ERROR_STOP=1` | **67/69** al primo passaggio; 2 fallimenti attesi e spiegati (§4.1) |
| L4 shim viste | `views_shim.sql` | **SHIM dichiarato**: vista `categories` (colonne dalla sezione Views dei tipi) | PASS |
| L5 fixture | `fixture.sql` | **DATI SINTETICI** inseriti sulle colonne reali, con i trigger reali attivi (es. `initialize_agent_tour_settings`, `trg_check_customer_vat`, `trigger_update_customer_last_order_date`) | PASS |

Inventario finale del DB locale: 210 tabelle `public`, schema `aitour_private` (viste `registry_cards`, `new_points`, tabella `geocoder_gate`), 346 funzioni `public` non-PostGIS, 566 policy, RLS attiva su 108 tabelle, 5 tabelle `gptour_orchestrator_*`, nessun oggetto `gptour_semantic*`.

Ordine temporale dichiarato: la baseline (tipi di settembre 2026) è più recente dello snapshot (marzo 2026) applicato sopra di essa; è accettabile perché la baseline fornisce solo struttura e le migrazioni L3 ricostruiscono funzioni/policy fino a ottobre 2026. Dove uno strato più vecchio ha creato una policy poi rimossa in produzione, la migrazione reale successiva la rimuove (`20260722_drop_duplicate_policies`, `20260812_security_rls_hardening`).

## 2. Report SQL/RLS — 111 controlli, 111 superati (revisione 2: 93 della prima consegna + 18 della sezione S7; esecuzioni: laboratorio nuovo, ripetizione sullo stesso laboratorio, dopo arresto/riavvio)

Canali: `psql` con `set local role` + `request.jwt.claims` (semantica hosted) e **PostgREST 16.2 reale su loopback** con JWT HS256 sintetici generati in memoria. Dettaglio per controllo in `evidence/verify_report.json`.

| Sezione | N. | Contenuto verificato |
|---|---|---|
| S1 struttura | 18 | colonne esatte delle 5 tabelle Fase 4B/6; RLS attiva; privilegi `authenticated` minimi (sessions S/I/U, plans S/I, requests S/I/U, **nessun DELETE**, nessun privilegio su Fase 6); `anon` zero privilegi su `gptour_*`; presenza delle 12 RPC Fase 6 + catalog scope + `save_tours_batch`; `aitour_private` senza USAGE per `authenticated`; **tutte le SECURITY DEFINER del perimetro GPTour con `search_path` fissato**; EXECUTE solo ad `authenticated`; namespace `gptour_semantic*` libero; ruoli senza superuser, solo `service_role` bypassa RLS; policy reali presenti su `customers/profiles/tabaccherie/agent_zones/ai_tour_settings/appointments/orders`; FK Fase 6 → `auth.users`; ≥25 trigger reali attivi |
| S2 Fase 4B RLS | 14 | owner inserisce/aggiorna/upserta; non-owner set vuoto; `with check` su sessione altrui; DELETE e UPDATE plans `permission denied`; anon negato per privilegio; **limite documentato**: la policy accetta `agent_id ≠ owner_uid` (nessun controllo autorizzativo SQL sull'agente: U2-b deve farlo nella RPC `create_session`) |
| S3 Fase 6 accessi | 12 | tabella abilitazioni non leggibile direttamente; `disabled/enabled/role_unsupported/inactive`; agente non si autoabilita; admin abilita/revoca; elenco solo admin (4 account, cliente portale escluso); anon senza EXECUTE |
| S4 catalog scope | 13 | `ai_tour_catalog_area(A,'Milano')` → registered 6 / inside 5 / otherAgent 1 / eligible 10 con **insieme esatto** di chiavi `tab:1-4 + cust:2-7` (esclusi: registro di B, chiusa, gps vuoto, Monza; cliente collegato via registro, disabilitato, fuori territorio); `new_point` esattamente {1,2,3} (stato NULL = non visitato); A→catalogo di B 42501; ruolo customer, profilo inattivo, anon negati; admin ammesso; B su Monza 1/4; `ai_tour_scope_candidates` con 11 candidati → allowed {ok_tab1, ok_linked, ok_cust2} ed esclusioni esatte per motivo; `p_lock=true` senza coordinate pianificate → nessuno ammesso; `save_gptour_scoped_batch` con punto di B → 42501 senza salvataggio; B per A → negato |
| S5 CRM con policy reali | 19 | `customers`: A esattamente i propri 10, B i propri 3, admin 13, anon nulla; `tabaccherie` leggibile per intero (policy reale select); `agent_zones/ai_tour_settings/appointments/orders` solo propri; A non modifica/elimina clienti di B (0 righe); A non si appropria della zona di B; `ai_tours`: A non crea a nome di B (`ai_tours_own`), crea proprio, B non vede; A non si autopromuove admin (trigger reale `prevent_profile_privilege_escalation`); **`profiles`: l'agente legge SOLO il proprio profilo** |
| S7 claim `user_metadata.role='admin'` su un agente (sonda negativa locale, rev. 2) | 18 | vedi §2.1 |
| S6 PostgREST HTTP | 17 | GET sessioni A `{s1,s3}` / B `[]` / anon negato; POST a nome altrui 403; DELETE 403; RPC `my_access` 200 `disabled`, anon negato; RPC `catalog_area` 200 eligible 10, per B 403; GET `customers` set esatto; ruolo customer `[]`; JWT scaduto/firma errata/audience errata 401; escalation ruolo respinta; `/rpc/gptour_semantic_claim` 404; tabella Fase 6 non esposta |

### 2.1 S7 — agente con claim JWT `user_metadata.role='admin'`: policy ricostruite vs RPC previste per U2

Contesto: alcune policy dello snapshot 2026-03-24 su `profiles` (e su `app_ef2c98f92d_whatsapp_templates`) usano `auth.jwt()->'user_metadata'->>'role'`; nessuna RPC del perimetro GPTour lo usa (solo `ensure_profile_exists`, `handle_new_user_hook`, `process_pending_profiles`, fuori perimetro). La sonda usa l'agente sintetico A con il claim aggiunto ai `request.jwt.claims` (psql) e al JWT HS256 (PostgREST); le scritture sono eseguite in transazione con rollback.

| Oggetto | Senza claim | Con claim `user_metadata.role='admin'` | Lettura |
|---|---|---|---|
| `profiles` SELECT diretto (psql e HTTP) | 1 riga (il proprio) | **5 righe** («Admins can view all profiles») | comportamento delle **policy ricostruite** dallo snapshot |
| `profiles` UPDATE campo non autorizzativo su profilo altrui | 0 righe | **passa** («Admins can update all profiles»; rollback) | policy ricostruite |
| `profiles` UPDATE `role` (proprio o altrui) | bloccato | **bloccato** dal trigger reale `prevent_profile_privilege_escalation` (`has_any_role` legge `profiles.role`) | trigger reale 2026-08-19 |
| `profiles` UPDATE `is_active` su profilo altrui | 0 righe | **passa** (rollback): `is_active` non è tra i campi protetti dal trigger (`role/supervisor_id/branch_id/custom_permissions`) | osservazione sulle policy ricostruite |
| `customers` SELECT | 10 | 10 (`customers_admin_full_access` usa `profiles.role`) | invariato |
| `ai_tours` di B | 0 | 0 (`has_any_role` su `profiles`) | invariato |
| RPC `gptour_orchestrator_my_access` (psql e HTTP) | `disabled` | `disabled` | **RPC U2**: claim ignorato |
| RPC `gptour_orchestrator_access_list` / `set_access` | negate | negate (`gptour_orchestrator_is_active_admin` su `profiles`) | RPC U2: claim ignorato |
| RPC `ai_tour_catalog_area` per B (psql e HTTP) | 42501 / 403 | 42501 / 403 (`aitour_private.authorized_agent` su `profiles`) | RPC U2: claim ignorato |
| RPC `ai_tour_catalog_area` per sé | eligible 10 | eligible 10 | invariato |

Conclusione locale: le RPC su cui U2 deve poggiare (Fase 6, catalog scope, `has_any_role`) decidono su `profiles.role` verificato nel DB e **non** sono influenzate dal claim; le sole deviazioni osservate riguardano policy dirette su `profiles` ricostruite dallo snapshot di marzo 2026, che in produzione potrebbero essere state modificate dopo quella data (il repository contiene `20260819_profiles_privilege_hardening.sql`, replicato, che non le rimuove). **Non si deduce alcuna vulnerabilità della produzione**, che non è stata interrogata né modificata; il punto va verificato in L3 ed è un ulteriore motivo per cui la Edge U2 non deve leggere `profiles` direttamente (§4.4.2).

Prove di ripetibilità: `replay_up.sh` due volte sullo stesso cluster (secondo avvio = solo servizi, senza riapplicare lo stack; `U2_REPLAY_FORCE=1` per riapplicare), `replay_down.sh` con `U2_REPLAY_KEEP=1` → `replay_up.sh` → `replay_verify.sh` ancora 93/93 (rev. 1) e 111/111 (rev. 2, ripetuta due volte sullo stesso laboratorio).

Prove aggiuntive eseguite con gli script v7 preesistenti su PG15 (`PG_MAJOR=15`): `K_rls_local.sh` fail=0, `T_sql_4b_dryrun.sh` fail=0, `V6_sql_phase6_dryrun.sh` 29/29.

**QA indipendente (testing agent, `/app/test_reports/iteration_65.json`):** ri-esecuzione completa su un root separato (`/tmp/voom-u2-replay-qa`): stessi contatori di replay, 93/93 ×3, spot-check SQL/HTTP indipendenti coincidenti, regressioni U1/U2 verdi, diff tracciato vuoto, nessun segreto; nessun difetto funzionale. Cinque asserzioni giudicate «troppo permissive» (accettavano qualsiasi errore) sono state irrigidite (zona di B → `UPDATE 0`; autopromozione → messaggio del trigger `Solo un admin…`; anon su `customers` → insieme vuoto; Fase 6 via HTTP → `403` con codice `42501`; ruolo customer → `Agente non autorizzato`) e la suite rieseguita: 93/93. Provenienza finale: agent-tested + QA indipendente nel pod; non equivale a verifica su DB hosted.

## 3. Regressioni U1/U2 (dopo il lavoro)

| Suite | Esito |
|---|---|
| U1 Node SA/SC/SD/SE | **232/232** (129+43+39+21) |
| U1 Deno 2.9.7 (stesse suite) | **232/232** |
| U2 contratto/bridge/negativi Node + Deno | **409/409 per runtime** (368+31+10); `deno check` moduli U1 e transport PASS |
| 40 file protetti U1/planner v7 | SHA256 cumulativo invariato `47b38f95…d30f` |
| `git diff 259ec92d` sui file tracciati | vuoto |

## 4. Incompatibilità, limiti e proposte

### 4.1 Fallimenti locali attesi (non bloccanti, dichiarati in `replay_set.txt` con prefisso `?`)
1. `20260506_enable_rls_15_tables.sql`: riferisce `supplier_orders.created_by/branch_id`, assenti nello snapshot tipi 2026-09-06; **nessuna** delle sue 35 policy compare in `20260722_turbo_rls_initplan.sql` (rigenerazione completa delle policy) ed esiste `20260506_rollback_rls.sql` → con ogni probabilità non è live. File in transazione unica: nulla applicato localmente. Fuori perimetro GPTour.
2. `20260728_fix_views_security_invoker.sql`: `ALTER VIEW` su viste hosted (`visit_routes_with_stats`, …) le cui definizioni non sono versionate. Fuori perimetro GPTour.

### 4.2 Migrazioni reali non ri-eseguibili (informativo, nessuna azione in U2-0)
`20260812_security_rls_hardening.sql` e `20261008_polar_centers.sql` creano policy senza `DROP IF EXISTS`; `20260915_ai_tour_esito_contacts_status.sql` non è riapplicabile dopo `20260929/30_ai_tour_contact_stats*` (tipo di ritorno cambiato). In produzione sono applicate una volta sola: non è un difetto da correggere qui, ma la **futura migration U2 deve essere idempotente** come Fase 4B/6 (lo sono: verificato ×2).

### 4.3 Oggetti non riproducibili dal repository
- DDL base delle tabelle CRM (ricostruito dai tipi: senza CHECK/enum, senza trigger/viste oltre lo snapshot); viste `supervisor_agents_map`, `v_agents_*`, `visit_routes_with_stats`, `products_agent_view`, `customer_follow_ups_view` (3 indici e 198 FK verso viste non ricostruiti); GoTrue, gateway, pooling hosted, PostgreSQL 17.6 hosted (locale: 15.19). Una verifica L3 resta necessaria (piano §3.1).

### 4.4 Rilievi rilevanti per il contratto U2 (compatibili, ma da rispettare in U2-b)
1. **Fase 4B non vincola `agent_id` all'autorizzazione**: il test S2 dimostra che `owner_uid = auth.uid()` basta per inserire una sessione con `agent_id` di un altro agente. U2-b deve autorizzare l'agente dentro `create_session` (come previsto dal piano) e non affidarsi alla sola RLS owner-only. Nessuna modifica a Fase 4B.
2. **`profiles` non è leggibile oltre il proprio profilo** per gli agenti, e le policy «admin» su `profiles` dipendono da `auth.jwt()->user_metadata->>role`, non da `profiles.role`. La Edge U2 non deve leggere `profiles` direttamente per autorizzare: usare le RPC SECURITY DEFINER esistenti (`gptour_orchestrator_my_access`, `aitour_private.authorized_agent` tramite le RPC catalog scope). Compatibile con D1.
3. **Privilegi di default hosted**: ogni tabella nuova nasce con `ALL` per `anon/authenticated/service_role`. La migration U2-b deve ripetere lo schema `REVOKE … GRANT minimi` di Fase 4B (verificato efficace nel laboratorio con i default hosted emulati).
4. **`customers.last_order_date` non equivale a «ultimo acquisto valido»**: il trigger reale `update_customer_last_order_date` (snapshot) imposta `last_order_date = NEW.created_at` a ogni INSERT su `orders`, anche per stati `cancelled`/preventivi/test (osservato nella fixture: cliente con solo ordine annullato ha `last_order_date` valorizzata). I filtri commerciali U2-e dovranno calcolare l'ultimo acquisto da `orders` con filtri di stato, come fa già l'adapter v7, e non dalla colonna denormalizzata.
5. **Catalog scope** (`ai_tour_catalog_area`, `ai_tour_scope_candidates`): SECURITY DEFINER con `search_path=''`, autorizzazione per agente, esiti per insiemi di chiavi e motivi di esclusione (`missing/identity/otherAgent/disabled/coordinates/outsideTerritory`), limite 8000 righe (`truncated`). Adatto come porta CRM «set-esatto» per U2 (piano §T35) senza duplicare regole nel client. `ai_tour_free_tabaccherie` e `ai_tour_registry_availability` presenti e eseguibili da `authenticated`.
6. **Tipi di errore PostgREST**: `42501` → HTTP 403, assenza RPC → 404, privilegio mancante → 401/403. Coerente con la matrice §4 del piano (403 `agent_mismatch`, 404/410 non enumeranti).
7. **Fase 6 richiede righe reali in `auth.users`** (FK): nel laboratorio sono sintetiche; in L3 servono utenti GoTrue reali.

### 4.5 Nessun adeguamento al codice sorgente reale è stato necessario
Tutti i file SQL reali sono stati applicati invariati. Gli unici artefatti locali sono gli shim dichiarati (L0/L4), la baseline derivata (L1) e la fixture sintetica (L5), tutti dentro `tests/gptour-semantic/u2/schema_replay/` e nel root effimero `/tmp`.

## 5. Allineamento con `main`

- `main` locale = `origin/main` = `380da912` (ultimo fetch registrato 2026-10-12 13:30 UTC; **nessun fetch eseguito ora**: un eventuale avanzamento remoto successivo non è verificabile senza accesso di rete autorizzato).
- `merge-base(main, HEAD) = main`: `main` è antenato di `HEAD`; **nessuna divergenza**. `HEAD` aggiunge 5 commit (`997f2c89 → 259ec92d`, tutti `gptour-semantic`), 24 file, +2182/−0 righe, nessun file in comune con modifiche su `main`.
- Il lavoro U2-0/U2-a e questo replay sono **non tracciati** (non committati) nel working tree: 29 file U2-0/a già accettati + i file di `schema_replay/` elencati in §7. Nessun merge automatico eseguito; l'eventuale integrazione in `main` sarebbe un fast-forward, da autorizzare separatamente.

## 6. Prerequisiti U2-b: valutazione

| Prerequisito | Stato |
|---|---|
| Contratto `semantic-1.1` verificato e invariato | 409/409 nel pod (Node+Deno) e nel QA indipendente; **il proprietario ha ricevuto i log ma non ha ancora verificato sorgenti e test U2-a**: la consegna rev. 2 li include per la verifica |
| Base dati realistica locale (schema, policy, funzioni, trigger reali) | **sì**, con i limiti §4.3 |
| Fase 4B/Fase 6/catalog scope applicabili e verificati su schema reale | sì (67/69 reali, 111/111 controlli) |
| Namespace `gptour_semantic_*` libero, privilegi/ruoli hosted emulati | sì |
| Regole da incorporare nella migration U2-b | §4.4 punti 1, 3, 7; idempotenza §4.2 |
| Scelte aperte del proprietario | P1–P4, E2–E4 del piano restano aperte; U2-b **non autorizzata** |
| Verifica L3 su runtime/DB hosted | non eseguibile nel pod; necessaria prima dell'attivazione |

## 7. File aggiunti (solo laboratorio/documentazione; nessuna modifica a file esistenti)

Elenco completo dei file nuovi/non tracciati del working tree (U2-0/U2-a + replay) e `git status` in `tests/gptour-semantic/u2/schema_replay/evidence/GIT_STATUS.txt`; impronte SHA-256 dei 40 file U1/v7 versionati in `evidence/U1_V7_BASE.sha256` (riferimento: commit `259ec92d`, non copiati nell'archivio).

`tests/gptour-semantic/u2/schema_replay/`: `gen_baseline.py`, `replay_set.txt`, `local_env.sql`, `views_shim.sql`, `fixture.sql`, `replay_common.py`, `replay_up.py/.sh`, `replay_verify.py/.sh`, `replay_down.py/.sh`, `evidence/{replay_report.json, verify_report.json, console_summary.txt}`; `docs/gptour-semantic/U2_0_SCHEMA_REPLAY_REPORT.md` (questo documento).

## 8. Comandi ripetibili (solo percorsi locali; nessun segreto)

```bash
export U2_PG_BIN=/usr/lib/postgresql/15/bin U2_PG_OS_USER=postgres
export U2_POSTGREST_BIN=/opt/voom-u2/bin/postgrest U2_REPLAY_ROOT=/tmp/voom-u2-replay
# prerequisito ambiente (fuori repository): pacchetti postgresql-15-postgis-3 (+scripts) installati nel pod
bash tests/gptour-semantic/u2/schema_replay/replay_up.sh       # stack completo su cluster nuovo
bash tests/gptour-semantic/u2/schema_replay/replay_verify.sh   # 111 controlli SQL/RLS/HTTP
U2_REPLAY_KEEP=1 bash tests/gptour-semantic/u2/schema_replay/replay_down.sh && bash tests/gptour-semantic/u2/schema_replay/replay_up.sh && bash tests/gptour-semantic/u2/schema_replay/replay_verify.sh
bash tests/gptour-semantic/run_all.sh                           # U1 232
U2_DENO_BIN=/opt/deno/deno bash tests/gptour-semantic/u2/run_contract.sh   # U2 409 Node+Deno
bash tests/gptour-semantic/u2/schema_replay/replay_down.sh     # rimozione dati effimeri
```

**Arresto del lavoro.** U2-0 è completata nel perimetro autorizzato. U2-b (persistenza/RPC), estrazione planner, filtri commerciali, Edge, client e qualsiasi accesso remoto restano non autorizzati.
