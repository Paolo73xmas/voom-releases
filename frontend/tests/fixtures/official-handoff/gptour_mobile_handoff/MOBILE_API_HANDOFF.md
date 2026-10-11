# GPTour Orchestrator — API HANDOFF per l'app MOBILE (Android/iOS)

Documento **autonomo**: contiene tutto ciò che serve a integrare il servizio senza accesso al repository web. Versione 2026-10-11 (Fase 5 WEB).

| Voce | Valore |
|---|---|
| Servizio | Supabase Edge Function `gptour-orchestrator` (progetto principale VOOM/888AGENTI) |
| Endpoint | `POST https://gorwxfzzyzxmxnizmebw.supabase.co/functions/v1/gptour-orchestrator` |
| Versione pubblicata | dashboard **v6**, `engineVersion` = `gptour-orchestrator/0.2.0`, **`contractVersion` = `1.0`** |
| Verifica | sorgente pubblicato (v6) confrontato in sola lettura con il contratto qui riportato: identico (contract.ts, handler.ts, agenda.ts 100% righe) |
| Stato | **pilota**: allowlist server-side (oggi admin1 e Salvatore Pirone). Collaudo web end-to-end superato l'11/10/2026 (37 verifiche live) |

Il **motore server decide tutto**: interpretazione della richiesta (regole deterministiche + AI solo in fallback), criteri commerciali, selezione clienti/nuovi punti, perimetro territoriale, agenda (follow-up/appuntamenti), date e orari (Europe/Rome), routing OSRM, fattibilità. Il client fa **solo**: conversazione, domande/opzioni, decisioni follow-up, visualizzazione del piano **così com'è**, conferma esplicita (lato client). Nessun ricalcolo di tappe, ordine, orari, km o tempi nel client.

---

## 1. Autenticazione, ruoli, allowlist

- Header obbligatori: `Authorization: Bearer <access_token Supabase dell'utente loggato>`, `apikey: <anon key del progetto>`, `Content-Type: application/json`. **Mai** `service_role` nel client.
- L'identità (uid, ruolo) è derivata dal JWT. Campi `role`, `agentId`, `tenantId`, `isAdmin` nel payload → **400** `campo … non ammesso nel payload: identità dall'autenticazione` (verificato live).
- Ruoli ammessi dal motore: `admin`, `admincustom` (possono pianificare per un agente con `targetAgentId`), `agent`, `agentcustom` (solo il proprio giro: **non** inviare `targetAgentId`, altrimenti `blocked/forbidden_agent`). Altri ruoli → `blocked/forbidden_role`.
- Allowlist pilota per UUID `auth.users` (solo server, secret `GPTOUR_ORCHESTRATOR_ALLOWED_UIDS`). Fuori lista → **403** `{"status":"blocked","errorCode":"pilot_not_enabled","error":"GPTour Orchestrator in collaudo: utente non abilitato al pilota","engineVersion":"gptour-orchestrator/0.2.0"}` — nessuna lettura CRM, nessuna sessione. Flag spento → **503** `{"error":"gptour-orchestrator non attivo (fase di collaudo isolato)"}`. Token assente/non valido → **401**.
- **Sonda senza creare sessioni** (usarla per mostrare/nascondere la modalità Orchestrator): inviare `{"contractVersion":"1.0"}` → `400` = utente abilitato, `403` = non abilitato (mostrare solo il GPTour esistente), `503` = servizio disattivato. Non interpretare mai l'allowlist lato client.
- Le letture CRM avvengono con il JWT dell'utente e le RLS reali; le sessioni sono owner-only (`sessionId` di un altro utente → **403 `forbidden_session`**).

## 2. Sessioni, revisioni, idempotenza (ciclo di vita)

- `sessionId`: generato dal client (≤128 char; es. `mob-<uid8>-<timestamp36>-<rand>`), **uno per conversazione per utente+agente**. Cambio agente, cambio utente o logout → **nuovo** sessionId; mai riusare quello di un altro utente/agente (`blocked/agent_mismatch` se la sessione era legata a un altro agente).
- `requestId`: **nuovo per ogni nuova azione/messaggio**; **lo stesso** nei retry della medesima richiesta (timeout/rete/5xx): il server restituisce la **risposta memorizzata identica** (stesso `requestId`, `sessionRevision`, `planId`) senza eseguire un nuovo turno (verificato live).
- `expectedRevision` (consigliato): ultimo `sessionRevision` ricevuto. Prima richiesta di una sessione nuova: `0` oppure omesso. Se la sessione è avanzata altrove → **409** `{"status":"failed","errorCode":"revision_conflict","sessionRevision":<rev server>,"message":"Revisione non aggiornata (attesa N)."}`: allineare la revisione a `sessionRevision`, mostrare lo stato, e ripetere l'azione con **nuovo** requestId (non ritentare quello vecchio). Attenzione: un `sessionId` mai usato con `expectedRevision>0` → 409 con `sessionRevision: 0`.
- Il server **non espone la cronologia**: il client conserva localmente il transcript (es. AsyncStorage con chiave `uid:agentId`, da cancellare al logout) e può recuperare l'ultimo piano con `action.get_plan {planId}` (nessuna rigenerazione, nessun nuovo turno pianificato; `failed/plan_not_found` se il piano non è della sessione).
- `action.reset` azzera i criteri della sessione (nuovo turno, revisione +1).
- Ogni turno applicativo incrementa `sessionRevision` di 1 (anche `infeasible`, `failed/routing_unavailable`).

## 3. Contratto TypeScript (copia esportabile, nessun import)

```ts
export const GPTOUR_CONTRACT_VERSION = '1.0';

