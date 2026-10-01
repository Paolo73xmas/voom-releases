import { describe, expect, it, vi } from 'vitest';
import { allowedTypesFor, candidateMatchesTourIntent, DEFAULT_FILL_CONTACT_DAYS, type IntentMatchMode } from '../lib/aitour/gptour-criteria';
import { DEFAULT_INTENT, type TourIntent } from '../lib/aitour/gptour-intent';
import { DEFAULT_SETTINGS, type EntityType, type TourCandidate, type TourPlan } from '../lib/aitour/types';
import { proposeGptour } from '../lib/aitour/gptour-opportunities';
vi.mock('../lib/theme', () => ({ currentThemeMode: 'light' }));
vi.mock('../lib/supabase', () => ({ supabase: {} }));

function fixture(entityType: EntityType, key: string, isOwnOrphan = false, contact: number | null = null): TourCandidate {
  return { key, customerId: key, tabaccheriaId: null, entityType, name: key,
    city: 'Rozzano', province: 'MI', address: '', lat: 45.4, lng: 9.1,
    lastVisitDate: null, lastOrderDate: null, daysSinceVisit: null, daysSinceOrder: null,
    daysSincePhysicalContact: contact, orderCount: 0, totalRevenue: 0, revenue6m: 600,
    avgOrderValue: 0, avgReorderDays: null, followUpDate: null, appointmentAt: null,
    notes: null, orphanStatus: null, estimatedRevenue: null, score: 0, priorityClass: 'Media',
    reason: '', nextSuggestedVisit: null, visitMinutes: 20, potentialValue: 0, isOwnOrphan,
    gptourData: { contactKnown: true, orderKnown: true, revenueKnown: true, zoneNames: ['Sud'] } };
}
const pool = [fixture('orphan', 'own', true), fixture('orphan', 'other'), fixture('prospect', 'prospect'), fixture('free', 'free'), fixture('never', 'never')];
const ownIntent: TourIntent = { ...DEFAULT_INTENT, requestedEntityTypes: ['orphan'], ownOrphansOnly: true, allowedExpansionTypes: [] };
const accepted = (intent: TourIntent, mode: IntentMatchMode) => pool.filter((c) => candidateMatchesTourIntent(c, intent, mode)).map((c) => c.key);

