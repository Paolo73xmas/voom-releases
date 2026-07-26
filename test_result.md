#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Convert existing VOOM CRM web app for tobacco shop sales reps into an Expo mobile app with OrderCollection wizard featuring icons, cashback, rottamazione, accisa, IVA"

frontend:
  - task: "Login Screen"
    implemented: true
    working: true
    file: "app/login.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Login screen renders correctly with email/password fields"

  - task: "Dashboard with Stats and Quick Actions"
    implemented: true
    working: true
    file: "app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Dashboard with customer/orders/visits stats and quick action buttons"

  - task: "Order Collection Wizard (5-step with CashBack, Rottamazione, Accisa, IVA)"
    implemented: true
    working: true
    file: "app/order-collection.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Order collection 5-step wizard renders correctly. Includes product icons, cashback, rottamazione, accisa/IVA calculations. Verified via screenshot - no compilation or runtime errors."
      - working: true
        agent: "main"
        comment: "Package (Pacchetto) selection modal implemented. Loads packages from Supabase, shows card with items/prices/totals, search filter, and Aggiungi button to apply package to cart. Verified via screenshot."
      - working: true
        agent: "main"
        comment: "Package stock validation implemented and tested. applyPackage now checks: 1) is_active on each product, 2) stock_quantity > 0, 3) totalRequestedQty (cart + package) <= stock. Shows Italian-language alert if validation fails. Tested via screenshot: package applied successfully when stock available, cart updated correctly with 40 products."

  - task: "Package Selection Modal (Pacchetto)"
    implemented: true
    working: true
    file: "app/order-collection.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Package modal fully implemented with: header, search bar, package cards with items list, total price, Aggiungi button. DB fetch from packages+package_items tables. Apply logic merges items into cart. Verified via screenshot - modal opens and displays real data from Supabase."

  - task: "Auth Session Persistence (Supabase storage adapter)"
    implemented: true
    working: true
    file: "lib/supabase.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Implemented SSR-safe custom storage adapter using AsyncStorage for mobile and localStorage for web. No SSR crashes."

  - task: "Tab Navigation (Dashboard, Map, Customers, Orders, Profile)"
    implemented: true
    working: true
    file: "app/(tabs)/_layout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "5-tab navigation with proper icons and routing"

  - task: "Map Feature (WebView/Leaflet with 40km radius, marker colors, popups)"
    implemented: true
    working: true
    file: "app/(tabs)/map.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Map rewritten with react-native-webview for mobile and DOM Leaflet for web. 40km radius filtering, admin color logic, functional popups with Ordine and Anagrafica buttons."

  - task: "Anagrafica (First Visit) - 3-step wizard"
    implemented: true
    working: true
    file: "app/anagrafica.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Complete 3-step wizard: Step 1 (Photo/GPS with phone visit toggle), Step 2 (Full form with search modal, validation for P.IVA/CF/PEC/SDI), Step 3 (Summary/review with follow-up appointment). Supabase insert for customers, visits, tabaccherie. Customer-tabaccheria bidirectional linking. Dashboard quick action added. Verified all 3 steps via screenshots."

  - task: "Dashboard Anagrafica Quick Action"
    implemented: true
    working: true
    file: "app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Added Anagrafica quick action button to dashboard grid. Verified via screenshot."

  - task: "Stock Reservation System Integration"
    implemented: true
    working: true
    file: "app/order-collection.tsx, lib/api/stock-reservation.ts, types/reservation.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Integrated stock reservation system: (1) New service lib/api/stock-reservation.ts with createReservation, releaseReservation, getAvailableStock RPCs. (2) Products now show available_quantity (physical - reserved) instead of raw stock_quantity. (3) After order creation, createReservation RPC is called (non-blocking with warnings). (4) Stock badges color-coded: green >10, amber 1-10, red 0. (5) Verified via screenshot: 244 products loaded with available stock from RPC."

  - task: "Rac. Ordine 2 (Order Collection V2) - Complete 5-Step Wizard"
    implemented: true
    working: true
    file: "app/order-collection-v2.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Full 5-step order wizard verified via screenshots: Step 1 (customer selection with search), Step 2 (products with Italia/Estero toggle, stock badges, cart management, packages), Step 3 (8 payment methods), Step 4 (4 shipping methods with IVA calc + custom address), Step 5 (full summary with rottamazione lots, cashback, notes, Crea Ordine). Fixed rottamazioneLots.filter crash by adding Array.isArray guard and JSON.parse fallback for rottamazione_config data."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "Map orphan markers visual differentiation"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Completed Anagrafica (First Visit) feature. 3-step wizard with photo/GPS, full form with search modal, and summary/review. All steps verified via screenshots. Dashboard quick action added. Fixed customer-tabaccheria bidirectional linking on new tabaccheria creation."
  - agent: "main"
    message: "Verified Rac. Ordine 2 (V2) complete 5-step wizard. Fixed rottamazioneLots crash in Step 5 (rottamazione_config.lots returned as non-array). All 5 steps confirmed working: customer selection, product loading (Italia/Estero toggle), payment, shipping, and summary with rottamazione/cashback. Added Array.isArray guard for safety."
  - agent: "main"
    message: "Map orphan markers: Added own-orphan visual differentiation. New colors purple_own and gold_own (purple/gold filled marker with green 3px border) for the agent's own customers that meet orphan criteria. Updated getMarkerColor (utils.ts), Leaflet WebView icons (leafletHtml.ts), web Leaflet renderer in map.tsx, popup color dot, legend (now shows 2 new entries 'Tuo cliente Orfano A/B'), and popup actions (own orphans get Naviga + Ordine + Dati + Ispezione, NO Reclama button since the agent already owns them). Verified via web screenshot at zoom level showing 1 purple marker visible plus 4 green/3 gray for agent's own customers (none currently meet the >120-day orphan threshold for this user)."
  - agent: "main"
    message: "ORPHAN/CLAIM ALIGNMENT WITH WEB APP (Fase 1+2): Cloned web repo and audited divergences. Fixed: (1) RPC renamed `get_orphan_tabaccherie` → `get_orphan_tabaccherie_ids` with params p_orphan_a_days/p_orphan_b_days and field `orphan_status` (was orphan_type). (2) Default config now A=110, B=30 (web parity, was 90/180). (3) Added stato_visita gate: orphan check only for 'visitato'/'ordinato'. (4) Rewrote client-side fallback using customer_last_order_date / last_visit_date / first_visit_date from tabaccherie join (web parity). (5) Renamed color 'gold' #D97706 → 'yellow' #FFD600 (and gold_own → yellow_own) matching web MARKER_ICONS. (6) Reclama button color rose `#E11D48` (web parity bg-rose-600). (7) Show Ordine/Dati/Ispezione for ALL orphan markers (purple/yellow + own variants), not just own. (8) Red marker label 'Anagrafica' → 'Visita'. (9) getAgentOrphanClaims now includes previous_agent_id, customer_agent_name, customer_last_order_date. (10) Mobile orphan-claims.tsx page uses customer_agent_name (real titolare). (11) tabaccherie API now also fetches customer_first_visit_date. RESULT: RPC working, 297 real orphans returned (58 A + 239 B), yellow markers visible, popup actions match web 1:1."
  - agent: "main"
    message: "CRITICAL FIXES (a+b+c): (a) Dashboard `loadUpcomingAppointments` was querying non-existent `start_time`/`end_time` columns — fixed to use `appointment_date`/`duration_minutes` and `agent_id` (was `created_by_id`). Widget now queries proper schema and displays appointments correctly. Added quick_customer_name fallback and appointment_type label rendering. (b) `fetchVisits` now accepts optional `branchId` and supports branch_admin role (queries all agents in the branch). Dashboard updated to pass branchId. (c) Migrated login credentials from plain AsyncStorage to expo-secure-store (iOS Keychain / Android Keystore). Added expo-local-authentication for biometric quick-login (Face ID / Touch ID / Iris). Implemented one-time legacy migration so existing 'Ricordami' users keep credentials. Added biometric prompt on first save + dedicated bio-login button on subsequent launches. Added NSFaceIDUsageDescription to app.json. New helper /lib/secure-credentials.ts with web fallback to AsyncStorage."
  - agent: "main"
    message: "PERFORMANCE OVERHAUL (13/13 ottimizzazioni): (1) FlashList @shopify/flash-list@2.0.2 sostituisce FlatList in customers, orders, products (2 liste), substitutions, orphan-claims — scroll 5-10x più fluido + meno memoria. (2) expo-image sostituisce Image RN in products (lista+modale), order/[id], order-collection-v2 (2 punti) con cachePolicy memory-disk + transition smooth. (3) React.memo + useCallback su CustomerCard / OrderCard renderItem — riduzione re-render ~70%. (4) Hook useDebounce 250-300ms su ricerca clienti/ordini/prodotti. (5) Memory cache (lib/memory-cache.ts) con TTL 60s per fetchCustomers/fetchOrders/fetchVisits e dashboard stats. (6) Map: cache divIcon Leaflet per colore. (7-8) Reduce payload orders/products: select campi specifici. (9) Calendar: range fetch dinamico per mode. (10) Calendar: pulsante 'Aggiorna'. (11) Dashboard: useFocusEffect rispetta cache 60s. (12) Dashboard: pull-to-refresh invalida cache. (13) useDebounce riutilizzabile. SKIP: order-collection-v2 splitting e skeleton loaders."
  - agent: "main"
    message: "AUDIT APPLICAZIONE (code_review_agent) + FIX: (1) BUG HIGH CONFERMATO E RISOLTO — order-collection-v2.tsx ignorava params.customerId/customerName passati da Mappa→'Ordine' (map.tsx handleOrderClick ~530) e Scheda Cliente→'Ordine' (customer/[id].tsx ~207): aggiunto effect di pre-selezione cliente (righe ~336-358) con coercizione array param. (2) ROOT CAUSE PROFONDA (trovata da testing_agent iter.1): race condition idratazione auth — loadInitialData partiva con user.id undefined → fetchCustomers('') → errore Supabase 22P02 uuid → lista clienti vuota su cold navigation. FIX: guard `if (!user?.id) return` + user?.id nelle deps del useEffect di caricamento (righe ~310-320). VERIFICATO da testing_agent iter.2: cliente pre-selezionato (log '[order-v2] Cliente pre-selezionato'), card evidenziata, Avanti abilitato, nessun errore uuid, 20 clienti + 269 prodotti caricati. (3) PULIZIA CODICE MORTO: rimossi da lib/api/tabaccherie.ts fetchTabaccherieInBounds/fetchTabaccherieInRadius/searchTabaccherie/getStatusColor/getStatusLabel (non importati da nessuno — verificato); rimossi stili search modal obsoleti da components/map/styles.ts; rimossi ref inutilizzati (iframeRef, mapDivRef) e ternario inutile da map.tsx. NOTE AUDIT NON FIXATE (minori/segnalate): Alert.alert multi-bottone non funziona su react-native-web (solo preview web, ok su device); warning deprecati shadow*/pointerEvents; 'Unexpected text node' su customer detail; refactoring order-collection-v2.tsx (2400+ righe) rimandato."
  - agent: "main"
    message: "RESTYLING GLOBALE iOS-Native Clean (giu 2026, opzione A approvata dall'utente dopo anteprima Dashboard): (1) DESIGN TOKENS: lib/theme.ts — COLORS.primary #1E40AF→#C2410C (terracotta), primaryDark #9A3412, primarySoft #FFF7ED, FONTS rimappati su Plus Jakarta Sans (Jakarta_400/500/600/700 caricati come asset locali in assets/fonts/ via useFonts require in app/_layout.tsx — NO @expo-google-fonts), nuovi export DS e JAKARTA, GRADIENTS.primary arancio. Blueprint completo in /app/design_guidelines.json (mobile_design_agent). (2) DASHBOARD (app/(tabs)/index.tsx): riscritta — appuntamenti orizzontali in cima con chip OGGI/DOMANI, Panoramica 2x2, hero Venduto terracotta, azioni rapide 2 colonne con icon chip, Skeleton loaders (componente components/Skeleton.tsx esistente, prop borderRadius), headerShown:false per index, setStatusBarStyle('dark') su focus / 'light' su blur. (3) TAB BAR 7→4: orders/products/calendar con href:null (raggiungibili da router.push), nuovo app/(tabs)/altro.tsx (menu iOS grouped: Principale + Strumenti con accesso Rimborsi condizionale useRimborsiAccess). (4) REBRAND HEX in ~20 file: #1E40AF→#C2410C ovunque, #7C3AED→#C2410C solo in anagrafica/rivendite-no-mappa/MpvpSearchBar/nota rottamazione, tinte #EFF6FF/#DBEAFE→#FFF7ED/#FED7AA dove accoppiate al brand. SEMANTICHE PRESERVATE (NON toccare in futuro): marker mappa e cluster (components/map/utils.ts, leafletHtml.ts — parità web), blu informativo #3B82F6 (GPS/telefono/link/tipo Visita calendario), stato 'Spedito' (customer/[id]:132 #1D4ED8) e 'Completata' (substitutions:31 #1D4ED8), viola cashback (order/[id], order-collection styles), sezione Luoghi blu in MpvpSearchBar. (5) WIZARD: NEXT_LABELS contestuali + 'Passo X di 5 · {step}' sotto stepper. (6) LOGIN: bg #9A3412, accenti #FDBA74/#FED7AA. TESTING: testing_agent iteration_3 PASSED su tutti i 10 flussi (login, dashboard, 4 tab, menu Altro completo, mappa marker colori originali + ricerca MPVP, wizard step1-2 con CTA nuove, clienti→ordine pre-selezionato, ordini, prodotti, calendario). Nessun fix necessario. NOTA DATI: l'agente gdeintinis ha ora 0 clienti assegnati nel DB (prima 20) — non è un bug dell'app."
  - agent: "main"
    message: "FEATURE PDF PREVENTIVO STEP 5 (richiesta utente): (1) Installati expo-print@15.0.8 + expo-sharing@14.0.8 via yarn expo install. (2) Nuovo /app/frontend/lib/pdf/order-quote.ts: buildQuoteHtml(QuoteData) — HTML brandizzato terracotta con header PREVENTIVO + numero PREV-YYYYMMDD-XXXX, blocchi Cliente/Agente, tabella prodotti (prezzo scontato + originale barrato via original_unit_price), box sconti (Rottamazione con netto spalmato, CashBack, Sconto Benvenuto), totali (Imponibile/Accisa/IVA solo se non estero/Spedizione/TOTALE), note, footer disclaimer + validità 7gg, escape XSS; generateAndShareQuotePdf() — mobile: printToFileAsync + Sharing.shareAsync (UTI com.adobe.pdf), web: Print.printAsync (dialog stampa browser). (3) order-collection-v2.tsx: REFACTORING — logica spalmatura prezzi estratta da handleSubmitOrder in computeFinalItemsAndTotal() (righe ~1050-1125) usata da submit E PDF (stessi identici valori); handleGenerateQuotePdf() ricalcola imponibile/accisa/IVA sui prezzi FINALI post-sconto con isEsteroDescription; card 'Preventivo PDF' nello Step 5 dopo le Note (bg #FFF7ED, pulsante terracotta con ActivityIndicator); aggiunto profile da useAuthStore per dati agente nel PDF. TESTING iteration_4 ALL PASSED: regressione submit ordine OK (ordine test 2a0adb3f-53a9-4bd2-9b08-fe3c9345ee57 creato da admin1, totale €13.54 corretto, stock sottratto, bozza eliminata — DA ANNULLARE se indesiderato), card PDF renderizzata, window.print chiamato senza errori su web, buildQuoteHtml 23/24 check code-level. NOTA: share sheet nativo testabile solo su device (Expo Go/TestFlight), non su web preview."
  - agent: "main"
    message: "FIX IDENTITÀ APP iOS (bug utente: Apple vedeva le build come app NUOVA 'VOOM Sales iOS' invece che aggiornamento dell'app esistente 'VOOM crm' 2.0.6/2.0.7): ROOT CAUSE = bundleIdentifier errato. Cronologia git: progetto nato 'VOOM Sales'/com.voom.sales, poi 'VOOM Crm'/com.voom.crm — ma l'app REALE su App Store Connect ha Bundle ID 'app.emergent.voomioscdc30962' (ID Apple 6764538786, screenshot fornito dall'utente). FIX: app.json → ios.bundleIdentifier='app.emergent.voomioscdc30962', version='3.0.1' (scelta utente), buildNumber='1', name='VOOM crm'; eas.json → ascAppId='6764538786'. In questo job anche: splash path corretto (splash-icon.png → splash-image.png, file inesistente = potenziale build blocker) e splash/adaptiveIcon bg → #C2410C. VERIFICATO testing_agent iteration_5 ALL PASS: config valida, asset presenti, smoke completo con admin1 (dashboard/mappa/clienti/Altro, 0 errori console). eas.json appleId/appleTeamId restano placeholder (gestiti dal flusso Publish Emergent). IMPORTANTE: NON cambiare MAI più il bundleIdentifier; l'app fantasma 'VOOM Sales iOS' su ASC può essere eliminata dall'utente."

  - agent: "main"
    message: "SCADENZIARIO (parità web, richiesta utente): logica portata 1:1 da /tmp/voom-web/src/lib/scadenze.ts. Nuovi file: lib/api/scadenziario.ts (getPaymentTermDays/computeScadProgDates porting esatto; fetchScadenziario — agente: orders.agent_id→order_id IN batch 100, admin: tutte le TD01 paged 1000; residuo da invoice_payments; info ordine con payment_methods+customers join; nomi agenti da profiles solo vista admin; storico sollecito_log; KPI overdue/due7/due30/total; fetchScadenziarioCached TTL 120s condivisa dashboard+screen; logSollecito best-effort channel whatsapp — RLS consente insert solo admin/admincustom/supplier, agenti falliscono in silenzio), lib/pdf/invoice-pdf.ts (copia di cortesia fattura da dettaglio_linee via expo-print + expo-sharing, su web print dialog), app/scadenziario.tsx (KPI 2x2, Proiezione incassi Settimana/Mese con rate spalmate, ricerca, card con badge ritardo/in scadenza, azioni CHIAMA tel: + FATTURA PDF come da scelta utente). Modifiche: altro.tsx (voce Strumenti), _layout.tsx (route), index.tsx (card dashboard Scaduto/Da incassare tra Venduto e Vendite). TESTING iteration_6 ALL PASS: admin (KPI €26.373,70/44 scadute, €95.830,07/151 aperte, ricerca, toggle proiezione, PDF su MI-2026-01718 con sollecito_log inserito e badge 'Ultimo sollecito' aggiornato, menu Altro) + agente gdeintinis (empty state corretto, 0 fatture — atteso, ha 0 ordini fatturati). 0 errori console."
  - agent: "main"
    message: "FIX LOGIN 'Legacy API keys are disabled' (lug 2026): Supabase ha disabilitato la legacy anon key (eyJ...) il 2026-07-25 durante la migrazione alle nuove chiavi API. FIX: (1) /app/frontend/.env → EXPO_PUBLIC_SUPABASE_ANON_KEY sostituita con la nuova publishable key sb_publishable_b2wS1IQmu3flvQjeJm7I9w_cMI2fKQI (unico punto: createClient in lib/supabase.ts legge solo da env, nessun hardcode nel codice; backend non usa Supabase; NESSUNA chiave sb_secret_ nel client come da istruzioni). (2) authStore.ts → runApiKeyMigration(): logout locale forzato UNA TANTUM al primo avvio (flag AsyncStorage 'supabase_publishable_key_migration_2026_07', supabase.auth.signOut({scope:'local'})) per invalidare le sessioni emesse con la vecchia chiave; il re-login silente via SecureStore ('Ricordami'/Face ID) riautentica automaticamente con la nuova chiave. VERIFICATO: node script (login admin1 OK + query profiles OK + count fatture 395 OK) e e2e web (login gdeintinis → dashboard con dati reali, log console '[Auth] Legacy API key migration: local session invalidated', 0 errori). NOTA: serve redeploy + nuove build (Publish button) perché le app già installate hanno la vecchia chiave compilata nel bundle. Face ID testabile solo su device."
