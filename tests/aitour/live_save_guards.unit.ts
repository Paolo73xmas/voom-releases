import assert from 'node:assert/strict';
import { protectLivePlan } from '../../frontend/lib/aitour/brief-live';
import { saveTour } from '../../frontend/lib/aitour/tours';
import { supabase } from '../../frontend/lib/supabase';
import type { TourCandidate, TourPlan } from '../../frontend/lib/aitour/types';

function candidate(key: string, city = 'Milano'): TourCandidate {
  return {
    key,
    entityType: 'client',
    customerId: key,
    tabaccheriaId: null,
    name: `Cliente ${key}`,
    address: 'Via Roma',
    city,
    province: 'MI',
    lat: 45.46,
    lng: 9.19,
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
    score: 50,
    priorityClass: 'Media',
    reason: '',
    nextSuggestedVisit: null,
    visitMinutes: 20,
    potentialValue: 0,
  };
}

function plan(stops: TourCandidate[]): TourPlan {
  const mapped = stops.map((c, i) => ({
    candidate: c,
    sequence: i + 1,
    arrivalMin: 600 + i * 30,
    departureMin: 620 + i * 30,
    travelMinFromPrev: 10,
    travelKmFromPrev: 5,
    mandatory: true,
  }));
  return {
    stops: mapped,
    geometry: [],
    start: { lat: 45.46, lng: 9.19, label: 'Start' },
    end: null,
    tourDate: '2026-01-12',
    startMin: 540,
    endMin: 1080,
    dayType: 'clienti',
    resolvedDayType: 'clienti',
    areaLabel: '',
    totalKm: 12,
    driveMin: 20,
    visitMin: mapped.length * 20,
    bufferMin: 300,
    returnMin: 0,
    returnKm: 0,
    finishMin: 620 + (mapped.length - 1) * 30,
    potentialValue: 0,
    avgScore: 50,
    excluded: [],
    aiSummary: '',
    aiRecommendation: null,
    warnings: [],
    routingFallback: false,
    requiredStops: mapped.map((m) => ({ key: m.candidate.key, name: m.candidate.name, priority: 1 })),
  };
}

async function run() {
  const c1 = candidate('c1');
  const c2 = candidate('c2');
  const p = plan([c1, c2]);
  const tour: any = {
    id: 'tour-1',
    area_filter: {
      mode: 'auto',
      briefRequirements: [
        { key: 'c1', customerId: 'c1', name: 'Cliente c1', priority: 1 },
        { key: 'c2', customerId: 'c2', name: 'Cliente c2', priority: 1 },
      ],
    },
  };

  const protectedPlan = protectLivePlan(p, tour, [c1, c2]);
  assert.equal(protectedPlan.requiredStops?.length, 2);

  const badPlan = { ...p, requiredStops: [{ key: 'missing', name: 'Missing', priority: 1 }] } as TourPlan;
  let writes = 0;
  const originalFrom = (supabase as any).from;
  (supabase as any).from = () => {
    writes += 1;
    return {
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'x' }, error: null }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    };
  };

  await assert.rejects(() => saveTour('agent-x', badPlan, 'Test Guard Tour'), /non entra nel giro|Priorità/);
  assert.equal(writes, 0, 'save guard must block before any DB write');

  (supabase as any).from = originalFrom;
  console.log('PASS live_save_guards.unit.ts');
}

run();
