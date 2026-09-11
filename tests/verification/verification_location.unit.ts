import assert from 'node:assert/strict';
import { getVerificationPosition } from '../../frontend/lib/aitour/verification-location';

async function run() {
  // cannot ask again -> nullable GPS (non-blocking)
  (globalThis as any).__locMock = {
    getForegroundPermissionsAsync: async () => ({ status: 'denied', canAskAgain: false }),
  };
  assert.equal(await getVerificationPosition(), null);

  // ask permission -> granted -> valid coords
  (globalThis as any).__locMock = {
    getForegroundPermissionsAsync: async () => ({ status: 'denied', canAskAgain: true }),
    requestForegroundPermissionsAsync: async () => ({ status: 'granted', canAskAgain: true }),
    getCurrentPositionAsync: async () => ({ coords: { latitude: 45.48, longitude: 9.21 } }),
  };
  const granted = await getVerificationPosition();
  assert.deepEqual(granted, { lat: 45.48, lng: 9.21 });

  // zero-zero invalid by policy
  (globalThis as any).__locMock = {
    getForegroundPermissionsAsync: async () => ({ status: 'granted', canAskAgain: true }),
    getCurrentPositionAsync: async () => ({ coords: { latitude: 0, longitude: 0 } }),
  };
  assert.equal(await getVerificationPosition(), null);

  // runtime failure/timeout-like rejection remains non-blocking
  (globalThis as any).__locMock = {
    getForegroundPermissionsAsync: async () => ({ status: 'granted', canAskAgain: true }),
    getCurrentPositionAsync: async () => {
      throw new Error('GPS timeout');
    },
  };
  assert.equal(await getVerificationPosition(), null);

  console.log('PASS verification_location.unit.ts');
}

run();
