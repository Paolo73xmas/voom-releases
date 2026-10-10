import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_INTENT, mergeIntent, sanitizeIntentPatch, type TourIntent } from '../lib/aitour/gptour-intent';
import { applyConversationRules, verifiedPlanningPool } from '../lib/aitour/gptour-registry';
import { purchaseMinDays } from '../lib/aitour/gptour-purchase-intent';
import { candidateMatchesTourIntent } from '../lib/aitour/gptour-criteria';
import { prepareGptDays, buildGptour } from '../lib/aitour/gptour-engine';
import { acceptDisplayedFillKeys, acceptedCandidateProblems } from '../lib/aitour/gptour-acceptance';
import { resolvePlanningScope, verifiedAgentInfo } from '../lib/aitour/gptour-planning-pool';
import { refreshPurchaseHistory } from '../lib/aitour/gptour-purchases';
import { validateCommercialGroups } from '../lib/aitour/gptour-commercial';
import { applyDevelopmentIntent } from '../lib/aitour/gptour-development';
import { attachGptourContext, readGptourContext } from '../lib/aitour/gptour-context';
import { enforceDayConsent } from '../lib/aitour/gptour-day-consent';
import { DEFAULT_SETTINGS, type TourCandidate, type EntityType } from '../lib/aitour/types';
import type { GptResult } from '../lib/aitour/gptour-api';
import type { RoutingDependencies } from '../lib/aitour/gptour-routing';
vi.mock('../lib/supabase', () => ({ supabase: {} }));
vi.mock('../lib/theme', () => ({ currentThemeMode: 'light' }));

const turn = (text: string, prev: TourIntent = DEFAULT_INTENT, patch: Partial<TourIntent> = {}) =>
  applyConversationRules(applyDevelopmentIntent(mergeIntent(prev, patch), text), text, prev);
function candidate(key: string, type: EntityType = 'client', days: number | null = null,
  fact: Partial<NonNullable<NonNullable<TourCandidate['gptourData']>['commercial']>> = {}): TourCandidate {
  const fresh = type === 'free' || type === 'never';
  return { key, entityType: type, name: key, customerId: fresh ? null : key, tabaccheriaId: `tab-${key}`,
    lat: 45.4, lng: 9.15, city: 'Rozzano', province: 'MI', address: '', lastVisitDate: null,
    lastOrderDate: days == null ? null : new Date(Date.now() - days * 86400000).toISOString().slice(0, 10),
    daysSinceOrder: days, daysSinceVisit: null, daysSincePhysicalContact: null, orderCount: days == null ? 0 : 2,
    totalRevenue: 0, revenue6m: 0, avgOrderValue: 0, avgReorderDays: null, followUpDate: null, appointmentAt: null,
    notes: null, orphanStatus: null, estimatedRevenue: null, score: 50, priorityClass: 'Media', reason: '',
    nextSuggestedVisit: null, visitMinutes: 20, potentialValue: 0,
    gptourData: { contactKnown: true, orderKnown: true, revenueKnown: true,
      commercial: { authorized: true, relationship: fresh ? 'none' : 'own', newPointVerified: fresh, purchasesVerified: true, ...fact } } };
}
const pool = [candidate('old', 'client', 21), candidate('edge', 'client', 20), candidate('recent', 'client', 19),
  { ...candidate('visited'), lastVisitDate: '2026-09-01', daysSincePhysicalContact: 2 },
  { ...candidate('contact', 'prospect'), lastPhysicalContactDate: '2026-09-01' },
  candidate('prospect-order', 'prospect', 30), candidate('orphan-order', 'orphan', 30, { relationship: 'other' }),
  candidate('orphan-empty', 'orphan', null, { relationship: 'unknown' }), candidate('new', 'never'), candidate('free', 'free'),
  candidate('unknown', 'free', null, { newPointVerified: false }), candidate('outside', 'client', 50, { authorized: false }),
  candidate('unverified-order', 'client', 50, { purchasesVerified: false })];