export interface GeoPoint { lat: number; lng: number; label?: string }

export type StructuredAction =
  | { type: 'answer'; questionId: string; optionId: string; value?: string }   // risposta a question.options
  | { type: 'set_date'; date: string }                                         // YYYY-MM-DD (Europe/Rome)
  | { type: 'set_start_time'; time: string }                                   // HH:MM
  | { type: 'follow_up_decision'; followUpId: string; decision: 'include' | 'exclude' | 'propose_reschedule'; proposedDate?: string }
  | { type: 'require_stop'; key: string }                                      // key di PlanStop / candidato (cust:<id>, tab:<id>)
  | { type: 'exclude_stop'; key: string }
  | { type: 'get_plan'; planId: string }
  | { type: 'reset' };

export interface OrchestratorRequest {
  contractVersion: string; sessionId: string; requestId: string; expectedRevision?: number;
  message?: string; action?: StructuredAction; targetAgentId?: string;        // serve message OPPURE action; message ≤ 2000 char
  departure?: GeoPoint; gps?: { lat: number; lng: number; accuracyM: number; capturedAt: string };
}

export type ResponseStatus = 'needs_clarification' | 'planning' | 'ready' | 'infeasible' | 'blocked' | 'failed';
export type QuestionKind = 'inactive_days' | 'area' | 'date' | 'non_working_day' | 'past_time' | 'day_over' | 'follow_ups' | 'stale_draft' | 'infeasible' | 'free_text';
export interface QuestionOption { id: string; label: string }
export interface Question { id: string; kind: QuestionKind; text: string; options: QuestionOption[] }

export interface CommercialGroups { version: 1; existing: boolean; newPoints: boolean; ownOnly: boolean; inactiveDays: number | null; needsDays: boolean }
export interface RequestedArea { comuni: string[]; provincia: string | null; exhaustive: boolean }
export interface NormalizedCriteria {
  groups: CommercialGroups | null; area: RequestedArea | null; date: string | null; dateAnchorTurn: number | null;
  startTime: string | null; endTime: string | null; wantAll: boolean; nonWorkingConfirmed: boolean; maxDays: number | null; extraDaysApproved: boolean;
  requiredKeys: string[]; requiredNames: string[]; excludedNames: string[]; excludedKeys: string[]; consents: string[];
}

