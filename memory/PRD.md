# VOOM Sales Mobile App - PRD

## Overview
Mobile CRM application for field sales agents managing tobacco shops (tabaccherie) in Italy. Converted from existing web application at https://github.com/Paolo73xmas/voom

## Target User
- **Role**: Field Sales Agent
- **Primary Use**: On-the-go customer management, visits, orders, and inspections

## Core Features Implemented

### 1. Authentication (Supabase)
- Email/password login
- Session persistence
- Profile-based role access

### 2. Mappa Punti Vendita (Map View)
- List of tobacco shops with status indicators
- Search functionality
- Color-coded status (Non Visitato/Visitato/Ordinato)
- Shop details modal

### 3. Clienti (Customers)
- Customer list with search
- Filter by category (Tutti/Clienti/Prospect)
- Customer detail view with:
  - Contact info (call, email, navigation)
  - Address details
  - Fiscal data (P.IVA, C.F., PEC, SDI)
  - Visit history dates

### 4. Ordini (Orders)
- Order list with status badges
- Order detail view with:
  - Customer info
  - Product line items
  - Total amounts
  - Shipping info

### 5. Visite (Visits)
- Create new visit with GPS location
- Visit types: Prima Visita, Follow-up, Consegna, Altro
- Outcome tracking: Positivo, Neutrale, Negativo
- Notes field

### 6. Ispezioni (Inspections)
- Create inspection with GPS location
- Photo capture/selection
- Notes field
- Customer selection

### 7. Dashboard
- Stats overview (Clienti, Ordini, Visite, In Attesa)
- Quick actions
- Recent activity placeholder

### 8. Profile
- User info display
- Role badge
- Logout functionality

## Tech Stack
- **Frontend**: Expo (React Native)
- **Navigation**: Expo Router (file-based)
- **State**: Zustand with persist
- **Backend**: Supabase (Auth + PostgreSQL)
- **UI**: Custom components with StyleSheet

## Database Connection
- **Supabase URL**: https://gorwxfzzyzxmxnizmebw.supabase.co
- **Tables Used**: profiles, customers, tabaccherie, visits, orders, order_items, inspections

## Permissions Required
- iOS: Location, Camera, Photo Library
- Android: ACCESS_FINE_LOCATION, CAMERA, STORAGE

## File Structure
```
/app/frontend/
├── app/
│   ├── _layout.tsx          # Root layout
│   ├── index.tsx            # Splash screen
│   ├── login.tsx            # Login screen
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab navigator
│   │   ├── index.tsx        # Dashboard
│   │   ├── map.tsx          # Map view
│   │   ├── customers.tsx    # Customers list
│   │   ├── orders.tsx       # Orders list
│   │   └── profile.tsx      # Profile
│   ├── customer/[id].tsx    # Customer detail
│   ├── order/[id].tsx       # Order detail
│   ├── visit/new.tsx        # New visit form
│   └── inspection/new.tsx   # New inspection form
├── lib/
│   ├── supabase.ts          # Supabase client
│   └── api/
│       ├── customers.ts     # Customer API
│       ├── orders.ts        # Orders API
│       ├── visits.ts        # Visits API
│       ├── tabaccherie.ts   # Tabaccherie API
│       └── inspections.ts   # Inspections API
├── store/
│   └── authStore.ts         # Auth state
└── types/
    └── index.ts             # TypeScript types
```

## Environment Variables
```
EXPO_PUBLIC_SUPABASE_URL=https://gorwxfzzyzxmxnizmebw.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_... (nuova publishable key, lug 2026 — la legacy anon key eyJ... è DISABILITATA lato Supabase e non va mai ripristinata; mai usare chiavi sb_secret_ nel client)
```

## Known Issues
- Preview environment tunnel (ngrok) has intermittent connectivity issues
- rottamazione_config table may not exist in Supabase (handled gracefully with defaults)

