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

## Next Steps
- Implement offline data sync (critical for field agents in areas with bad reception)
- Camera integration for photo uploads in anagrafica visits
- Cart persistence in Order Collection
- Refactoring of large files (order-collection.tsx ~3500 lines, map.tsx ~1100 lines)
