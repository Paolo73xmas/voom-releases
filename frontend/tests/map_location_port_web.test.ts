// Web location-port adapter: browser watch/clear behavior and error/data forwarding.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

type AnyObj = Record<string, any>;

describe('map location-port web adapter', () => {
  it('uses browser watchPosition with strict options and forwards full coords + errors', async () => {
    vi.resetModules();
    const getPermissions = vi.fn(async () => ({ status: 'granted', canAskAgain: true }));
    const reqPermissions = vi.fn(async () => ({ status: 'granted', canAskAgain: true }));
    const servicesEnabled = vi.fn(async () => true);
    vi.doMock('expo-location', () => ({
      Accuracy: { High: 6 },
      getForegroundPermissionsAsync: getPermissions,
      requestForegroundPermissionsAsync: reqPermissions,
      hasServicesEnabledAsync: servicesEnabled,
    }));

    let successCb: any = null;
    let errorCb: any = null;
    let options: AnyObj | null = null;
    const clearWatch = vi.fn();
    const watchPosition = vi.fn((success, error, opts) => {
      successCb = success;
      errorCb = error;
      options = opts;
      return 77;
    });

    const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
      geolocation: {
        watchPosition,
        clearWatch,
      },
      },
    });

    const { locationPort } = await import('../lib/map/location-port');
    const fixes: AnyObj[] = [];
    const errors: string[] = [];
    const sub = await locationPort.watchPositionAsync(
      { accuracy: locationPort.Accuracy.High } as never,
      value => fixes.push(value),
      message => errors.push(message),
    );

    expect(watchPosition).toHaveBeenCalledTimes(1);
    expect(options).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 });

    if (!successCb || !errorCb) {
      throw new Error('geolocation callbacks were not captured');
    }

    successCb({
      coords: {
        latitude: 45.1,
        longitude: 9.1,
        accuracy: 12,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 123456,
    } as any);
    errorCb({ message: 'gps unavailable' } as any);

    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toMatchObject({
      timestamp: 123456,
      coords: {
        latitude: 45.1,
        longitude: 9.1,
        accuracy: 12,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
    });
    expect(errors).toEqual(['gps unavailable']);

    sub.remove();
    sub.remove();
    expect(clearWatch).toHaveBeenCalledTimes(1);

    if (previousDescriptor) Object.defineProperty(globalThis, 'navigator', previousDescriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  });

  it('throws when browser geolocation is unavailable', async () => {
    vi.resetModules();
    vi.doMock('expo-location', () => ({
      Accuracy: { High: 6 },
      getForegroundPermissionsAsync: vi.fn(),
      requestForegroundPermissionsAsync: vi.fn(),
      hasServicesEnabledAsync: vi.fn(),
    }));
    const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    const { locationPort } = await import('../lib/map/location-port');

    await expect(locationPort.watchPositionAsync({} as never, vi.fn())).rejects.toThrow('GEOLOCATION_UNAVAILABLE');
    if (previousDescriptor) Object.defineProperty(globalThis, 'navigator', previousDescriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  });

  it('never references removeSubscription/EventEmitter internals (web SDK regression guard)', () => {
    const source = readFileSync('/app/frontend/lib/map/location-port.ts', 'utf8');
    expect(source).not.toContain('.removeSubscription(');
    expect(source).not.toContain('new EventEmitter(');
    expect(source).toContain('geolocation.watchPosition');
    expect(source).toContain('geolocation.clearWatch');
  });
});
