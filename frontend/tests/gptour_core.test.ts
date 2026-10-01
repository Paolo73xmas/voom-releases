import { describe, expect, it, vi } from 'vitest';
vi.mock('../lib/theme', () => ({ currentThemeMode: 'light' }));
vi.mock('../lib/supabase', () => ({ supabase: {} }));
import { DEFAULT_SETTINGS, type TourCandidate, type TourPlan } from '../lib/aitour/types';
import { DEFAULT_INTENT, mergeIntent, sanitizeIntentPatch, applyRejection } from '../lib/aitour/gptour-intent';
import { candidateMatchesTourIntent } from '../lib/aitour/gptour-criteria';
import { resolveGptourAgent, assertEffectiveAgent, canUseGptour, normalizeGptourAgents } from '../lib/aitour/gptour-auth';
import { IdentitySet, dedupeGptour } from '../lib/aitour/gptour-identity';
import { prepareGptDays, buildGptour, assertEventIdentity } from '../lib/aitour/gptour-engine';
import { optimizeIndices, windowArrival, decideReturnHome, type RoutingDependencies } from '../lib/aitour/gptour-routing';
import { bestInsertion, combinedDeviation, routeDistanceKm, proposeGptour } from '../lib/aitour/gptour-opportunities';
import { bordersOf, normalizeComune } from '../lib/aitour/comuni-adjacency';
import { attachGptourContext, assertGptourPlan, gptourMetadataWarning } from '../lib/aitour/gptour-context';
import { planAreaMetadata } from '../lib/aitour/brief-feasibility';
import { romeDate, romeLocalToIso, validDate, nextWorkingDay } from '../lib/aitour/gptour-dates';
import { isVisibleInAgentZones, physicalContact } from '../lib/aitour/gptour-data';
import type { GptResult } from '../lib/aitour/gptour-api';

