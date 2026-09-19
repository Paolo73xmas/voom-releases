# Verifica commit web → mobile — 18/09/2026

## Metodo
- Repo web: https://github.com/Paolo73xmas/voom, branch `main` (clone di consultazione `/tmp/voomweb`).
- Ultimo confronto documentato: `22cb583` (10/09). Range analizzato: `22cb583..81c5d61d` = **15 commit**, fino al 18/09.
- Analisi statica di patch, migrazioni e confronto con il codice mobile. Nessuna scrittura su Supabase, nessuna modifica applicativa in questa analisi.

## Conclusione
**Servono 2 allineamenti mobile**, entrambi dal commit `81c5d61d` (AI Tour). Un terzo punto (`9d495aa2`) è una **discrepanza di semantica dati da decidere col web**, non un fix mobile unilaterale. Gli altri 12 commit non richiedono porting.

## 1. Da allineare — `81c5d61d` (18/09) AI Tour
### a) Regola 15 giorni e appuntamenti futuri
- Web: `isRecentlyServed(c, days, forDate)` con `hasDueAppointment`: l'appuntamento/follow-up sospende la regola **solo se dovuto entro la data pianificata**. `AITour.tsx` e `week.ts` passano la data del giro/fine settimana.
- Mobile: `lib/aitour/scoring.ts:17-20` esenta qualunque `appointmentAt`/`followUpDate`/`isFollowUp`, senza data di riferimento. Chiamanti senza `forDate`: `app/ai-tour.tsx:667,784,1146,1176`, `lib/aitour/week.ts:212,220`, `lib/aitour/liveops.ts:338`.
- Effetto reale: un cliente con appuntamento fra due settimane viene riproposto ogni giorno subito dopo la visita.

### b) La visita chiude i follow-up scaduti
- Web `live.ts` `completeStop`: dopo la visita imposta `status='completed'` sugli `appointments` `appointment_type='follow_up'`, `status='scheduled'`, `appointment_date <= now` dello stesso cliente/agente.
- Mobile `lib/aitour/live.ts:237-303`: registra visita e nuovo follow-up ma **non chiude** quelli scaduti → il cliente resta "con appuntamento pendente".

## 2. Da decidere col web — `9d495aa2` (12/09) totali ordini
- La lista ordini web ora assume `orders.total_amount` = **sola merce** e mostra `Merce` + `Totale (merce + spedizione)` sommando `shipping_cost` (verifica dichiarata su 895/898 ordini storici).
- Ma il write path web `src/pages/OrderCollection.tsx:1372,1685` scrive `total_amount = itemsTotal + shippingCostWithVAT`, **come il mobile** (`app/order-collection-v2.tsx:1150`).
- Quindi per gli ordini **nuovi** (web e mobile) la spedizione risulta conteggiata due volte nella nuova colonna Totale del web. Non è un difetto introdotto dal mobile: va allineata la semantica lato web prima di toccare il mobile.
- Nota minore mobile: `app/(tabs)/orders.tsx:86` etichetta `total_amount` come "Totale" senza distinguere merce/spedizione.

## 3. Nessun intervento mobile richiesto (12 commit)
- **AI Tour Verifiche** `59a807c0`, `d83d8a24`, `ba96a957`, `23f9401c`: il mobile è già allineato — `lib/api/customer-verification.ts` invia `customer_id` nullable + `tabaccheria_id` + `subject_name` (vincolo `cvr_subject_present` rispettato); `lib/aitour/data.ts:250,296` esclude `customers.disabled` e `tabaccherie.chiusa`; la firma della RPC `ai_tour_free_tabaccherie` non cambia (`20261016`), la RPC esclude già le chiuse lato server. Il modale registro e "Segna come Chiusa" restano funzioni admin web.
- **Guardie doppio sconto Benvenuto** `19e4bbbc`, `7f070142`: il trigger agisce solo se esistono righe con `discount_percent > 0`; il mobile invia sempre `discount_percent: 0` con prezzo già netto (`order-collection-v2.tsx:1125-1130`) → trigger inerte, nessun rischio di riscrittura dei totali.
- **Foto assegni multiple / OCR** `966cf3bc` (+ `20261017`, `20261018`): tabelle `check_photos`/`check_ocr_data` non usate dal mobile.
- **Rientri/Sostituzioni** `63035b32` (+ `20261021_returns.sql`): nuove tabelle `returns`/`return_items`, tab admin web. Il mobile usa `substitutions`/`substitution_items`, invariate. Eventuale parità mobile = nuova feature, non un allineamento.
- **Provvigioni/amministrazione** `586a49cf`, `1366e64c`, `0dd26cc2`, `d35dfbeb`, `56983d03`: moduli non presenti nell'app agente.

