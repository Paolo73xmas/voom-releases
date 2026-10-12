import { describe, expect, it, vi } from 'vitest';

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void };
const deferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

function createHookHarness() {
  let stateIdx = 0;
  let effectIdx = 0;
  const states: unknown[] = [];
  const effects: { deps?: unknown[]; cleanup?: (() => void) | void }[] = [];

  const reactModule = {
    useState<T>(initial: T): [T, (value: T | ((prev: T) => T)) => void] {
      const idx = stateIdx++;
      if (!(idx in states)) states[idx] = initial;
      const setState = (value: T | ((prev: T) => T)) => {
        const prev = states[idx] as T;
        states[idx] = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
      };
      return [states[idx] as T, setState];
    },
    useEffect(fn: () => void | (() => void), deps?: unknown[]) {
      const idx = effectIdx++;
      const prev = effects[idx];
      const changed =
        !prev ||
        !deps ||
        !prev.deps ||
        deps.length !== prev.deps.length ||
        deps.some((d, i) => !Object.is(d, prev.deps![i]));
      if (changed) {
        if (prev?.cleanup) prev.cleanup();
        const cleanup = fn();
        effects[idx] = { deps, cleanup };
      }
    },
  };

  const render = <T,>(factory: () => T): T => {
    stateIdx = 0;
    effectIdx = 0;
    return factory();
  };

  return { reactModule, render };
}

async function setupAccessHook() {
  vi.resetModules();
  const harness = createHookHarness();
  let authOwner = 'owner-a';

  const calls: { owner: string; signal: AbortSignal }[] = [];
  const probes = new Map<string, Deferred<'enabled' | 'not_allowed' | 'disabled' | 'unavailable'>>();
  const probeOrchestratorAccess = vi.fn(async (_options, owner: string, _current, signal?: AbortSignal) => {
    const d = deferred<'enabled' | 'not_allowed' | 'disabled' | 'unavailable'>();
    probes.set(owner, d);
    calls.push({ owner, signal: signal as AbortSignal });
    return d.promise;
  });

  vi.doMock('react', () => harness.reactModule);
  vi.doMock('../lib/aitour/gptour-orchestrator-api', () => ({ probeOrchestratorAccess }));
  vi.doMock('../store/authStore', () => ({
    useAuthStore: {
      getState: () => ({ user: authOwner ? { id: authOwner } : null }),
    },
  }));
  vi.doMock('../lib/aitour/orchestrator/binding', () => ({
    APPROVED_ORCHESTRATOR_BINDING: {
      version: '1.0',
      provenance: 'handoff-verified',
      historyMode: 'local-transcript',
      recoveryRevision: 'confirmed',
      encodeAction: () => ({ type: 'noop' }),
      decodeResponse: () => ({
        sessionId: 's',
        revision: 1,
        status: 'ready',
        warnings: [],
        criteria: [],
        pendingDecisions: [],
        questions: [],
        messages: [],
        plan: null,
        planId: null,
      }),
    },
  }));

  const mod = await import('../hooks/useOrchestratorAccess');
  const render = (owner: string | null, enabled: boolean) => harness.render(() => mod.useOrchestratorAccess(owner, enabled));

  return {
    render,
    setAuthOwner: (owner: string) => {
      authOwner = owner;
    },
    probes,
    calls,
    probeOrchestratorAccess,
  };
}

describe('useOrchestratorAccess hook regressions', () => {
  const flush = async () => {
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
  };

  it('returns off when focus/flag disabled and never probes', async () => {
    const env = await setupAccessHook();
    expect(env.render('owner-a', false)).toBe('off');
    expect(env.probeOrchestratorAccess).not.toHaveBeenCalled();
  });

  it('owner switch with late response ignores stale owner and keeps current owner result', async () => {
    const env = await setupAccessHook();
    expect(env.render('owner-a', true)).toBe('checking');
    expect(env.calls).toHaveLength(1);

    env.setAuthOwner('owner-b');
    expect(env.render('owner-b', true)).toBe('checking');
    expect(env.calls).toHaveLength(2);

    env.probes.get('owner-a')?.resolve('enabled');
    await flush();
    expect(env.render('owner-b', true)).toBe('checking');

    env.probes.get('owner-b')?.resolve('not_allowed');
    await flush();
    expect(env.render('owner-b', true)).toBe('not_allowed');
    expect(Boolean(env.calls[0].signal.aborted)).toBe(true);
  });

  it('probe error maps to unavailable for current owner', async () => {
    const env = await setupAccessHook();
    expect(env.render('owner-a', true)).toBe('checking');
    env.probes.get('owner-a')?.reject(new Error('probe down'));
    await flush();
    expect(env.render('owner-a', true)).toBe('unavailable');
  });

  it('re-open after focus false triggers a new probe', async () => {
    const env = await setupAccessHook();
    expect(env.render('owner-a', true)).toBe('checking');
    env.probes.get('owner-a')?.resolve('enabled');
    await flush();
    expect(env.render('owner-a', true)).toBe('enabled');

    expect(env.render('owner-a', false)).toBe('off');
    expect(env.render('owner-a', true)).toBe('checking');
    expect(env.calls.length).toBeGreaterThanOrEqual(2);
  });
});