## Recently Fixed
- Auth session persistence: SSR-safe storage adapter using AsyncStorage (mobile) + localStorage (web)
- Product interface: Added missing cashback_eligible and estero fields
- Order Collection wizard: Verified compilation and rendering of CashBack, Rottamazione, Accisa, IVA features
- Package (Pacchetto) modal with pricing bug fix (nullish coalescing)
- Rottamazione/CashBack price application on order submission
- Map rewrite using react-native-webview (mobile) + DOM Leaflet (web)
- 40km radius boundary filtering for tabaccherie
- Admin marker color visibility (real colors vs gray for agents)
- Map -> Order Collection navigation with customer pre-selection
- **Anagrafica (First Visit)**: Complete 3-step wizard with photo/GPS, form with search, summary/review, Supabase submission
- **MPVP Unified Search Bar (web parity)**: Barra ricerca unificata sulla mappa — fuzzy search clienti (tabaccherie: denominazione, indirizzo, comune, P.IVA, cod. fiscale) + luoghi via Nominatim in un unico dropdown. Selezione cliente → zoom + apertura popup marker (con fetchTabaccheriaById se fuori bounds); selezione luogo → zoom sulla posizione. Sostituito il vecchio modal di ricerca geocoding.
- **Audit applicazione + fix (giu 2026)**: (1) Pre-selezione cliente in order-collection-v2 da Mappa→Ordine / Scheda Cliente→Ordine (params.customerId era ignorato). (2) Fix race condition idratazione auth in order-collection-v2 (fetchCustomers('') → errore uuid 22P02 su cold navigation) con guard user?.id. (3) Rimosso codice morto: funzioni inutilizzate in lib/api/tabaccherie.ts, stili search modal obsoleti, ref inutilizzati in map.tsx. Verificato da testing_agent (iteration_2).
- **PDF Preventivo Step 5 (giu 2026)**: allo Step 5 (Riepilogo) della Raccolta Ordine, card "Preventivo PDF" con pulsante "Genera PDF Preventivo" — genera PDF brandizzato (expo-print) e apre share sheet nativo (expo-sharing); su web apre dialog stampa browser. Contenuto: cliente, agente, righe prodotti con prezzi finali post-sconti (originale barrato), box sconti (Rottamazione/CashBack/Sconto Benvenuto), totali, note, disclaimer validità 7gg. Logica prezzi estratta in computeFinalItemsAndTotal() condivisa con handleSubmitOrder (nessuna regressione — ordine test creato con totale corretto €13.54). File: lib/pdf/order-quote.ts. Verificato da testing_agent (iteration_4, PASSED).
- **Fix identità app iOS (giu 2026)**: bundleIdentifier corretto in `app.emergent.voomioscdc30962` (ID Apple 6764538786 = app esistente "VOOM crm" su App Store Connect), version 3.0.1, buildNumber 1, name "VOOM crm", ascAppId in eas.json. Prima le build creavano un'app nuova ("VOOM Sales iOS") perché il bundle ID era com.voom.sales→com.voom.crm. ⚠️ NON cambiare mai più il bundleIdentifier. Verificato testing_agent (iteration_5, ALL PASS).
- **Manuale Utente PDF (giu 2026)**: manuale completo in italiano (21 pagine A4, 14 capitoli, 24 screenshot reali dell'app catturati via Playwright con utente admin) — copertina, indice, login/privacy, dashboard, mappa (legenda colori + ricerca MPVP), clienti, wizard ordine 5 passi, PDF preventivo, bozze, ordini, prodotti, calendario, menu Altro/strumenti, profilo, FAQ. Generato con /app/manual/capture.py (screenshot) + /app/manual/build_manual.py (HTML→PDF via Playwright chromium). Scaricabile da GET /api/manual (route FileResponse in backend/server.py). Per rigenerarlo dopo modifiche UI: rieseguire i due script.
- **Restyling globale "iOS-Native Clean" (giu 2026, approvato dall'utente)**: brand Terracotta #C2410C (via blu #1E40AF e viola #7C3AED non semantici), font Plus Jakarta Sans (asset locali via expo-font, chiavi Jakarta_400/500/600/700), Dashboard ridisegnata (appuntamenti orizzontali, stats 2x2, hero Venduto terracotta, azioni 2 colonne, Skeleton loaders, headerShown false + status bar dark su focus), tab bar 7→4 (Dashboard/Mappa/Clienti/Altro; orders/products/calendar/profile nascoste con href:null), nuovo menu /(tabs)/altro.tsx, wizard ordine con label "Passo X di 5" e CTA contestuali (NEXT_LABELS), login terracotta scuro (#9A3412). COLORI SEMANTICI PRESERVATI: marker mappa (parità web), blu informativo #3B82F6 (GPS/telefono/link/Visita/Spedito/Completata), viola cashback. Token design: DS + JAKARTA in lib/theme.ts; COLORS/FONTS/GRADIENTS.primary rebrandizzati. Blueprint: /app/design_guidelines.json. Verificato da testing_agent (iteration_3, PASSED, nessun fix).
- **Sconto Cartone (ago 2026, parità web)**: products.pezzi_cartone + sconto_cartone (colonne già in produzione). In order-collection-v2: a ogni variazione quantità, se qty >= pezzi_cartone il prezzo unitario riga diventa listino×(1−sconto/100) arrotondato a 4 decimali; sotto soglia torna al listino. Prezzi modificati a mano (flag manual_price su CartItem, settato dal modale se |nuovo−corrente|>0.005, o da pacchetti con prezzo custom) NON vengono MAI sovrascritti. UI: hint real-time in lista prodotti (ambra "mancano N pz" / verde "attivo"), badge verde nel riepilogo Step 5. manual_price persistito nelle bozze. Verificato testing_agent iteration_8 ALL PASS (prodotto reale MESH MINI RAGING BULL 20: 3.75€, cartone 100pz, −10%).
- **Scadenziario (giu 2026, parità web)**: nuova sezione fatture da incassare, logica portata 1:1 da src/lib/scadenze.ts della web app. Fatture TD01 non annullate con residuo = totale_documento − Σ invoice_payments > 0.01; scadenze programmate = data fattura + giorni dalla condizione di pagamento (parsing "a N" da nome+descrizione payment_methods, nessun numero → +10gg; multi-rata supportata es. "30 e 60"). Vista AGENTE: solo fatture dei propri ordini (orders.agent_id, filtraggio frontend — RLS su electronic_invoices è aperta); vista ADMIN (admin/admincustom/supervisor): tutte + nome agente per riga. UI: schermata /scadenziario (KPI Scaduto/Entro 7gg/8-30gg/Totale, Proiezione incassi con toggle Settimana/Mese e chip orizzontali con rate spalmate residuo/n.scadenze, ricerca fattura/cliente/agente, card con badge ritardo/in scadenza, storico ultimo sollecito), voce menu Altro→Strumenti, card riepilogo Dashboard (Scaduto + Da incassare, cache condivisa 120s via fetchScadenziarioCached). AZIONI SOLLECITO (scelta utente): pulsante "Chiama" (tel: al cellulare/telefono cliente) + "Fattura PDF" (copia di cortesia generata da dettaglio_linee via expo-print, share sheet nativo per inoltro WhatsApp manuale; su web dialog stampa). Dopo il PDF, insert best-effort in sollecito_log (channel whatsapp; RLS consente insert solo ad admin — per agenti fallisce in silenzio). File: lib/api/scadenziario.ts, lib/pdf/invoice-pdf.ts, app/scadenziario.tsx. Verificato testing_agent (iteration_6, ALL PASS, admin + empty state agente).

- **Fix RLS clienti (ago 2026)**: policy production su customers cambiate (agente vede propri + agent_id NULL) ma l'app filtrava .eq(agent_id) → liste vuote. fetchCustomers/searchCustomers ora .or(agent_id.eq.uid,agent_id.is.null) per agenti (conferma utente: correzione visiva, l'ordine richiede comunque la visita).
- **AI Tour MVP (ago 2026, parità web)**: nuova sezione /ai-tour (menu Altro + quick action Dashboard). Moduli web /src/lib/aitour portati 1:1 in lib/aitour (types/scoring/planner/osrm/data/tours/ai/territories/live) con import mobile, geo.ts ray-casting puro (no @turf), timeoutSignal Hermes-safe. Schermata nativa: form (data, orari stepper, tipo giornata Clienti/Sviluppo/Mista/AI, partenza GPS-indirizzo-casa-sede con permessi contestuali, rientro, area territorio/auto/provincia/comune/raggio, visite obbligatorie), pipeline identica al web (loadCandidates→scoreCandidates→recommendDayType edge fn→filterByArea/pickBestCluster→loadFreeTabaccherie→planTour OSRM→getStrategySummary), risultato con KPI/strategia AI/fermate orarie/Naviga deeplink/escluse, salvataggio ai_tours+ai_tour_stops, tab I miei Tour (view/delete). FASI SUCCESSIVE NON ANCORA PORTATE: Live tour (esiti visita), Settimana/Mensile, Heatmap, Monitoring staff, disegno territori.

- **AI Tour Fase 2+3 (ago 2026, parità web)**: LIVE TOUR (Avvia Tour dalla result view, auto-resume tour attivi, heartbeat GPS 60s per Monitoring admin + traccia percorso, card prossima visita con Navigatore/Sono arrivato/Raccolta Ordine/Ispezione con chiusura automatica tappa al ritorno via AsyncStorage aitour_external + findExternalResult, acquisizione prospect con verifica GPS 500m → Prima Visita precompilata, esito manuale 11 opzioni + note + follow-up (crea visita CRM + appuntamento), salta con 8 motivi, ricalcolo automatico del giro con rimozione tappe fuori orario, suggerimento recupero tempo, consuntivo finale con report giornata km GPS/ordini/durata) + SETTIMANA (buildWeekPlan: clienti in scadenza per cadenza, kmeans territori per giorno, capacità/trim/backfill, Genera tour del giorno) + MESE (buildMonthPlan: settimane rimanenti, spill/fillers, Pianifica questa settimana → preset auto-run). Durate apprese già attive (RPC learned_durations in generazione, alimentate da actual_duration_minutes del live). File: components/aitour/{LiveTourView,EsitoModal,SkipModal,WeekTab,MonthTab,shared}, lib/aitour/{live(getCurrentPos expo-location),report,week,month}. RESTANO NON PORTATE: Heatmap, Monitoring staff, disegno territori, mappa tour.

- **Manuale AI Tour agente (ago 2026)**: PDF operativo per gli agenti sulla sezione AI Tour mobile (10 capitoli sul modello del manuale web, 18 screenshot reali dell'app). File /app/manual/manuale-ai-tour-agente-mobile.pdf, servito da GET /api/manual-aitour. Rigenerabile con /app/manual/capture_aitour.py + build_manual_aitour.py (+ cleanup dati test con frontend/scripts/cleanup_aitour_test.mjs).

- **Mappa del tour AI in app (ago 2026)**: components/aitour/TourMapView.tsx (Leaflet WebView/iframe, percorso + marker numerati per tipo + popup con Naviga). Toggle Elenco/Mappa nel risultato del tour e "Mappa del giro" collassabile nel Tour Live (con stati ✓/✕). RESTANO NON PORTATE: Heatmap, Monitoring staff, disegno territori.

- **Allineamento commit web 16/08 (ago 2026)**: ricalcolo automatico live su ritardo >15min (watcher 60s) + suggerimenti nearby 7km; orphan map paginata (1572 orfani vs 1000 troncati); indicatore "(durata appresa)" nel Live; badge giri AI Tour pianificati sulla dashboard agente. Skip motivati: sezioni staff web-only (Monitoring, Posizioni Squadra, Heatmap, contenzioso avvocati, export RiBa, evasione controllata).
- **Allineamento commit web 16/08 sera (9b8218b + 173e349)**: fix visita CRM da esito Tour Live che falliva sempre in silenzio (check constraint su visits: visit_type 'ai_tour' e outcome raw non ammessi → ora visit_type 'follow_up' + esiti mappati positive/neutral/negative, error logging reale; verificato su DB con insert/cleanup); scelta dell'ORA del follow-up nel modale esito (chips 09:00–17:00, appuntamento in Calendario all'orario scelto, non più fisso 09:00); all'avvio del tour la tour_date viene riallineata a oggi (Monitoring/report/storici coerenti se il tour era generato per un altro giorno). Clone web a 173e349, zero delta residui.
- **Allineamento commit web 17/08 (bc19a12f + 3db8ca72 + 50afa96a)**: giornate intensive — margine di sicurezza cap a `buffer_max_min` (default 60, configurabile da Impostazioni admin web) in generazione/settimana/ricalcolo Live; intensificazione automatica del giro se restano >90 min liberi (Mai Visitate/Orfani/libere vicini alle tappe, warning "Giornata intensificata: +N visite") + warning tempo residuo non riempibile. Il fix Mai Visitate (stato_visita + anti-duplicati P.IVA) è solo-DB e arriva via RPC. ⚠️ NOTA: la nuova RPC `ai_tour_free_tabaccherie` in produzione va in statement timeout con i box reali (regressione della migration web 50afa96a, da ottimizzare lato web/DB con indice su btrim(vat_number)).
- **Mappa AI Tour a schermo intero (ago 2026)**: tasto flottante "Schermo intero" sulla mappa del giro (risultato e Tour Live) → Modal fullscreen navigabile con tasto "Riduci" sempre visibile (safe area). La RPC free_tabaccherie è stata poi ottimizzata lato web (~7x, commit 2d94c689): di nuovo veloce (0,8s).
- **Allineamento commit web 18/08 pomeriggio (59895b18 + 332305cc + f7ae423f)**: multi-zona con alias nel Genera Tour (chips zona da `agent_zones.alias`, toggle con minimo una, generazione/libere/intensificazione filtrate sulle zone selezionate, etichetta area con alias); ricerca cliente step 1 e prodotti step 2 multi-termine (ogni parola deve comparire nei campi). Skip motivati: branch_admin/combobox agente admin/inventario/WhatsApp (web-staff o solo-DB). Test: iteration_14 ALL PASS + validazione zone con account reale roberto.beretta (4 zone, tour su sola MILANO CENTRO).
- **Splash di avvio "AI TOUR" (ago 2026, mockup approvato dall'utente)**: `components/AiTourSplash.tsx` sostituisce il vecchio VoomSplash — sfondo scuro con nebulosa viola, titolo VOOM CRM + AI TOUR (viola/arancio), card "Il tuo giro di oggi" con percorso animato tappa-per-tappa, badge TOUR LIVE pulsante, KPI e 4 feature chips; fade-out e fallback anti-blocco invariati.
- **Retheme palette AI Tour + Dark mode (ago 2026)**: tema DARK stile splash (#0B0714) **di default**, tema chiaro con brand VIOLA #7C3AED selezionabile; toggle "Aspetto: Chiaro/Scuro" nel Profilo + bottone rapido sole/luna nel header della Dashboard (helper condiviso lib/themeToggle.ts). Token mutabili in lib/theme.ts (applyThemeMode, persistenza @voom_theme_mode, init sincrono localStorage su web + gate async native), riavvio soft al cambio (web reload / expo-updates su native). PDF e manuali esclusi e invariati. Testato con testing_agent (iteration_11: ALL PASS, entrambi i temi).
- **Manuale AI Tour v1.2 (18/08 sera)**: aggiornato con le novità — Cap.1 "Il nuovo look" (splash animato, palette viola, dark default, toggle Dashboard/Profilo), Cap.3 "Zone del giro" (chips alias multi-zona), Cap.6 tasto "Avvia Tour" nell'header + tip ricerca multi-parola. 6 nuovi screenshot (ai23-27 + ai26) + ricatturati ai01/ai02/ai03 in tema scuro attuale. Script: capture_novita_v12.py/v12b.py/capture_avvia_header.py/capture_recap_dark.py. PDF 24 pagine servito su /api/manual-aitour.
- **Allineamento commit web 18/08 sera (17deb4a1 + c267441b) — guardia anti-azzeramento ricalcolo live**: BUG web fixato: un esito registrato oltre end_time faceva cancellare TUTTE le tappe restanti come "fuori orario". Portate in LiveTourView.tsx le 3 guardie 1:1: (1) runRecalc no-op se nowMin() >= initial.endMin con avviso "prosegui manualmente o termina"; (2) se plan.stops.length===0 (l'AI scarterebbe tutto) nessuna cancellazione; (3) il watcher auto-ricalcolo da ritardo salta oltre fine tour. Il trigger DB `trg_ai_tour_block_recalc_wipe` (blocca cancellazioni 'Rimossa dal ricalcolo AI%' oltre fine tour, Europe/Rome) è già applicato in produzione Supabase e protegge anche i client con bundle vecchio — nessuna azione app necessaria.
- **Allineamento commit web 959ed4f6 — numerazione stabile tappe Live**: dopo un esito/salto la tappa successiva manteneva il numero sbagliato (ripartiva da 1). In LiveTourView.tsx aggiunto memo `stopNumbers` (Map id→indice+1 su tutti gli stops) usato sia per i label dei marker mappa (prima pendingIdx+1) sia per i badge della lista "VISITE RIMANENTI" (prima i+1). Parità 1:1 col web LiveTour.tsx.
- **Allineamento commit web 794ff560 — Ispezione unificata in Live**: rimosso doppio bottone (Ispezione esterna + Visita terminata) → unico bottone 'Ispezione' emerald: con scheda cliente apre EsitoModal, senza avvia acquisizione prospect (al ritorno con nextKind=inspection si apre direttamente l'esito). EsitoModal: titolo 'Ispezione', foto max 2 con Scatta (expo-image-picker, permission contract canAskAgain+Apri Impostazioni), contatti punto vendita prefillati e salvati, validazione email client. Nuova lib createTourInspection (parità web): inspections status completed + last_visit_date + upload bucket 'inspection_photos' + righe con gps/photo_order; uploadSinglePhoto con bucket param. VERIFICATO: testing_agent iteration_15 (RLS probes PASS) + e2e completo (salvataggio contatti su DB confermato). Cleanup produzione completo (cleanup_ispezione_test.mjs).
- **Allineamento commit web 18/08 notte (dbe03d5f + a4388424 + 691f0100) — Ispezione Live v2 + riassegnazione orfani**: (1) EsitoModal: 2 foto OBBLIGATORIE (conferma disabilitata + hint rosso "Scatta 2 foto…", label "obbligatorie" con ALERT_RED theme-aware); prefill contatti via RPC `ai_tour_stop_customer_contacts` (RLS-safe per clienti di altri agenti, fallback contact_phone) con initialContacts ref → onConfirm invia contatti SOLO se modificati; nuova prop stopId. (2) LiveTourView handleEsito riordinato come web: 1° riassegnazione ORFANO (GPS ≤500m → RPC `ai_tour_reassign_orphan`, dialog RN "Cliente riassegnato a te" con nome agente precedente, stato reassigned), 2° contatti, 3° foto→ispezione, 4° RPC `ai_tour_refresh_customer_status` per orphan/never/prospect (messaggio CLIENTI/PROSPECT). (3) Orfano A v2 (691f0100): la RPC get_orphan_tabaccherie_ids è già migrata in produzione (visita azzera Orfano A); allineato il solo fallback client-side di fetchOrphanMap (max(last_order, last_visit)). (4) 7b3b6219 storico riassegnazioni = staff/web-only, SKIP motivato. VERIFICATO: RPC probes production OK (scripts/test_esito_rpcs.mjs), e2e READ-ONLY su tour live reale (bottone unico, modale obbligatorie, prefill RPC con cellulare reale, conferma bloccata senza foto) SENZA scritture DB — un tour attivo di roberto era in test dal VIVO dall'utente (eventi umani 21:26) e NON è stato toccato.
- **Manuale AI Tour v1.3**: cap.6 riscritto per l'Ispezione unificata (scheda unica: esito+2 foto obbligatorie+contatti, riassegnazione orfano di persona, guardia oltre orario fine), fig nuove ai28-ispezione-esito e ai29-live-ispezione (rimosse ai08/ai09/ai10 coi bottoni vecchi); cap.4 box "Come si esce dallo stato Orfano" (visita azzera Orfano A); cap.9 +4 messaggi nuovi. PDF 23 pagine 6.5MB servito 200 su /api/manual-aitour.

- **Video tutorial AI Tour (ago 2026)**: voce narrante maschile italiana MADRELINGUA (edge-tts `it-IT-DiegoNeural`, scelta dell'utente dopo confronto campioni — la prima versione OpenAI onyx aveva accento anglofono) e UI reale in dark theme registrata via Playwright con account tadini@voomweb.it. VIDEO UNICO `aitour-tutorial-completo.mp4` (6:20, richiesto dall'utente): le 3 parti concatenate con sincronizzazione narrazione↔immagini tramite RALLENTAMENTO fluido dei segmenti (setpts, max x1.25) dove l'audio è più lungo della finestra registrata — testi riadattati senza riferimenti a "episodi" separati. Servito da GET /api/video-tutorial/completo (+ /1 /2 /3 per i singoli, /api/voice-sample/{name} per i campioni voce). Blur nome header nella parte dashboard. Rigenerabile con gen_narration.py (edge-tts) + record_video{1,2,3}.py + assemble_single.py (unico) o assemble_v2.py (singoli, freeze-frame).

- **Fix centratura mappa tour (ago 2026)**: la mappa (soprattutto a Schermo intero) non era centrata sull'intero giro — fitBounds girava solo al load, prima che il Modal avesse dimensioni definitive. TourMapView.tsx: re-fit ritardato (+300ms/+900ms) + listener resize con invalidateSize, disattivati appena l'utente interagisce (dragstart/zoomstart con flag fitting); aggiunto `zoomSnap: 0.25` per fit frazionario preciso (il tour riempie lo schermo invece di restare piccolo al centro per colpa degli zoom interi). Video 2 ri-registrato con il fix e video unico riassemblato (6:23); i 2 tour di test salvati dalle registrazioni sono stati eliminati da produzione (scripts/cleanup_video_tours.mjs).

- **Allineamento origin/main (ago 2026, commit 943c6c8 + db839da + 1d98212)**: 1) ripartizione km per ciclo (urbano/extraurbano/autostrada) da annotazioni OSRM salvata alla pianificazione (osrm.ts, planner.ts, tours.ts → colonne km_urban/km_extra/km_highway, per report Costi Operativi admin web); 2) tasto "Esci" nella vista Tour Live (il giro resta attivo) + flag di sessione anti-rientro automatico + banner "TOUR LIVE — Riprendi vista live" (LiveTourView.tsx, ai-tour.tsx) — testato E2E con tour sintetico poi rimosso; 3) ricerca Clienti estesa alla denominazione del registro tabaccherie collegato (lib/api/customers.ts), tappe orfano da registro con customer_id + riga "Scheda CRM: <nome commerciale>" nella card Prossima Visita del Live e nel popup mappa (data.ts, live.ts con lookup crmName in loadLiveState, LiveTourView, TourMapView), fix: l'esito non riclassifica più gli orfani come prospect (updateStopCustomer con guardia entityType).

- **Aggiornamento narrazione orfani (ago 2026)**: scena v3_s4 del tutorial riscritta su richiesta utente — ora spiega che con l'ispezione l'orfano passa all'agente, che l'AI non lo propone più ad altri agenti perché "ispezionato da poco", ma che per uscire dallo stato di orfano serve un acquisto. Audio Diego rigenerato con rate +8% (37.7s) per restare nel limite x1.25 di rallentamento; riassemblati video 3 e video completo (6:25).

- **Allineamento origin/main (ago 2026, commit 6052b56 + 1a83cd9 — fasce orarie visite)**: 1) `lib/visit-slots.ts` (definizioni fasce da system_settings.visit_time_slots, default 6 fasce, pranzo 11.30-14.30 strict, tolleranza ±30min) e `components/customers/VisitSlotWheel.tsx` (ruota SVG multi-selezione con react-native-svg, installato); 2) planner con vincolo fasce (windowArrival: attesa se in anticipo, esclusione se fuori fascia, penalità attesa nel greedy, 2-opt annullato se viola le fasce, warnings, excluded reason dedicata) in planner.ts + waitMin/outsideWindow su PlannedStop; 3) preferredSlots su TourCandidate (data.ts con lookup anche per orfani via crmSlots, live.ts da stop.preferred_slots, tours.ts salva preferred_slots); 4) UI: ruota nell'EsitoModal (prefill via RPC estesa, salvata su scheda se modificata), riga "Fascia visite preferita" nella card Prossima Visita del Live, badge fascia + "attesa Xm" + ⚠ fuori fascia nelle righe risultato di ai-tour.tsx, ruota nella Prima Visita (anagrafica.tsx step 2 + insert), sezione view/edit in customer/[id].tsx; 5) NUOVA schermata `app/bulk-visit-slots.tsx` (Agg. Massivo: clienti senza fascia, ricerca fuzzy, selezione multipla, ruota, salvataggio batch) con accesso da tab Clienti. Testato E2E in preview (assegnazione reale poi ripristinata). Commit d7121a0 (admin supplier orders), 19713a5 (magazzino RPC) e 6b82993: solo web/server, nessuna modifica mobile.

