import { describe, expect, it, vi } from 'vitest';

// Il validatore è puro: mock del client Supabase solo per evitare il bundle React Native.
vi.mock('../lib/supabase', () => ({ supabase: {} }));

import { briefConsistencyIssues, briefClarifications } from '../lib/aitour/brief-consistency';
import { briefSummary, resolveBriefDate } from '../lib/aitour/brief-summary';
import { previewBriefCandidates } from '../lib/aitour/brief-preview';
import { normalizeBriefV4, type TourBriefV4 } from '../lib/aitour/brief-v4';
import type { BriefCustomer } from '../lib/aitour/brief-customers';
import type { CandidatePool } from '../lib/aitour/data';
import type { TourCandidate } from '../lib/aitour/types';

// Porting del test web tests/aitour/brief_consistency.unit.ts
const base = (over: Record<string, unknown> = {}): TourBriefV4 => normalizeBriefV4({
  dayType: 'clienti', requestedDate: { type: 'tomorrow', value: '2026-06-16' }, areas: [], selection: { operator: 'AND', conditions: [{ type: 'clients_all' }] },
  includeAutomatic: true, mandatoryStops: [], preferredStops: [], exclusions: [], preferences: [], projectRules: [], fillers: [],
  visitTarget: { mode: 'unspecified', value: null, min: null, max: null, scope: 'total_including_mandatory' },
  route: { startPlace: null, endPlace: null, compact: 'off', startTime: null, endTime: null, finishBy: null, returnHome: false, returnToStart: false, splitAllowed: null, maxDays: null },
  interpretation: { confidence: 1, needsConfirmation: false, unresolvedEntities: [], warnings: [] }, summary: 'AI', ...over,
});
const customers: BriefCustomer[] = [
  { id: 'c1', name: 'Tabacchi Rossi', city: 'Voghera', province: 'PV', address: 'Via Roma 1', lat: 44.99, lng: 9.01 },
  { id: 'c2', name: 'Bar Bianchi', city: 'Pavia', province: 'PV', address: 'Corso Cavour 2', lat: 45.18, lng: 9.15 },
];
const TODAY = '2026-06-15';
const ids = (b: TourBriefV4) => briefConsistencyIssues(b, customers, TODAY).map((i) => i.id.split('-')[0]);
const apply = (b: TourBriefV4, id: string, fix: number) => {
  const issue = briefConsistencyIssues(b, customers, TODAY).find((i) => i.id.startsWith(id));
  expect(issue, `issue ${id} presente`).toBeTruthy();
  return issue!.fixes[fix].apply(b);
};

