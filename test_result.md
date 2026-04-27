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

