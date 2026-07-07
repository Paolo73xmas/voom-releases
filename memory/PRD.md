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
EXPO_PUBLIC_SUPABASE_ANON_KEY=[key]
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

## Next Steps
- Implement offline data sync (critical for field agents in areas with bad reception)
- Camera integration for photo uploads in anagrafica visits
- Cart persistence in Order Collection
- Refactoring of large files (order-collection.tsx ~3500 lines, map.tsx ~1100 lines)