describe('GPTour fill/corridor — parity with web 88bfb44', () => {
  it('A: own orphan + progressive prospect/free/never; never foreign orphan', () => {
    expect(allowedTypesFor(ownIntent, 'fill')).toBeNull();
    expect(accepted(ownIntent, 'fill')).toEqual(['own', 'prospect', 'free', 'never']);
  });
  it('B: corridor never broadens orphan-only without explicit expansion', () => {
    expect([...allowedTypesFor(ownIntent, 'corridor')!]).toEqual(['orphan']);
    expect(accepted(ownIntent, 'corridor')).toEqual(['own']);
  });
  it.each(['fill', 'corridor'] as const)('C: explicit prospect expansion constrains %s, excludes free/never and foreign orphan', (mode) => {
    const intent = { ...ownIntent, allowedExpansionTypes: ['prospect'] as EntityType[] };
    expect(accepted(intent, mode)).toEqual(['own', 'prospect']);
  });
  it.each(['fill', 'corridor', 'initial'] as const)('D: ownOrphansOnly=false adds no ownership restriction (%s)', (mode) => {
    const intent = { ...ownIntent, ownOrphansOnly: false };
    expect(candidateMatchesTourIntent(pool[0], intent, mode)).toBe(true);
    expect(candidateMatchesTourIntent(pool[1], intent, mode)).toBe(true);
  });
  it.each(['fill', 'corridor', 'initial'] as const)('no requested or expansion types => unrestricted type set (%s)', (mode) => {
    expect(allowedTypesFor(DEFAULT_INTENT, mode)).toBeNull();
    expect(accepted(DEFAULT_INTENT, mode)).toEqual(pool.map((c) => c.key));
  });
  it.each(['fill', 'corridor', 'initial'] as const)('expansion-only Intent is constrained to explicit types (%s)', (mode) => {
    expect(accepted({ ...DEFAULT_INTENT, allowedExpansionTypes: ['prospect'] }, mode)).toEqual(['prospect']);
  });
  it('initial AI selection remains constrained and does not inherit progressive fill', () => {
    expect(accepted(ownIntent, 'initial')).toEqual(['own']);
  });
  it('web null means no type gate, ranking remains responsible for priority (including client fallback)', () => {
    expect(candidateMatchesTourIntent(fixture('client', 'client'), ownIntent, 'fill')).toBe(true);
    expect(candidateMatchesTourIntent(fixture('client', 'client'), ownIntent, 'corridor')).toBe(false);
  });
  it.each([14, 15, 16, null])('default prospect physical-contact boundary %s (fill and explicitly authorized corridor)', (days) => {
    expect(DEFAULT_FILL_CONTACT_DAYS).toBe(15);
    const p = fixture('prospect', 'p', false, days), pass = days === null || days >= 15;
    expect(candidateMatchesTourIntent(p, ownIntent, 'fill')).toBe(pass);
    expect(candidateMatchesTourIntent(p, { ...ownIntent, allowedExpansionTypes: ['prospect'] }, 'corridor')).toBe(pass);
  });
  it.each([29, 30, 31, null])('explicit physical-contact threshold30 takes priority over default15 (%s)', (days) => {
    expect(candidateMatchesTourIntent(fixture('prospect', 'p', false, days), { ...ownIntent, physicalContactMinDays: 30 }, 'fill')).toBe(days === null || days >= 30);
  });
  it('explicit zero is not overwritten by default; unknown remains unknown', () => {
    const p = fixture('prospect', 'p', false, 0);
    expect(candidateMatchesTourIntent(p, { ...ownIntent, physicalContactMinDays: 0 }, 'fill')).toBe(true);
    expect(candidateMatchesTourIntent({ ...p, daysSincePhysicalContact: null, gptourData: { contactKnown: false, orderKnown: true, revenueKnown: true } }, ownIntent, 'fill')).toBe(false);
  });
  it('progressive types never bypass exclusions, revenue or strict area', () => {
    const p = pool[2];
    for (const patch of [{ excludedStops: [p.key] }, { rejectedOpportunityKeys: [p.key] }, { minRevenue: 700 }, { requestedArea: { comune: 'Milano' } }, { requestedArea: { provincia: 'TO' } }, { requestedArea: { zona: 'Nord' } }])
      expect(candidateMatchesTourIntent(p, { ...ownIntent, ...patch }, 'fill')).toBe(false);
  });
  it('actual proposal uses progressive fill order and strict corridor; does not mutate Intent or insert automatically', async () => {
    const start = { lat: 45.39, lng: 9.1, label: 'Casa' }, end = { lat: 45.41, lng: 9.1, label: 'Fine' };
    const plan = { start, end, stops: [], geometry: [[45.39, 9.1], [45.41, 9.1]], bufferMin: 500, finishMin: 500, endMin: 1100, routingFallback: false } as unknown as TourPlan;
    const matrix = vi.fn(async (points: { lat: number; lng: number }[]) => ({ fallback: false,
      durations: points.map((_, i) => points.map((_, j) => i === j ? 0 : 60)), distances: points.map((_, i) => points.map((_, j) => i === j ? 0 : 100)) }));
    const before = JSON.stringify(ownIntent);
    expect((await proposeGptour(plan, [plan], [...pool].reverse(), ownIntent, DEFAULT_SETTINGS, false, matrix)).candidates.map((c) => c.key)).toEqual(['own', 'prospect', 'never', 'free']);
    expect((await proposeGptour(plan, [plan], pool, ownIntent, DEFAULT_SETTINGS, true, matrix)).candidates.map((c) => c.key)).toEqual(['own']);
    expect(JSON.stringify(ownIntent)).toBe(before); expect(plan.stops).toHaveLength(0);
  });
});