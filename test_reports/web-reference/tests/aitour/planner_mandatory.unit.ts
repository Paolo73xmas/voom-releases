import assert from 'node:assert/strict'
import { planTour } from '../../src/lib/aitour/planner'
import { mandatoryProblems } from '../../src/lib/aitour/brief-feasibility'
import type { TourCandidate } from '../../src/lib/aitour/types'

function cand(over: Partial<TourCandidate>): TourCandidate {
  return {
    key: over.key ?? crypto.randomUUID(),
    entityType: over.entityType ?? 'client',
    customerId: over.customerId ?? crypto.randomUUID(),
    tabaccheriaId: null,
    name: over.name ?? 'Cliente',
    requestedPriority: over.requestedPriority,
    address: over.address ?? 'Via Roma',
    city: over.city ?? 'Brescia',
    province: over.province ?? 'BS',
    lat: over.lat ?? 45.54,
    lng: over.lng ?? 10.22,
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
      // Size must match ALL requested points (including optional + end), not a fixed 4.
      const n = url.split('/driving/')[1].split('?')[0].split(';').length
      const durations = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 0 : 600))
      return new Response(JSON.stringify({ code: 'Ok', durations, distances: durations }), { status: 200 })
    }
    if (url.includes('/route/v1/driving/')) {
      return new Response(
        JSON.stringify({
          code: 'Ok',
          routes: [
            {
              distance: 30000,
              duration: 3000,
              geometry: { coordinates: [[10.2, 45.5], [10.3, 45.6]] },
              legs: Array.from({ length: url.split('/driving/')[1].split('?')[0].split(';').length - 1 }, () => ({ duration: 600, distance: 10000, annotation: { distance: [10000], duration: [600] } })),
            },
          ],
        }),
        { status: 200 }
      )
    }
    throw new Error(`Unexpected URL in OSRM mock: ${url}`)
  }) as typeof fetch
}

async function run() {
  installOsrmMock()
  try {
    const mustP1 = cand({ key: 'm1', name: 'Rossi', requestedPriority: 1, preferredSlots: [{ id: 's1', label: 'mattina', start: 540, end: 660, strict: true }], visitMinutes: 20 })
    const mustP3 = cand({ key: 'm3', name: 'Bianchi', requestedPriority: 3, preferredSlots: [{ id: 's3', label: 'tarda', start: 720, end: 780, strict: true }], visitMinutes: 20, score: 55 })
    const optional = cand({ key: 'o1', name: 'Optional', requestedPriority: 2, visitMinutes: 20, score: 30 })

    const planned = await planTour({
      protectMandatory: true,
      candidates: [mustP1, mustP3, optional],
      mandatoryKeys: new Set(['m1', 'm3']),
      start: { lat: 45.54, lng: 10.22, label: 'Start' },
      end: { lat: 45.54, lng: 10.22, label: 'End' },
      tourDate: '2026-02-10',
      startMin: 480,
      endMin: 1080,
      dayType: 'clienti',
      resolvedDayType: 'clienti',
      bufferPct: 10,
      area: { mode: 'auto' },
    })

    const idxP1 = planned.stops.findIndex((s) => s.candidate.key === 'm1')
    const idxP3 = planned.stops.findIndex((s) => s.candidate.key === 'm3')
    assert.ok(idxP1 >= 0 && idxP3 >= 0)
    assert.ok(idxP1 < idxP3, 'Priority 1 mandatory must be admitted before lower priorities')

    const probs = mandatoryProblems(planned)
    assert.equal(probs.length, 0)

    // Impossible required stop should be reported as uncovered with explicit mandatory problem
    const impossible = cand({ key: 'imp', name: 'Impossibile', requestedPriority: 1, preferredSlots: [{ id: 'x', label: 'impossible', start: 300, end: 320, strict: true }], visitMinutes: 40 })
    const impossiblePlan = await planTour({
      protectMandatory: true,
      candidates: [impossible],
      mandatoryKeys: new Set(['imp']),
      start: { lat: 45.54, lng: 10.22, label: 'Start' },
      end: { lat: 45.54, lng: 10.22, label: 'End' },
      tourDate: '2026-02-10',
      startMin: 480,
      endMin: 600,
      dayType: 'clienti',
      resolvedDayType: 'clienti',
      bufferPct: 10,
      area: { mode: 'auto' },
    })
    const missing = mandatoryProblems(impossiblePlan)
    assert.ok(missing.some((m) => m.includes('non entra nel giro')))

    console.log('PASS planner_mandatory.unit.ts')
  } finally {
    globalThis.fetch = originalFetch
  }
}

run()