const keys = (i: TourIntent) => verifiedPlanningPool(pool, i).map(c => c.key);
const raw = (selection: TourCandidate[]): GptResult => ({ reply: 'fixture', needsInfo: false, multiDay: false, lodging: 'home',
  tourDate: '2099-10-05', startTime: '08:00', endTime: '18:00', selection: selection.map(c => ({ key: c.key, reason: null })), days: [], notes: null });
const deps: RoutingDependencies = { matrix: async points => ({ fallback: false,
  durations: points.map((_, i) => points.map((_, j) => i === j ? 0 : 60)), distances: points.map((_, i) => points.map((_, j) => i === j ? 0 : 100)) }),
  route: async points => ({ fallback: false, latlngs: points.map(p => [p.lat, p.lng]), legs: points.slice(1).map(() => ({ durationMin: 1, distanceKm: .1 })),
    totalMin: points.length - 1, totalKm: .5, kmUrban: null, kmExtra: null, kmHighway: null }) };

describe('commercial classification and scoped purchase groups', () => {
  it.each(['Domani voglio fare sviluppo a Rozzano', 'Una giornata di acquisizione a Rozzano', 'Tabaccherie mai visitate a Rozzano'])('preserves explicit development classification: %s', text => {
    const i = turn(text);
    expect(i.commercialGroups).toMatchObject({ existing: false, newPoints: true });
    expect(i.requestedArea?.comune).toBe('Rozzano');
    expect(keys(i)).toEqual(['new', 'free']);
  });
  it.each([
    'Clienti che non comprano da 30 giorni', 'Clienti senza ordini da almeno 30 giorni',
    'Clienti con ultimo acquisto almeno 30 giorni fa', 'Clienti che non ordinano da un mese',
  ])('equivalent purchase phrase: %s', text => {
    expect(purchaseMinDays(text)).toBe(30);
    expect(turn(text).commercialGroups).toMatchObject({ existing: true, newPoints: false, inactiveDays: 30, needsDays: false });
  });
  it('requires a threshold and accepts a numeric clarification without borrowing AI defaults', () => {
    const i = turn('Clienti inattivi negli acquisti', DEFAULT_INTENT, { orderMinDays: 30 });
    expect(i.commercialGroups).toMatchObject({ needsDays: true, inactiveDays: null });
    expect(keys(i)).toEqual([]);
    expect(turn('20 giorni', i).commercialGroups).toMatchObject({ inactiveDays: 20, needsDays: false });
    expect(turn('0 giorni', i).commercialGroups?.needsDays).toBe(true);
  });
  it.each([15, 20, 30])('inclusive threshold %s with actual order provenance, never a never-buyer', n => {
    const i = turn(`clienti senza ordini da ${n} giorni`);
    for (const d of [n - 1, n, n + 1, null])
      expect(candidateMatchesTourIntent(candidate('c', 'client', d), i)).toBe(d !== null && d >= n);
    expect(candidateMatchesTourIntent(candidate('snapshot', 'client', n + 1, { purchasesVerified: false }), i)).toBe(false);
  });
  it('existing relationships include visited never-buyers and contacted prospects, not registry unknowns', () => {
    const actual = keys(turn('I miei clienti'));
    expect(actual).toContain('visited'); expect(actual).toContain('contact'); expect(actual).toContain('old');
    for (const key of ['new', 'free', 'unknown', 'outside', 'orphan-order', 'orphan-empty']) expect(actual).not.toContain(key);
  });
  it('A: inactivity excludes visited never-buyers and new points, includes verified purchasing prospects/orphans', () => {
    expect(keys(turn('clienti che non comprano da 20 giorni'))).toEqual(['old', 'edge', 'prospect-order', 'orphan-order']);
  });
  it('B: existing clients plus new points includes never-buying relationships, no unknown/unauthorized category', () => {
    const actual = keys(turn('I miei clienti e le tabaccherie nuove'));
    for (const key of ['old', 'visited', 'contact', 'new', 'free']) expect(actual).toContain(key);
    for (const key of ['unknown', 'outside', 'orphan-empty', 'orphan-order']) expect(actual).not.toContain(key);
  });
  it('C: new points bypass ONLY purchase conditions, never relationships or territory', () => {
    const mixed = turn('clienti che non ordinano da 20 giorni e nuovi punti vendita mai visitati');
    expect(mixed.requireOrderHistory).toBe(false); expect(mixed.orderMinDays).toBeNull();
    expect(mixed.commercialGroups?.inactiveDays).toBe(20);
    expect(keys(turn('clienti che non ordinano da 20 giorni e nuovi punti vendita mai visitati')))
      .toEqual(['old', 'edge', 'prospect-order', 'orphan-order', 'new', 'free']);
    const i = turn('clienti senza ordini da 15 giorni più nuovi punti vendita');
    expect(candidateMatchesTourIntent(candidate('not-new', 'free', null, { relationship: 'other' }), i)).toBe(false);
    expect(candidateMatchesTourIntent(candidate('outside-new', 'never', null, { authorized: false }), i)).toBe(false);
    expect(candidateMatchesTourIntent({ ...candidate('dirty', 'never'), lastVisitDate: '2026-01-01' }, i)).toBe(false);
    expect(candidateMatchesTourIntent({ ...candidate('legacy', 'never'), gptourData: undefined }, i)).toBe(false);
  });
  it('mixed verifier refreshes only existing relationships; actual order loader nulls stale snapshots', async () => {
    const intent = turn('clienti senza ordini da 20 giorni e nuovi punti vendita');
    const refresh = vi.fn(async (cs: TourCandidate[]) => refreshPurchaseHistory(cs, async () => [
      { id: 'order', customer_id: 'edge', order_date: candidate('edge', 'client', 20).lastOrderDate! }]));
    const out = await resolvePlanningScope(pool, intent, { refresh, borders: async () => new Set<string>() });
    expect(out.pool!.map(c => c.key)).toEqual(['edge', 'new', 'free']);
    expect(refresh.mock.calls[0][0].every(c => !['free', 'never'].includes(c.entityType))).toBe(true);
    expect(verifiedAgentInfo(intent, 3).istruzioneRegistro).toContain('MAI per i nuovi');
  });
});

