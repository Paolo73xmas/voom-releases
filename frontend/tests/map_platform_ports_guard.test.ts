// Platform port static guards: native keeps Expo SDK path; hook imports platform port.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('map platform port guards', () => {
  it('native port remains Expo identity export', () => {
    const src = readFileSync('/app/frontend/lib/map/location-port.native.ts', 'utf8');
    expect(src).toContain("import * as Location from 'expo-location'");
    expect(src).toContain('export const locationPort = Location');
  });

  it('useMapLocation imports location-port platform module (not expo-location directly)', () => {
    const src = readFileSync('/app/frontend/hooks/useMapLocation.ts', 'utf8');
    expect(src).toContain("from '../lib/map/location-port'");
    expect(src).not.toContain("from 'expo-location'");
  });
});
