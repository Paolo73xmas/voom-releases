import { create } from 'zustand';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { loadSavedCredentials } from '../lib/secure-credentials';

export type UserRole = 'admin' | 'admincustom' | 'warehouse' | 'supervisor' | 'agent' | 'customer' | 'branch_admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  agent_id?: string | null;
  supervisor_id: string | null;
  branch_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  supervisorId?: string | null;
  branchId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * True per qualche secondo dopo che l'utente ha premuto "Esci".
   * Impedisce al login screen di triggerare l'auto-biometric login subito dopo.
   */
  justLoggedOut: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Flag che distingue un logout VOLONTARIO (utente preme "Esci") da un
 * logout INVOLONTARIO (token scaduto / errore di rete).
 * Solo il logout involontario attiva il re-login silente con SecureStore.
 */
let intentionalLogout = false;

/**
 * Flag che evita chiamate concorrenti di initialize() (es. _layout.tsx + index.tsx)
 * che possono causare race conditions e stati inconsistenti.
 */
let initInProgress = false;

function profileToUser(profile: Profile): User {
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as UserRole,
    supervisorId: profile.supervisor_id,
    branchId: profile.branch_id || null,
    isActive: profile.is_active,
    createdAt: new Date(profile.created_at),
    updatedAt: new Date(profile.updated_at),
  };
}

async function fetchProfileById(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

/**
 * Tenta di recuperare/rinnovare la sessione in modo aggressivo:
 * 1. getSession() -> sessione locale
 * 2. Se assente o scaduta -> refreshSession()
 * 3. Se anche refresh fallisce e abbiamo credenziali salvate -> re-login silente
 */
async function recoverSession(): Promise<{ userId: string } | null> {
  try {
    // 1. Sessione locale (non usare timeout: Supabase auth ha un lock interno)
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const now = Date.now();
      const expiringSoon = expiresAt - now < 60_000;

      if (!expiringSoon) {
        return { userId: session.user.id };
      }

      // 2. Token quasi/già scaduto -> tenta refresh
      console.log('[Auth] Access token expired/expiring, attempting refresh...');
      try {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed?.session?.user) {
          console.log('[Auth] Session refreshed successfully');
          return { userId: refreshed.session.user.id };
        }
      } catch (e) {
        console.warn('[Auth] refreshSession threw:', e);
      }
    }

    // 3. Refresh standalone (può funzionare se c'è refresh token valido in storage)
    try {
      const { data: refreshed2, error: refreshError2 } = await supabase.auth.refreshSession();
      if (!refreshError2 && refreshed2?.session?.user) {
        console.log('[Auth] Recovered via stand-alone refresh');
        return { userId: refreshed2.session.user.id };
      }
    } catch (e) {
      console.warn('[Auth] standalone refreshSession threw:', e);
    }

    // 4. ULTIMA SPIAGGIA: re-login silente con SecureStore
    const creds = await loadSavedCredentials();
    if (creds) {
      console.log('[Auth] Refresh exhausted, attempting silent re-login...');
      try {
        const { data: signed, error: signError } = await supabase.auth.signInWithPassword({
          email: creds.email,
          password: creds.password,
        });
        if (!signError && signed?.user) {
          console.log('[Auth] Silent re-login successful');
          return { userId: signed.user.id };
        }
      } catch (e) {
        console.warn('[Auth] silent re-login threw:', e);
      }
    }

    return null;
  } catch (e) {
    console.error('[Auth] recoverSession error:', e);
    return null;
  }
}

