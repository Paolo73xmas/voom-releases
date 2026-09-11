import assert from 'node:assert/strict'
import { planTour, planFixedOrder } from '../../src/lib/aitour/planner'
import { journeyPlanProblems, type BriefJourney, makeJourneyPreview } from '../../src/lib/aitour/brief-journey'
import { mandatoryProblems } from '../../src/lib/aitour/brief-feasibility'
import type { TourCandidate, TourPlan } from '../../src/lib/aitour/types'

function cand(over: Partial<TourCandidate>): TourCandidate {
  return {
    key: over.key ?? crypto.randomUUID(),
    entityType: over.entityType ?? 'client',
    customerId: over.customerId ?? crypto.randomUUID(),
    tabaccheriaId: null,
    name: over.name ?? 'Cliente',
    requestedPriority: over.requestedPriority,
    journeyStage: over.journeyStage,
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
  }
}

const originalFetch = globalThis.fetch

function installOsrmMock() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/table/v1/driving/')) {
      const n = url.split('/driving/')[1].split('?')[0].split(';').length
      const durations = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => {
          if (i === j) return 0
          // Keep stage order dominant, but dynamic shape by indexes.
          return Math.abs(j - i) * 600 + 300
        })
      )
      return new Response(JSON.stringify({ code: 'Ok', durations, distances: durations }), { status: 200 })
    }
    if (url.includes('/route/v1/driving/')) {
      const points = url.split('/driving/')[1].split('?')[0].split(';')
      const legs = Array.from({ length: points.length - 1 }, () => ({ duration: 780, distance: 12000, annotation: { distance: [12000], duration: [780] } }))
      return new Response(
        JSON.stringify({
          code: 'Ok',
          routes: [{ distance: (points.length - 1) * 12000, duration: (points.length - 1) * 780, geometry: { coordinates: points.map((p) => p.split(',').map(Number)) }, legs }],
        }),
        { status: 200 }
      )
    }
    throw new Error(`Unexpected URL in OSRM mock: ${url}`)
  }) as typeof fetch
}

function journeyFixture(): BriefJourney {
  const j: BriefJourney = {
    stages: [
      { name: 'Milano', direction: 'SW', radiusKm: 10, point: { lat: 45.4642, lng: 9.19, label: 'Milano' } },
      { name: 'Rozzano', direction: null, radiusKm: 8, point: { lat: 45.381, lng: 9.156, label: 'Rozzano' } },
      { name: 'Pavia', direction: null, radiusKm: 8, point: { lat: 45.185, lng: 9.16, label: 'Pavia' } },
    ],
    corridorKm: 3,
  }
  j.preview = makeJourneyPreview(j, [
    [[9.19, 45.4642], [9.156, 45.381]],
    [[9.156, 45.381], [9.16, 45.185]],
  ], 35)
  j.confirmedKey = j.preview.inputKey
  return j
}

async function run() {
  installOsrmMock()
  try {
    const journey = journeyFixture()

    // High score in Pavia must never precede Milano/Rozzano when journey order is enforced.
    const milano = cand({ key: 'm1', name: 'Milano A', city: 'Milano', journeyStage: 0, score: 50, lat: 45.44, lng: 9.13 })
    const rozzano = cand({ key: 'r1', name: 'Rozzano B', city: 'Rozzano', journeyStage: 1, score: 45, lat: 45.381, lng: 9.156 })
    const paviaHigh = cand({ key: 'p1', name: 'Pavia VIP', city: 'Pavia', province: 'PV', journeyStage: 2, score: 99, lat: 45.185, lng: 9.16 })
    const optionalLate = cand({ key: 'p2', name: 'Pavia 2', city: 'Pavia', province: 'PV', journeyStage: 2, score: 95, lat: 45.18, lng: 9.17 })

    const plan = await planTour({
      enforceJourneyOrder: true,
      candidates: [paviaHigh, optionalLate, milano, rozzano],
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
    })
    const stages = plan.stops.map((s) => s.candidate.journeyStage ?? -1)
    for (let i = 1; i < stages.length; i++) assert.ok(stages[i] >= stages[i - 1], 'Journey order must be monotonic')
    const firstPavia = plan.stops.findIndex((s) => s.candidate.key === 'p1')
    const milanoIdx = plan.stops.findIndex((s) => s.candidate.key === 'm1')
    const rozzanoIdx = plan.stops.findIndex((s) => s.candidate.key === 'r1')
    assert.ok(firstPavia > milanoIdx && firstPavia > rozzanoIdx)
    assert.ok(plan.returnMin >= 0)
    assert.ok(plan.totalKm > 0)

    // Mandatory + hard time conflict must remain blocked (non silently rearranged).
    const impossible = cand({ key: 'imp', name: 'Pavia impossibile', journeyStage: 2, requestedPriority: 1, preferredSlots: [{ id: 'x', label: 'too-early', start: 300, end: 320, strict: true }], visitMinutes: 40, city: 'Pavia', province: 'PV', lat: 45.185, lng: 9.16 })
    const impossiblePlan = await planTour({
      protectMandatory: true,
      enforceJourneyOrder: true,
      candidates: [milano, impossible],
      mandatoryKeys: new Set(['imp']),
      start: { lat: 45.46, lng: 9.19, label: 'Start' },
      end: { lat: 45.185, lng: 9.16, label: 'End' },
      tourDate: '2026-02-10',
      startMin: 480,
      endMin: 600,
      dayType: 'clienti',
      resolvedDayType: 'clienti',
      bufferPct: 10,
      area: { mode: 'auto' },
    })
    const blocked = mandatoryProblems(impossiblePlan)
    assert.ok(blocked.some((x) => x.includes('non entra nel giro')))

    // Stage eligible but not visited must produce journeyPlanProblems and save/start guard.
    const stageMissingPlan: TourPlan = {
      ...plan,
      stops: plan.stops.filter((s) => (s.candidate.journeyStage ?? 0) !== 1),
      areaFilter: {
        mode: 'auto',
        briefJourney: journey,
        journeyStageCounts: [
          { index: 0, label: 'Milano', eligible: 2 },
          { index: 1, label: 'Rozzano', eligible: 1 },
          { index: 2, label: 'Pavia', eligible: 2 },
        ],
      },
    }
    const stageMissing = journeyPlanProblems(stageMissingPlan)
    assert.ok(stageMissing.some((x) => x.includes('nessuna visita pianificata')))
    const saveGuard = mandatoryProblems(stageMissingPlan)
    assert.ok(saveGuard.some((x) => x.includes('nessuna visita pianificata')))

    // Fixed-order inversion must be detected explicitly.
    const inverted = await planFixedOrder([paviaHigh, rozzano, milano], {
      ...plan,
      areaFilter: { mode: 'auto', briefJourney: journey, journeyStageCounts: [{ index: 0, label: 'Milano', eligible: 1 }, { index: 1, label: 'Rozzano', eligible: 1 }, { index: 2, label: 'Pavia', eligible: 1 }] },
    })
    const invProblems = journeyPlanProblems(inverted)
    assert.ok(invProblems.some((x) => x.includes('ordine delle zone è stato invertito')))

    console.log('PASS planner_journey_order.unit.ts')
  } finally {
    globalThis.fetch = originalFetch
  }
}

run()