export const candidate = (n: number, patch: Partial<TourCandidate> = {}): TourCandidate => ({
  key: `client:${n}`, customerId: String(n), tabaccheriaId: `tab-${n}`, entityType: 'client', name: `Cliente ${n}`,
  lat: 45.4 + n * .001, lng: 9.1 + n * .001, city: 'Rozzano', province: 'MI', address: '',
  lastVisitDate: null, lastOrderDate: null, daysSinceVisit: null, daysSinceOrder: null, daysSincePhysicalContact: null,
  orderCount: 0, totalRevenue: 0, revenue6m: 600, avgOrderValue: 0, avgReorderDays: null, followUpDate: null,
  appointmentAt: null, notes: null, orphanStatus: null, estimatedRevenue: null, score: 0, priorityClass: 'Media',
  reason: '', nextSuggestedVisit: null, visitMinutes: 20, potentialValue: 0,
  gptourData: { contactKnown: true, orderKnown: true, revenueKnown: true, zoneNames: ['Sud'] }, ...patch,
});
const result = (keys: string[]): GptResult => ({ reply: 'Giro', needsInfo: false, multiDay: false, lodging: 'home', tourDate: '2026-10-05', startTime: null, endTime: null, selection: keys.map((key) => ({ key, reason: null })), days: [], notes: null });
const home = { lat: 45.4, lng: 9.1, label: 'Casa' };
const deps = (fallback = false): RoutingDependencies => ({
  matrix: async (p) => ({ durations: p.map((_, i) => p.map((_, j) => i === j ? 0 : 300)), distances: p.map((_, i) => p.map((_, j) => i === j ? 0 : 1000)), fallback }),
  route: async (p) => ({ latlngs: p.map((x) => [x.lat, x.lng]), legs: p.slice(1).map(() => ({ durationMin: 5, distanceKm: 1 })), totalKm: p.length - 1, totalMin: (p.length - 1) * 5, fallback, kmUrban: null, kmExtra: null, kmHighway: null }),
});
describe('GPTour authorization', () => {
  it('malformed admin list fails safely without .find crash', () => {
    expect(() => normalizeGptourAgents({ id: 'a' })).toThrow('Elenco agenti');
    expect(() => normalizeGptourAgents([null])).toThrow('Elenco agenti');
    expect(normalizeGptourAgents([{ id: 'a', full_name: 'Agente' }])).toEqual([{ id: 'a', full_name: 'Agente' }]);
    expect(normalizeGptourAgents([{ id: 'a', full_name: null }])).toEqual([{ id: 'a', full_name: 'a' }]);
  });
  it.each(['agent', 'agentcustom'])('%s only self', (role) => { expect(resolveGptourAgent(role, 'a', 'a')).toBe('a'); expect(() => resolveGptourAgent(role, 'a', 'b')).toThrow('403'); });
  it.each(['admin', 'admincustom'])('%s selected target', (role) => expect(resolveGptourAgent(role, 'admin', 'a')).toBe('a'));
  it.each(['supervisor', 'branch_admin', 'warehouse', 'supplier', 'customer', 'unknown'])('403 %s', (role) => { expect(canUseGptour(role)).toBe(false); expect(() => resolveGptourAgent(role, 'a')).toThrow('403'); });
  it('requires exact effective subject, including missing field', () => { expect(() => assertEffectiveAgent('a', undefined)).toThrow(); expect(() => assertEffectiveAgent('a', 'b')).toThrow(); expect(() => assertEffectiveAgent('a', 'a')).not.toThrow(); });
});
describe('GPTour intent and deterministic criteria', () => {
  it('physical contact is max of visit/inspection, never order date', () => expect(physicalContact('2026-09-01', '2026-09-15')).toBe('2026-09-15'));
  it('own orphan visible outside assigned polygon; foreign/generic not exempt', () => {
    const zones = [{ agent_id: 'a', geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } }] as never;
    expect(isVisibleInAgentZones(candidate(1, { entityType: 'orphan', isOwnOrphan: true }), zones)).toBe(true);
    expect(isVisibleInAgentZones(candidate(1, { entityType: 'orphan', isOwnOrphan: false }), zones)).toBe(false);
  });
  it('multi-turn keeps values and nested areas; explicit null resets', () => {
    const a = mergeIntent(DEFAULT_INTENT, { physicalContactMinDays: 30, requestedArea: { comune: 'Rozzano', provincia: 'MI' } });
    const b = mergeIntent(a, sanitizeIntentPatch({ maxDays: 3, requestedArea: { zona: 'Sud' } }));
    expect(b.physicalContactMinDays).toBe(30); expect(b.requestedArea?.comune).toBe('Rozzano');
    expect(mergeIntent(b, { physicalContactMinDays: null }).physicalContactMinDays).toBeNull();
  });
  it('AI patch cannot forge persisted CRM decisions', () => expect(sanitizeIntentPatch({ followUpDecisions: [{ followUpId: 'fake' }] }).followUpDecisions).toBeUndefined());
  it.each([29, 30, 31, null])('physical days %s inclusive', (days) => expect(candidateMatchesTourIntent(candidate(1, { daysSincePhysicalContact: days, daysSinceOrder: 0 }), { ...DEFAULT_INTENT, physicalContactMinDays: 30 })).toBe(days === null || days >= 30));
  it.each([29, 30, 31, null])('order days %s independent', (days) => expect(candidateMatchesTourIntent(candidate(1, { daysSinceOrder: days, daysSincePhysicalContact: 0 }), { ...DEFAULT_INTENT, orderMinDays: 30 })).toBe(days === null || days >= 30));
  it('unknown is not never contacted', () => expect(candidateMatchesTourIntent(candidate(1, { gptourData: { contactKnown: false, orderKnown: true, revenueKnown: true } }), { ...DEFAULT_INTENT, physicalContactMinDays: 30 })).toBe(false));
  it('own orphan, other orphan, authorized prospect expansion', () => {
    const i = { ...DEFAULT_INTENT, requestedEntityTypes: ['orphan'] as const, ownOrphansOnly: true, allowedExpansionTypes: ['prospect'] as const };
    const intent = { ...i, requestedEntityTypes: [...i.requestedEntityTypes], allowedExpansionTypes: [...i.allowedExpansionTypes] };
    expect(candidateMatchesTourIntent(candidate(1, { entityType: 'orphan', isOwnOrphan: true }), intent)).toBe(true);
    expect(candidateMatchesTourIntent(candidate(1, { entityType: 'orphan', isOwnOrphan: false }), intent)).toBe(false);
    expect(candidateMatchesTourIntent(candidate(1, { entityType: 'prospect' }), intent)).toBe(true);
    expect(candidateMatchesTourIntent(candidate(1), intent)).toBe(false);
  });
  it('hard city, province alias, zone and revenue', () => {
    expect(candidateMatchesTourIntent(candidate(1), { ...DEFAULT_INTENT, requestedArea: { comune: 'Milano' } })).toBe(false);
    expect(candidateMatchesTourIntent(candidate(1), { ...DEFAULT_INTENT, requestedArea: { provincia: 'Milano', zona: 'Sud' }, minRevenue: 500 })).toBe(true);
    expect(candidateMatchesTourIntent(candidate(1), { ...DEFAULT_INTENT, minRevenue: 700 })).toBe(false);
    expect(candidateMatchesTourIntent(candidate(1), { ...DEFAULT_INTENT, project: 'FED' })).toBe(false);
  });
  it('rejection sticky and candidate never immediately offered again', () => {
    const i = mergeIntent(applyRejection(DEFAULT_INTENT, ['client:1']), { allowLargeBuffer: false });
    expect(i.allowLargeBuffer).toBe(true); expect(candidateMatchesTourIntent(candidate(1), i)).toBe(false);
  });
  it('filters initial AI keys, not just fillers', () => {
    const list = [candidate(1, { entityType: 'orphan', isOwnOrphan: true }), candidate(2, { entityType: 'orphan', isOwnOrphan: false })];
    const out = prepareGptDays(result(list.map((c) => c.key)), list, { ...DEFAULT_INTENT, ownOrphansOnly: true }, DEFAULT_SETTINGS, '2026-10-05');
    expect(out.days[0].selection.map((s) => s.key)).toEqual(['client:1']); expect(out.warnings.length).toBeGreaterThan(0);
  });
});
describe('GPTour identity, complete-all and routing', () => {
  it('dedup key aliases by customer, register or same normalized place', () => {
    const a = candidate(1), alias = { ...a, key: 'orphan:1' }, samePlace = { ...a, key: 'x', customerId: 'x', tabaccheriaId: 'y', name: 'CLIENTE 1' };
    expect(dedupeGptour([a, alias, samePlace])).toHaveLength(1); expect(IdentitySet.from([a]).has(alias)).toBe(true);
  });
  it('wantAll completes omitted keys without exceeding maxDays', () => {
    const pool = Array.from({ length: 25 }, (_, i) => candidate(i));
    const out = prepareGptDays(result([pool[0].key]), pool, { ...DEFAULT_INTENT, wantAll: true, maxDays: 1 }, DEFAULT_SETTINGS, '2026-10-05');
    expect(out.days).toHaveLength(1); expect(out.days[0].selection).toHaveLength(25);
  });
  it('rejects AI days above cap', () => {
    const r = { ...result(['client:1']), multiDay: true, days: [1, 2].map((day) => ({ day, tourDate: `2026-10-0${day + 4}`, selection: [{ key: `client:${day}`, reason: null }], startTime: null, endTime: null, area: null })) };
    expect(() => prepareGptDays(r, [candidate(1), candidate(2)], { ...DEFAULT_INTENT, maxDays: 1 }, DEFAULT_SETTINGS, '2026-10-05')).toThrow('limite');
  });
  it('two CRM events on different dates cannot silently disappear', () => {
    const decision = { followUpId: 'f1', key: 'client:1', customerName: 'Cliente', originalDate: '2026-10-05', currentDate: '2026-10-05', currentTime: '09:00', decision: 'required' as const };
    expect(() => assertEventIdentity({ ...DEFAULT_INTENT, followUpDecisions: [decision, { ...decision, followUpId: 'f2', currentDate: '2026-10-06' }] }, [candidate(1)])).toThrow('Due follow-up');
  });
  it('imposed sequence preserved, slots wait', async () => {
    const pool = [candidate(1), candidate(2, { preferredSlots: [{ id: 'pm', label: 'Pomeriggio', start: 900, end: 1000, strict: true }] })];
    const out = await buildGptour({ ...result(['client:2', 'client:1']), orderImposed: true }, pool, DEFAULT_INTENT, DEFAULT_SETTINGS, home, '2026-10-05', deps());
    expect(out.days[0].plan.stops.map((s) => s.candidate.key)).toEqual(['client:2', 'client:1']); expect(out.days[0].plan.stops[0].arrivalMin).toBe(900);
  });
  it('preferred-window optimizer and strict arrival', () => {
    expect(windowArrival(candidate(1, { preferredSlots: [{ id: 'a', label: 'a', start: 600, end: 650, strict: true }] }), 660).outside).toBe(true);
    const m = { durations: [[0, 1, 20], [1, 0, 5], [20, 5, 0]], distances: [], fallback: false };
    expect(optimizeIndices([candidate(1), candidate(2)], m, 480, false)).toEqual([0, 1]);
  });
  it.each([49, 50, 51])('lodging threshold is strictly less (%s)', (km) => expect(decideReturnHome(km, 50)).toBe(km < 50));
  it('unknown routing is explicit and returns home prudentially', async () => {
    const r = { ...result([]), multiDay: true, lodging: 'away' as const, days: [1, 2].map((day) => ({ day, tourDate: `2026-10-0${day + 4}`, area: null, startTime: null, endTime: null, selection: [{ key: `client:${day}`, reason: null }] })) };
    const out = await buildGptour(r, [candidate(1), candidate(2)], { ...DEFAULT_INTENT, lodgingRule: { mode: 'conditional', maxKmHome: 50 } }, DEFAULT_SETTINGS, home, '2026-10-05', deps(true));
    expect(out.days[0].nightDecision).toBe('routing_unknown'); expect(out.days[0].returnHomeAfterDay).toBe(true); expect(out.days[0].nightKmHome).toBeNull();
  });
  it('unstable conditional night never oscillates forever or pretends certainty', async () => {
    const r = { ...result([]), multiDay: true, days: [1, 2].map((day) => ({ day, tourDate: `2026-10-0${day + 4}`, area: null, startTime: null, endTime: null, selection: [{ key: `client:${day}`, reason: null }] })) };
    const base = deps(); let measured = 0;
    const changing: RoutingDependencies = { ...base, route: async (points) => { const route = await base.route(points);
      if (points.length === 2 && (points[1] as { label?: string }).label?.startsWith('Cliente')) route.totalKm = ++measured % 2 ? 51 : 49;
      return route;
    } };
    const b = await buildGptour(r, [candidate(1), candidate(2)], { ...DEFAULT_INTENT, lodgingRule: { mode: 'conditional', maxKmHome: 50 } }, DEFAULT_SETTINGS, home, '2026-10-05', changing);
    expect(b.days[0].nightDecision).toBe('unstable'); expect(b.days[0].returnHomeAfterDay).toBe(true);
  });
  it('dated required follow-up moves to its day and is marked follow-up', async () => {
    const r = { ...result([]), multiDay: true, days: [1, 2].map((day) => ({ day, tourDate: `2026-10-0${day + 4}`, area: null, startTime: null, endTime: null, selection: [{ key: `client:${3 - day}`, reason: null }] })) };
    const intent = { ...DEFAULT_INTENT, followUpDecisions: [{ followUpId: 'f1', key: 'client:1', customerName: 'Cliente 1', originalDate: '2026-10-05', currentDate: '2026-10-05', currentTime: '10:00', decision: 'required' as const }] };
    const b = await buildGptour(r, [candidate(1), candidate(2)], intent, DEFAULT_SETTINGS, home, '2026-10-05', deps());
    const stop = b.days.find((d) => d.plan.tourDate === '2026-10-05')?.plan.stops.find((s) => s.candidate.key === 'client:1');
    expect(stop?.candidate.isFollowUp).toBe(true); expect(stop?.arrivalMin).toBe(600);
  });
  it('marginal A-C-B and combined deviation', () => {
    const m = [[0, 10, 6, 8], [10, 0, 6, 5], [6, 6, 0, 2], [8, 5, 2, 0]];
    expect(bestInsertion(m, [0, 1], 2).cost).toBe(2); expect(combinedDeviation(m, [0, 1], [2, 3]).total).toBe(3);
  });
  it('corridor uses whole polyline, not only stops', () => expect(routeDistanceKm(candidate(1, { lat: 45, lng: 9.5 }), [[45, 9], [45, 10]])).toBeLessThan(.01));
  it('ISTAT real neighbor dataset', () => { expect(bordersOf('Rozzano').has(normalizeComune('Assago'))).toBe(true); expect(bordersOf('Rozzano').has(normalizeComune('Roma'))).toBe(false); });
  it('proposal is not inserted automatically and rejects fallback', async () => {
    const pool = [candidate(1), candidate(2)]; const build = await buildGptour(result(['client:1']), pool, DEFAULT_INTENT, DEFAULT_SETTINGS, home, '2026-10-05', deps());
    const plan = build.days[0].plan;
    const p = await proposeGptour(plan, [plan], pool, DEFAULT_INTENT, DEFAULT_SETTINGS, false, deps().matrix);
    expect(p.candidates).toHaveLength(1); expect(plan.stops).toHaveLength(1);
    expect((await proposeGptour(plan, [plan], pool, DEFAULT_INTENT, DEFAULT_SETTINGS, false, deps(true).matrix)).candidates).toHaveLength(0);
  });
  it('residual daily buffer is not the legacy safety buffer', async () => {
    const pool = [candidate(1), candidate(2)], build = await buildGptour(result(['client:1']), pool, DEFAULT_INTENT, DEFAULT_SETTINGS, home, '2026-10-05', deps());
    const plan = { ...build.days[0].plan, bufferMin: 100, finishMin: build.days[0].plan.endMin - 100 };
    expect((await proposeGptour(plan, [plan], pool, DEFAULT_INTENT, { ...DEFAULT_SETTINGS, buffer_max_min: 1, max_daily_buffer_minutes: 120 }, false, deps().matrix)).candidates).toHaveLength(0);
    expect((await proposeGptour(plan, [plan], pool, DEFAULT_INTENT, { ...DEFAULT_SETTINGS, buffer_max_min: 1, max_daily_buffer_minutes: 50 }, false, deps().matrix)).candidates).toHaveLength(1);
  });
  it('wantAll rebalances nearby unpinned underfilled days', () => {
    const r = { ...result([]), multiDay: true, days: [1, 2].map((day) => ({ day, tourDate: `2026-10-0${day + 4}`, area: null, startTime: null, endTime: null, selection: [{ key: `client:${day}`, reason: null }] })) };
    const prepared = prepareGptDays(r, [candidate(1), candidate(2)], { ...DEFAULT_INTENT, wantAll: true }, DEFAULT_SETTINGS, '2026-10-05');
    expect(prepared.days).toHaveLength(1); expect(prepared.days[0].selection).toHaveLength(2);
  });
});
describe('GPTour context and legacy', () => {
  it('optional namespace merges existing area metadata', async () => {
    const b = await buildGptour(result(['client:1']), [candidate(1)], DEFAULT_INTENT, DEFAULT_SETTINGS, home, '2026-10-05', deps());
    b.days[0].plan.areaFilter = { mode: 'city', city: 'Rozzano', zoneIds: ['z'] };
    const p = attachGptourContext(b.days, DEFAULT_INTENT, 'group')[0].plan;
    expect(planAreaMetadata(p)?.zoneIds).toEqual(['z']); expect(p.areaFilter?.gptourContext?.version).toBe(1); expect(() => assertGptourPlan(p)).not.toThrow();
    expect(gptourMetadataWarning(p.areaFilter, 'GPTour', [candidate(2)])).toContain('modificato');
    expect(gptourMetadataWarning(p.areaFilter, 'GPTour', [candidate(1)], '2026-10-06')).toContain('data');
    expect(gptourMetadataWarning(p.areaFilter, 'GPTour', [candidate(1, { lat: 44 })])).toContain('coordinate');
  });
  it('legacy no namespace remains untouched', () => { expect(() => assertGptourPlan({ areaFilter: null } as TourPlan)).not.toThrow(); expect(gptourMetadataWarning(null, 'Giro classico')).toBeNull(); expect(gptourMetadataWarning(null, 'GPTour')).toContain('criteri'); });
  it('date handling Rome and next working day', () => {
    expect(validDate('2026-02-30')).toBe(false); expect(nextWorkingDay('2026-10-03')).toBe('2026-10-05');
    expect(romeDate(romeLocalToIso('2026-10-25', '09:00'))).toBe('2026-10-25');
  });
});