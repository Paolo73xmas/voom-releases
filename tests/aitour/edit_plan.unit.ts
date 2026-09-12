import assert from 'node:assert/strict';
import {
  prepareEditedPlan,
  recalculateEditedPlan,
  editAreaConsentKey,
} from '../../frontend/lib/aitour/edit-plan';
import type { TourCandidate, TourPlan } from '../../frontend/lib/aitour/types';

function candidate(over: Partial<TourCandidate> & { key: string; name?: string }): TourCandidate {
  return {
    key: over.key,
    entityType: over.entityType ?? 'client',
    customerId: over.customerId ?? over.key,
    tabaccheriaId: over.tabaccheriaId ?? null,
    name: over.name ?? `Cliente ${over.key}`,
    address: over.address ?? 'Via Roma 1',
    city: over.city ?? 'Milano',
    province: over.province ?? 'MI',
    lat: over.lat ?? 45.4642,
    lng: over.lng ?? 9.19,
    lastVisitDate: null,
    lastOrderDate: null,
    orderCount: 0,
    totalRevenue: 0,
    revenue6m: 0,
    avgOrderValue: 0,
    avgReorderDays: null,
    daysSinceOrder: null,
    daysSinceVisit: null,
    followUpDate: null,
    appointmentAt: over.appointmentAt ?? null,
    notes: null,
    orphanStatus: null,
    estimatedRevenue: null,
    score: over.score ?? 70,
    priorityClass: 'Media',
    reason: '',
    nextSuggestedVisit: null,
    visitMinutes: over.visitMinutes ?? 20,
    preferredSlots: over.preferredSlots,
    excludedDays: over.excludedDays,
    requestedPriority: over.requestedPriority,
    potentialValue: 0,
  };
}

function planWithStops(stops: TourCandidate[], mandatoryKeys: Set<string>, requiredStops?: TourPlan['requiredStops']): TourPlan {
  return {
    stops: stops.map((c, i) => ({
      candidate: c,
      sequence: i + 1,
      arrivalMin: 540 + i * 30,
      departureMin: 560 + i * 30,
      travelMinFromPrev: 10,
      travelKmFromPrev: 4,
      waitMin: 0,
      outsideWindow: false,
      mandatory: mandatoryKeys.has(c.key),
    })),
    geometry: [],
    start: { lat: 45.4642, lng: 9.19, label: 'Milano' },
    end: { lat: 45.4642, lng: 9.19, label: 'Rientro' },
    tourDate: '2026-01-15',
    startMin: 480,
    endMin: 1080,
    dayType: 'clienti',
    resolvedDayType: 'clienti',
    areaLabel: 'Milano',
    totalKm: 12,
    driveMin: 30,
    visitMin: stops.length * 20,
    bufferMin: 300,
    returnMin: 12,
    returnKm: 4,
    finishMin: 720,
    potentialValue: 0,
    avgScore: 70,
    excluded: [],
    aiSummary: '',
    aiRecommendation: null,
    warnings: [],
    routingFallback: false,
    areaFilter: {
      mode: 'city',
      city: 'Milano',
      briefAreas: [{ kind: 'city', value: 'Milano', mode: 'include' }],
      briefJourney: null,
      briefRequirements: (requiredStops || []).map((r) => ({ key: r.key, customerId: r.key, name: r.name, priority: r.priority })),
    },
    requiredStops,
    returnFlexible: false,
  };
}

function plannerReturning(base: TourPlan) {
  const mkStop = (c: TourCandidate, i: number, startMin: number, mandatory = true) => ({
    candidate: c,
    sequence: i + 1,
    arrivalMin: startMin + 20 + i * 35,
    departureMin: startMin + 40 + i * 35,
    travelMinFromPrev: 10,
    travelKmFromPrev: 4,
    waitMin: 0,
    outsideWindow: false,
    mandatory,
  });
  return {
    optimized: async ({ candidates, startMin }: { candidates: TourCandidate[]; startMin?: number }) => ({
      ...base,
      stops: candidates.map((c, i) => mkStop(c, i, startMin ?? base.startMin, true)),
      warnings: [],
      routingFallback: false,
    }),
    manual: async (ordered: TourCandidate[], b: TourPlan) => ({
      ...b,
      stops: ordered.map((c, i) => mkStop(c, i, b.startMin, b.requiredStops?.some((r) => r.key === c.key) ?? false)),
      warnings: [],
      routingFallback: false,
    }),
  };
}