// =============================================================================
// Zustand store
// =============================================================================

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  profile: null,
  isAuthenticated: false,
  isLoading: true,
  justLoggedOut: false,

  login: async (email: string, password: string) => {
    // Safety timeout: forza isLoading=false dopo 25s se il login si blocca
    const safetyTimer = setTimeout(() => {
      const state = useAuthStore.getState();
      if (state.isLoading) {
        console.warn('[Auth] login() safety timeout, forcing isLoading=false');
        useAuthStore.setState({ isLoading: false });
      }
    }, 25000);

    try {
      set({ isLoading: true });

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw new Error(authError.message === 'Invalid login credentials'
          ? 'Email o password non corretti'
          : authError.message);
      }

      if (!authData?.user) {
        throw new Error('Autenticazione fallita');
      }

      const profile = await fetchProfileById(authData.user.id);

      if (!profile) {
        throw new Error('Profilo non trovato. Contatta l\'amministratore.');
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        throw new Error('Account disattivato. Contatta l\'amministratore.');
      }

      set({ user: profileToUser(profile), profile, isAuthenticated: true, isLoading: false, justLoggedOut: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    } finally {
      clearTimeout(safetyTimer);
    }
  },

  logout: async () => {
    try {
      // Segnala che è un logout VOLONTARIO: il listener onAuthStateChange
      // NON deve tentare il re-login silente con SecureStore
      intentionalLogout = true;

      await supabase.auth.signOut();
      try {
        const { clearCache } = await import('../lib/memory-cache');
        clearCache();
      } catch (e) { console.warn('[authStore] clearCache:', e); }

      // Ferma anche l'auto-refresh per evitare race conditions
      try { supabase.auth.stopAutoRefresh(); } catch {}

      // justLoggedOut=true: impedisce al login screen di triggerare
      // l'auto-biometric login subito dopo il logout volontario
      set({ user: null, profile: null, isAuthenticated: false, justLoggedOut: true });
    } catch (error) {
      set({ user: null, profile: null, isAuthenticated: false, justLoggedOut: true });
      throw error;
    } finally {
      // Reset del flag dopo un breve delay
      setTimeout(() => { intentionalLogout = false; }, 1500);
    }
  },

  initialize: async () => {
    // Guard against concurrent / duplicate init calls (e.g. _layout.tsx + index.tsx)
    if (initInProgress) {
      console.log('[Auth] initialize() already in progress, skipping duplicate call');
      // Wait for ongoing init to complete (poll-style)
      let attempts = 0;
      while (initInProgress && attempts < 100) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      return;
    }
    initInProgress = true;

    // Safety timeout: forza isLoading=false dopo 12s se qualcosa si blocca
    const safetyTimer = setTimeout(() => {
      const state = useAuthStore.getState();
      if (state.isLoading) {
        console.warn('[Auth] initialize() safety timeout, forcing isLoading=false');
        useAuthStore.setState({ isLoading: false });
      }
      initInProgress = false;
    }, 12000);

    try {
      set({ isLoading: true });

      // Niente Promise.race qui: i timeout interferivano con il lock interno di Supabase auth
      const recovered = await recoverSession();

      if (!recovered) {
        set({ user: null, profile: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const profile = await fetchProfileById(recovered.userId);

      if (!profile) {
        set({ user: null, profile: null, isAuthenticated: false, isLoading: false });
        return;
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        set({ user: null, profile: null, isAuthenticated: false, isLoading: false });
        return;
      }

      set({ user: profileToUser(profile), profile, isAuthenticated: true, isLoading: false });
    } catch (error) {
      console.error('Initialize error:', error);
      set({ user: null, profile: null, isAuthenticated: false, isLoading: false });
    } finally {
      clearTimeout(safetyTimer);
      initInProgress = false;
    }
  },
}));

// =============================================================================
// LIVELLO 1 — AppState listener: pausa/riprende auto-refresh in background
// LIVELLO 2 — onAuthStateChange globale (TOKEN_REFRESHED / SIGNED_OUT / SIGNED_IN)
// LIVELLO 3 — Quando app torna in foreground, tenta recovery completo
//             (refresh + re-login silente con SecureStore se necessario)
// =============================================================================

let authListenersInitialized = false;

export function initializeAuthListeners() {
  if (authListenersInitialized) return;
  authListenersInitialized = true;

  // --- LIVELLO 1: AppState ---
  // Su web AppState non è significativo (non c'è "background" reale), skip.
  if (Platform.OS !== 'web') {
    const handleAppStateChange = async (state: AppStateStatus) => {
      if (state === 'active') {
        try {
          supabase.auth.startAutoRefresh();
        } catch (e) { console.warn('[Auth] startAutoRefresh:', e); }

        // LIVELLO 3: quando l'app torna in foreground prova a recuperare la sessione
        // (gestisce il caso "app aperta dopo 2 giorni in background")
        const store = useAuthStore.getState();
        if (store.isAuthenticated) {
          try {
            const recovered = await recoverSession();
            if (!recovered) {
              console.warn('[Auth] Foreground recovery failed, logging out');
              await store.logout();
            }
          } catch (e) {
            console.warn('[Auth] Foreground recovery error:', e);
          }
        }
      } else if (state === 'background' || state === 'inactive') {
        try {
          supabase.auth.stopAutoRefresh();
        } catch (e) { console.warn('[Auth] stopAutoRefresh:', e); }
      }
    };

    AppState.addEventListener('change', handleAppStateChange);

    // Avvia subito (l'app parte già in foreground)
    try {
      supabase.auth.startAutoRefresh();
    } catch (e) { console.warn('[Auth] initial startAutoRefresh:', e); }
  }

  // --- LIVELLO 2: onAuthStateChange ---
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('[Auth] event:', event, '| user:', session?.user?.email || 'none');

    if (event === 'TOKEN_REFRESHED') {
      // Token rinnovato con successo, niente da fare (la sessione è valida)
      return;
    }

    if (event === 'SIGNED_OUT') {
      // SIGNED_OUT può scattare per: logout volontario, token revocato, refresh fallito.
      // NON facciamo silent re-login qui per evitare duplicati con recoverSession().
      // Il silent re-login avviene SOLO in initialize() e AppState foreground.
      console.log('[Auth] SIGNED_OUT event, clearing state');
      useAuthStore.setState({
        user: null,
        profile: null,
        isAuthenticated: false,
        isLoading: false,
        justLoggedOut: intentionalLogout,
      });
      return;
    }

    if (event === 'SIGNED_IN' && session?.user) {
      // Aggiorna lo store con il profilo aggiornato (solo se non già autenticato)
      const current = useAuthStore.getState();
      if (!current.isAuthenticated || current.user?.id !== session.user.id) {
        const profile = await fetchProfileById(session.user.id);
        if (profile && profile.is_active) {
          useAuthStore.setState({
            user: profileToUser(profile),
            profile,
            isAuthenticated: true,
            isLoading: false,
          });
        }
      }
    }
  });
}