- **Video tutorial: capitolo Fasce Orarie (ago 2026)**: nuovo capitolo registrato (rec4, record_video4.py) inserito tra la parte 2 e il Tour Live nel video unico (ora 7:29) — scena 1: ruota nella scheda cliente (l'AI organizza l'appuntamento quando il cliente è disponibile, ±30 min, pranzo rigido); scena 2: Agg. Massivo (Seleziona tutti + ruota); chiusura: senza fascia indicata l'AI usa tutta la fascia oraria operativa. v2_s6 accorciata (rimosso "Vediamolo subito"). Anche video singolo /api/video-tutorial/4 (aitour-tutorial-4-fasce.mp4, 1:04).

- **Allineamento origin/main (ago 2026, commit 4c78503 + 2b236af + 1099ba8 — 4 fasi Live)**: 1) OPERAZIONI LIVE: bottone "Tappa" (AddStopModal: ricerca cliente/prospect/orfano, posizionamento "adesso"/"dopo la tappa X", persistenza added_live + ricalcolo percorso) e bottone "Ordine" (ReorderStopsModal: frecce su/giù con testID, evento manual_reorder + ricalcolo geometria) — lib/aitour/liveops.ts; 2) RIPASSO IN GIORNATA: nel SkipModal chips orario ripasso (testID) → tappa mantenuta con badge ripasso + evento revisit_scheduled {ora, ragione}; 3) PAUSA PRANZO: bottone "Pausa Pranzo" con countdown (minuti da ai_tour_settings.lunch_break_minutes, default 30), ricalcolo alla ripresa, lunch_break_start/end su ai_tours + eventi lunch_break_started/ended — mini-E2E conferma tour resta active dopo pausa/ripresa; 4) STAMINA AGENTE: chip stamina in Live View (OwnStaminaChip + lib/aitour/contribution.ts, RPC self-only agent_own_stamina, visibile solo se admin attiva stamina_visible, refresh 2 min, colori 80+/50+/rosso); 5) GIORNI ESCLUSI: customers.excluded_visit_days + ExcludedDaysPicker (scheda cliente, anagrafica, bulk). Commit solo admin/staff (replay giro admin, trasferimento zone, trigger DB) skippati con motivazione. VERIFICATO: E2E completo (e2e_live_ops.py, 7 step OK) + verifica eventi/colonne su DB + schema produzione (verify_phase_schema.mjs). CLEANUP COMPLETO: tour sintetici eliminati, record stamina di prova rimosso (agent_own_stamina → visible:false, stato originale). ⚠️ Un evento `finished` inatteso era comparso SOLO nell'E2E completo (probabile interazione automatica del test); il mini-E2E pausa non lo riproduce — da osservare in QA utente.