export type StopRole = 'suggested' | 'required_by_agent' | 'appointment' | 'follow_up_confirmed';
export interface PlanStop {
  key: string; name: string; city: string; lat: number; lng: number; role: StopRole; group: 'existing' | 'new';
  arrivalMin: number; departureMin: number; travelMinFromPrev: number; travelKmFromPrev: number; waitMin: number; visitMin: number;
  lunchBeforeMin: number; reason: string; lastOrderDate: string | null; daysSinceOrder: number | null; outsideWindow: boolean;
}
export interface PlanTotals { driveMin: number; visitMin: number; waitMin: number; breakMin: number; returnMin: number; totalMin: number; availableMin: number; bufferMin: number; totalKm: number }
/** geometry: coppie [lat, lng] nell'ordine di percorrenza partenza → tappe → rientro (già convertite dal motore da OSRM [lng, lat]). */
export interface DayPlan {
  day: number; date: string; startMin: number; finishMin: number; endMin: number; departure: GeoPoint; returnTo: GeoPoint | null;
  stops: PlanStop[]; totals: PlanTotals; geometry: [number, number][]; startsFrom: 'home' | 'previous_day_end';
  returnHomeAfterDay: boolean; nightKmHome: number | null; nightDecision: 'last_day' | 'threshold' | 'global' | 'routing_unknown'; warnings: string[]; conflicts: string[];
}
export interface Plan {
  planId: string; sessionId: string; sessionRevision: number; engineVersion: string; contractVersion: string; generatedAt: string;
  date: string; startMin: number; finishMin: number; endMin: number; departure: GeoPoint; returnTo: GeoPoint | null;
  stops: PlanStop[]; totals: PlanTotals; geometry: [number, number][];
  verification: 'verified_routing' | 'estimated_routing'; snapshotRef: string;
  selectionReasons: { selected: Array<{ key: string; reason: string }>; excluded: Array<{ key: string; name: string; reason: string }> };
  warnings: string[]; dependsOnPendingChanges: string[]; days?: DayPlan[];
}
export interface DataQuality { candidatesComplete: boolean; poolTruncated: boolean; purchasesVerified: boolean; registryVerified: boolean; routingSource: 'osrm' | 'estimate' | 'none'; notes: string[] }
export interface Metrics { durationMs: number; crmQueries: number; aiCalls: number; routingCalls: number; aiPromptTokens?: number; aiCompletionTokens?: number; aiMs?: number; aiFailures?: number }

export interface OrchestratorResponse {
  status: ResponseStatus; contractVersion: string; engineVersion: string; sessionId: string; sessionRevision: number; requestId: string; generatedAt: string;
  message: string; question: Question | null; criteria: NormalizedCriteria; pendingDecisions: string[]; plan: Plan | null; planId: string | null;
  conflicts: string[]; dataQuality: DataQuality; metrics: Metrics; errorCode?: string;
}

