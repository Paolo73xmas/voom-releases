import assert from 'node:assert/strict';
import { bindSavedPlace, bindSavedBriefPlaces } from '../../frontend/lib/aitour/brief-saved-places';
import { matchBriefCustomers, type BriefCustomer } from '../../frontend/lib/aitour/brief-customers';
import { inBriefArea, areaProblem, outsideAreaReason, provinceCode, type TourAreaConstraint } from '../../frontend/lib/aitour/brief-area';
import { selectCandidatesV4, type TourBriefV4 } from '../../frontend/lib/aitour/brief-v4';
import { wantsDevelopmentRegistry, developmentSearches, loadBriefDevelopment } from '../../frontend/lib/aitour/brief-development';
import { supabase } from '../../frontend/lib/supabase';
import type { AiTourSettings, TourCandidate } from '../../frontend/lib/aitour/types';

function c(over: Partial<BriefCustomer>): BriefCustomer {
  return {
    id: over.id ?? crypto.randomUUID(),
    name: over.name ?? 'Cliente',
    crmName: over.crmName ?? '',
    contactName: over.contactName ?? '',
    resaleCode: over.resaleCode ?? '',
    city: over.city ?? 'Brescia',
    province: over.province ?? 'BS',
    address: over.address ?? 'Via Roma',
    lat: over.lat ?? 45.54,
    lng: over.lng ?? 10.22,
  };
}

function tc(over: Partial<TourCandidate>): TourCandidate {
  return {
    key: over.key ?? crypto.randomUUID(),
    entityType: over.entityType ?? 'client',
    customerId: over.customerId ?? crypto.randomUUID(),
    tabaccheriaId: over.tabaccheriaId ?? null,
    name: over.name ?? 'Cliente',
    address: over.address ?? 'Via',
    city: over.city ?? 'Brescia',
    province: over.province ?? 'BS',
    lat: over.lat ?? 45.54,
    lng: over.lng ?? 10.22,
    lastVisitDate: null,
    lastOrderDate: null,
    orderCount: 0,
    totalRevenue: 0,
    revenue6m: over.revenue6m ?? 0,
    avgOrderValue: 0,
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
  };
}

const settings: AiTourSettings = {
  work_start: '08:00', work_end: '18:00', visit_minutes_client: 20, visit_minutes_prospect: 25, visit_minutes_orphan: 25,
  buffer_pct_clienti: 18, buffer_pct_sviluppo: 35, buffer_pct_mista: 25, buffer_max_min: 60,
  cadence_weeks_active: 5, cadence_weeks_low: 8, lunch_break_minutes: 30,
  home_address: 'Via Casa 1, Brescia', home_lat: 45.541, home_lng: 10.221,
  office_address: 'Via Sede 2, Brescia', office_lat: 45.551, office_lng: 10.231,
};

function brief(areas: TourAreaConstraint[] = []): TourBriefV4 {
  return {
    version: '4.0', includeAutomatic: true, dayType: 'sviluppo', requestedDate: { type: 'unspecified', value: null },
    areas,
    selection: { operator: 'OR', conditions: [{ type: 'prospects' }, { type: 'orphans' }] },
    mandatoryStops: [], preferredStops: [], exclusions: [], preferences: [], projectRules: [], fillers: [],
    visitTarget: { mode: 'unspecified', value: null, min: null, max: null, scope: 'total_including_mandatory' },
    route: { startPlace: { kind: 'home', rawReference: 'Casa', point: { lat: 1, lng: 1, label: 'OLD' } }, endPlace: null, compact: 'off', startTime: null, endTime: null, finishBy: null, returnHome: false, returnToStart: false, splitAllowed: null, maxDays: null },
    interpretation: { confidence: 1, needsConfirmation: false, unresolvedEntities: [], warnings: [] },
    summary: '',
  };
}

