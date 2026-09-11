import assert from 'node:assert/strict';
import {
  normalizeJourney,
  makeJourneyPreview,
  journeyProblems,
  journeyStageFor,
  assignJourneyStages,
  balanceJourneyCandidates,
  type BriefJourney,
} from '../../frontend/lib/aitour/brief-journey';
import { inBriefArea } from '../../frontend/lib/aitour/brief-area';
import { planTour } from '../../frontend/lib/aitour/planner';
import { mandatoryProblems } from '../../frontend/lib/aitour/brief-feasibility';
import { suggestPortfolioLocalities, exactLocality } from '../../frontend/lib/aitour/journey-localities';
import type { TourCandidate } from '../../frontend/lib/aitour/types';

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
    daysSinceOrder: null,
    daysSinceVisit: null,
    followUpDate: null,
    appointmentAt: null,
    notes: null,
    orphanStatus: null,
    estimatedRevenue: null,
    score: over.score ?? 60,
    priorityClass: 'Media',
    reason: '',
    nextSuggestedVisit: null,
    visitMinutes: over.visitMinutes ?? 20,
    preferredSlots: over.preferredSlots,
    excludedDays: over.excludedDays,
    potentialValue: 0,
    requestedPriority: over.requestedPriority,
    journeyStage: over.journeyStage,
  };
}

const originalFetch = globalThis.fetch;

function installOsrmMock() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/table/v1/driving/')) {
      const n = url.split('/driving/')[1].split('?')[0].split(';').length;
      const durations = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 0 : Math.abs(j - i) * 600 + 300))
      );
      return new Response(JSON.stringify({ code: 'Ok', durations, distances: durations }), { status: 200 });
    }
    if (url.includes('/route/v1/driving/')) {
      const points = url.split('/driving/')[1].split('?')[0].split(';');
      const legs = Array.from({ length: points.length - 1 }, () => ({ duration: 780, distance: 12000, annotation: { distance: [12000], duration: [780] } }));
      return new Response(
        JSON.stringify({
          code: 'Ok',
          routes: [{ distance: (points.length - 1) * 12000, duration: (points.length - 1) * 780, geometry: { coordinates: points.map((p) => p.split(',').map(Number)) }, legs }],
        }),
        { status: 200 }
      );
    }
    throw new Error(`Unexpected URL in OSRM mock: ${url}`);
  }) as typeof fetch;
}

async function run() {
  installOsrmMock();
  try {
    const norm = normalizeJourney({
      stages: [{ name: 'Milano', direction: 'SW', radiusKm: 8, point: { lat: 1, lng: 1 } }],
      corridorKm: 3,
      preview: { fake: true },
      confirmedKey: 'x',
    }) as BriefJourney;
    assert.equal(norm.stages.length, 1);
    assert.equal((norm as any).preview, undefined);
    assert.equal((norm as any).confirmedKey, undefined);

    const j: BriefJourney = {
      stages: [
        { name: 'Milano', direction: 'SW', radiusKm: 10, point: { lat: 45.4642, lng: 9.19, label: 'Milano' } },
        { name: 'Rozzano', direction: null, radiusKm: 8, point: { lat: 45.381, lng: 9.156, label: 'Rozzano' } },
        { name: 'Pavia', direction: null, radiusKm: 8, point: { lat: 45.185, lng: 9.16, label: 'Pavia' } },
      ],
      corridorKm: 3,
    };
    const roads: [number, number][][] = [
      [[9.19, 45.4642], [9.156, 45.381]],
      [[9.156, 45.381], [9.16, 45.185]],
    ];
    j.preview = makeJourneyPreview(j, roads, 35);
    j.confirmedKey = j.preview.inputKey;

    assert.equal(journeyStageFor({ lat: 45.381, lng: 9.156 }, j), 1);
    assert.equal(inBriefArea({ lat: 45.185, lng: 9.16, city: 'Pavia', province: 'PV' } as any, [], j), true);
    assert.equal(inBriefArea({ lat: 45.7, lng: 9.7, city: 'Bergamo', province: 'BG' } as any, [], j), false);

    const probs = journeyProblems({ ...j, corridorKm: 6 });
    assert.ok(probs.some((p) => p.includes('Aggiorna la mappa')));

    const staged = assignJourneyStages([
      cand({ key: 'a', score: 95, lat: 45.43, lng: 9.12 }),
      cand({ key: 'b', score: 90, lat: 45.41, lng: 9.15 }),
      cand({ key: 'c', score: 99, lat: 45.381, lng: 9.156 }),
      cand({ key: 'd', score: 85, lat: 45.30, lng: 9.16 }),
      cand({ key: 'e', score: 98, lat: 45.185, lng: 9.16 }),
    ], j);
    const balanced = balanceJourneyCandidates(staged);
    assert.ok(new Set(balanced.slice(0, 3).map((c) => c.journeyStage)).size >= 2);

    const plan = await planTour({
      enforceJourneyOrder: true,
      candidates: [
        cand({ key: 'p1', city: 'Pavia', province: 'PV', journeyStage: 2, score: 99, lat: 45.185, lng: 9.16 }),
        cand({ key: 'm1', city: 'Milano', journeyStage: 0, score: 50, lat: 45.44, lng: 9.13 }),
        cand({ key: 'r1', city: 'Rozzano', journeyStage: 1, score: 45, lat: 45.381, lng: 9.156 }),
      ],
      mandatoryKeys: new Set<string>(),
      start: { lat: 45.46, lng: 9.19, label: 'Start Milano' },
      end: { lat: 45.185, lng: 9.16, label: 'End Pavia' },
      tourDate: '2026-02-10',
      startMin: 480,
      endMin: 1140,
      dayType: 'clienti',
      resolvedDayType: 'clienti',
      bufferPct: 10,
      area: { mode: 'auto' },
    });
    const stages = plan.stops.map((s) => s.candidate.journeyStage ?? -1);
    for (let i = 1; i < stages.length; i++) assert.ok(stages[i] >= stages[i - 1], 'stage order must stay monotonic');

    void mandatoryProblems;

    const suggestions = suggestPortfolioLocalities('Lozano', [
      { city: 'Rozzano', province: 'MI', lat: 45.38, lng: 9.16 },
      { city: 'Loiano', province: 'BO', lat: 44.27, lng: 11.32 },
    ], j.stages);
    assert.equal(suggestions[0].city, 'Rozzano');
    assert.equal(exactLocality('Lozano', { lat: 45.381, lng: 9.158, label: 'Rozzano, Milano, Italia' }), false);

    console.log('PASS core_journey_planner.unit.ts');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

run();