/** Minuti dalla mezzanotte (Europe/Rome, già applicato dal motore) → "HH:MM". */
export const minToHHMM = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;
```

Validazione server (400 con `{"error": "..."}`): `contractVersion` ≠ `1.0`; `sessionId`/`requestId` assenti o >128 char; `expectedRevision` negativa; né `message` né `action`; `message` > 2000 char; `action.type` sconosciuta; `departure`/`gps` con lat/lng non validi; campi identità nel payload; JSON malformato.

## 4. Stati, codici HTTP, errorCode

| `status` | HTTP | `errorCode` possibili | Cosa fare nel client |
|---|---|---|---|
| `needs_clarification` | 200 | — | mostrare `question.text` + pulsanti `options` → `action.answer {questionId, optionId}`; **oppure** risposta libera in `message` ("domani", "30 giorni", "includili") |
| `planning` | 200 | — | `plan` presente ma con `verification='estimated_routing'` (OSRM non disponibile): mostrare come **bozza con tempi stimati**, non "verificato", nessuna conferma |
| `ready` | 200 | — | `plan` definitivo con `verification='verified_routing'` (percorso OSRM): mostrare e consentire la conferma esplicita |
| `infeasible` | 200 | — | nessun piano; `message` spiega (orario/criteri); `question` può proporre alternative (`kind='infeasible'`) |
| `blocked` | 403 | `pilot_not_enabled` (gateway, corpo ridotto), `forbidden_role`, `forbidden_agent`, `forbidden_session`, `agent_mismatch`, `agent_settings_unavailable`, `territory_unavailable` | spiegare, proporre il GPTour esistente come fallback; nessun piano |
| `failed` | 422 | `routing_unavailable`, `plan_not_found` | messaggio di errore, nessun piano; ritentare più tardi (con **nuovo** requestId se si vuole un nuovo turno) |
| `failed` | **409** | `revision_conflict` | allineare `sessionRevision`, ripetere l'azione con nuovo requestId |
| — | 400 | `{"error": "..."}` | errore di contratto/payload (bug client) |
| — | 401 | `{"error": "token mancante" / "token non valido"}` | rinnovare la sessione Supabase |
| — | 500 | `{"status":"failed","error":"errore interno orchestratore","detail":"..."}` | errore transitorio: ritentare con **lo stesso** requestId |
| — | 503 | `{"error": "gptour-orchestrator non attivo ..."}` | servizio disattivato: fallback al GPTour esistente |

Il corpo 403 `pilot_not_enabled` **non** ha tutti i campi del contratto (`criteria`, `metrics`, … assenti): il client deve tollerarlo (la web app normalizza con valori vuoti). Tutti gli altri `blocked`/`failed` hanno il corpo completo.

## 5. Domande e decisioni sui follow-up

- Ordine tipico: `inactive_days` ("da quanti giorni inattivi?", opzioni `15`/`20`/`30`) → `area` → `date` (opzioni `YYYY-MM-DD` + `other`) → (`non_working_day` | `past_time` | `day_over`) → `follow_ups` → piano. Ogni risposta è un turno (revisione +1).
- `follow_ups`: `question.id = "followups:<eventId1>,<eventId2>,…"`; testo con una riga per impegno `• <nome> — follow-up|appuntamento del <data> [(arretrato)] [ore HH:MM]`; `options` = `include_all` / `exclude_all` / `propose_reschedule`.
  - Decisione aggregata: `action.answer {questionId, optionId:'include_all'}` (o `message` "includili").
  - Decisione singola: `action.follow_up_decision {followUpId:<eventId>, decision:'include'|'exclude'|'propose_reschedule', proposedDate?}`; il server **ripropone la domanda** con i soli impegni ancora indecisi finché ne restano (la web app mostra i pulsanti Includi/Escludi/Riprogramma per riga, ricavando id e nomi da `question.id` e dalle righe `• `).
  - Le decisioni **non scrivono nel CRM** (follow-up/appuntamenti invariati); `pendingDecisions` può contenere `reschedule_proposals_not_applied`.
- Follow-up arretrati **fuori dall'area del giro**: non inseriti e senza tempo riservato; avviso in `plan.warnings` (mostrarlo sempre, non mascherarlo).
- `stale_draft`: la bozza precedente non è più valida (data/ora superata) → rispondere con le opzioni proposte.

## 6. Mappe, coordinate, orari, multi-giorno

- `plan.geometry` / `days[i].geometry`: array di coppie **`[lat, lng]`** nell'ordine di percorrenza partenza → tappe (ordine di `stops`) → rientro. Per react-native-maps: `{ latitude: g[0], longitude: g[1] }`. Nel collaudo reale: 2.704 punti, tutti in Italia (lat 45.x, lng 9.x). Se la geometria è vuota, tracciare la spezzata partenza → stops → returnTo.
- `stops[i].lat/lng`, `departure`, `returnTo`: `GeoPoint`. Marker numerati 1..N nell'ordine di `stops` (è l'ordine di visita).
- Orari in **minuti dalla mezzanotte Europe/Rome** (`arrivalMin` 432 → 07:12); date `YYYY-MM-DD`. Mostrare: partenza `startMin`, per tappa `arrivalMin–departureMin`, `travelMinFromPrev`/`travelKmFromPrev`, `visitMin`, `waitMin`, `lunchBeforeMin`, fine `finishMin`, limite `endMin`, totali (`totalKm`, `driveMin`+`returnMin`, `visitMin`, `waitMin`, `breakMin`, `bufferMin`), `role`/`group`/`outsideWindow`, `reason`, `lastOrderDate`/`daysSinceOrder`.
- `verification`: `verified_routing` → "percorso verificato (OSRM)"; `estimated_routing` → "tempi stimati, routing non disponibile" (mai "verificato"). `dataQuality.routingSource` coerente (`osrm`/`estimate`).
- Multi-giorno: se `plan.days` ha ≥ 2 elementi usare `days[]` (il livello superiore riflette il giorno 1); `startsFrom='previous_day_end'` = si riparte da dove si è finito; `returnHomeAfterDay=false` = pernottamento (`nightKmHome` = distanza da casa); `warnings`/`conflicts` per giornata.
- `plan.selectionReasons.excluded` (può essere lungo, es. 672 voci): mostrare su richiesta con `reason` (es. "fuori dal territorio autorizzato").

## 7. Esempi reali (anonimizzati, collaudo 11/10/2026, Edge v6)

**Turno 1 — richiesta**
```json
{"contractVersion":"1.0","sessionId":"mob-83ca397d-m1x2y3-ab12cd","requestId":"req-m1x2y3-0001","expectedRevision":0,"targetAgentId":"<uuid agente>",
 "message":"Organizzami un giro per domani a Milano, visitando clienti esistenti e nuove tabaccherie mai visitate."}
