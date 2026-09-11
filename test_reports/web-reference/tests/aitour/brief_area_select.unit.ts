import assert from 'node:assert/strict'
import { inBriefArea, areaProblem, outsideAreaReason, provinceCode, type TourAreaConstraint } from '../../src/lib/aitour/brief-area'
import { selectCandidatesV4, type TourBriefV4 } from '../../src/lib/aitour/brief-v4'
import type { TourCandidate } from '../../src/lib/aitour/types'

function candidate(over: Partial<TourCandidate>): TourCandidate {
  return {
    key: over.key ?? crypto.randomUUID(),
    entityType: over.entityType ?? 'client',
    customerId: over.customerId ?? crypto.randomUUID(),
    tabaccheriaId: over.tabaccheriaId ?? null,
    name: over.name ?? 'Cliente',
    address: over.address ?? 'Via Roma',
    city: over.city ?? 'Brescia',
    province: over.province ?? 'BS',
    lat: over.lat ?? 45.54,
    lng: over.lng ?? 10.22,
    lastVisitDate: null,
    lastOrderDate: null,
    orderCount: over.orderCount ?? 0,
    totalRevenue: over.totalRevenue ?? 0,
    revenue6m: over.revenue6m ?? 0,
    avgOrderValue: over.avgOrderValue ?? 0,
    avgReorderDays: null,
    daysSinceOrder: over.daysSinceOrder ?? null,
    daysSinceVisit: over.daysSinceVisit ?? null,
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
    potentialValue: 0,
  }
}

function brief(areas: TourAreaConstraint[]): TourBriefV4 {
  return {
    version: '4.0',
    includeAutomatic: true,
    dayType: 'clienti',
    requestedDate: { type: 'unspecified', value: null },
    areas,
    selection: { operator: 'AND', conditions: [{ type: 'clients_top', count: 2 }] },
    mandatoryStops: [],
    preferredStops: [],
    exclusions: [],
    preferences: [],
    projectRules: [],
    fillers: [],
    visitTarget: { mode: 'unspecified', value: null, min: null, max: null, scope: 'total_including_mandatory' },
    route: { startPlace: null, endPlace: null, compact: 'off', startTime: null, endTime: null, finishBy: null, returnHome: false, returnToStart: false, splitAllowed: null, maxDays: null },
    interpretation: { confidence: 1, needsConfirmation: false, unresolvedEntities: [], warnings: [] },
    summary: '',
  }
}

function run() {
  assert.equal(provinceCode('Provincia di Brescia'), 'BS')
  assert.equal(provinceCode('BS'), 'BS')

  const areas: TourAreaConstraint[] = [{ kind: 'province', value: 'Provincia di Brescia', mode: 'include' }]
  const bs = candidate({ key: 'bs', city: 'Brescia', province: 'BS', score: 90, revenue6m: 1000 })
  const mi = candidate({ key: 'mi', city: 'Milano', province: 'MI', score: 95, revenue6m: 2000 })

  // strict area applied before top-N: only BS remains despite MI being higher score
  const sel = selectCandidatesV4(brief(areas), { clients: [bs, mi], prospects: [], orphans: [] })
  assert.equal(sel.candidates.length, 1)
  assert.equal(sel.candidates[0].key, 'bs')

  // empty BS results stay empty (no broadening to whole portfolio)
  const onlyMi = selectCandidatesV4(brief(areas), { clients: [mi], prospects: [], orphans: [] })
  assert.equal(onlyMi.candidates.length, 0)

  // exclusions win over includes
  const withExclude: TourAreaConstraint[] = [
    { kind: 'province', value: 'BS', mode: 'include' },
    { kind: 'city', value: 'Brescia', mode: 'exclude' },
  ]
  assert.equal(inBriefArea(bs, withExclude), false)

  // missing province is a warning reason for strict province area
  const noProv = candidate({ key: 'np', city: 'Sconosciuto', province: '' })
  assert.ok(outsideAreaReason(noProv, [{ kind: 'province', value: 'BS', mode: 'include' }])?.includes('Provincia mancante'))

  // invalid province area should fail closed
  const badArea: TourAreaConstraint = { kind: 'province', value: 'Provincia Inventata', mode: 'include' }
  assert.ok(areaProblem(badArea)?.includes('Provincia non riconosciuta'))
  assert.equal(inBriefArea(bs, [badArea]), false)

  console.log('PASS brief_area_select.unit.ts')
}

run()
