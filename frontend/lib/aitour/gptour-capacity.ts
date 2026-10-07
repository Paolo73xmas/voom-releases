import type { AiTourSettings } from './types';

// Estratto invariato da web gptour-complete.ts @ a57b8e3e (solo per lo sviluppo).
export const MAX_DAY_RADIUS_KM = 45;
const toMin = (hhmm: string): number => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };
export function estimateDayCapacity(settings: AiTourSettings, avgVisitMin: number, avgTravelMin = 12): number {
  const available = toMin(settings.work_end) - toMin(settings.work_start) - (settings.lunch_break_minutes || 0);
  return Math.max(3, Math.floor(available / (avgVisitMin + avgTravelMin)));
}