```
(`targetAgentId` solo se chi chiama è admin; un agente lo omette.)

**Turno 1 — risposta 200** (`needs_clarification`, 2,2–3,1 s, `aiCalls: 0`)
```json
{"status":"needs_clarification","contractVersion":"1.0","engineVersion":"gptour-orchestrator/0.2.0","sessionId":"mob-83ca397d-m1x2y3-ab12cd","sessionRevision":1,"requestId":"req-m1x2y3-0001","generatedAt":"2026-10-11T19:17:00.000Z",
 "message":"Per lunedì 12 ottobre 2026 risultano impegni da decidere: …",
 "question":{"id":"followups:<uuid-evento-1>,<uuid-evento-2>","kind":"follow_ups",
   "text":"Per lunedì 12 ottobre 2026 risultano impegni da decidere:\n• «Cliente A» — follow-up del venerdì 9 ottobre 2026 (arretrato) ore 11:00\n• «Cliente B» — follow-up del venerdì 9 ottobre 2026 (arretrato) ore 16:00\nLi includo nel giro, li lascio fuori, oppure propongo una nuova data?",
   "options":[{"id":"include_all","label":"Includili tutti"},{"id":"exclude_all","label":"Lasciali fuori dal giro"},{"id":"propose_reschedule","label":"Proponi una riprogrammazione"}]},
 "criteria":{"groups":{"version":1,"existing":true,"newPoints":true,"ownOnly":false,"inactiveDays":null,"needsDays":false},"area":{"comuni":["MILANO"],"provincia":null,"exhaustive":false},"date":"2026-10-12","dateAnchorTurn":1,"startTime":null,"endTime":null,"wantAll":false,"nonWorkingConfirmed":false,"maxDays":null,"extraDaysApproved":false,"requiredKeys":[],"requiredNames":[],"excludedNames":[],"excludedKeys":[],"consents":[]},
 "pendingDecisions":[],"plan":null,"planId":null,"conflicts":[],
 "dataQuality":{"candidatesComplete":true,"poolTruncated":false,"purchasesVerified":true,"registryVerified":true,"routingSource":"none","notes":[]},
 "metrics":{"durationMs":2224,"crmQueries":6,"aiCalls":0,"routingCalls":0}}
