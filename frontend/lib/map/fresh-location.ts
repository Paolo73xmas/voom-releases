import type * as Location from 'expo-location';

export type MapFix = { lat: number; lng: number; timestamp: number; accuracy: number | null };
export type LocationPort = Pick<typeof Location, 'Accuracy' | 'getForegroundPermissionsAsync' | 'requestForegroundPermissionsAsync' | 'hasServicesEnabledAsync' | 'watchPositionAsync'>;
export type LocationIssue = { message: string; openSettings?: boolean };
export class MapLocationError extends Error {
  constructor(public code: 'permission' | 'services' | 'timeout' | 'cancelled' | 'unavailable', message: string, public openSettings = false) { super(message); }
}
export const MAX_FIX_AGE_MS = 5000;
export const GPS_TIMEOUT_MS = 20000;

export function freshMapFix(value: Location.LocationObject, now: number): MapFix | null {
  const c = value?.coords;
  if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || Math.abs(c.latitude) > 90 || Math.abs(c.longitude) > 180
    || !Number.isFinite(value.timestamp) || value.timestamp <= 0 || now - value.timestamp > MAX_FIX_AGE_MS || value.timestamp > now + 2000) return null;
  return { lat: c.latitude, lng: c.longitude, timestamp: value.timestamp,
    accuracy: c.accuracy != null && Number.isFinite(c.accuracy) && c.accuracy >= 0 ? c.accuracy : null };
}

/** One foreground acquisition, not ongoing tracking. Cached/late fixes cannot move the map. */
export function startFreshMapLocation(api: LocationPort, now = Date.now, timeoutMs = GPS_TIMEOUT_MS) {
  let settled = false, subscription: Location.LocationSubscription | undefined;
  let earlyFix: MapFix | null = null;
  let finish: (fix: MapFix | null, error?: MapLocationError) => void = () => {};
  const promise = new Promise<MapFix>((resolve, reject) => {
    const timer = setTimeout(() => finish(null, new MapLocationError('timeout', 'Posizione aggiornata non disponibile. Spostati in un luogo aperto e riprova.')), timeoutMs);
    finish = (fix, error) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      try { subscription?.remove(); } catch {
        reject(new MapLocationError('unavailable', 'Il servizio di posizione non ha completato la richiesta. Riprova.'));
        return;
      }
      if (fix) resolve(fix); else reject(error);
    };
    void (async () => {
      let permission = await api.getForegroundPermissionsAsync();
      if (settled) return;
      if (permission.status !== 'granted' && permission.canAskAgain) permission = await api.requestForegroundPermissionsAsync();
      if (settled) return;
      if (permission.status !== 'granted') throw new MapLocationError('permission', 'Consenti l’accesso alla posizione per centrare la mappa sul punto attuale.', !permission.canAskAgain);
      const enabled = await api.hasServicesEnabledAsync();
      if (settled) return;
      if (!enabled) throw new MapLocationError('services', 'La posizione del dispositivo è disattivata. Attivala e riprova.');
      const handle = await api.watchPositionAsync({ accuracy: api.Accuracy.High, timeInterval: 1000, distanceInterval: 0, mayShowUserSettingsDialog: true }, value => {
        if (settled) return;
        const fix = freshMapFix(value, now());
        if (fix) { if (subscription) finish(fix); else earlyFix = fix; }
      }, () => finish(null, new MapLocationError('unavailable', 'Impossibile leggere la posizione aggiornata. Controlla GPS e permessi, poi riprova.')));
      if (settled) handle.remove();
      else {
        subscription = handle;
        // Some providers deliver before returning the handle: close it before resolving the fix.
        if (earlyFix && now() - earlyFix.timestamp <= MAX_FIX_AGE_MS) finish(earlyFix);
      }
    })().catch(error => finish(null, error instanceof MapLocationError ? error : new MapLocationError('unavailable', 'Impossibile leggere la posizione aggiornata. Controlla GPS e permessi, poi riprova.')));
  });
  return { promise, cancel: () => finish(null, new MapLocationError('cancelled', 'Acquisizione annullata.')) };
}