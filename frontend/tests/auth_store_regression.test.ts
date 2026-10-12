import { beforeEach, describe, expect, it, vi } from 'vitest';

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'agent';
  agent_id: string | null;
  supervisor_id: string | null;
  branch_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const activeProfile: Profile = {
  id: 'owner-1',
  email: 'owner@example.test',
  full_name: 'Owner Test',
  role: 'agent',
  agent_id: null,
  supervisor_id: null,
  branch_id: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const inactiveProfile: Profile = { ...activeProfile, is_active: false };

function profileQuery(profile: Profile | null) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: profile, error: null })),
      })),
    })),
  };
}

async function loadAuthStore(options?: {
  profile?: Profile | null;
  signOutImpl?: () => Promise<{ error: unknown | null }>;
  signInImpl?: () => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
  getSessionImpl?: () => Promise<{ data: { session: { user: { id: string }; expires_at?: number | null } | null }; error: unknown | null }>;
  refreshSessionImpl?: () => Promise<{ data: { session: { user: { id: string } } | null }; error: unknown | null }>;
  savedCreds?: { email: string; password: string } | null;
  storageSeed?: Record<string, string>;
}) {
  vi.resetModules();

  const appStateHandlers: ((state: 'active' | 'background' | 'inactive') => Promise<void> | void)[] = [];
  const signOut = vi.fn(options?.signOutImpl ?? (async () => ({ error: null })));
  const signInWithPassword = vi.fn(options?.signInImpl ?? (async () => ({ data: { user: { id: 'owner-1' } }, error: null })));
  const getSession = vi.fn(options?.getSessionImpl ?? (async () => ({ data: { session: null }, error: null })));
  const refreshSession = vi.fn(options?.refreshSessionImpl ?? (async () => ({ data: { session: null }, error: null })));
  const startAutoRefresh = vi.fn();
  const stopAutoRefresh = vi.fn();
  let authCallback: ((event: string, session: { user?: { id: string; email?: string } } | null) => void) | null = null;

  vi.doMock('react-native', () => ({
    AppState: {
      addEventListener: vi.fn((_event: string, cb: (state: 'active' | 'background' | 'inactive') => Promise<void> | void) => {
        appStateHandlers.push(cb);
        return { remove: vi.fn() };
      }),
    },
    Platform: { OS: 'ios' },
  }));

  const storageMap = new Map<string, string>([
    ['supabase_publishable_key_migration_2026_07', '1'],
    ...Object.entries(options?.storageSeed ?? {}),
  ]);
  const asyncStorage = {
    getItem: vi.fn(async (key: string) => storageMap.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storageMap.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storageMap.delete(key);
    }),
  };
  vi.doMock('@react-native-async-storage/async-storage', () => ({ default: asyncStorage }));
  vi.doMock('../lib/secure-credentials', () => ({ loadSavedCredentials: vi.fn(async () => options?.savedCreds ?? null) }));
  vi.doMock('../lib/memory-cache', () => ({ clearCache: vi.fn() }));

  const profile = options?.profile === undefined ? activeProfile : options.profile;
  const supabase = {
    auth: {
      signOut,
      signInWithPassword,
      getSession,
      refreshSession,
      startAutoRefresh,
      stopAutoRefresh,
      onAuthStateChange: vi.fn((cb: (event: string, session: { user?: { id: string; email?: string } } | null) => void) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    from: vi.fn(() => profileQuery(profile)),
  };
  vi.doMock('../lib/supabase', () => ({ supabase }));

  const mod = await import('../store/authStore');
  return {
    useAuthStore: mod.useAuthStore,
    initializeAuthListeners: mod.initializeAuthListeners,
    signOut,
    signInWithPassword,
    getSession,
    refreshSession,
    startAutoRefresh,
    stopAutoRefresh,
    appStateHandlers,
    getAuthCallback: () => authCallback,
    asyncStorage,
    storageMap,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authStore regressions (local-only signout and state safety)', () => {
  it('logout success is local-only and does not wipe storage keys globally', async () => {
    const ctx = await loadAuthStore();
    ctx.useAuthStore.setState({
      user: { id: 'owner-1', email: 'owner@example.test', fullName: 'Owner', role: 'agent', supervisorId: null, branchId: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      profile: activeProfile,
      isAuthenticated: true,
      isLoading: false,
      justLoggedOut: false,
    });

    await ctx.useAuthStore.getState().logout();

    expect(ctx.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(ctx.asyncStorage.removeItem).not.toHaveBeenCalled();
    expect(ctx.useAuthStore.getState().isAuthenticated).toBe(false);
    expect(ctx.useAuthStore.getState().justLoggedOut).toBe(true);
  });

  it('logout SDK error keeps authenticated state and surfaces error', async () => {
    const ctx = await loadAuthStore({ signOutImpl: async () => ({ error: { message: 'offline' } }) });
    ctx.useAuthStore.setState({
      user: { id: 'owner-1', email: 'owner@example.test', fullName: 'Owner', role: 'agent', supervisorId: null, branchId: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      profile: activeProfile,
      isAuthenticated: true,
      isLoading: false,
      justLoggedOut: false,
    });

    await expect(ctx.useAuthStore.getState().logout()).rejects.toThrow('Logout non completato');
    expect(ctx.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(ctx.useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('logout rejected promise keeps authenticated state', async () => {
    const ctx = await loadAuthStore({ signOutImpl: async () => { throw new Error('network fail'); } });
    ctx.useAuthStore.setState({
      user: { id: 'owner-1', email: 'owner@example.test', fullName: 'Owner', role: 'agent', supervisorId: null, branchId: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      profile: activeProfile,
      isAuthenticated: true,
      isLoading: false,
      justLoggedOut: false,
    });

    await expect(ctx.useAuthStore.getState().logout()).rejects.toThrow('network fail');
    expect(ctx.useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('login on inactive profile signs out locally and rejects', async () => {
    const ctx = await loadAuthStore({ profile: inactiveProfile });
    await expect(ctx.useAuthStore.getState().login('owner@example.test', 'pw')).rejects.toThrow('Account disattivato');
    expect(ctx.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(ctx.useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('initialize on inactive profile signs out locally and keeps unauthenticated state', async () => {
    const ctx = await loadAuthStore({
      profile: inactiveProfile,
      getSessionImpl: async () => ({
        data: { session: { user: { id: 'owner-1' }, expires_at: Math.floor(Date.now() / 1000) + 600 } },
        error: null,
      }),
    });

    await ctx.useAuthStore.getState().initialize();

    expect(ctx.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(ctx.useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('SIGNED_OUT listener clears state without recursive signOut', async () => {
    const ctx = await loadAuthStore();
    ctx.useAuthStore.setState({
      user: { id: 'owner-1', email: 'owner@example.test', fullName: 'Owner', role: 'agent', supervisorId: null, branchId: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      profile: activeProfile,
      isAuthenticated: true,
      isLoading: false,
      justLoggedOut: false,
    });

    ctx.initializeAuthListeners();
    const callback = ctx.getAuthCallback();
    expect(callback).toBeTruthy();

    callback?.('SIGNED_OUT', null);

    expect(ctx.signOut).not.toHaveBeenCalled();
    expect(ctx.useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('foreground recovery failure triggers local logout only', async () => {
    const ctx = await loadAuthStore({
      getSessionImpl: async () => ({ data: { session: null }, error: null }),
      refreshSessionImpl: async () => ({ data: { session: null }, error: null }),
    });

    ctx.useAuthStore.setState({
      user: { id: 'owner-1', email: 'owner@example.test', fullName: 'Owner', role: 'agent', supervisorId: null, branchId: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      profile: activeProfile,
      isAuthenticated: true,
      isLoading: false,
      justLoggedOut: false,
    });

    ctx.initializeAuthListeners();
    expect(ctx.appStateHandlers.length).toBeGreaterThan(0);
    await ctx.appStateHandlers[0]('active');

    expect(ctx.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(ctx.useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('logout can retry after SDK error and preserves non-auth draft keys in memory storage', async () => {
    let attempts = 0;
    const ctx = await loadAuthStore({
      signOutImpl: async () => {
        attempts += 1;
        if (attempts === 1) return { error: { message: 'offline' } };
        return { error: null };
      },
      storageSeed: {
        '@order_drafts': JSON.stringify([{ id: 'draft-1', total: 42 }]),
        'gptour:draft:v1:owner-1': JSON.stringify({ messages: ['ciao'] }),
      },
    });

    ctx.useAuthStore.setState({
      user: { id: 'owner-1', email: 'owner@example.test', fullName: 'Owner', role: 'agent', supervisorId: null, branchId: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
      profile: activeProfile,
      isAuthenticated: true,
      isLoading: false,
      justLoggedOut: false,
    });

    await expect(ctx.useAuthStore.getState().logout()).rejects.toThrow('Logout non completato');
    expect(ctx.useAuthStore.getState().isAuthenticated).toBe(true);
    expect(ctx.storageMap.get('@order_drafts')).toBeTruthy();
    expect(ctx.storageMap.get('gptour:draft:v1:owner-1')).toBeTruthy();

    await expect(ctx.useAuthStore.getState().logout()).resolves.toBeUndefined();
    expect(ctx.signOut).toHaveBeenCalledTimes(2);
    expect(ctx.useAuthStore.getState().isAuthenticated).toBe(false);
    expect(ctx.asyncStorage.removeItem).not.toHaveBeenCalled();
    expect(ctx.storageMap.get('@order_drafts')).toBeTruthy();
    expect(ctx.storageMap.get('gptour:draft:v1:owner-1')).toBeTruthy();
  });
});