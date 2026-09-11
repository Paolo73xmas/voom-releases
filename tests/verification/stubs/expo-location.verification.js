export const Accuracy = { Balanced: 2 };

function state() {
  return globalThis.__locMock || {};
}

export async function getForegroundPermissionsAsync() {
  if (state().getForegroundPermissionsAsync) return state().getForegroundPermissionsAsync();
  return { status: 'granted', canAskAgain: true };
}

export async function requestForegroundPermissionsAsync() {
  if (state().requestForegroundPermissionsAsync) return state().requestForegroundPermissionsAsync();
  return { status: 'granted', canAskAgain: true };
}

export async function getCurrentPositionAsync() {
  if (state().getCurrentPositionAsync) return state().getCurrentPositionAsync();
  return { coords: { latitude: 45.46, longitude: 9.19 } };
}
