// Viewport guards: reject invalid/older updates; accept stable/later pan updates.
import { describe, expect, it } from 'vitest';
import { acceptViewport } from '../lib/map/viewport';

describe('map viewport guards', () => {
  it('accepts first valid viewport and rejects invalid coordinates', () => {
    const first = acceptViewport(null, { lat: 45.1, lng: 9.1, zoom: 13, version: 0 });
    expect(first).toMatchObject({ lat: 45.1, lng: 9.1, version: 0 });
    const invalid = acceptViewport(first, { lat: 451, lng: 9.1, zoom: 13, version: 1 } as never);
    expect(invalid).toEqual(first);
  });

  it('rejects older version and accepts same/newer versions', () => {
    const current = { lat: 45.2, lng: 9.2, zoom: 12, version: 2 };
    const older = acceptViewport(current, { lat: 40.0, lng: 10.0, zoom: 10, version: 1 });
    expect(older).toEqual(current);

    const same = acceptViewport(current, { lat: 45.3, lng: 9.3, zoom: 12, version: 2 });
    expect(same).toMatchObject({ lat: 45.3, lng: 9.3, version: 2 });

    const newer = acceptViewport(current, { lat: 45.4, lng: 9.4, zoom: 11, version: 3 });
    expect(newer).toMatchObject({ lat: 45.4, lng: 9.4, version: 3 });
  });
});
