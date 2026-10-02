import { describe, expect, it, vi, beforeEach } from 'vitest';
import { acceptDisplayedFillKeys, acceptedCandidateProblems, acceptedKeysAfterIntentPatch, readAcceptedFillKeys, retainAcceptedFillKeys } from '../lib/aitour/gptour-acceptance';
import { DEFAULT_INTENT, sanitizeIntentPatch, type TourIntent } from '../lib/aitour/gptour-intent';
import { candidateMatchesTourIntent } from '../lib/aitour/gptour-criteria';
import { buildGptour, prepareGptDays } from '../lib/aitour/gptour-engine';
import { attachGptourContext, assertGptourPlan, readGptourContext, restoreGptourCandidate } from '../lib/aitour/gptour-context';
import { protectLivePlan } from '../lib/aitour/brief-live';
import { saveToursBatch, type SavedTour } from '../lib/aitour/tours';
import { DEFAULT_SETTINGS, type TourCandidate, type TourPlan, type EntityType } from '../lib/aitour/types';
import type { GptResult } from '../lib/aitour/gptour-api';
import type { RoutingDependencies } from '../lib/aitour/gptour-routing';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../lib/theme', () => ({ currentThemeMode: 'light' }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }));
const home = { lat: 45.4, lng: 9.1, label: 'Casa' }, date = '2099-10-05';
const settings = { ...DEFAULT_SETTINGS, work_start: '09:00', work_end: '18:00', lunch_break_minutes: 0 };
const intent: TourIntent = { ...DEFAULT_INTENT, requestedEntityTypes: ['orphan'], ownOrphansOnly: true };
function candidate(type: EntityType, key: string, patch: Partial<TourCandidate> = {}): TourCandidate {
  return { key, customerId: key, tabaccheriaId: null, entityType: type, name: key, lat: 45.41, lng: 9.11,
    city: 'Rozzano', province: 'MI', address: '', lastVisitDate: null, lastOrderDate: null,
    daysSinceVisit: null, daysSinceOrder: null, daysSincePhysicalContact: null, orderCount: 0, totalRevenue: 0,
    revenue6m: 600, avgOrderValue: 0, avgReorderDays: null, followUpDate: null, appointmentAt: null,
    notes: null, orphanStatus: null, estimatedRevenue: null, score: 0, priorityClass: 'Media', reason: '',
    nextSuggestedVisit: null, visitMinutes: 20, potentialValue: 0, isOwnOrphan: type === 'orphan',
    gptourData: { contactKnown: true, orderKnown: true, revenueKnown: true, zoneNames: ['Sud'] }, ...patch };
}
const own = candidate('orphan', 'own'), prospect = candidate('prospect', 'prospect'), otherProspect = candidate('prospect', 'other-prospect');
const free = candidate('free', 'free'), never = candidate('never', 'never'), foreign = candidate('orphan', 'foreign', { isOwnOrphan: false });
const pool = [own, prospect, otherProspect, free, never, foreign];
const result = (keys: string[]): GptResult => ({ reply: 'Fixture', needsInfo: false, multiDay: false, lodging: 'home',
  tourDate: date, startTime: null, endTime: null, selection: keys.map((key) => ({ key, reason: null })), days: [], notes: null });
