import assert from 'node:assert/strict'
import { wantsDevelopmentRegistry, developmentSearches, loadBriefDevelopment } from '../../src/lib/aitour/brief-development'
import { selectCandidatesV4, type TourBriefV4 } from '../../src/lib/aitour/brief-v4'
import type { AiTourSettings, TourCandidate } from '../../src/lib/aitour/types'
import { supabase } from '@/lib/supabase/client'

const defaultSettings: AiTourSettings = {
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
  home_address: null,
  home_lat: null,
  home_lng: null,
  office_address: null,
  office_lat: null,
  office_lng: null,
}

function baseBrief(over: Partial<TourBriefV4> = {}): TourBriefV4 {
  return {
    version: '4.0',
    includeAutomatic: true,
    dayType: 'sviluppo',
    requestedDate: { type: 'unspecified', value: null },
    areas: [{ kind: 'city', value: 'Foggia', mode: 'include' }],
    selection: { operator: 'OR', conditions: [{ type: 'prospects' }, { type: 'orphans' }] },
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
    ...over,
  }
}

function c(over: Partial<TourCandidate>): TourCandidate {
  return {
    key: over.key ?? crypto.randomUUID(),
    entityType: over.entityType ?? 'prospect',
    customerId: over.customerId ?? crypto.randomUUID(),
    tabaccheriaId: over.tabaccheriaId ?? null,
    name: over.name ?? 'X',
    address: over.address ?? 'Via',
    city: over.city ?? 'Foggia',
    province: over.province ?? 'FG',
    lat: over.lat ?? 41.46,
    lng: over.lng ?? 15.55,
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
    score: 0,
    priorityClass: 'Media',
    reason: '',
    nextSuggestedVisit: null,
    visitMinutes: 20,
    preferredSlots: null,
    excludedDays: null,
    potentialValue: 0,
  }
}

async function run() {
  assert.equal(wantsDevelopmentRegistry(baseBrief()), true)
  assert.equal(wantsDevelopmentRegistry(baseBrief({ exclusions: [{ type: 'prospects' }] })), false)

  // stale journey geometry must fail closed
  const stale = baseBrief({
    areas: [],
    journey: {
      stages: [{ name: 'Foggia', direction: 'S', radiusKm: 10, point: { lat: 41.462, lng: 15.544, label: 'Foggia' } }],
      corridorKm: 3,
      preview: { inputKey: 'stale', regions: [], roads: [], roadKm: 0 },
    },
  })
  assert.throws(() => developmentSearches(stale), /Conferma prima la località/)

  // dayType sviluppo fallback source = prospects+orphans+registry, never clients-only
  const sel = selectCandidatesV4(baseBrief(), {
    clients: [c({ key: 'client', entityType: 'client' })],
    prospects: [c({ key: 'prospect', entityType: 'prospect' })],
    orphans: [c({ key: 'orphan', entityType: 'orphan', customerId: null })],
    registry: [c({ key: 'free', entityType: 'free', customerId: null, tabaccheriaId: 'tab-1' })],
  })
  const keys = new Set(sel.candidates.map((x) => x.key))
  assert.ok(keys.has('prospect') && keys.has('orphan') && keys.has('free'))
  assert.ok(!keys.has('client'))

  // exclusions prospects must remove prospect+free+never together
  const noProspects = selectCandidatesV4(baseBrief({ exclusions: [{ type: 'prospects' }] }), {
    clients: [],
    prospects: [c({ key: 'p2', entityType: 'prospect' })],
    orphans: [c({ key: 'o2', entityType: 'orphan', customerId: null })],
    registry: [c({ key: 'f2', entityType: 'free', tabaccheriaId: 't2', customerId: null }), c({ key: 'n2', entityType: 'never', tabaccheriaId: 't3', customerId: null })],
  })
  const noTypes = new Set(noProspects.candidates.map((x) => x.entityType))
  assert.ok(!noTypes.has('prospect') && !noTypes.has('free') && !noTypes.has('never'))

  // provider error must be explicit (not silent zero), and >=501 must raise refine-area message.
  const originalRpc = (supabase as { rpc: (fn: string, args: unknown) => Promise<{ data: unknown[]; error: unknown }> }).rpc
  ;(supabase as { rpc: (fn: string, args: unknown) => Promise<{ data: unknown[]; error: unknown }> }).rpc = async () => ({ data: [], error: { message: 'rpc down' } })
  await assert.rejects(
    () => loadBriefDevelopment(baseBrief(), 'agent-1', defaultSettings, new Set(), { lat: 41.46, lng: 15.55, label: 'Foggia' }),
    /Registro tabaccherie non disponibile|Ricerca nel registro tabaccherie non disponibile/
  )

  ;(supabase as { rpc: (fn: string, args: unknown) => Promise<{ data: unknown[]; error: unknown }> }).rpc = async () => ({
    data: Array.from({ length: 501 }, (_, i) => ({ id: `t${i}`, denominazione: `Tab ${i}`, codice_rivendita: `${i}`, indirizzo: 'Via', comune: 'Foggia', provincia: 'FG', lat: 41.46, lng: 15.55, assigned: false })),
    error: null,
  })
  await assert.rejects(
    () => loadBriefDevelopment(baseBrief(), 'agent-1', defaultSettings, new Set(), { lat: 41.46, lng: 15.55, label: 'Foggia' }),
    /troppe tabaccherie/
  )
  ;(supabase as { rpc: (fn: string, args: unknown) => Promise<{ data: unknown[]; error: unknown }> }).rpc = originalRpc

  console.log('PASS brief_development.unit.ts')
}

run()
