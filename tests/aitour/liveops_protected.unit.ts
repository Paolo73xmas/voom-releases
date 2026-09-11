import assert from 'node:assert/strict';
import { insertLiveStop, areaCheckForTour, type LiveStopRef, type ReplanContext } from '../../frontend/lib/aitour/liveops';
import type { SavedTour } from '../../frontend/lib/aitour/tours';
import type { TourCandidate } from '../../frontend/lib/aitour/types';

function candidate(key: string, city: string, province: string): TourCandidate {
  return {
    key,
    entityType: 'client',
    customerId: key,
    tabaccheriaId: null,
    name: key,
    address: 'Via Roma',
    city,
    province,
    lat: city === 'Milano' ? 45.46 : 45.18,
    lng: city === 'Milano' ? 9.19 : 9.16,
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

async function run() {
  const tour = {
    id: 'tour-1',
    agent_id: 'agent-1',
    tour_date: '2026-01-12',
    tour_type: 'clienti',
    resolved_tour_type: 'clienti',
    start_lat: 45.46,
    start_lng: 9.19,
    area_filter: {
      mode: 'auto',
      briefAreas: [{ kind: 'city', value: 'Milano', mode: 'include' }],
      briefRequirements: [{ key: 'c1', customerId: 'c1', name: 'c1', priority: 1 }],
    },
  } as unknown as SavedTour;

  const pending: LiveStopRef[] = [{ id: 's1', candidate: candidate('c1', 'Milano', 'MI'), mandatory: true }];
  const inArea = await areaCheckForTour(tour, pending);
  assert.equal(inArea(candidate('x', 'Milano', 'MI')), true);
  assert.equal(inArea(candidate('y', 'Pavia', 'PV')), false);

  const ctx: ReplanContext = {
    tour,
    startPos: { lat: 45.46, lng: 9.19 },
    endPoint: null,
    startMin: 540,
    endMin: 1080,
    settings: {
      work_start: '08:00', work_end: '18:00', visit_minutes_client: 20, visit_minutes_prospect: 25, visit_minutes_orphan: 25,
      buffer_pct_clienti: 18, buffer_pct_sviluppo: 35, buffer_pct_mista: 25, buffer_max_min: 60,
      cadence_weeks_active: 5, cadence_weeks_low: 8, lunch_break_minutes: 30,
      home_address: null, home_lat: null, home_lng: null, office_address: null, office_lat: null, office_lng: null,
    },
  };

  await assert.rejects(
    () => insertLiveStop(ctx, pending, candidate('outside', 'Pavia', 'PV'), { mode: 'after', afterStopId: 's1' }, { mandatory: false }),
    /fuori dalla zona/
  );

  console.log('PASS liveops_protected.unit.ts');
}

run();
