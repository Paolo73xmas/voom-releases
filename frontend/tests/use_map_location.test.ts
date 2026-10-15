// useMapLocation hook: immutable bootstrap, single-flight refresh, cancel/issue handling.
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
  let refIdx = 0;
  let effectIdx = 0;
  let callbackIdx = 0;
  const states: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const effects: { deps?: unknown[]; cleanup?: (() => void) | void }[] = [];
  const callbacks: { deps?: unknown[]; fn: (...args: any[]) => any }[] = [];

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
    useRef<T>(initial: T) {
      const idx = refIdx++;
      if (!(idx in refs)) refs[idx] = { current: initial };
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
    useCallback<T extends (...args: any[]) => any>(fn: T, deps?: unknown[]) {
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
    effects.forEach(effect => {
      if (effect?.cleanup) effect.cleanup();
    });
  };

  return { reactModule, render, unmount };
}

describe('useMapLocation hook regressions', () => {
  it('initial fix then refresh keeps initialView object reference stable and updates fix', async () => {
    vi.resetModules();
    const harness = createHookHarness();
    const reqA = deferred<{ lat: number; lng: number; timestamp: number; accuracy: number | null }>();
    const reqB = deferred<{ lat: number; lng: number; timestamp: number; accuracy: number | null }>();
    const queue = [reqA, reqB];
    const cancelSpies: ReturnType<typeof vi.fn>[] = [];

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('expo-location', () => ({
      Accuracy: { High: 6 },
      getForegroundPermissionsAsync: vi.fn(),
      requestForegroundPermissionsAsync: vi.fn(),
      hasServicesEnabledAsync: vi.fn(),
      watchPositionAsync: vi.fn(),
    }));
    vi.doMock('../lib/map/fresh-location', async (importOriginal) => {
      const original = await importOriginal<typeof import('../lib/map/fresh-location')>();
      return {
        ...original,
        startFreshMapLocation: vi.fn(() => {
          const next = queue.shift();
          if (!next) throw new Error('missing deferred request');
          const cancel = vi.fn();
          cancelSpies.push(cancel);
          return { promise: next.promise, cancel };
        }),
      };
    });

    const mod = await import('../hooks/useMapLocation');

    let hook = harness.render(() => mod.useMapLocation());
    reqA.resolve({ lat: 45.1, lng: 9.1, timestamp: 1000, accuracy: 15 });
    await Promise.resolve();
    await Promise.resolve();
    hook = harness.render(() => mod.useMapLocation());

    const firstInitialRef = hook.initialView;
    expect(firstInitialRef).toMatchObject({ lat: 45.1, lng: 9.1, hasFix: true });
    expect(hook.fix).toMatchObject({ lat: 45.1, lng: 9.1 });

    const second = hook.refresh();
    reqB.resolve({ lat: 45.2, lng: 9.2, timestamp: 2000, accuracy: 10 });
    await second;
    hook = harness.render(() => mod.useMapLocation());

    expect(hook.fix).toMatchObject({ lat: 45.2, lng: 9.2, timestamp: 2000 });
    expect(hook.initialView).toBe(firstInitialRef);
    expect(cancelSpies.length).toBeGreaterThanOrEqual(2);
  });

  it('startup fallback keeps hasFix=false and does not create blue-marker bootstrap after denied GPS', async () => {
    vi.resetModules();
    const harness = createHookHarness();
    const denied = deferred<{ lat: number; lng: number; timestamp: number; accuracy: number | null }>();

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('expo-location', () => ({ Accuracy: { High: 6 } }));
    vi.doMock('../lib/map/fresh-location', async (importOriginal) => {
      const original = await importOriginal<typeof import('../lib/map/fresh-location')>();
      return {
        ...original,
        startFreshMapLocation: vi.fn(() => ({
          promise: denied.promise,
          cancel: vi.fn(),
        })),
      };
    });

    const { MapLocationError } = await import('../lib/map/fresh-location');
    const mod = await import('../hooks/useMapLocation');
    harness.render(() => mod.useMapLocation());
    denied.reject(new MapLocationError('permission', 'denied'));
    await Promise.resolve();
    await Promise.resolve();
    const hook = harness.render(() => mod.useMapLocation());

    expect(hook.initialView).toMatchObject({ lat: 41.9028, lng: 12.4964, hasFix: false });
    expect(hook.fix).toBeNull();
  });

  it('concurrent taps are single-flight; second refresh returns null while first pending', async () => {
    vi.resetModules();
    const harness = createHookHarness();
    const req = deferred<{ lat: number; lng: number; timestamp: number; accuracy: number | null }>();

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('expo-location', () => ({ Accuracy: { High: 6 } }));
    vi.doMock('../lib/map/fresh-location', async (importOriginal) => {
      const original = await importOriginal<typeof import('../lib/map/fresh-location')>();
      return {
        ...original,
        startFreshMapLocation: vi.fn(() => ({ promise: req.promise, cancel: vi.fn() })),
      };
    });

    const mod = await import('../hooks/useMapLocation');
    let hook = harness.render(() => mod.useMapLocation());
    req.resolve({ lat: 45.1, lng: 9.1, timestamp: 1000, accuracy: 15 });
    await Promise.resolve();
    await Promise.resolve();
    hook = harness.render(() => mod.useMapLocation());

    const p1 = hook.refresh();
    const p2 = hook.refresh();
    await expect(p2).resolves.toBeNull();
    await p1;
  });

  it('cancel discards stale callback and next attempt recovers', async () => {
    vi.resetModules();
    const harness = createHookHarness();
    const initReq = deferred<{ lat: number; lng: number; timestamp: number; accuracy: number | null }>();
    const pendingReq = deferred<{ lat: number; lng: number; timestamp: number; accuracy: number | null }>();
    const recoverReq = deferred<{ lat: number; lng: number; timestamp: number; accuracy: number | null }>();
    const queue = [initReq, pendingReq, recoverReq];
    const cancels: ReturnType<typeof vi.fn>[] = [];

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('expo-location', () => ({ Accuracy: { High: 6 } }));
    vi.doMock('../lib/map/fresh-location', async (importOriginal) => {
      const original = await importOriginal<typeof import('../lib/map/fresh-location')>();
      return {
        ...original,
        startFreshMapLocation: vi.fn(() => {
          const d = queue.shift();
          if (!d) throw new Error('missing request');
          const cancel = vi.fn();
          cancels.push(cancel);
          return { promise: d.promise, cancel };
        }),
      };
    });

    const mod = await import('../hooks/useMapLocation');
    let hook = harness.render(() => mod.useMapLocation());
    initReq.resolve({ lat: 45, lng: 9, timestamp: 1000, accuracy: 10 });
    await Promise.resolve();
    await Promise.resolve();
    hook = harness.render(() => mod.useMapLocation());

    const pending = hook.refresh();
    hook.cancel();
    pendingReq.resolve({ lat: 10, lng: 10, timestamp: 1100, accuracy: 10 });
    await expect(pending).resolves.toBeNull();
    expect(cancels.at(-1)).toHaveBeenCalledTimes(1);

    const next = hook.refresh();
    recoverReq.resolve({ lat: 46, lng: 10, timestamp: 2000, accuracy: 5 });
    await next;
    hook = harness.render(() => mod.useMapLocation());
    expect(hook.fix).toMatchObject({ lat: 46, lng: 10, timestamp: 2000 });
  });

  it('unmount cancels active request and ignores late resolve', async () => {
    vi.resetModules();
    const harness = createHookHarness();
    const initReq = deferred<{ lat: number; lng: number; timestamp: number; accuracy: number | null }>();
    const pendingReq = deferred<{ lat: number; lng: number; timestamp: number; accuracy: number | null }>();
    const queue = [initReq, pendingReq];
    const cancels: ReturnType<typeof vi.fn>[] = [];

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('expo-location', () => ({ Accuracy: { High: 6 } }));
    vi.doMock('../lib/map/fresh-location', async (importOriginal) => {
      const original = await importOriginal<typeof import('../lib/map/fresh-location')>();
      return {
        ...original,
        startFreshMapLocation: vi.fn(() => {
          const req = queue.shift();
          if (!req) throw new Error('missing request');
          const cancel = vi.fn();
          cancels.push(cancel);
          return { promise: req.promise, cancel };
        }),
      };
    });

    const mod = await import('../hooks/useMapLocation');
    let hook = harness.render(() => mod.useMapLocation());
    initReq.resolve({ lat: 45, lng: 9, timestamp: 1000, accuracy: 8 });
    await Promise.resolve();
    await Promise.resolve();
    hook = harness.render(() => mod.useMapLocation());

    const pending = hook.refresh();
    harness.unmount();
    pendingReq.resolve({ lat: 99, lng: 99, timestamp: 2000, accuracy: 1 });
    await expect(pending).resolves.toBeNull();
    expect(cancels.at(-1)).toHaveBeenCalledTimes(1);
  });
});
