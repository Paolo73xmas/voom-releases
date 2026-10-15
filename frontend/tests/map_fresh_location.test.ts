// Map fresh-location acquisition guards (permissions/services/freshness/cancel/timeout).
import { describe, expect, it, vi } from 'vitest';
import { MAX_FIX_AGE_MS, MapLocationError, freshMapFix, startFreshMapLocation } from '../lib/map/fresh-location';

type Permission = { status: 'granted' | 'denied'; canAskAgain: boolean };
type WatchCallback = Parameters<Parameters<typeof startFreshMapLocation>[0]['watchPositionAsync']>[1];
type WatchError = Parameters<Parameters<typeof startFreshMapLocation>[0]['watchPositionAsync']>[2];

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

function makePort(options?: {
  permission?: Permission;
  requestedPermission?: Permission;
  servicesEnabled?: boolean;
  watchDeferred?: ReturnType<typeof deferred<{ remove: ReturnType<typeof vi.fn> }>>;
}) {
  const remove = vi.fn();
  let watchCb: WatchCallback | null = null;
  let watchErr: WatchError | null = null;
  const watchDeferred = options?.watchDeferred ?? deferred<{ remove: ReturnType<typeof vi.fn> }>();

  const api = {
    Accuracy: { High: 6 },
    getForegroundPermissionsAsync: vi.fn(async () => options?.permission ?? { status: 'granted', canAskAgain: true }),
    requestForegroundPermissionsAsync: vi.fn(async () => options?.requestedPermission ?? { status: 'denied', canAskAgain: false }),
    hasServicesEnabledAsync: vi.fn(async () => options?.servicesEnabled ?? true),
    watchPositionAsync: vi.fn(async (_opts, cb, err) => {
      watchCb = cb;
      watchErr = err;
      return watchDeferred.promise;
    }),
  };

  return {
    api,
    remove,
    watchDeferred,
    emit: (value: { coords: { latitude: number; longitude: number; accuracy?: number | null }; timestamp: number }) => watchCb?.(value as never),
    fail: () => watchErr?.({ message: 'gps fail' } as never),
    resolveWatch: () => watchDeferred.resolve({ remove }),
  };
}