async function run() {
  // edit-plan: mandatory propagation + previous priority + plan immutable + slot precedence
  const a = candidate({ key: 'a', name: 'A', preferredSlots: [{ id: 'ap1', label: 'ore 10:00', start: 600, end: 600 }] });
  const b = candidate({ key: 'b', name: 'B', requestedPriority: 3 });
  const original = planWithStops([a], new Set(['a']), [{ key: 'a', name: 'A', priority: 1 }]);
  const originalSnapshot = structuredClone(original);
  const poolStaleA = candidate({ key: 'a', name: 'A stale', preferredSlots: null });
  const prep = prepareEditedPlan(original, [poolStaleA, b], ['a', 'b'], new Set(['a', 'b']));
  assert.deepEqual(original, originalSnapshot, 'input plan must stay immutable');
  assert.equal(prep.chosen.find((x) => x.key === 'a')?.preferredSlots?.[0]?.id, 'ap1', 'plan candidate slots must override stale pool');
  assert.equal(prep.base.requiredStops?.find((r) => r.key === 'a')?.priority, 1, 'old priority must be preserved');
  assert.equal(prep.base.requiredStops?.find((r) => r.key === 'b')?.priority, 3, 'new mandatory must preserve requested priority');
  assert.equal(prep.base.areaFilter?.briefRequirements?.length, 2, 'metadata must mirror required stops');

  // edit-plan: duplicate aliases + invalid coordinates must fail early
  await assert.rejects(
    async () => prepareEditedPlan(
      original,
      [candidate({ key: 'x1', customerId: 'dup' }), candidate({ key: 'x2', customerId: 'dup' })],
      ['x1', 'x2'],
      new Set()
    ),
    /presente due volte/
  );
  await assert.rejects(
    async () => prepareEditedPlan(original, [candidate({ key: 'bad', lat: 0, lng: 0 })], ['bad'], new Set()),
    /coordinate mancanti o non valide/
  );

  // edit-plan: outside-area consent required, warning stored, consent invalidates on coordinate changes
  const outside = candidate({ key: 'pavia', city: 'Pavia', province: 'PV', lat: 45.1847, lng: 9.1582 });
  await assert.rejects(
    () => recalculateEditedPlan(original, [a, outside], ['a', 'pavia'], new Set(['a']), false, {}, plannerReturning(original), 1000),
    /Conferma eccezione fuori zona/
  );
  const okConsent = editAreaConsentKey(original, outside);
  const withConsent = await recalculateEditedPlan(original, [a, outside], ['a', 'pavia'], new Set(['a']), false, { pavia: okConsent }, plannerReturning(original), 1000);
  assert.ok(withConsent.warnings.some((w) => w.includes('Eccezione fuori zona confermata: Cliente pavia')));
  await assert.rejects(
    () => recalculateEditedPlan(original, [a, { ...outside, lat: outside.lat + 0.3 }], ['a', 'pavia'], new Set(['a']), false, { pavia: okConsent }, plannerReturning(original), 1000),
    /Conferma eccezione fuori zona/
  );

  // edit-plan: existing outside stop in plan requires no new consent
  const planAlreadyOutside = planWithStops([a, outside], new Set(['a']), [{ key: 'a', name: 'A', priority: 1 }]);
  assert.doesNotThrow(() => prepareEditedPlan(planAlreadyOutside, [a], ['a', 'pavia'], new Set(['a'])));

  // edit-plan: manual mode applies explicit toggles/removals and updates required metadata
  const bothMandatory = planWithStops([a, b], new Set(['a', 'b']), [{ key: 'a', name: 'A', priority: 1 }, { key: 'b', name: 'B', priority: 2 }]);
  const manual = await recalculateEditedPlan(
    bothMandatory,
    [a, b],
    ['a', 'b'],
    new Set(['b']),
    true,
    {},
    plannerReturning(bothMandatory),
    1000
  );
  assert.deepEqual(manual.requiredStops?.map((r) => r.key), ['b']);
  assert.equal(manual.stops.find((s) => s.candidate.key === 'a')?.mandatory, false);
  assert.equal(manual.stops.find((s) => s.candidate.key === 'b')?.mandatory, true);
  assert.deepEqual(manual.areaFilter?.briefRequirements?.map((r) => r.key), ['b']);

  // edit-plan: planner partial output must not be silently accepted
  const partialPlanner = {
    optimized: async () => ({ ...original, stops: [original.stops[0]], warnings: [], routingFallback: false }),
    manual: async () => ({ ...original, stops: [original.stops[0]], warnings: [], routingFallback: false }),
  };
  await assert.rejects(
    () => recalculateEditedPlan(original, [a, b], ['a', 'b'], new Set(['a']), false, {}, partialPlanner, 1000),
    /Ricalcolo incompleto/
  );

  // edit-plan: timeout keeps original state untouched
  const timeoutPlan = planWithStops([a, b], new Set(['a']), [{ key: 'a', name: 'A', priority: 1 }]);
  const timeoutSnapshot = structuredClone(timeoutPlan);
  const neverPlanner = {
    optimized: () => new Promise<never>(() => {}),
    manual: () => new Promise<never>(() => {}),
  };
  await assert.rejects(
    () => recalculateEditedPlan(timeoutPlan, [a, b], ['a', 'b'], new Set(['a']), false, {}, neverPlanner, 10),
    /impiegando troppo tempo/
  );
  assert.deepEqual(timeoutPlan, timeoutSnapshot, 'original plan must remain unchanged after timeout');

  // edit-plan: mandatory feasibility/routing guard must still block unsafe plans
  const unsafePlanner = {
    optimized: async ({ candidates }: { candidates: TourCandidate[] }) => ({
      ...original,
      stops: candidates.map((c, i) => ({ ...original.stops[0], candidate: c, sequence: i + 1, mandatory: c.key === 'a', outsideWindow: c.key === 'a' })),
      requiredStops: [{ key: 'a', name: 'A', priority: 1 }],
      routingFallback: true,
      warnings: [],
    }),
    manual: async (ordered: TourCandidate[]) => ({
      ...original,
      stops: ordered.map((c, i) => ({ ...original.stops[0], candidate: c, sequence: i + 1, mandatory: c.key === 'a', outsideWindow: c.key === 'a' })),
      requiredStops: [{ key: 'a', name: 'A', priority: 1 }],
      routingFallback: true,
      warnings: [],
    }),
  };
  await assert.rejects(
    () => recalculateEditedPlan(original, [a], ['a'], new Set(['a']), false, {}, unsafePlanner, 1000),
    /Tempi stradali non verificati|fascia concordata/
  );

  console.log('PASS edit_plan.unit.ts');
}

run();
