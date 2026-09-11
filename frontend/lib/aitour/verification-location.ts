import * as Location from 'expo-location';
import { isVerificationPoint, verificationTimeout, type VerificationPoint } from '../api/customer-verification';

// Unica lettura foreground, contestuale all'invio. Mai coordinate della tappa
// spacciate per posizione agente e nessun blocco indefinito delle API native.
export async function getVerificationPosition(): Promise<VerificationPoint | null> {
  try {
    let permission = await verificationTimeout(Location.getForegroundPermissionsAsync(), 3000, 'Permesso GPS non disponibile');
    if (permission.status !== 'granted') {
      if (!permission.canAskAgain) return null;
      permission = await verificationTimeout(Location.requestForegroundPermissionsAsync(), 8000, 'Permesso GPS non concesso in tempo');
      if (permission.status !== 'granted') return null;
    }
    const position = await verificationTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 7000, 'GPS non disponibile');
    const point = { lat: position.coords.latitude, lng: position.coords.longitude };
    return isVerificationPoint(point) ? point : null;
  } catch { return null; }
}