describe('fresh-location map guards', () => {
  it('freshMapFix accepts (0,0) as valid coordinate but rejects out-of-range/future/old', () => {
    const now = 1_000_000;
    expect(freshMapFix({ coords: { latitude: 0, longitude: 0, accuracy: 12 }, timestamp: now } as never, now)).toMatchObject({ lat: 0, lng: 0 });
    expect(freshMapFix({ coords: { latitude: 91, longitude: 0, accuracy: 1 }, timestamp: now } as never, now)).toBeNull();
    expect(freshMapFix({ coords: { latitude: 45, longitude: 9, accuracy: 1 }, timestamp: now - MAX_FIX_AGE_MS - 1 } as never, now)).toBeNull();
    expect(freshMapFix({ coords: { latitude: 45, longitude: 9, accuracy: 1 }, timestamp: now + 3000 } as never, now)).toBeNull();
  });

  it('denied permission with canAskAgain=false returns permission error with openSettings=true', async () => {
    const env = makePort({ permission: { status: 'denied', canAskAgain: false } });
    const run = startFreshMapLocation(env.api as never);
    const error = (await run.promise.catch(e => e)) as MapLocationError;
    expect(error).toMatchObject({ code: 'permission', openSettings: true });
  });

  it('services disabled returns services error and never starts watch', async () => {
    const env = makePort({ servicesEnabled: false });
    const run = startFreshMapLocation(env.api as never);
    const error = (await run.promise.catch(e => e)) as MapLocationError;
    expect(error).toMatchObject({ code: 'services' });
    expect(env.api.watchPositionAsync).not.toHaveBeenCalled();
  });

  it('ignores stale/future fixes and resolves on first fresh high-accuracy watch event', async () => {
    const nowRef = { now: 200_000 };
    const env = makePort();
    const run = startFreshMapLocation(env.api as never, () => nowRef.now);
    env.resolveWatch();
    await vi.waitFor(() => expect(env.api.watchPositionAsync).toHaveBeenCalledTimes(1));

    env.emit({ coords: { latitude: 45.1, longitude: 9.1, accuracy: 20 }, timestamp: nowRef.now - 60_000 });
    env.emit({ coords: { latitude: 45.2, longitude: 9.2, accuracy: 20 }, timestamp: nowRef.now + 30_000 });
    const pending = vi.fn();
    run.promise.then(pending).catch(() => undefined);
    await Promise.resolve();
    expect(pending).not.toHaveBeenCalled();

    const freshTs = nowRef.now - 1500;
    env.emit({ coords: { latitude: 45.3, longitude: 9.3, accuracy: 12 }, timestamp: freshTs });
    await expect(run.promise).resolves.toMatchObject({ lat: 45.3, lng: 9.3, timestamp: freshTs });
    expect(env.remove).toHaveBeenCalledTimes(1);
  });

  it('timeout rejects and clears watch; late callbacks cannot apply', async () => {
    vi.useFakeTimers();
    const env = makePort();
    const run = startFreshMapLocation(env.api as never, () => Date.now(), 20);
    const timeoutResult = run.promise.catch(e => e as MapLocationError);
    env.resolveWatch();
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(25);
    const error = await timeoutResult;
    expect(error).toMatchObject({ code: 'timeout' });
    expect(env.remove).toHaveBeenCalledTimes(1);

    env.emit({ coords: { latitude: 45, longitude: 9, accuracy: 10 }, timestamp: Date.now() });
    await Promise.resolve();
    vi.useRealTimers();
  });

  it('cancel while permission pending rejects cancelled and prevents late watch registration effects', async () => {
    const permissionDef = deferred<Permission>();
    const watchDef = deferred<{ remove: ReturnType<typeof vi.fn> }>();
    const remove = vi.fn();
    const api = {
      Accuracy: { High: 6 },
      getForegroundPermissionsAsync: vi.fn(async () => permissionDef.promise),
      requestForegroundPermissionsAsync: vi.fn(async () => ({ status: 'granted', canAskAgain: true })),
      hasServicesEnabledAsync: vi.fn(async () => true),
      watchPositionAsync: vi.fn(async () => watchDef.promise),
    };
    const run = startFreshMapLocation(api as never);
    run.cancel();
    permissionDef.resolve({ status: 'granted', canAskAgain: true });
    watchDef.resolve({ remove });

    const error = (await run.promise.catch(e => e)) as MapLocationError;
    expect(error).toMatchObject({ code: 'cancelled' });
    await Promise.resolve();
    expect(remove).not.toHaveBeenCalled();
  });

  it('watch throw rejects unavailable and next request can recover', async () => {
    const brokenApi = {
      Accuracy: { High: 6 },
      getForegroundPermissionsAsync: vi.fn(async () => ({ status: 'granted', canAskAgain: true })),
      requestForegroundPermissionsAsync: vi.fn(async () => ({ status: 'granted', canAskAgain: true })),
      hasServicesEnabledAsync: vi.fn(async () => true),
      watchPositionAsync: vi.fn(async () => {
        throw new Error('native watch failure');
      }),
    };
    const runA = startFreshMapLocation(brokenApi as never);
    const error = (await runA.promise.catch(e => e)) as MapLocationError;
    expect(error).toMatchObject({ code: 'unavailable' });

    const envB = makePort();
    const now = 400_000;
    const runB = startFreshMapLocation(envB.api as never, () => now);
    envB.resolveWatch();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(envB.api.watchPositionAsync).toHaveBeenCalledTimes(1);
    envB.emit({ coords: { latitude: 44.5, longitude: 10.1, accuracy: 8 }, timestamp: now - 1000 });
    await expect(runB.promise).resolves.toMatchObject({ lat: 44.5, lng: 10.1 });
  });

  it('supports early fresh callback before watch handle resolves', async () => {
    const now = 500_000;
    const env = makePort();
    const run = startFreshMapLocation(env.api as never, () => now);

    await vi.waitFor(() => expect(env.api.watchPositionAsync).toHaveBeenCalledTimes(1));
    env.emit({ coords: { latitude: 45.7, longitude: 9.7, accuracy: 6 }, timestamp: now - 500 });
    env.resolveWatch();

    await expect(run.promise).resolves.toMatchObject({ lat: 45.7, lng: 9.7, timestamp: now - 500 });
    expect(env.remove).toHaveBeenCalledTimes(1);
  });

  it('cancelled request removes late watch handle once it arrives', async () => {
    const watchDef = deferred<{ remove: ReturnType<typeof vi.fn> }>();
    const remove = vi.fn();
    const api = {
      Accuracy: { High: 6 },
      getForegroundPermissionsAsync: vi.fn(async () => ({ status: 'granted', canAskAgain: true })),
      requestForegroundPermissionsAsync: vi.fn(async () => ({ status: 'granted', canAskAgain: true })),
      hasServicesEnabledAsync: vi.fn(async () => true),
      watchPositionAsync: vi.fn(async () => watchDef.promise),
    };
    const run = startFreshMapLocation(api as never);
    await vi.waitFor(() => expect(api.watchPositionAsync).toHaveBeenCalledTimes(1));
    run.cancel();
    watchDef.resolve({ remove });

    const error = (await run.promise.catch(e => e)) as MapLocationError;
    expect(error).toMatchObject({ code: 'cancelled' });
    await Promise.resolve();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('remove() failure rejects unavailable and settles (no pending promise)', async () => {
    const env = makePort();
    const now = 600_000;
    env.remove.mockImplementation(() => {
      throw new Error('remove failed');
    });
    const run = startFreshMapLocation(env.api as never, () => now);
    await vi.waitFor(() => expect(env.api.watchPositionAsync).toHaveBeenCalledTimes(1));
    env.resolveWatch();
    await Promise.resolve();
    env.emit({ coords: { latitude: 45.9, longitude: 9.9, accuracy: 4 }, timestamp: now - 200 });

    const error = (await run.promise.catch(e => e)) as MapLocationError;
    expect(error).toMatchObject({ code: 'unavailable' });
  });
});
