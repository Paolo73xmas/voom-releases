import assert from 'node:assert/strict'
import { bindSavedPlace, bindSavedBriefPlaces } from '../../src/lib/aitour/brief-saved-places'
import type { TourBriefV4, BriefPlace } from '../../src/lib/aitour/brief-v4'
import type { AiTourSettings } from '../../src/lib/aitour/types'

function settings(over: Partial<AiTourSettings> = {}): AiTourSettings {
  return {
    work_start: '08:00',
    work_end: '18:00',
    visit_minutes_client: 20,
    visit_minutes_prospect: 25,
    visit_minutes_orphan: 25,
    buffer_pct_clienti: 18,
    buffer_pct_sviluppo: 35,
    buffer_pct_mista: 25,
    buffer_max_min: 60,
    cadence_weeks_active: 5,
    cadence_weeks_low: 8,
    lunch_break_minutes: 30,
    home_address: 'Via Casa 1, Brescia',
    home_lat: 45.541,
    home_lng: 10.221,
    office_address: 'Via Sede 2, Brescia',
    office_lat: 45.551,
    office_lng: 10.231,
    ...over,
  }
}

function brief(over: Partial<TourBriefV4> = {}): TourBriefV4 {
  return {
    version: '4.0',
    includeAutomatic: true,
    dayType: 'mista',
    requestedDate: { type: 'unspecified', value: null },
    areas: [],
    selection: { operator: 'AND', conditions: [{ type: 'clients_all' }] },
    mandatoryStops: [{ rawReference: 'Adriano Nuvolento', priority: 1 }],
    preferredStops: [{ rawReference: 'Stefano Calvisano', priority: 2 }],
    exclusions: [],
    preferences: [],
    projectRules: [{ source: 'user-brief' }],
    fillers: [{ source: 'fallback' }],
    visitTarget: { mode: 'unspecified', value: null, min: null, max: null, scope: 'total_including_mandatory' },
    route: {
      startPlace: { kind: 'home', rawReference: 'Casa', point: { lat: 1, lng: 1, label: 'OLD' } },
      endPlace: null,
      compact: 'off',
      startTime: null,
      endTime: null,
      finishBy: null,
      returnHome: false,
      returnToStart: false,
      splitAllowed: null,
      maxDays: null,
    },
    interpretation: { confidence: 1, needsConfirmation: false, unresolvedEntities: [], warnings: [] },
    summary: 'test',
    ...over,
  }
}

function run() {
  const s = settings()

  // valid saved home/office must bind exact saved point+label and never keep stale point
  const home = bindSavedPlace({ kind: 'home', rawReference: 'Casa', point: { lat: 40, lng: 9, label: 'STALE' } }, s) as BriefPlace
  assert.equal(home.rawReference, 'Via Casa 1, Brescia')
  assert.deepEqual(home.point, { lat: 45.541, lng: 10.221, label: 'Via Casa 1, Brescia' })

  const office = bindSavedPlace({ kind: 'office', rawReference: 'Sede', point: { lat: 41, lng: 10, label: 'STALE2' } }, s) as BriefPlace
  assert.equal(office.rawReference, 'Via Sede 2, Brescia')
  assert.deepEqual(office.point, { lat: 45.551, lng: 10.231, label: 'Via Sede 2, Brescia' })

  // invalid coords must drop point
  const invalidCases: Partial<AiTourSettings>[] = [
    { home_lat: null, home_lng: 10.22 },
    { home_lat: 45.5, home_lng: null },
    { home_lat: Number.NaN, home_lng: 10.22 },
    { home_lat: Number.POSITIVE_INFINITY, home_lng: 10.22 },
    { home_lat: 91, home_lng: 10.22 },
    { home_lat: 45.5, home_lng: 181 },
    { home_lat: 0, home_lng: 0 },
  ]
  for (const over of invalidCases) {
    const p = bindSavedPlace({ kind: 'home', rawReference: 'Casa', point: { lat: 1, lng: 1, label: 'OLD' } }, settings(over)) as BriefPlace
    assert.equal(p.point, undefined)
  }

  // empty address must drop point even if stale coords existed
  const noAddr = bindSavedPlace({ kind: 'home', rawReference: 'Casa', point: { lat: 1, lng: 1, label: 'OLD' } }, settings({ home_address: '   ' })) as BriefPlace
  assert.equal(noAddr.point, undefined)

  // no settings (all null) must discard old point
  const noSettings = bindSavedPlace(
    { kind: 'home', rawReference: 'Casa', point: { lat: 1, lng: 1, label: 'OLD' } },
    settings({ home_address: null, home_lat: null, home_lng: null }),
  ) as BriefPlace
  assert.equal(noSettings.point, undefined)

  // free address/customer points unchanged
  const addr = { kind: 'address', rawReference: 'Via Roma 1', point: { lat: 45.6, lng: 10.2, label: 'Via Roma 1' } } as BriefPlace
  const cust = { kind: 'customer', rawReference: 'Rossi', point: { lat: 45.7, lng: 10.3, label: 'Rossi' } } as BriefPlace
  assert.deepEqual(bindSavedPlace(addr, s), addr)
  assert.deepEqual(bindSavedPlace(cust, s), cust)

  // returnHome synthesizes endPlace home and binds it from saved settings
  const bound = bindSavedBriefPlaces(brief({ route: { ...brief().route, returnHome: true, endPlace: null } }), s)
  assert.equal(bound.route.endPlace?.kind, 'home')
  assert.deepEqual(bound.route.endPlace?.point, { lat: 45.541, lng: 10.221, label: 'Via Casa 1, Brescia' })

  // preserve unrelated brief sections (priorities, sources, etc.)
  assert.equal(bound.mandatoryStops[0].priority, 1)
  assert.equal(bound.preferredStops[0].priority, 2)
  assert.equal((bound.projectRules[0] as { source: string }).source, 'user-brief')
  assert.equal((bound.fillers[0] as { source: string }).source, 'fallback')

  console.log('PASS brief_saved_places.unit.ts')
}

run()
