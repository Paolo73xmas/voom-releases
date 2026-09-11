export const Accuracy = { Balanced: 2 };
export async function getForegroundPermissionsAsync() { return { status: 'granted', canAskAgain: true }; }
export async function requestForegroundPermissionsAsync() { return { status: 'granted', canAskAgain: true }; }
export async function getCurrentPositionAsync() { return { coords: { latitude: 45.46, longitude: 9.19 } }; }