- **Video tutorial: capitolo Operazioni Live (ago 2026)**: nuovo capitolo 5 registrato (rec5, record_video5.py con tour sintetico poi eliminato) e inserito nel video unico DOPO il capitolo Tour Live (ora 9:18) — 5 scene: i 3 bottoni Pausa Pranzo/Tappa/Ordine, riordino tappe con frecce + conferma, ripasso in giornata (motivo+orario+badge), aggiunta tappa (ricerca + Falla ORA), pausa pranzo (countdown + Riprendi ora + regola una volta al giorno, chiude con "Buone vendite con AI Tour!"). La scena v3_s7 (Termina) riscritta senza il saluto finale, con transizione "le novità non finiscono qui" (rallenta x1.196, entro il limite x1.25). Anche video singolo /api/video-tutorial/5 (aitour-tutorial-5-liveops.mp4, 1:45, zero freeze). Voce Diego (edge-tts). QA frame + volumedetect OK, endpoint 5 e completo HTTP 200.

- **Fix download video tutorial (ago 2026)**: l'endpoint /api/video-tutorial/{num} ignorava l'header Range (Safari/iOS lo esige per i video: bytes=0-1 → 206) e rispondeva 405 alle HEAD. Riscritto in server.py: supporto HEAD (200 + Content-Length), Range parziali/aperti (206 + Content-Range, streaming a chunk 512KB, 416 se fuori misura), Accept-Ranges: bytes anche sul GET pieno. Verificato: GET 200 completo, HEAD 200, bytes=0-1 → 206, range aperto → 206 con resume.