describe('consent, persistence and deterministic planning', () => {
  it('Rozzano -> 9:00 -> Opera preserves both groups, date, and ignores malicious model widening/reset patch', () => {
    let i = turn('Domani clienti che non comprano da 20 giorni e nuovi punti vendita a Rozzano', DEFAULT_INTENT, { tourDates: ['2099-10-05'] });
    i = { ...i, tourDates: ['2099-10-05'] };
    const groups = i.commercialGroups;
    i = turn('Parti dalle 9:00', i, { requestedEntityTypes: ['orphan'], orderMinDays: null, requireOrderHistory: false, allowedExpansionTypes: ['prospect'], tourDates: ['2099-10-06'], requestedArea: { comune: 'Roma' } });
    expect(i.commercialGroups).toEqual(groups); expect(i.tourDates).toEqual(['2099-10-05']); expect(i.requestedStartTime).toBe('09:00');
    i = turn('Aggiungi anche Opera', i);
    expect(i.requestedArea?.comuni).toEqual(['Rozzano', 'Opera']); expect(i.commercialGroups).toEqual(groups);
    i = turn('No, lascia perdere i nuovi clienti. Solo quelli che non ordinano da 20 giorni.', i);
    expect(i.commercialGroups).toMatchObject({ existing: true, newPoints: false, inactiveDays: 20 });
    expect(keys(i)).not.toContain('new');
  });
  it('explicit positive addition grants only the named group; mere AI suggestion or bare yes does not', () => {
    const i = turn('solo miei clienti che non comprano da 20 giorni');
    expect(turn('Parti alle 9:00', i, { commercialGroups: { version: 1, existing: true, newPoints: true, ownOnly: false, inactiveDays: null, needsDays: false } }).commercialGroups).toEqual(i.commercialGroups);
    expect(turn('sì', i, { allowedExpansionTypes: ['free', 'never'] }).commercialGroups).toEqual(i.commercialGroups);
    expect(turn('Sì, aggiungi anche nuovi punti vendita', i).commercialGroups).toMatchObject({ newPoints: true, inactiveDays: 20, ownOnly: true });
    expect(sanitizeIntentPatch({ commercialGroups: { newPoints: true }, acceptedFillKeys: ['new'] })).toEqual({});
  });
  it.each(['initial', 'fill', 'corridor'] as const)('client-only technical intent never broadens in %s, even forged receipts', mode => {
    const i = { ...DEFAULT_INTENT, requestedEntityTypes: ['client'] as EntityType[] };
    for (const type of ['prospect', 'free', 'never', 'orphan'] as EntityType[]) {
      const c = candidate(type, type);
      expect(candidateMatchesTourIntent(c, i, mode)).toBe(false);
      expect(acceptedCandidateProblems(c, i, [c.key])).toContain('tipologia non autorizzata');
      expect(() => acceptDisplayedFillKeys([], { candidates: [c], orderedKeys: [c.key] }, [c], i)).toThrow();
    }
  });
  it('technical category grants are literal, not AI inferred', () => {
    const i = turn('Solo i miei orfani', DEFAULT_INTENT, { requestedEntityTypes: ['orphan'], ownOrphansOnly: true });
    expect(turn('completa la giornata', i, { allowedExpansionTypes: ['prospect'], requestedEntityTypes: ['orphan', 'prospect'] }).allowedExpansionTypes).toEqual([]);
    expect(turn('aggiungi anche prospect', i).allowedExpansionTypes).toEqual(['prospect']);
  });
  it('two groups build a SINGLE feasible plan and survive context JSON without new dates', async () => {
    const i = { ...turn('Domani clienti senza ordini da 20 giorni e nuovi punti vendita a Rozzano'), tourDates: ['2099-10-05'] };
    const result = enforceDayConsent(raw(pool), i);
    const prepared = prepareGptDays(result, pool, i, DEFAULT_SETTINGS, '2099-10-05');
    expect(prepared.days).toHaveLength(1);
    expect(prepared.days[0].selection.map(s => s.key)).toEqual(keys(i));
    const built = await buildGptour(result, pool, i, { ...DEFAULT_SETTINGS, work_start: '08:00', work_end: '18:00' }, { lat: 45.39, lng: 9.15, label: 'Casa' }, '2099-10-05', deps);
    expect(built.days).toHaveLength(1);
    expect(built.days[0].plan.stops.some(s => s.candidate.key === 'new')).toBe(true);
    expect(built.days[0].plan.stops.some(s => s.candidate.key === 'edge')).toBe(true);
    expect(built.days[0].plan.finishMin).toBeLessThanOrEqual(built.days[0].plan.endMin);
    const ctx = attachGptourContext(built.days, i, 'isolated')[0].plan.areaFilter;
    expect(readGptourContext(JSON.parse(JSON.stringify(ctx)))?.intent.commercialGroups).toEqual(i.commercialGroups);
    expect(validateCommercialGroups(undefined)).toBeUndefined();
    expect(() => validateCommercialGroups({ version: 99 })).toThrow();
  });
  it('a four-client day is not expanded with other categories despite empty capacity', () => {
    const i = turn('Clienti che non comprano da 20 giorni');
    const prepared = prepareGptDays(raw(pool), pool, i, DEFAULT_SETTINGS, '2099-10-05');
    expect(prepared.days[0].selection).toHaveLength(4);
    expect(prepared.days[0].selection.some(s => s.key === 'free')).toBe(false);
  });
});