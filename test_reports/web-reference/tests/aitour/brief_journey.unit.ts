import assert from 'node:assert/strict'
import {
  normalizeJourney,
  journeyProblems,
  makeJourneyPreview,
  journeyStageFor,
  journeyKey,
  assignJourneyStages,
  balanceJourneyCandidates,
  type BriefJourney,
} from '../../src/lib/aitour/brief-journey'
import { inBriefArea } from '../../src/lib/aitour/brief-area'
import type { TourCandidate } from '../../src/lib/aitour/types'

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
    score: over.score ?? 50,
    priorityClass: 'Media',
    reason: '',
    nextSuggestedVisit: null,
    visitMinutes: 20,
    preferredSlots: null,
    excludedDays: null,
    potentialValue: 0,
    journeyStage: over.journeyStage,
  }
}

function run() {
  // normalizeJourney must ignore LLM-injected coordinates/geometry/consent bits
  const raw = {
    stages: [{ name: 'Milano', direction: 'SW', radiusKm: 8, point: { lat: 1, lng: 1 }, geometry: { x: true } }],
    corridorKm: 3,
    preview: { fake: true },
    confirmedKey: 'abc',
    consent: true,
  }
  const norm = normalizeJourney(raw) as BriefJourney
  assert.equal(norm.stages.length, 1)
  assert.equal(norm.stages[0].name, 'Milano')
  assert.equal(norm.stages[0].direction, 'SW')
  assert.equal((norm.stages[0] as { point?: unknown }).point, undefined)
  assert.equal((norm as { preview?: unknown }).preview, undefined)
  assert.equal((norm as { confirmedKey?: unknown }).confirmedKey, undefined)

  // SW wedge around Milano should include SW points and exclude NE points
  const milanoOnly: BriefJourney = {
    stages: [{ name: 'Milano', direction: 'SW', radiusKm: 10, point: { lat: 45.4642, lng: 9.19, label: 'Milano' } }],
    corridorKm: 3,
  }
  milanoOnly.preview = makeJourneyPreview(milanoOnly, [], 0)
  const swPoint = { lat: 45.42, lng: 9.10 }
  const nePoint = { lat: 45.54, lng: 9.30 }
  assert.equal(journeyStageFor(swPoint, milanoOnly), 0)
  assert.equal(journeyStageFor(nePoint, milanoOnly), null)

  // Ordered corridor Milano -> Rozzano -> Pavia with overlap preference near arrivals
  const j: BriefJourney = {
    stages: [
      { name: 'Milano', direction: 'SW', radiusKm: 10, point: { lat: 45.4642, lng: 9.19, label: 'Milano' } },
      { name: 'Rozzano', direction: null, radiusKm: 8, point: { lat: 45.381, lng: 9.156, label: 'Rozzano' } },
      { name: 'Pavia', direction: null, radiusKm: 8, point: { lat: 45.185, lng: 9.16, label: 'Pavia' } },
    ],
    corridorKm: 3,
  }
  const roads: [number, number][][] = [
    [[9.19, 45.4642], [9.156, 45.381]],
    [[9.156, 45.381], [9.16, 45.185]],
  ]
  j.preview = makeJourneyPreview(j, roads, 35)
  assert.equal(journeyStageFor({ lat: 45.381, lng: 9.156 }, j), 1, 'overlap near Rozzano should prefer stage 2 locality')
  assert.equal(inBriefArea({ lat: 45.185, lng: 9.16, city: 'Pavia', province: 'PV' }, [], j), true)
  assert.equal(inBriefArea({ lat: 45.70, lng: 9.70, city: 'Bergamo', province: 'BG' }, [], j), false, 'outside corridor must fail closed')

  // Geometry/order edits must invalidate map refresh + confirmation
  const beforeKey = journeyKey(j)
  const jsonbOrdered: BriefJourney = { ...j, stages: j.stages.map((s) => ({ point: s.point ? { label: s.point.label, lng: s.point.lng, lat: s.point.lat } : undefined, radiusKm: s.radiusKm, direction: s.direction, name: s.name })) }
  assert.equal(journeyKey(jsonbOrdered), beforeKey, 'JSONB object-key reordering must not invalidate geometry/consent')
  assert.equal(journeyStageFor({ lat: 45.185, lng: 9.16 }, jsonbOrdered), 2, 'Saved geometry remains usable after JSONB key reorder')
  j.confirmedKey = beforeKey
  const changed = { ...j, corridorKm: 6 }
  const probsMap = journeyProblems(changed)
  assert.ok(probsMap.some((p) => p.includes('Aggiorna la mappa')))
  const refreshed = { ...changed, preview: makeJourneyPreview(changed, roads, 35), confirmedKey: beforeKey }
  const probsConfirm = journeyProblems(refreshed)
  assert.ok(probsConfirm.some((p) => p.includes('Conferma sulla mappa')))

  // applyJourney behavior: assign stages from geometry then balance by stage before cap
  const staged = assignJourneyStages([
    cand({ key: 'a', score: 95, lat: 45.43, lng: 9.12 }), // stage 0
    cand({ key: 'b', score: 90, lat: 45.41, lng: 9.15 }), // stage 0
    cand({ key: 'c', score: 99, lat: 45.381, lng: 9.156 }), // stage 1
    cand({ key: 'd', score: 85, lat: 45.30, lng: 9.16 }), // stage 1/2 corridor
    cand({ key: 'e', score: 98, lat: 45.185, lng: 9.16 }), // stage 2
  ], j)
  assert.ok(staged.every((c) => c.journeyStage != null))
  const balanced = balanceJourneyCandidates(staged)
  const firstThreeStages = balanced.slice(0, 3).map((c) => c.journeyStage)
  assert.ok(new Set(firstThreeStages).size >= 2, 'balancing should avoid single-stage front-loading')

  // Invalid/missing input and route mismatch rejections
  assert.equal(normalizeJourney(null), null)
  assert.throws(() => makeJourneyPreview(j, roads.slice(0, 1), 5), /Percorso stradale incompleto/)

  console.log('PASS brief_journey.unit.ts')
}

run()
