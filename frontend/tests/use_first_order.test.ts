import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  let mounted = true;
  let stateIdx = 0;
  let refIdx = 0;
  let effectIdx = 0;
  let callbackIdx = 0;

  const states: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const effects: { deps?: unknown[]; cleanup?: (() => void) | void }[] = [];
  const callbacks: { deps?: unknown[]; fn: unknown }[] = [];

  let afterUnmountStateUpdates = 0;

  const reactModule = {
    useState<T>(initial: T): [T, (value: T | ((prev: T) => T)) => void] {
      const idx = stateIdx++;
      if (!(idx in states)) states[idx] = initial;
      const setState = (value: T | ((prev: T) => T)) => {
        if (!mounted) {
          afterUnmountStateUpdates += 1;
          return;
        }
        const prev = states[idx] as T;
        states[idx] = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
      };
      return [states[idx] as T, setState];
    },
    useRef<T>(initial: T): { current: T } {
      const idx = refIdx++;
      if (!refs[idx]) refs[idx] = { current: initial };
      return refs[idx] as { current: T };
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
    useCallback<T extends (...args: any[]) => any>(fn: T, deps?: unknown[]): T {
      const idx = callbackIdx++;
      const prev = callbacks[idx];
      const changed =
        !prev ||
        !deps ||
        !prev.deps ||
        deps.length !== prev.deps.length ||
        deps.some((d, i) => !Object.is(d, prev.deps![i]));
      if (changed) callbacks[idx] = { deps, fn };
      return callbacks[idx].fn as T;
    },
  };

  const render = <T,>(factory: () => T): T => {
    stateIdx = 0;
    refIdx = 0;
    effectIdx = 0;
    callbackIdx = 0;
    return factory();
  };

  const unmount = () => {
    mounted = false;
    for (const effect of effects) if (effect?.cleanup) effect.cleanup();
  };

  return { reactModule, render, unmount, get_after_unmount_updates: () => afterUnmountStateUpdates };
}

async function setupUseFirstOrder(fetchImpl: (customerId: string, signal: AbortSignal) => Promise<boolean>) {
  vi.resetModules();
  const harness = createHookHarness();
  vi.doMock('react', () => harness.reactModule);
  vi.doMock('../lib/api/first-order', () => ({ fetchIsFirstOrder: vi.fn(fetchImpl) }));

  const mod = await import('../hooks/useFirstOrder');
  const api = await import('../lib/api/first-order');

  const render = (customerId?: string) => harness.render(() => mod.useFirstOrder(customerId));
  return {
    render,
    unmount: harness.unmount,
    get_after_unmount_updates: harness.get_after_unmount_updates,
    fetchIsFirstOrder: vi.mocked(api.fetchIsFirstOrder),
  };
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('useFirstOrder', () => {
  it('does not reuse already-confirmed eligibility on the first render of another customer', async () => {
    const next = deferred<boolean>();
    const env = await setupUseFirstOrder(id => id === 'A' ? Promise.resolve(true) : next.promise);
    env.render('A');
    await Promise.resolve();
    expect(env.render('A').isFirstOrder).toBe(true);
    const changed = env.render('B');
    expect(changed.status).toBe('loading');
    expect(changed.isFirstOrder).toBe(false);
    next.resolve(false);
    await Promise.resolve();
    expect(env.render('B').status).toBe('ineligible');
    env.unmount();
  });

  it('only uses the newest retry even when an aborted older request resolves later', async () => {
    const old = deferred<boolean>(), recent = deferred<boolean>();
    let calls = 0;
    const env = await setupUseFirstOrder(() => ++calls === 1 ? old.promise : recent.promise);
    const initial = env.render('A');
    const retry = initial.retry();
    old.resolve(true);
    await Promise.resolve();
    expect(env.render('A').status).toBe('loading');
    recent.resolve(false);
    await retry;
    expect(env.render('A').status).toBe('ineligible');
    env.unmount();
  });
  it('returns idle and does not fetch when customer is missing', async () => {
    const env = await setupUseFirstOrder(async () => true);
    const state = env.render(undefined);

    expect(state.status).toBe('idle');
    expect(state.isFirstOrder).toBe(false);
    expect(env.fetchIsFirstOrder).not.toHaveBeenCalled();
  });

  it('memoizes retry with same customer and changes callback when customer changes', async () => {
    const env = await setupUseFirstOrder(async () => true);
    const first = env.render('cust-a');
    const sameCustomer = env.render('cust-a');
    const changedCustomer = env.render('cust-b');

    expect(sameCustomer.retry).toBe(first.retry);
    expect(changedCustomer.retry).not.toBe(first.retry);
  });

  it('ignores stale response when customer changes before first request resolves', async () => {
    const a = deferred<boolean>();
    const b = deferred<boolean>();

    const env = await setupUseFirstOrder((customerId) => {
      if (customerId === 'A') return a.promise;
      return b.promise;
    });

    env.render('A');
    let stateB = env.render('B');
    expect(stateB.status).toBe('loading');

    a.resolve(true);
    await Promise.resolve();
    stateB = env.render('B');
    expect(stateB.status).toBe('loading');
    expect(stateB.isFirstOrder).toBe(false);

    b.resolve(false);
    await Promise.resolve();
    stateB = env.render('B');
    expect(stateB.status).toBe('ineligible');
    expect(stateB.isFirstOrder).toBe(false);
  });

  it('surfaces error then allows retry success', async () => {
    const firstAttempt = deferred<boolean>();
    const secondAttempt = deferred<boolean>();
    let calls = 0;

    const env = await setupUseFirstOrder(() => {
      calls += 1;
      return calls === 1 ? firstAttempt.promise : secondAttempt.promise;
    });

    env.render('cust-retry');
    firstAttempt.reject(new Error('boom'));
    await Promise.resolve();
    let state = env.render('cust-retry');
    expect(state.status).toBe('error');

    const retryPromise = state.retry();
    state = env.render('cust-retry');
    expect(state.status).toBe('loading');

    secondAttempt.resolve(true);
    await retryPromise;
    state = env.render('cust-retry');
    expect(state.status).toBe('eligible');
    expect(state.isFirstOrder).toBe(true);
  });

  it('aborts after 15 seconds timeout and fails closed', async () => {
    vi.useFakeTimers();
    let seenSignal: AbortSignal | null = null;

    const env = await setupUseFirstOrder((_customerId, signal) => {
      seenSignal = signal;
      return new Promise<boolean>((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const err = Object.assign(new Error('aborted'), { name: 'AbortError' });
          reject(err);
        });
      });
    });

    env.render('cust-timeout');
    await vi.advanceTimersByTimeAsync(15001);
    await Promise.resolve();

    const state = env.render('cust-timeout');
    expect(Boolean((seenSignal as any)?.aborted)).toBe(true);
    expect(state.status).toBe('error');
    expect(state.isFirstOrder).toBe(false);
  });

  it('aborts pending request on unmount without post-unmount state updates', async () => {
    const slow = deferred<boolean>();
    const env = await setupUseFirstOrder(() => slow.promise);

    env.render('cust-unmount');
    env.unmount();
    slow.resolve(true);
    await Promise.resolve();

    expect(env.get_after_unmount_updates()).toBe(0);
  });
});
