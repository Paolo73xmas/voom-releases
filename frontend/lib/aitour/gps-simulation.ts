// Simulazione GPS per i test degli admin: ogni controllo di posizione della sezione AI Tour / Tour Live
// (acquisizione sul posto, riassegnazione orfani, esito con GPS, segnalazioni, partenza, battito posizione)
// riceve la posizione del punto atteso, come se l'admin fosse lì. Solo ruoli admin, mai agenti.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'aitour.gps.simulation';
let enabled = false, allowed = false, loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const isGpsSimulationRole = (role?: string | null) => role === 'admin' || role === 'admincustom';
/** Da chiamare con il ruolo dell'utente loggato: senza ruolo admin la simulazione è sempre spenta. */
export function setGpsSimulationAllowed(role?: string | null) {
  const next = isGpsSimulationRole(role);
  if (next === allowed && loaded) return;
  allowed = next;
  if (allowed && !loaded) { loaded = true; AsyncStorage.getItem(KEY).then((v) => { enabled = v === '1'; emit(); }).catch(() => undefined); }
  emit();
}
export const isGpsSimulated = () => allowed && enabled;
export function setGpsSimulation(on: boolean) {
  if (!allowed) return;
  enabled = on; emit();
  AsyncStorage.setItem(KEY, on ? '1' : '0').catch(() => undefined);
}
/** Posizione da restituire ai controlli GPS quando la simulazione è attiva: il punto atteso. */
export const simulatedPosition = <T extends { lat: number; lng: number }>(near: T | null | undefined): T | null => (isGpsSimulated() ? near ?? null : null);
export function useGpsSimulation() {
  const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
  return { allowed: useSyncExternalStore(subscribe, () => allowed, () => allowed), enabled: useSyncExternalStore(subscribe, () => allowed && enabled, () => false), toggle: () => setGpsSimulation(!enabled) };
}