```

**Turno 2 — richiesta** (opzione aggregata)
```json
{"contractVersion":"1.0","sessionId":"mob-83ca397d-m1x2y3-ab12cd","requestId":"req-m1x2y3-0002","expectedRevision":1,"targetAgentId":"<uuid agente>",
 "action":{"type":"answer","questionId":"followups:<uuid-evento-1>,<uuid-evento-2>","optionId":"include_all"}}
```
Variante per singolo impegno: `{"type":"follow_up_decision","followUpId":"<uuid-evento-1>","decision":"exclude"}` → il server risponde di nuovo `needs_clarification` con `followups:<uuid-evento-2>` finché resta un impegno indeciso.

**Turno 2 — risposta 200** (`ready`, 3,3–4,4 s; estratto, 13 tappe)
```json
{"status":"ready","sessionRevision":2,"requestId":"req-m1x2y3-0002","planId":"<uuid piano>",
 "message":"lunedì 12 ottobre 2026 a Milano — clienti con relazione commerciale + nuovi punti mai visitati: 13 tappe, partenza 07:00, fine 15:53 (guida 113 min, visite 390 min, pause 30 min, attese 0 min).",
 "question":null,"pendingDecisions":[],
 "plan":{"planId":"<uuid piano>","sessionId":"mob-83ca397d-m1x2y3-ab12cd","sessionRevision":2,"engineVersion":"gptour-orchestrator/0.2.0","contractVersion":"1.0","generatedAt":"2026-10-11T19:17:04.000Z",
   "date":"2026-10-12","startMin":420,"finishMin":953,"endMin":1200,
   "departure":{"lat":45.348,"lng":9.164,"label":"Casa"},"returnTo":{"lat":45.348,"lng":9.164,"label":"Casa"},
   "verification":"verified_routing","snapshotRef":"<ref>",
   "stops":[
     {"key":"cust:<id>","name":"<cliente 1>","city":"MILANO","lat":45.3168,"lng":9.1389,"role":"suggested","group":"existing","arrivalMin":432,"departureMin":462,"travelMinFromPrev":11.7,"travelKmFromPrev":6.6,"waitMin":0,"visitMin":30,"lunchBeforeMin":0,"reason":"cliente con relazione commerciale","lastOrderDate":null,"daysSinceOrder":null,"outsideWindow":false},
     {"key":"cust:<id>","name":"<cliente 2>","city":"MILANO","lat":45.443,"lng":9.1795,"role":"suggested","group":"existing","arrivalMin":541,"departureMin":571,"travelMinFromPrev":19.2,"travelKmFromPrev":18.6,"waitMin":0,"visitMin":30,"lunchBeforeMin":0,"reason":"cliente con relazione commerciale","lastOrderDate":null,"daysSinceOrder":null,"outsideWindow":false},
     {"key":"tab:<id>","name":"<nuovo punto 7>","city":"MILANO","lat":45.52,"lng":9.2231,"role":"suggested","group":"new","arrivalMin":726,"departureMin":756,"travelMinFromPrev":6.4,"travelKmFromPrev":3.1,"waitMin":0,"visitMin":30,"lunchBeforeMin":0,"reason":"nuovo punto verificato nel registro","lastOrderDate":null,"daysSinceOrder":null,"outsideWindow":false},
     {"key":"tab:<id>","name":"<nuovo punto 8>","city":"MILANO","lat":45.5186,"lng":9.2211,"role":"suggested","group":"new","arrivalMin":787,"departureMin":817,"travelMinFromPrev":1.0,"travelKmFromPrev":0.3,"waitMin":0,"visitMin":30,"lunchBeforeMin":30,"reason":"nuovo punto verificato nel registro","lastOrderDate":null,"daysSinceOrder":null,"outsideWindow":false},
     {"key":"cust:<id>","name":"<cliente 13>","city":"MILANO","lat":45.5089,"lng":9.2465,"role":"suggested","group":"existing","arrivalMin":887,"departureMin":917,"travelMinFromPrev":3.3,"travelKmFromPrev":1.2,"waitMin":0,"visitMin":30,"lunchBeforeMin":0,"reason":"cliente con relazione commerciale","lastOrderDate":null,"daysSinceOrder":null,"outsideWindow":false}
   ],
   "totals":{"driveMin":77.2,"visitMin":390,"waitMin":0,"breakMin":30,"returnMin":35.6,"totalMin":532.8,"availableMin":780,"bufferMin":247.2,"totalKm":79.7},
   "geometry":[[45.348,9.164],[45.3479,9.1642],"… 2704 coppie [lat,lng] …",[45.348,9.164]],
   "selectionReasons":{"selected":[{"key":"cust:<id>","reason":"cliente con relazione commerciale"},"…"],"excluded":[{"key":"tab:<id>","name":"<punto>","reason":"fuori dal territorio autorizzato"},"… 672 voci"]},
   "warnings":["follow-up arretrato «Cliente A» fuori dall'area del giro: non inserito nel percorso, resta da pianificare separatamente (nessun tempo riservato)","follow-up arretrato «Cliente B» fuori dall'area del giro: non inserito nel percorso, resta da pianificare separatamente (nessun tempo riservato)"],
   "dependsOnPendingChanges":[]},
 "conflicts":[],"dataQuality":{"candidatesComplete":true,"poolTruncated":false,"purchasesVerified":true,"registryVerified":true,"routingSource":"osrm","notes":[]},
 "metrics":{"durationMs":3275,"crmQueries":7,"aiCalls":0,"routingCalls":2}}
