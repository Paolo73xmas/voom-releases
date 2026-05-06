import { create } from 'zustand';
import { supabase } from '../lib/supabase';

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
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  profile: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
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

      if (!authData.user) {
        throw new Error('Autenticazione fallita');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(`Errore recupero profilo: ${profileError.message}`);
      }

      if (!profile) {
        throw new Error('Profilo non trovato. Contatta l\'amministratore.');
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        throw new Error('Account disattivato. Contatta l\'amministratore.');
      }

      const user: User = {
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

      set({ user, profile, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await supabase.auth.signOut();
      // Security: clear in-memory cache to avoid leaking previous user's data
      try {
        const { clearCache } = await import('../lib/memory-cache');
        clearCache();
      } catch (e) { console.warn('[authStore] clearCache:', e); }
      set({ user: null, profile: null, isAuthenticated: false });
    } catch (error) {
      set({ user: null, profile: null, isAuthenticated: false });
      throw error;
    }
  },

  initialize: async () => {
    try {
      set({ isLoading: true });
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        set({ user: null, profile: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error || !profile) {
        set({ user: null, profile: null, isAuthenticated: false, isLoading: false });
        return;
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        set({ user: null, profile: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const user: User = {
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

      set({ user, profile, isAuthenticated: true, isLoading: false });
    } catch (error) {
      console.error('Initialize error:', error);
      set({ user: null, profile: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