describe('briefConsistencyIssues: contraddizioni con correzione a un tap', () => {
  it('brief pulito: nessuna contraddizione', () => {
    expect(ids(base())).toEqual([]);
  });

  it('progetto richiesto ed escluso', () => {
    const b = base({ selection: { operator: 'AND', conditions: [{ type: 'project_membership', names: ['FED', 'DoctorVape'], match: 'any' }] }, exclusions: [{ type: 'project_membership', names: ['doctorvape'] }] });
    expect(ids(b)).toEqual(['project']);
    expect(apply(b, 'project', 0).exclusions).toHaveLength(0);
    const fixed = apply(b, 'project', 1);
    expect(fixed.selection.conditions[0].names).toEqual(['FED']);
    expect(ids(fixed)).toEqual([]);
  });

  it('filtro numerico annullato dall\'esclusione', () => {
    expect(ids(base({ selection: { operator: 'AND', conditions: [{ type: 'clients_all' }, { type: 'last_order_days', operator: '>=', value: 30 }] }, exclusions: [{ type: 'last_order_days', operator: '>=', value: 20 }] }))).toEqual(['num']);
    expect(ids(base({ selection: { operator: 'AND', conditions: [{ type: 'clients_all' }, { type: 'last_visit_days', operator: '>=', value: 30 }] }, exclusions: [{ type: 'last_visit_days', operator: '<=', value: 7 }] }))).toEqual([]);
  });

  it('area inclusa ed esclusa, provincia con sigla o nome', () => {
    const b = base({ areas: [{ kind: 'province', value: 'Provincia di Pavia', mode: 'include' }, { kind: 'province', value: 'PV', mode: 'exclude' }] });
    expect(ids(b)).toEqual(['area']);
    expect(apply(b, 'area', 1).areas.map((a) => a.mode)).toEqual(['exclude']);
  });

  it('percorso a zone con area include', () => {
    const b = base({ areas: [{ kind: 'city', value: 'Milano', mode: 'include' }], journey: { stages: [{ name: 'Milano', direction: 'SW', radiusKm: null }, { name: 'Pavia', direction: null, radiusKm: null }], corridorKm: null } });
    expect(ids(b)).toEqual(['journey']);
    expect(apply(b, 'journey', 0).areas).toHaveLength(0);
  });

  it('giornata incoerente con la selezione', () => {
    const b = base({ dayType: 'clienti', selection: { operator: 'OR', conditions: [{ type: 'prospects' }, { type: 'orphans' }] } });
    expect(ids(b)).toEqual(['daytype']);
    expect(apply(b, 'daytype', 0).dayType).toBe('sviluppo');
    const dev = base({ dayType: 'sviluppo', exclusions: [{ type: 'prospects' }, { type: 'orphans' }], selection: { operator: 'OR', conditions: [{ type: 'prospects' }, { type: 'orphans' }] } });
    expect(ids(dev)).toContain('dev');
  });

  it('appuntamento fuori orario e su tappa se possibile', () => {
    const b = base({ route: { startTime: '09:00', endTime: '17:00', finishBy: '16:00' }, mandatoryStops: [{ rawReference: 'Rossi', appointment: { type: 'exact', time: '16:30' }, priority: 2 }] });
    b.mandatoryStops[0].selectedCustomerId = 'c1';
    expect(ids(b)).toEqual(['appt']);
    const fixed = apply(b, 'appt-end', 0);
    expect(fixed.route.finishBy).toBe('17:00');
    expect(ids(fixed)).toEqual([]);
    const p = base({ route: { startTime: '10:00', endTime: '18:00' }, preferredStops: [{ rawReference: 'Bianchi', appointment: { type: 'approximate', time: '09:30' } }] });
    expect(ids(p)).toHaveLength(2);
    const promoted = apply(p, 'appt-pref', 0);
    expect([promoted.mandatoryStops.length, promoted.preferredStops.length]).toEqual([1, 0]);
  });

  it('rientro, giornate e percorso compatto incoerenti', () => {
    expect(ids(base({ route: { returnHome: true, returnToStart: true } }))).toEqual(['return']);
    expect(ids(base({ route: { returnHome: true, endPlace: { kind: 'customer', rawReference: 'Tabacchi Rossi' } } }))).toEqual(['return']);
    expect(ids(base({ route: { splitAllowed: false, maxDays: 2 } }))).toEqual(['split']);
    expect(ids(base({ route: { compact: 'required' }, journey: { stages: [{ name: 'Foggia', direction: 'S', radiusKm: null }], corridorKm: null } }))).toEqual(['compact']);
  });

  it('target incompatibile con gli obbligatori', () => {
    const b = base({ visitTarget: { mode: 'exact', value: 2, min: null, max: null, scope: 'total_including_mandatory' }, mandatoryStops: [{ rawReference: 'A' }, { rawReference: 'B' }, { rawReference: 'C' }] });
    expect(ids(b)).toEqual(['target']);
    expect(apply(b, 'target', 0).visitTarget.value).toBe(3);
    expect(apply(b, 'target', 1).visitTarget.scope).toBe('automatic_plus_mandatory');
    const named = base({ includeAutomatic: false, visitTarget: { mode: 'exact', value: 5, min: null, max: null, scope: 'total_including_mandatory' }, mandatoryStops: [{ rawReference: 'A' }] });
    expect(ids(named)).toEqual(['target']);
    expect(apply(named, 'target', 0).includeAutomatic).toBe(true);
  });

  it('data passata con fix oggi/domani', () => {
    const b = base({ requestedDate: { type: 'explicit', value: '2026-06-10' } });
    expect(ids(b)).toEqual(['date']);
    expect(apply(b, 'date', 1).requestedDate).toEqual({ type: 'tomorrow', value: '2026-06-16' });
  });
});

describe('briefClarifications: domande mirate', () => {
  it('una domanda per entità non collocata, con opzioni coerenti', () => {
    const b = base({ interpretation: { confidence: 0.5, needsConfirmation: true, unresolvedEntities: ['Voghera', 'Bergamo'], warnings: [] } });
    const cl = briefClarifications(b);
    expect(cl).toHaveLength(2);
    expect(cl[0].fixes.map((f) => f.label)).toEqual(['È un cliente da visitare', 'È una zona (comune)', 'Ignora']);
    expect(cl[1].fixes.some((f) => f.label === 'È la provincia BG')).toBe(true);
    const asArea = cl[0].fixes[1].apply(b);
    expect(asArea.areas).toEqual([{ kind: 'city', value: 'Voghera', mode: 'include' }]);
    expect(asArea.interpretation.unresolvedEntities).toEqual(['Bergamo']);
    expect(cl[0].fixes[0].apply(b).mandatoryStops[0].rawReference).toBe('Voghera');
  });

  it('entità già collocata come area: nessuna domanda ridondante', () => {
    const b = base({ areas: [{ kind: 'city', value: 'Pippolandia', mode: 'include' }], interpretation: { confidence: 0.5, needsConfirmation: true, unresolvedEntities: ['pippolandia'], warnings: [] } });
    expect(briefClarifications(b)).toHaveLength(0);
  });
});

