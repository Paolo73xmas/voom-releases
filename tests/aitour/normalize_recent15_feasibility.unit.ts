import assert from 'node:assert/strict';
import { normalizeBriefV4 } from '../../frontend/lib/aitour/brief-v4';
import { splitRecentlyServed, isRecentlyServed } from '../../frontend/lib/aitour/scoring';
import { mandatoryProblems, assertMandatoryFeasible } from '../../frontend/lib/aitour/brief-feasibility';
import type { TourCandidate, TourPlan } from '../../frontend/lib/aitour/types';

function cand(over: Partial<TourCandidate>): TourCandidate {
  return {
    key: over.key ?? crypto.randomUUID(),
    entityType: over.entityType ?? 'client',
    customerId: over.customerId ?? crypto.randomUUID(),
    tabaccheriaId: null,
    name: over.name ?? 'Cliente',
    address: over.address ?? 'Via Roma',
    city: over.city ?? 'Milano',
    province: over.province ?? 'MI',
    lat: over.lat ?? 45.46,
    lng: over.lng ?? 9.19,
    lastVisitDate: null,
    lastOrderDate: null,
    orderCount: 0,
    totalRevenue: 0,
    revenue6m: 0,
    avgOrderValue: 0,
    avgReorderDays: null,
    daysSinceOrder: over.daysSinceOrder ?? null,
    daysSinceVisit: over.daysSinceVisit ?? null,
    followUpDate: over.followUpDate ?? null,
    appointmentAt: over.appointmentAt ?? null,
    isFollowUp: over.isFollowUp,
    notes: null,
    orphanStatus: null,
    estimatedRevenue: null,
    score: over.score ?? 50,
    priorityClass: 'Media',
    reason: '',
    nextSuggestedVisit: null,
    visitMinutes: 20,
    potentialValue: 0,
    preferredSlots: over.preferredSlots,
    excludedDays: over.excludedDays,
  };
}

function basePlan(): TourPlan {
  const c = cand({ key: 'must-1', name: 'Cliente Obbligatorio' });
  return {
    stops: [
      {
        candidate: c,
        sequence: 1,
        arrivalMin: 600,
        departureMin: 620,
        travelMinFromPrev: 10,
        travelKmFromPrev: 5,
        mandatory: true,
      },
    ],
    geometry: [],
    start: { lat: 45.46, lng: 9.19, label: 'Start' },
    end: null,
    tourDate: '2026-01-12',
    startMin: 540,
    endMin: 1080,
    dayType: 'clienti',
    resolvedDayType: 'clienti',
    areaLabel: '',
    totalKm: 5,
    driveMin: 10,
    visitMin: 20,
    bufferMin: 440,
    returnMin: 0,
    returnKm: 0,
    finishMin: 620,
    potentialValue: 0,
    avgScore: 50,
    excluded: [],
    aiSummary: '',
    aiRecommendation: null,
    warnings: [],
    routingFallback: false,
    requiredStops: [{ key: 'must-1', name: 'Cliente Obbligatorio', priority: 1 }],
  };
}

function run() {
  const normalized = normalizeBriefV4({
    dayType: 'clienti',
    requestedDate: { type: 'today', value: null },
    selection: { operator: 'AND', conditions: [{ type: 'clients_all' }, { type: 'last_order_days', operator: '>=', value: 30 }] },
    mandatoryStops: [{ rawReference: 'Rossi', priority: 1 }],
    route: { compact: 'off', returnHome: false, returnToStart: false, splitAllowed: null, maxDays: 2 },
    interpretation: { confidence: 0.9, needsConfirmation: false, unresolvedEntities: [], warnings: [] },
  } as any);
  assert.equal(normalized.selection.conditions.length, 2);
  assert.equal(normalized.route.maxDays, 2);

  const recentNormal = cand({ key: 'r1', daysSinceVisit: 5, daysSinceOrder: 10 });
  const recentAppointment = cand({ key: 'r2', daysSinceVisit: 5, appointmentAt: '2026-01-15T09:00:00Z' });
  const recentFollowUp = cand({ key: 'r3', daysSinceOrder: 3, isFollowUp: true });

  assert.equal(isRecentlyServed(recentNormal), true);
  assert.equal(isRecentlyServed(recentAppointment), false, 'appointments must be exempt from 15-day exclusion');
  assert.equal(isRecentlyServed(recentFollowUp), false, 'follow-up must be exempt from 15-day exclusion');
  const split = splitRecentlyServed([recentNormal, recentAppointment, recentFollowUp]);
  assert.ok(split.kept.some((x) => x.key === 'r2') && split.kept.some((x) => x.key === 'r3'));
  assert.ok(split.excluded.some((x) => x.key === 'r1'));

  const feasible = basePlan();
  assert.equal(mandatoryProblems(feasible).length, 0);
  assert.doesNotThrow(() => assertMandatoryFeasible(feasible));

  const infeasible = { ...feasible, requiredStops: [{ key: 'must-2', name: 'Mancante', priority: 1 }] };
  assert.ok(mandatoryProblems(infeasible).some((e) => e.includes('non entra nel giro')));
  assert.throws(() => assertMandatoryFeasible(infeasible), /non entra nel giro/);

  console.log('PASS normalize_recent15_feasibility.unit.ts');
}

run();