```
Turno 3 reale: `message: "Parto alle 8"` → `ready`, `sessionRevision: 3`, stesse 13 tappe, `startMin: 480`, fine 16:53 (il server ricalcola; il client mostra).

**Altre risposte reali**
- Stesso `requestId` del turno 2 reinviato → **200** con corpo identico (`sessionRevision: 2`, stesso `planId`), nessun nuovo turno.
- `expectedRevision: 1` quando la sessione è a 2 → **409** `{"status":"failed","errorCode":"revision_conflict","sessionRevision":2,"message":"Revisione non aggiornata (attesa 2).", …}`.
- `Authorization: Bearer x` → **401** `{"error":"token non valido"}`.
- payload con `"role":"admin"` → **400** `{"error":"campo role non ammesso nel payload: identità dall'autenticazione","contractVersion":"1.0"}`.
- utente non in allowlist (sonda) → **403** `{"status":"blocked","errorCode":"pilot_not_enabled",…}`.
- Domanda data (altro scenario): `{"id":"date","kind":"date","text":"Per quale giorno?","options":[{"id":"2026-10-11","label":"Oggi (domenica 11 ottobre 2026)"},{"id":"2026-10-12","label":"Domani (lunedì 12 ottobre 2026)"},{"id":"other","label":"Un altro giorno"}]}`.
- Domanda giorni: `{"id":"inactive_days","kind":"inactive_days","options":[{"id":"15","label":"15 giorni"},{"id":"20","label":"20 giorni"},{"id":"30","label":"30 giorni"}]}`.

## 8. Fixture condivise web/mobile (portafoglio di collaudo: agente pilota, allowlist)

| # | Frase | Percorso atteso | Esito atteso (11/10/2026) |
|---|---|---|---|
| P1 | "Organizzami un giro per domani a Milano, visitando clienti esistenti e nuove tabaccherie mai visitate." | `follow_ups` → `ready` | **13 tappe, 79,7 km, 07:00 → 15:53**, verified_routing, 2 avvisi follow-up fuori area, 672 esclusi (legacy GPTour: 7 tappe / 103,6 km) |
| P2 | "Organizzami un giro a Rozzano e Opera con i clienti che non ordinano da almeno 20 giorni." | `date` → `follow_ups` → `ready` | 2 tappe / 9,4 km, criteri `inactiveDays: 20`, `comuni: [ROZZANO, OPERA]` (collaudo 4B/5 iniziale) |
| P3 | "Voglio visitare il maggior numero possibile di clienti inattivi, rispettando il mio orario lavorativo." | `inactive_days` → `area` → `date` → `follow_ups` → `ready` | piano completo nel limite orario (collaudo 4B) |
| P4 | frase non riconosciuta ("Pensavo di dedicare la giornata successiva…") | AI fallback (`metrics.aiCalls = 1`) → `free_text` o criteri | nessun piano inventato |
| N1 | utente fuori allowlist | — | 403 `pilot_not_enabled` (anche la sonda) |
| N2 | `contractVersion: "9.9"` | — | 400 |
| N3 | stesso `requestId` | — | risposta identica |
| N4 | `expectedRevision` obsoleta | — | 409 `revision_conflict` |
| N5 | `sessionId` di un altro utente | — | 403 `forbidden_session` |
| N6 | agente con `targetAgentId` ≠ sé | — | 403 `forbidden_agent` |

Fixture sintetiche multi-giorno/pernottamento/routing stimato: la web app le ha verificate con un mock della Edge (script `tests/gptour-orchestrator/web/V_web_ui_mock.py`, riproducibile anche per il mobile adattando i selettori): piano `planning` + `estimated_routing` → bozza non confermabile; `plan.days` (2 giornate, `returnHomeAfterDay=false` giorno 1); 422 `routing_unavailable`; 403 `agent_mismatch`; 500 → retry stesso requestId; 503 → fallback.

## 9. Checklist di conformità per il client mobile (ciò che fa la web app)

1. Sonda `{"contractVersion":"1.0"}` all'apertura della schermata: 400 → mostra "GPTour Orchestrator (pilota)" + fallback "GPTour classico"; 403/503 → solo GPTour classico. **Un solo motore per richiesta** (mai interrogare entrambi).
2. `sessionId` per `uid:agentId` conservato localmente con il transcript (TTL 24 h nella web app), cancellato al logout e con "Nuova conversazione" (`reset` locale + nuovo sessionId).
3. `requestId` nuovo per ogni invio; "Riprova" riusa lo **stesso** oggetto richiesta (solo per 5xx/rete/422); 409 → allinea revisione e chiede di ripetere (nuovo requestId); 400/401/403 non ritentabili.
4. Mostra sempre `criteria` (chip: gruppi/giorni inattivi, comuni/provincia, data, orari, inclusi/esclusi), `pendingDecisions`, `question` con pulsanti + campo libero, decisioni follow-up per riga.
5. Piano solo da `plan` del server, **senza ricalcoli**: `ready` → "percorso verificato OSRM" + conferma esplicita (solo client: nessuna scrittura CRM, nessun tour creato); `planning` → "tempi stimati", nessuna conferma; `infeasible`/`failed`/`blocked` → messaggio e nessun piano.
6. Mappa: polilinea da `geometry` `[lat,lng]`, marker numerati nell'ordine di `stops`, partenza/rientro; `days[]` per il multi-giorno.
7. Mostra integralmente `plan.warnings` e `dataQuality.notes`; `selectionReasons.excluded` su richiesta.
8. Nessun `role/agentId/isAdmin/tenantId` nel payload; `targetAgentId` solo se l'utente è admin e pianifica per un altro agente.

## 10. Limiti noti

- Pilota: allowlist server (admin1 e un agente); gli altri → 403 → l'app deve offrire il GPTour esistente.
- Perimetro = zone attive dell'agente + clienti "di progetto" sempre visitabili; clienti assegnati fuori zona esclusi ("fuori dal territorio autorizzato") — decisione prodotto aperta. Orfani/clienti di altri agenti non inclusi.
- OSRM pubblico = stima stradale senza traffico; `estimated_routing` se OSRM non risponde. `lastOrderDate`/`daysSinceOrder` possono essere `null` quando il flusso non richiede la verifica acquisti.
- Nessun salvataggio tour/conferma lato server: la "conferma" è solo client. Latenza tipica 2–4 s/turno. AI (gpt-4.1-mini) solo in fallback per frasi non riconosciute.
- Isolamento multi-azienda non certificato (nessun identificatore tenant nelle sessioni). Edge **v6** è l'unica versione di riferimento: non assumere campi non elencati qui.