- **Fix tastiera su ricerca "Visite obbligatorie" (ago 2026)**: la tastiera copriva input e risultati nel form AI Tour. Installato react-native-keyboard-controller@1.18.5 (incluso in Expo Go per SDK 54), KeyboardProvider nel root _layout.tsx, ScrollView principale di ai-tour.tsx sostituita con KeyboardAwareScrollView (bottomOffset 170 → input + ~4 risultati visibili sopra la tastiera). Beneficia tutti i TextInput del form. Smoke test web OK (form + ricerca + risultati, zero pageerror); il comportamento tastiera reale va verificato dall'utente su dispositivo.

- **Revisione narrazione pausa pranzo nel video (ago 2026, richiesta utente)**: rimossa la frase "la pausa vale una sola volta al giorno" dalla scena v5_s5; aggiunto "la durata di default è impostata a trenta minuti, ma può essere tranquillamente modificata". Rigenerato audio (23.93s, entra nella finestra 25s senza freeze) e riassemblati video 5 (1:45) e completo (9:18). Endpoint 200 verificati.

- **Fix crash foto ispezione Tour Live su Android (ago 2026, segnalato da agente Valentina Lomartire, build produzione)**: l'app si chiudeva allo scatto delle 2 foto nell'EsitoModal. Causa più probabile: OOM — Android termina il processo quando la fotocamera si apre sopra il Tour Live (mappa+GPS) e le foto full-res (fino a 50MP) saturano la memoria (nelle altre sezioni senza mappa le foto funzionano). Fix in EsitoModal.tsx: (1) shrinkPhoto() con expo-image-manipulator (nuova API ImageManipulator.manipulate → resize 1600px + compress 0.7) subito dopo lo scatto → meno memoria per thumbnail/upload; (2) recupero foto dopo process-death con ImagePicker.getPendingResultAsync() alla riapertura del modale (solo Android) + alert "Foto recuperata". Verificato: lint/tsc puliti (13 errori TS pre-esistenti solo in order-collection-v2), smoke E2E web con tour sintetico (poi eliminato): EsitoModal si apre con sezione foto. NOTA: il crash nativo non è riproducibile in questo ambiente; la conferma definitiva richiede redeploy + nuova build Android installata da Valentina.