async function run() {
  const home = bindSavedPlace({ kind: 'home', rawReference: 'Casa', point: { lat: 1, lng: 1, label: 'old' } }, settings)!;
  assert.deepEqual(home.point, { lat: 45.541, lng: 10.221, label: 'Via Casa 1, Brescia' });
  const bound = bindSavedBriefPlaces(brief(), settings);
  assert.equal(bound.route.startPlace?.rawReference, 'Via Casa 1, Brescia');

  const base = [
    c({ id: 'rossi-bs', name: 'Tabacchi Rossi', city: 'Brescia' }),
    c({ id: 'rossi-bg', name: 'Tabacchi Rossi', city: 'Bergamo' }),
    c({ id: 'fumagalli', name: 'Tabacchi Fumagalli' }),
    c({ id: 'code-only', name: 'Anonimo', resaleCode: 'RIV123', city: 'Lumezzane' }),
  ];
  assert.notEqual(matchBriefCustomers({ rawReference: 'Fumagali' }, base).status, 'unresolved');
  assert.equal(matchBriefCustomers({ rawReference: 'Rossi' }, base).status, 'ambiguous');
  assert.equal(matchBriefCustomers({ rawReference: 'ClienteInesistenteTotaleZZZ' }, base).status, 'unresolved');

  assert.equal(provinceCode('Provincia di Brescia'), 'BS');
  const bs = tc({ key: 'bs', city: 'Brescia', province: 'BS', score: 90, revenue6m: 1000 });
  const mi = tc({ key: 'mi', city: 'Milano', province: 'MI', score: 95, revenue6m: 2000 });
  const sel = selectCandidatesV4(
    {
      ...brief([{ kind: 'province', value: 'Provincia di Brescia', mode: 'include' }]),
      dayType: 'clienti',
      selection: { operator: 'AND', conditions: [{ type: 'clients_top', count: 2 }] },
    },
    { clients: [bs, mi], prospects: [], orphans: [] }
  );
  assert.equal(sel.candidates.length, 1);
  assert.equal(sel.candidates[0].key, 'bs');
  assert.equal(inBriefArea(bs, [{ kind: 'city', value: 'Brescia', mode: 'exclude' }]), false);
  assert.ok(areaProblem({ kind: 'province', value: 'Provincia Inventata', mode: 'include' } as TourAreaConstraint)?.includes('Provincia non riconosciuta'));
  assert.ok(outsideAreaReason(tc({ city: 'Sconosciuto', province: '' }), [{ kind: 'province', value: 'BS', mode: 'include' }])?.includes('Provincia mancante'));

  assert.equal(wantsDevelopmentRegistry(brief()), true);
  assert.equal(wantsDevelopmentRegistry({ ...brief(), exclusions: [{ type: 'prospects' }] as any }), false);
  assert.throws(() => developmentSearches({ ...brief(), areas: [], journey: { stages: [{ name: 'Foggia', direction: 'S', radiusKm: 10, point: { lat: 41.462, lng: 15.544, label: 'Foggia' } }], corridorKm: 3, preview: { inputKey: 'stale', regions: [], roads: [], roadKm: 0 } } }), /Conferma prima la località/);

  const originalRpc = (supabase as any).rpc;
  (supabase as any).rpc = async (fn: string) => {
    if (fn === 'ai_tour_no_interest_ids') return { data: [], error: null };
    if (fn === 'ai_tour_free_tabaccherie') return { data: [{ id: 'tab-1', denominazione: 'Tab 1', codice_rivendita: '1', indirizzo: 'Via', comune: 'Foggia', provincia: 'FG', lat: 41.46, lng: 15.55, assigned: false }], error: null };
    return { data: [], error: null };
  };
  const devRows = await loadBriefDevelopment(brief(), 'agent-1', settings, new Set(), { lat: 41.46, lng: 15.55, label: 'Foggia' });
  assert.ok(devRows.length >= 1);
  (supabase as any).rpc = originalRpc;

  console.log('PASS brief_customer_area_dev_saved.unit.ts');
}

run();