describe('briefSummary e resolveBriefDate', () => {
  it('riassunto coerente con i chip', () => {
    const b = base({ mandatoryStops: [{ rawReference: 'Rossi di Voghera', appointment: { type: 'exact', time: '15:30' }, priority: 1 }], selection: { operator: 'AND', conditions: [{ type: 'project_membership', names: ['FED'] }, { type: 'last_order_days', operator: '>=', value: 30 }] }, areas: [{ kind: 'city', value: 'Pavia', mode: 'include' }], visitTarget: { mode: 'approximately', value: 12, min: null, max: null, scope: 'total_including_mandatory' }, route: { returnHome: true, finishBy: '18:00', compact: 'prefer' }, preferences: [{ type: 'prefer_oldest_last_order' }] });
    b.mandatoryStops[0].selectedCustomerId = 'c1';
    const s = briefSummary(b, customers, new Date('2026-06-15T10:00:00'));
    expect(s.startsWith('Giro clienti domani 16/06: progetti: FED e non ordinano da almeno 30 gg a Pavia.')).toBe(true);
    expect(s).toContain('Tappa obbligatoria: Tabacchi Rossi (Voghera) alle 15:30 [priorità alta].');
    expect(s).toContain('Circa 12 visite compresi gli obbligatori, fine tassativa entro le 18:00.');
    expect(s).toContain('rientro a casa, percorso compatto se possibile.');
    expect(s).toContain('ultimi 15 giorni');
    b.mandatoryStops = [];
    expect(briefSummary(b, customers)).not.toContain('obbligatori');
  });

  it('data passata riportata a oggi', () => {
    expect(resolveBriefDate(base({ requestedDate: { type: 'explicit', value: '2026-01-01' } }), new Date('2026-06-15T10:00:00'))).toBe('2026-06-15');
  });
});

describe('previewBriefCandidates', () => {
  const cand = (key: string, over: Partial<TourCandidate>): TourCandidate => ({
    key, entityType: 'client', customerId: key, tabaccheriaId: null, name: key, address: '', city: 'Pavia', province: 'PV',
    lat: 45.18, lng: 9.15, lastVisitDate: null, lastOrderDate: null, orderCount: 3, totalRevenue: 0, revenue6m: 0,
    avgOrderValue: 0, avgReorderDays: null, daysSinceOrder: 40, daysSinceVisit: 40, followUpDate: null, appointmentAt: null,
    notes: null, orphanStatus: null, estimatedRevenue: null, score: 10, priorityClass: 'Media', reason: '', visitMinutes: 20, ...over,
  } as TourCandidate);
  const pool = { clients: [cand('a', {}), cand('b', { daysSinceVisit: 3 }), cand('c1', {}), cand('d', { city: 'Milano', province: 'MI' })], prospects: [], orphans: [] } as unknown as CandidatePool;

  it('conta idonei, esclusi 15 giorni e nominati senza doppioni', () => {
    const b = base({ areas: [{ kind: 'city', value: 'Pavia', mode: 'include' }], mandatoryStops: [{ rawReference: 'Rossi' }], visitTarget: { mode: 'maximum', value: 1, min: null, max: null, scope: 'total_including_mandatory' } });
    b.mandatoryStops[0].selectedCustomerId = 'c1';
    const pv = previewBriefCandidates(b, pool, '2026-06-16');
    expect([pv.eligible, pv.recentlyExcluded.map((c) => c.key), pv.named, pv.planned]).toEqual([1, ['b'], 1, 1]);
    b.visitTarget = { mode: 'exact', value: 1, min: null, max: null, scope: 'automatic_plus_mandatory' };
    expect(previewBriefCandidates(b, pool, '2026-06-16').planned).toBe(2);
  });

  it('un escluso dai 15 giorni nominato come tappa rientra nel giro', () => {
    const b = base({ areas: [{ kind: 'city', value: 'Pavia', mode: 'include' }] });
    const before = previewBriefCandidates(b, pool, '2026-06-16');
    expect(before.recentlyExcluded.map((c) => c.key)).toEqual(['b']);
    // Stessa operazione del pulsante "Includi" nell'anteprima
    const recovered = { ...b, mandatoryStops: [{ rawReference: 'b', cityHint: 'Pavia', appointment: null, priority: 2, selectedCustomerId: 'b' }] };
    const after = previewBriefCandidates(recovered, pool, '2026-06-16');
    expect(after.recentlyExcluded.map((c) => c.key)).toEqual([]);
    expect([after.named, after.eligible, after.planned]).toEqual([1, 2, 3]);
  });
});
