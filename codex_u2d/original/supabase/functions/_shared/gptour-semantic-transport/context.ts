// Pure proposal for the NEXT context. This function does not save it or authorize an agent.
import type { OperationalContext, TurnRequest } from './contract.ts';
import { isTimestamp } from './checks.ts';
export const emptyOperationalContext = (): OperationalContext => ({ departure: null, departureSource: null, acquiredAt: null, gps: null, lastPlanId: null, planRevision: null });
export function proposeOperationalContext(req: TurnRequest, prev: OperationalContext, acceptedAt: string): { context: OperationalContext; notices: string[] } {
  if (!isTimestamp(acceptedAt)) throw new Error('Invalid trusted acceptedAt');
  if (req.action?.type === 'reset') return { context: emptyOperationalContext(), notices: [] };
  const context: OperationalContext = JSON.parse(JSON.stringify(prev));
  const notices: string[] = [];
  if (req.departure) {
    context.departure = { ...req.departure }; context.departureSource = 'explicit'; context.acquiredAt = acceptedAt;
  }
  if (req.gps) {
    const g = req.gps, age = Date.parse(acceptedAt) - Date.parse(g.capturedAt);
    const valid = Number.isFinite(g.lat) && Number.isFinite(g.lng) && Math.abs(g.lat) <= 90 && Math.abs(g.lng) <= 180 &&
      !(g.lat === 0 && g.lng === 0) && Number.isFinite(g.accuracyM) && g.accuracyM >= 0 && g.accuracyM <= 200 &&
      isTimestamp(g.capturedAt) && age >= -30000 && age <= 300000;
    if (!valid) notices.push('GPS ignorato: coordinate, precisione o data di acquisizione non utilizzabili.');
    else {
      context.gps = { ...g };
      if (context.departureSource !== 'explicit') {
        context.departure = { lat: g.lat, lng: g.lng, label: 'GPS' }; context.departureSource = 'gps'; context.acquiredAt = acceptedAt;
      }
    }
  }
  return { context, notices };
}