const deps: RoutingDependencies = {
  matrix: async (points) => ({ fallback: false, durations: points.map((_, i) => points.map((_, j) => i === j ? 0 : 60)), distances: points.map((_, i) => points.map((_, j) => i === j ? 0 : 100)) }),
  route: async (points) => ({ fallback: false, latlngs: points.map((p) => [p.lat, p.lng]), legs: points.slice(1).map(() => ({ durationMin: 1, distanceKm: .1 })),
    totalMin: points.length - 1, totalKm: (points.length - 1) * .1, kmUrban: null, kmExtra: null, kmHighway: null }),
};
const proposed = (list: TourCandidate[]) => ({ candidates: list, orderedKeys: ['own', ...list.map((c) => c.key)] });
const accept = (...list: TourCandidate[]) => acceptDisplayedFillKeys([], proposed(list), pool, intent);
const planWith = async (keys = ['prospect']) => {
  const built = await buildGptour(result(['own', ...keys]), pool, intent, settings, home, date, deps, [], keys);
  built.days[0].plan.areaFilter = { mode: 'city', city: 'Rozzano', zoneIds: ['existing-zone'] };
  return attachGptourContext(built.days, intent, 'group', keys)[0].plan;
};
beforeEach(() => { rpc.mockReset(); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Real network forbidden'); })); });

describe('GPTour accepted fill keys — explicit, exact and local to context', () => {
  it('only displayed and accepted keys are registered; Intent never broadened', () => {
    const previous = JSON.stringify(intent), keys = accept(prospect);
    expect(keys).toEqual(['prospect']); expect(JSON.stringify(intent)).toBe(previous);
    expect(acceptedCandidateProblems(prospect, intent, keys)).toEqual([]);
    expect(acceptedCandidateProblems(otherProspect, intent, keys)).toContain('tipologia non autorizzata');
    expect(candidateMatchesTourIntent(prospect, intent, 'corridor')).toBe(false);
    expect(candidateMatchesTourIntent(prospect, intent, 'initial')).toBe(false);
  });
  it('accepting only prospect does not admit free/never or another key of same type', () => {
    const prepared = prepareGptDays(result(['own', 'prospect', 'other-prospect', 'free', 'never']), pool, intent, settings, date, accept(prospect));
    expect(prepared.days[0].selection.map((s) => s.key)).toEqual(['own', 'prospect']);
    expect(prepared.warnings).toHaveLength(3);
  });
  it('multiple offered free/never/prospect remain after actual deterministic rebuild', async () => {
    const keys = accept(prospect, free, never);
    const built = await buildGptour(result(['own', ...keys]), pool, intent, settings, home, date, deps, [], keys);
    expect(built.days[0].plan.stops.map((s) => s.candidate.key).sort()).toEqual(['free', 'never', 'own', 'prospect']);
    expect(built.warnings).toEqual([]);
  });
  it('LLM fields cannot manufacture acceptance', () => {
    const malicious = { ...result(['own', 'prospect']), acceptedFillKeys: ['prospect'], gptourContext: { version: 1, acceptedFillKeys: ['prospect'] } };
    expect(sanitizeIntentPatch({ acceptedFillKeys: ['prospect'] })).toEqual({});
    expect(prepareGptDays(malicious, pool, intent, settings, date).days[0].selection.map((s) => s.key)).toEqual(['own']);
  });
  it('rejects an unknown proposal key or key absent from insertion order', () => {
    expect(() => acceptDisplayedFillKeys([], proposed([candidate('prospect', 'unknown')]), pool, intent)).toThrow('non è più disponibile');
    expect(() => acceptDisplayedFillKeys([], { candidates: [prospect], orderedKeys: ['own'] }, pool, intent)).toThrow('non è più disponibile');
  });
  it('revalidates current pool, not stale displayed facts', () => {
    expect(() => acceptDisplayedFillKeys([], proposed([prospect]), [own, { ...prospect, daysSincePhysicalContact: 1 }], intent)).toThrow('non più idonea');
  });
  it('foreign orphan never accepted, even if receipt is forged', () => {
    expect(() => acceptDisplayedFillKeys([], proposed([foreign]), pool, intent)).toThrow('orfano non proprio');
    expect(acceptedCandidateProblems(foreign, intent, ['foreign'])).toContain('orfano non proprio');
    expect(() => prepareGptDays(result(['own', 'foreign']), pool, intent, settings, date, ['foreign'])).toThrow('in conflitto');
  });
  it.each([14, 15, 16, null])('keeps fill prospect default15 on accepted key (%s)', (days) => {
    const p = { ...prospect, daysSincePhysicalContact: days };
    expect(acceptedCandidateProblems(p, intent, ['prospect']).length === 0).toBe(days === null || days >= 15);
  });
  it.each([
    ['fatturato', { minRevenue: 700 }], ['ordine', { orderMinDays: 30 }], ['contatto', { physicalContactMinDays: 30 }],
    ['progetto', { project: 'FED' }],
    ['provincia', { requestedArea: { provincia: 'TO' } }],
    ['esclusione', { excludedStops: ['prospect'] }], ['rifiuto', { rejectedOpportunityKeys: ['prospect'] }],
  ] as [string, Partial<TourIntent>][])('accepted key never bypasses %s and produces conflict, not silent removal', (_, patch) => {
    const current = { ...prospect, daysSincePhysicalContact: 20, daysSinceOrder: 20 };
    const next = { ...intent, ...patch };
    expect(acceptedCandidateProblems(current, next, ['prospect']).length).toBeGreaterThan(0);
    expect(() => prepareGptDays(result(['own', 'prospect']), [own, current], next, settings, date, ['prospect'])).toThrow('fill accettata in conflitto');
  });
  it('explicit expansions still restrict accepted types', () => {
    const next: TourIntent = { ...intent, allowedExpansionTypes: ['prospect'] };
    expect(acceptedCandidateProblems(free, next, ['free'])).toContain('tipologia non autorizzata');
    expect(acceptedCandidateProblems(prospect, next, ['prospect'])).toEqual([]);
  });
  it('missing accepted candidate cannot silently disappear', () => {
    expect(() => prepareGptDays(result(['own', 'prospect']), [own], intent, settings, date, ['prospect'])).toThrow('non più disponibile');
  });
  it('no acceptance is inferred by legacy calls', () => {
    expect(prepareGptDays(result(['own', 'prospect']), pool, intent, settings, date).days[0].selection.map((s) => s.key)).toEqual(['own']);
    expect(readAcceptedFillKeys(undefined)).toEqual([]); expect(readAcceptedFillKeys(null)).toEqual([]);
    expect(() => readAcceptedFillKeys({ prospect: true })).toThrow('non valido');
    expect(() => readAcceptedFillKeys(['prospect', 1])).toThrow('non valido');
  });
  it('changing types, allowed expansions or reset clears approvals; unrelated changes retain for revalidation', () => {
    expect(acceptedKeysAfterIntentPatch(['prospect'], intent, { requestedEntityTypes: ['client'] })).toEqual([]);
    expect(acceptedKeysAfterIntentPatch(['prospect'], intent, { allowedExpansionTypes: ['prospect'] })).toEqual([]);
    expect(acceptedKeysAfterIntentPatch(['prospect'], intent, {}, true)).toEqual([]);
    expect(acceptedKeysAfterIntentPatch(['prospect'], intent, { minRevenue: 500 })).toEqual(['prospect']);
    expect(acceptedKeysAfterIntentPatch(['prospect'], intent, { requestedEntityTypes: ['orphan'] })).toEqual(['prospect']);
  });
  it('removal/pruning revokes only removed keys, without broadening later AI selections', () => {
    const retained = retainAcceptedFillKeys(['prospect', 'free', 'prospect'], ['own', 'free']);
    expect(retained).toEqual(['free']);
    expect(prepareGptDays(result(['own', 'prospect', 'free']), pool, intent, settings, date, retained).days[0].selection.map((s) => s.key)).toEqual(['own', 'free']);
  });
  it('wantAll remains restricted to initial criteria for unaccepted keys', () => {
    const p = prepareGptDays(result(['own', 'prospect']), pool, { ...intent, wantAll: true }, settings, date, ['prospect']);
    expect(p.days.flatMap((d) => d.selection.map((s) => s.key)).sort()).toEqual(['own', 'prospect']);
  });
});

describe('GPTour receipt — draft, rebuild, save, reload and existing Live validation', () => {
  it('draft JSON round trip retains exact keys and old drafts remain empty', () => {
    const draft = JSON.parse(JSON.stringify({ version: 1, agentId: 'a', gptourContext: { version: 1, acceptedFillKeys: accept(prospect) } }));
    expect(readAcceptedFillKeys(draft.gptourContext.acceptedFillKeys)).toEqual(['prospect']);
    expect(readAcceptedFillKeys((JSON.parse('{"version":1}') as { gptourContext?: { acceptedFillKeys?: string[] } }).gptourContext?.acceptedFillKeys)).toEqual([]);
  });
  it('real batch serializer persists merged area JSON and passes feasibility without changing Intent', async () => {
    const plan = await planWith(); rpc.mockResolvedValue({ data: ['saved-tour'], error: null });
    expect(() => assertGptourPlan(plan)).not.toThrow();
    await saveToursBatch('agent-fixture', [plan]);
    const stored = rpc.mock.calls[0][1].p_tours[0].tour.area_filter;
    expect(stored).toMatchObject({ mode: 'city', city: 'Rozzano', zoneIds: ['existing-zone'], gptourContext: { version: 1, acceptedFillKeys: ['prospect'] } });
    expect(stored.gptourContext.intent).toEqual(intent);
    expect(stored.gptourContext.intent.allowedExpansionTypes).toEqual([]);
  });
  it('saved context read/restore and standard Live preflight preserve the accepted visit', async () => {
    const plan = await planWith(), area = JSON.parse(JSON.stringify(plan.areaFilter));
    expect(readGptourContext(area)?.acceptedFillKeys).toEqual(['prospect']);
    const reloaded = { ...prospect, key: 'live:prospect', entityType: 'client' as const, daysSincePhysicalContact: 0 };
    const restored = restoreGptourCandidate(reloaded, area);
    expect(restored.key).toBe('prospect'); expect(restored.entityType).toBe('prospect');
    const livePlan = { ...plan, areaFilter: null, stops: plan.stops.map((s) => ({ ...s, candidate: s.candidate.key === 'prospect' ? reloaded : s.candidate })) };
    const protectedPlan = protectLivePlan(livePlan, { area_filter: area } as SavedTour, [own, reloaded]);
    expect(protectedPlan.stops.map((s) => s.candidate.key)).toContain('prospect');
    expect(protectedPlan.areaFilter?.gptourContext?.acceptedFillKeys).toEqual(['prospect']);
  });
  it('old v1 context without acceptedFillKeys gets no new exception', async () => {
    const plan = await planWith(); delete plan.areaFilter!.gptourContext!.acceptedFillKeys;
    expect(readGptourContext(plan.areaFilter)).toBeTruthy();
    expect(() => assertGptourPlan(plan)).toThrow('tipologia non autorizzata');
    expect(() => assertGptourPlan({ areaFilter: null } as TourPlan)).not.toThrow();
  });
  it('cannot persist approval for key not represented by saved facts', async () => {
    const plan = await planWith(); plan.areaFilter!.gptourContext!.acceptedFillKeys = ['other-prospect'];
    expect(() => assertGptourPlan(plan)).toThrow('non coerenti');
  });
  it('invalidated accepted key cannot be saved despite persisted receipt', async () => {
    const plan = await planWith(); plan.stops.find((s) => s.candidate.key === 'prospect')!.candidate = { ...prospect, daysSincePhysicalContact: 1 };
    await expect(saveToursBatch('agent-fixture', [plan])).rejects.toThrow('contatto fisico recente');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('multi-day approvals follow exact visits when changing day, with no grant on other days', async () => {
    const r: GptResult = { ...result([]), multiDay: true, days: [
      { day: 1, tourDate: date, area: null, startTime: null, endTime: null, selection: [{ key: 'own', reason: null }] },
      { day: 2, tourDate: '2099-10-06', area: null, startTime: null, endTime: null, selection: [{ key: 'prospect', reason: null }] },
    ] };
    const build = await buildGptour(r, pool, intent, settings, home, date, deps, [], ['prospect']);
    const days = attachGptourContext(build.days, intent, 'group', ['prospect']);
    expect(days[0].plan.areaFilter?.gptourContext?.acceptedFillKeys).toEqual([]);
    expect(days[1].plan.areaFilter?.gptourContext?.acceptedFillKeys).toEqual(['prospect']);
    expect(attachGptourContext(days, intent, 'group')[1].plan.areaFilter?.gptourContext?.acceptedFillKeys).toEqual(['prospect']);
    rpc.mockResolvedValue({ data: ['day1', 'day2'], error: null });
    await expect(saveToursBatch('a', days.map((d) => d.plan))).resolves.toEqual(['day1', 'day2']); expect(rpc).toHaveBeenCalledTimes(1);
  });
});