- **Allineamento origin/main (ago 2026, 10 commit web 0638e0b→298738d — 4 fasi confermate dall'utente, TUTTE VERIFICATE E2E)**:
  1) **Un solo giro Live per agente** (0638e0b): `startLiveTour` chiude automaticamente gli altri tour active dell'agente (tappe planned/arrived → cancelled con motivo "Giro chiuso automaticamente: avviato un nuovo tour", tour → completed + actual_end, evento `closed_by_new_tour` con new_tour_id) — live.ts. In più: avvisi in generazione piano (planner.ts) per giro multi-zona (tappe distanti >25 km in linea d'aria con città indicate) e giro lontano dalla partenza (>25 km) — visti in E2E ("~104 km LA LOGGIA ↔ SILVANO PIETRA").
  2) **Ricalcolo Live senza rimozioni** (298738d): runRecalc/insertLiveStop/reorder trattano TUTTE le tappe come obbligatorie — l'AI riordina e rimodula gli orari, non cancella mai; se la fine prevista sfora avvisa "nessuna tappa è stata rimossa: usa il cestino rosso o Salta". **Cestino rosso** (4fbae81): icona trash su ogni riga VISITE RIMANENTI → dialog conferma → `trashStop` (cancelled + skip_reason "Visita cestinata dall'agente" + evento `stop_trashed`), riga in GESTITE con label "cestinata" + ricalcolo.
  3) **Più Visite** (1644954+f766142): bottone verde nel Live → modale con fine giro posticipabile (input HH:MM + chips +30min/+1h/+2h) → `extendTourVisits` (liveops.ts): candidati stessi criteri del planner ma solo <10km dal percorso rimanente e DENTRO l'area del giro originale (`areaCheckForTour`: ai_tours.area_filter persistito alla generazione — mode territory/province/city/radius/auto — con fallback zone agente dedotte dalle tappe originali added_live=false); tappe esistenti mai toccate, eventi `end_time_extended` + `visits_extended`. E2E: +2h → 7 visite aggiunte reali.
  4) **Prossimità intelligente** (d1e200a): nel Live, a ogni heartbeat GPS (60s), `suggestNearbyProximity` cerca tabaccherie da acquisire a <3 km dalla posizione o dal percorso rimanente, in area e non scartate → banner ambra "Opportunità a X km" con **suono (expo-audio, asset proximity-ping.wav, config plugin in app.json) + vibrazione** (scelta utente); Aggiungi → addLiveStop+ricalcolo, "No grazie" → esclusa per il resto del giro (AsyncStorage per-tour). **Stop 6 mesi "non interessato"**: RPC `ai_tour_no_interest_ids` (qualunque agente) filtra clienti/prospect/orfani in loadCandidates e tabaccherie libere in loadFreeTabaccherie (cache 5 min); torna proponibile prima solo se dopo il "no" c'è un ordine o un appuntamento futuro. E2E: banner apparso a 0.1km e scartato correttamente.
  5) **Anagrafica / Fuori mappa** (5482c17): telefono/email/PEC/SDI ora FACOLTATIVI in /anagrafica (Prima Visita) e /rivendite-no-mappa (vincoli DB già rimossi lato web: verificato con insert probe); formato validato solo se compilati; contact_phone salvato come null se vuoto. **Recupera Anagrafica** (scelta utente: anche per agenti — la Edge Function `openapi-invoice-proxy` autorizza i ruoli agent/agentcustom, verificato HTTP 200): nuovo lib/api/openapi-company.ts (3 endpoint Openapi paralleli via proxy con session token) + bottone ambra in /anagrafica step 2 che auto-compila ragione sociale/P.IVA/CF/sede/PEC/SDI da P.IVA o C.F. (gestito anche il formato province stringa vs oggetto). E2E reale con P.IVA ENI: tutti i campi compilati incluso PEC/SDI. NOTA: il CF societario può essere di 11 cifre ma l'app (parità web) richiede 16 char per procedere.
  - **Verifiche**: tsc/lint puliti (restano solo errori pre-esistenti in order-collection-v2/order[id]/AnimatedNumber/geo-zones); testing_agent iteration_17 code review PASS; E2E Playwright completi con tour sintetico tadini (cestino, salta, Più Visite +7 visite, banner prossimità, un-solo-giro con generazione reale e closed_by_new_tour, forms). **Cleanup DB completo**: tutti i tour di test eliminati (tadini + residuo roberto di mattina), 0 active residui, nessun cliente creato. Unico residuo non eliminabile: 4 punti mock in gps_tracking di tadini (RLS insert-only per agenti, impatto nullo: punti identici → 0 km).
  - ⚠️ **Suono + vibrazione dell'avviso prossimità richiedono una NUOVA BUILD nativa** (config plugin expo-audio): non verificabili in Expo Go/preview web. Produzione: serve redeploy.