## Limiti
Analisi statica: non certifica lo stato delle migrazioni sul progetto Supabase in uso né il comportamento runtime su device. I test del repo web non sono stati eseguiti.

## Allineamenti implementati (18/09, autorizzati dall'utente)
- `lib/aitour/scoring.ts`: aggiunto `hasDueAppointment` e parametro `forDate` a `isRecentlyServed`/`splitRecentlyServed` (mantenuta l'esenzione per `isFollowUp`, tappa scelta esplicitamente per la giornata).
- Chiamanti aggiornati con la data di riferimento: `app/ai-tour.tsx` (giornaliero, riempitivi orfani, brief, ampliamento raggio brief), `lib/aitour/week.ts` (fine settimana), `lib/aitour/liveops.ts` (data del tour in "Più Visite").
- `lib/aitour/live.ts` `completeStop`: dopo la visita imposta `status='completed'` sugli appuntamenti `follow_up` `scheduled` con data <= adesso dello stesso cliente/agente (come il web), prima dell'inserimento del nuovo follow-up.
- Test: nuovo `frontend/tests/recent_contact_appointment.test.ts` (6 test, porting del test web) — vitest 31 test passati, suite `tests/aitour/run_suite.sh` 6 file PASS, tsc e lint puliti.
- Non implementati per scelta dell'utente: semantica `total_amount` (solo segnalata al web) e tab Rientri mobile.

## Commit web 06790e97 (18/09) — parità implementata sul mobile (autorizzata dall'utente)
- Nuovi: `lib/aitour/brief-consistency.ts` (validatore contraddizioni + `briefClarifications` + `pendingUnresolvedEntities`), `lib/aitour/brief-summary.ts` (`briefSummary`, `resolveBriefDate`), `lib/aitour/brief-preview.ts` (`previewBriefCandidates`).
- Nuovi componenti RN: `components/aitour/brief/BriefIssues.tsx` (fix a un tocco, target 44px) e `components/aitour/brief/BriefPreviewBox.tsx`.
- `components/aitour/BriefModal.tsx`: riassunto CRM "Ho capito così:", contraddizioni e domande con correzione immediata, anteprima candidati con debounce 350 ms e pool riusato, generazione disabilitata con contraddizioni/domande aperte, invio di `summary` rigenerato + `modelSummary`.
- `lib/aitour/brief-review.ts`: usa `pendingUnresolvedEntities` (le entità già collocate non bloccano più la generazione).
- `app/ai-tour.tsx`: guardia contraddizioni prima della generazione e data del giro da `resolveBriefDate`.
- `lib/aitour/brief-v4.ts`: campo `modelSummary`.
- Test: nuovo `frontend/tests/brief_consistency.test.ts` (15 test, porting del test web) — vitest 46 test/7 file PASS, suite AI Tour 6/6 PASS, tsc e lint puliti. Iteration 43: smoke UI del modale OK, nessun tour generato.

## Commit web e2275d4c (19/09) — verificato e allineato
- Web: `loadCandidates` include i prospect tra gli orfani propri e deduplica per punto vendita; nuovo `dedupeSamePlace` nel planner.
- Mobile: `lib/aitour/data.ts` era già allineato (prospect negli orfani propri + `notInOrphans` per customer/tabaccheria). Mancava la rete di sicurezza del planner: portato `dedupeSamePlace` in `lib/aitour/planner.ts` e applicato a `input.candidates` in `planTour`.
- Test: nuovo `frontend/tests/planner_dedupe_same_place.test.ts` (4 test, porting del test web).

## Extra richiesto dall'utente: "Esclusi recuperabili" (non presente nel web)
- `components/aitour/brief/BriefPreviewBox.tsx`: nell'elenco degli esclusi dai 15 giorni ogni cliente con scheda ha il pulsante "Includi" (target 44px); per i soggetti senza scheda resta l'indicazione di nominarli nella richiesta.
- `components/aitour/BriefModal.tsx`: `includeExcluded` aggiunge il soggetto come tappa nominata obbligatoria (priorità 2) se non già presente; l'anteprima si ricalcola e la tappa è rimovibile dai chip.
- Test: caso aggiunto in `tests/brief_consistency.test.ts` (escluso nominato → esce da recentlyExcluded, named +1).
- Iteration 44: vitest 8 file/51 test PASS, suite AI Tour 6/6, UI verificata (esclusi 6→5, nominati +1, nessun doppione), nessun tour generato.
