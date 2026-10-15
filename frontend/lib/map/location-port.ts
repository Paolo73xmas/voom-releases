import * as Location from 'expo-location';
import type { LocationPort } from './fresh-location';

/** Web only: use the public browser watcher/clearWatch pair, not Expo 19's incompatible
 * web EventEmitter.removeSubscription path. Native resolves location-port.native.ts. */
export const locationPort: LocationPort = {
  Accuracy: Location.Accuracy,
  getForegroundPermissionsAsync: () => Location.getForegroundPermissionsAsync(),
  requestForegroundPermissionsAsync: () => Location.requestForegroundPermissionsAsync(),
  hasServicesEnabledAsync: () => Location.hasServicesEnabledAsync(),
  watchPositionAsync: async (_options, onPosition, onError) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) throw new Error('GEOLOCATION_UNAVAILABLE');
    const geolocation = navigator.geolocation;
    const id = geolocation.watchPosition(value => onPosition({
      timestamp: value.timestamp,
      coords: {
        latitude: value.coords.latitude, longitude: value.coords.longitude,
        accuracy: value.coords.accuracy, altitude: value.coords.altitude,
        altitudeAccuracy: value.coords.altitudeAccuracy, heading: value.coords.heading, speed: value.coords.speed,
      },
    }), error => onError?.(error.message), { enableHighAccuracy: true, maximumAge: 0 });
    let removed = false;
    return { remove: () => { if (!removed) { removed = true; geolocation.clearWatch(id); } } };
  },
};