- **Puntini neri tabaccherie sulla mappa (ago 2026, commit web e2e6187, richiesta utente)**: nel tab Mappa, layer canvas non interattivo con TUTTE le tabaccherie del registro nell'area visualizzata (fino a 5000, RPC `tabaccherie_points_in_bbox` SECURITY DEFINER già migrata dal web, paginata a 1000 con .range per il limite PostgREST) — utile a zoom larghi dove i marker colorati sono limitati a 1000. Implementato su ENTRAMBE le vie mappa: web diretta (L.layerGroup + L.canvas in map.tsx, ricaricato in loadByBounds con guard anti-race dotsReqRef) e WebView nativa (messaggio `updateDots` in leafletHtml.ts, payload troncato a 5 decimali). Badge conteggio "● N tabaccherie nell'area" (testID map-dots-count, "5000+" se al limite) + voce legenda "Tabaccheria (registro)". Verificato E2E web: Pavia 77, dopo zoom-out 2034 puntini (vs 1000 marker) con nuvola densa visibile su Milano. **USER-CONFIRMED su iPhone/Expo Go** ("vedo i punti sulla mappa, tutto ok") — il primo "non li vedo" era bundle vecchio in cache di Expo Go; log device confermano la catena RPC→invio→disegno (es. "WebView ha disegnato 45 puntini registro"). Aggiunta diagnostica permanente: ack `dotsRendered`/`mapReady`/`jsError` dalla WebView + log `[Map] puntini registro`/`invio N puntini` in map.tsx; layer dots nella WebView protetto da try/catch per non rompere i marker in caso di errore.

