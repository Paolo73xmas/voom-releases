import * as Location from 'expo-location';
import { isVerificationPoint, verificationTimeout, type VerificationPoint } from '../api/customer-verification';

import { simulatedPosition } from './gps-simulation';

// Unica lettura foreground, contestuale all'invio. Mai coordinate della tappa
// spacciate per posizione agente (salvo simulazione GPS admin per i test) e nessun blocco indefinito delle API native.
export async function getVerificationPosition(near?: VerificationPoint | null): Promise<VerificationPoint | null> {
  const simulated = simulatedPosition(near);
  if (simulated) return simulated;
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