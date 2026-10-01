import type { TourIntent } from './gptour-intent';
import type { TourCandidate, TourPlan, SavedAreaFilter } from './types';
import type { GptDayPlan } from './gptour-engine';
import { candidateIntentProblems } from './gptour-criteria';
import { isoDow } from './gptour-dates';
export interface GptourContext {
  version: 1; source: 'mobile'; webReference: string; groupId: string; dayIndex: number; dayCount: number;
  intent: TourIntent; followUpDecisions: TourIntent['followUpDecisions']; lodgingRule: TourIntent['lodgingRule'];
  routingState: { fallback: boolean; nightDecision: GptDayPlan['nightDecision']; nightKmHome: number | null; startsFrom: GptDayPlan['startsFrom']; returnHome: boolean };
  facts: TourCandidate[]; plannedDate: string; groupDates: string[];
}
export function attachGptourContext(days: GptDayPlan[], intent: TourIntent, groupId: string): GptDayPlan[] {
  return days.map((day, index) => ({ ...day, plan: { ...day.plan, areaFilter: { ...(day.plan.areaFilter || { mode: 'auto' }),
    finishMin: day.plan.finishMin, returnMin: day.plan.returnMin, routingFallback: day.plan.routingFallback,
    gptourContext: { version: 1, source: 'mobile', webReference: '88bfb440d86ca4103016ed2b5c1ed3416ecf497a', groupId, dayIndex: index, dayCount: days.length,
      intent, followUpDecisions: intent.followUpDecisions, lodgingRule: intent.lodgingRule,
      routingState: { fallback: day.plan.routingFallback, nightDecision: day.nightDecision, nightKmHome: day.nightKmHome, startsFrom: day.startsFrom, returnHome: day.returnHomeAfterDay },
      facts: day.plan.stops.map((s) => s.candidate), plannedDate: day.plan.tourDate, groupDates: days.map((d) => d.plan.tourDate) },
  } } }));
}
export function readGptourContext(area?: SavedAreaFilter | null): GptourContext | null {
  const ctx = area?.gptourContext;
  if (!ctx) return null;
  if (ctx.version !== 1 || !Array.isArray(ctx.facts) || !ctx.intent || !Array.isArray(ctx.intent.excludedStops)) throw new Error('Contesto GPTour non supportato. Il giro è visibile, ma i criteri non possono essere ricostruiti.');
  return ctx;
}
export function factForCandidate(c: TourCandidate, ctx: GptourContext): TourCandidate | undefined {
  return ctx.facts.find((x) => c.customerId ? x.customerId === c.customerId : c.tabaccheriaId ? x.tabaccheriaId === c.tabaccheriaId : x.key === c.key);
}
export function restoreGptourCandidate(c: TourCandidate, area?: SavedAreaFilter | null): TourCandidate {
  let ctx: GptourContext | null;
  try { ctx = readGptourContext(area); } catch { return c; }
  const fact = ctx && factForCandidate(c, ctx);
  return fact ? { ...c, ...fact, lat: c.lat, lng: c.lng, name: c.name } : c;
}
export function gptourMetadataWarning(area: SavedAreaFilter | null | undefined, name: string | null, candidates?: TourCandidate[], tourDate?: string): string | null {
  let ctx: GptourContext | null;
  try { ctx = readGptourContext(area); } catch (e) { return (e as Error).message; }
  if (!ctx) return /gptour/i.test(name || '') ? 'Questo tour GPTour non contiene i criteri originali. Le operazioni che richiedono tali criteri non sono disponibili.' : null;
  if (tourDate && ctx.plannedDate !== tourDate) return 'La data del giro non coincide più con il contesto GPTour. Verifica i follow-up e le dipendenze fra giornate prima di ricalcolare.';
  if (candidates?.some((c) => { const f = factForCandidate(c, ctx); return f && (Math.abs(f.lat - c.lat) > .000001 || Math.abs(f.lng - c.lng) > .000001); })) return 'Le coordinate del giro sono cambiate senza aggiornare il contesto GPTour. Verifica percorso e pernottamenti.';
  if (candidates && candidates.some((c) => !factForCandidate(c, ctx))) return 'Il giro è stato modificato senza aggiornare il contesto GPTour. Verifica i criteri prima di aggiungere o ricalcolare visite.';
  return null;
}
export function assertGptourPlan(plan: TourPlan): void {
  const ctx = readGptourContext(plan.areaFilter); if (!ctx) return;
  const errors: string[] = [];
  if (ctx.plannedDate && ctx.plannedDate !== plan.tourDate) errors.push('Data del giro diversa dal contesto GPTour');
  for (const s of plan.stops) {
    const issues = candidateIntentProblems(s.candidate, ctx.intent);
    if (issues.length) errors.push(`${s.candidate.name}: ${issues.join(', ')}`);
    if (s.outsideWindow || s.candidate.excludedDays?.includes(isoDow(plan.tourDate))) errors.push(`${s.candidate.name}: fascia/giorno non disponibile`);
  }
  if (plan.routingFallback) errors.push('Percorso stradale non verificato');
  if (plan.finishMin > plan.endMin) errors.push('Il giro supera l’orario disponibile');
  if (errors.length) throw new Error([...new Set(errors)].join('. '));
}