- **Puntini neri anche nella mappa del Tour Live/risultato AI Tour (ago 2026, richiesta utente)**: TourMapView.tsx ora carica le tabaccherie del registro nel bounding box del percorso (partenza+tappe+rientro, margine ~10 km, `tabaccheriePointsInBounds`) e le embedda nel payload dell'HTML (iframe web + WebView nativa, stesso codice) come circleMarker canvas non interattivi sotto i marker numerati, protetti da try/catch. **Raggio adattivo allo zoom** (z≥13:3px, ≥11:2.2, ≥9:1.6, sotto:1.1, opacity 0.75, handler zoomend) applicato in TUTTE e tre le implementazioni (TourMapView, leafletHtml.ts WebView tab Mappa, branch web map.tsx) per non far dominare i puntini a zoom larghi. I dots si ricaricano quando cambia la composizione del giro (l'HTML si rigenera). Verificato E2E web con tour sintetico (poi eliminato): canvas presente, puntini discreti su vista Torino–Pavia; tab Mappa senza regressioni (badge 77/2034 ok). Da riverificare su device se richiesto.

- **Interruttore puntini neri (ago 2026, richiesta utente)**: preferenza unica persistita in AsyncStorage chiave `voom_dots_visible` ('1'/'0', default on) condivisa tra le due mappe. Tab Mappa: nuovo FAB (icona ellipse/ellipse-outline, testID map-dots-toggle, sopra il toggle legenda che ora sta a bottom+212, legenda spostata a +268); OFF → layer rimosso (web: removeLayer; native: messaggio `setDotsVisible` gestito in leafletHtml.ts), badge conteggio nascosto e fetch sospesi (guard dotsVisibleRef in loadTabDots); ON → layer riaggiunto + fetch sui bounds correnti. Mappa del giro (TourMapView): bottone overlay sotto "Schermo intero" (testID tourmap-dots-toggle, anche in fullscreen); il toggle rigenera l'HTML con payload dots vuoto/pieno. Icona color COLORS.text (fix visibilità tema dark). E2E: toggle OFF/ON + persistenza dopo reload verificati su entrambe le mappe (T1–T7 ok). NOTA test: gli storage state Playwright scadono per refresh-token rotation dopo usi ripetuti — rigenerare con setup_auth prima di incolpare l'app (un finto "resume non funziona" era solo sessione scaduta).

- **Allineamento origin/main (ago 2026, commit d00397b + 5a6c004 + 012d981 — Modifica giro / anagrafica null / avviso acquisizione)**:
  1) **Pannello "Modifica giro"** (nuovo `components/aitour/TourEditModal.tsx` + integrazione in ai-tour.tsx): bottone "Modifica" (testID aitour-edit-btn) visibile dopo la generazione E su tour salvato richiamato con status `planned`. Il pannello (Modal fullscreen, testID aitour-edit-panel) permette: riordino con frecce (testID aitour-edit-up/down-N), rimozione (aitour-edit-remove-N), toggle obbligatoria ⭐ rossa (aitour-edit-mandatory-N), aggiunta candidati dal pool con ricerca per nome/CRM/indirizzo/città (aitour-edit-search, multi-token) — aggiunta normale (verde) o direttamente obbligatoria (stella rossa). Footer: "RICALCOLA CON AI" (planTour con tutte le tappe scelte come vincolo, ordine ottimale) e "Applica questa sequenza manuale" (planFixedOrder, attivo solo se l'ordine è stato toccato). Per i tour salvati richiamati il pool candidati è caricato al volo (openEdit) e le tappe assenti dal pool usano i candidati del piano (fallback byKey). Se il tour è `planned` salvato, il ricalcolo persiste SUBITO via nuova `replaceTourPlan` in lib/aitour/tours.ts (update header + delete/insert stops con buildStopRows condivisa + evento `recalc` {source:'edit_saved'}). Ricerca "Visite obbligatorie" del form estesa a referente/indirizzo/città (or ilike multi-colonna) con indirizzo nei risultati.
  2) **Fix salvataggio anagrafica**: in anagrafica.tsx pec/sdi vuoti ora salvati come `null` (trim, sdi uppercase) — telefono/email erano già `|| null`; rivendite-no-mappa già conforme.
  3) **Avviso acquisizione prospect nel Live** (LiveTourView.tsx): nel dialog di acquisizione box rosso "IMPORTANTE" (testID aitour-acquire-repress-warning) che spiega di ripremere ISPEZIONE/RACCOLTA ORDINE se al rientro la schermata esito non si apre da sola; il messaggio toast al rientro con nextKind=inspection ora include il promemoria.
  - **VERIFICATO E2E** (e2e_edit_tour.py 11 step + e2e_acquire_warning.py 3 step, account tadini): generazione→Modifica→ricerca città/indirizzo→aggiunta obbligatoria (15→16)→rimozione (16→15)→Ricalcola AI→Salva→reload→richiamo da "I miei Tour"→Modifica (pool al volo)→riordino→Applica sequenza manuale→"Giro ricalcolato e tour salvato aggiornato". DB verificato: stops sostituiti con sequenza 1-15 contigua, mandatory=true persistito sulla tappa aggiunta ⭐, evento recalc {source:'edit_saved'}. Warning acquisizione visibile su tour sintetico con tappa tabaccheria senza customer. CLEANUP: entrambi i tour di test eliminati, tadini 0 planned/active. Fix in corso d'opera: DS.bg non esiste nel tema → DS.surface2. Produzione: richiede redeploy.

## Next Steps
- Implement offline data sync (critical for field agents in areas with bad reception)
- Camera integration for photo uploads in anagrafica visits
- Cart persistence in Order Collection
- Refactoring of large files (order-collection.tsx ~3500 lines, map.tsx ~1100 lines)
