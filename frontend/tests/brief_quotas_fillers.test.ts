import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

import { planTour } from '../lib/aitour/planner';
import { applyProjectPriority, buildProjectQuotas, pickWithQuotas, quotaReport } from '../lib/aitour/brief-quotas';
import { fillerCandidates } from '../lib/aitour/brief-fillers';
import { normalizeBriefV4, projectRuleLabel, fillerLabel, type TourBriefV4 } from '../lib/aitour/brief-v4';
import { briefConsistencyIssues } from '../lib/aitour/brief-consistency';
import { briefSummary } from '../lib/aitour/brief-summary';
import type { TourCandidate } from '../lib/aitour/types';
import type { CandidatePool } from '../lib/aitour/data';

// Porting del test web tests/aitour/brief_quotas_fillers.unit.ts
function cand(over: Partial<TourCandidate>): TourCandidate {
  return {
    key: over.key ?? 'k', entityType: over.entityType ?? 'client', customerId: over.customerId ?? over.key ?? null, tabaccheriaId: null,
    name: over.name ?? over.key ?? 'Cliente', address: '', city: over.city ?? 'Pavia', province: 'PV', lat: over.lat ?? 45.18, lng: over.lng ?? 9.15,
    lastVisitDate: null, lastOrderDate: null, orderCount: 3, totalRevenue: 0, revenue6m: 0, avgOrderValue: 0, avgReorderDays: null,
    daysSinceOrder: over.daysSinceOrder ?? 40, daysSinceVisit: over.daysSinceVisit ?? 40, followUpDate: null, appointmentAt: null,
    notes: null, orphanStatus: null, estimatedRevenue: null, score: over.score ?? 50, priorityClass: 'Media', reason: '',
    visitMinutes: over.visitMinutes ?? 20, projectName: over.projectName ?? null, projectType: over.projectType ?? null,
    requestedPriority: over.requestedPriority,
  } as TourCandidate;
}

const base = (over: Record<string, unknown>): TourBriefV4 => normalizeBriefV4({
  dayType: 'clienti', requestedDate: { type: 'tomorrow', value: '2026-06-16' }, areas: [],
  selection: { operator: 'AND', conditions: [{ type: 'project_membership', names: ['FED', 'DoctorVape'], match: 'any' }] },
  includeAutomatic: true, mandatoryStops: [], preferredStops: [], exclusions: [], preferences: [],
  visitTarget: { mode: 'exact', value: 10, min: null, max: null, scope: 'total_including_mandatory' },
  route: { compact: 'off', startTime: null, endTime: null, finishBy: null, returnHome: false, returnToStart: false, splitAllowed: null, maxDays: null },
  interpretation: { confidence: 1, needsConfirmation: false, unresolvedEntities: [], warnings: [] }, summary: 'AI', ...over,
});

const fed = Array.from({ length: 8 }, (_, i) => cand({ key: `fed${i}`, projectName: 'FED', score: 40 - i }));
const dv = Array.from({ length: 12 }, (_, i) => cand({ key: `dv${i}`, projectName: 'DoctorVape', score: 80 - i }));
const all = [...dv, ...fed];

describe('normalizzazione quote e riempitivi', () => {
  const b = base({
    projectRules: [{ type: 'minimum_count', project: 'FED', value: 6 }, { type: 'maximum_count', project: 'DoctorVape', value: 4 }, { type: 'ratio', project: 'FED', value: 50 }, { type: 'priority', project: 'FED', priority: 1 }, { type: 'bogus', project: 'X' }, { type: 'minimum_count', project: '' }],
    fillers: [{ selection: { operator: 'AND', conditions: [{ type: 'prospects' }] }, when: 'time_available', target: { mode: 'maximum', value: 3 } }, { selection: { conditions: [] } }],
  });

  it('regole normalizzate, percentuale 50 → 0.5, scarti ignorati', () => {
    expect(b.projectRules.map(projectRuleLabel)).toEqual(['Almeno 6 FED', 'Massimo 4 DoctorVape', '50% FED', 'Priorità 1: FED']);
    expect(b.fillers.map(fillerLabel)).toEqual(['Se avanza tempo: max 3 prospect']);
  });

  it('il riassunto CRM dichiara quote e riempitivi', () => {
    const s = briefSummary(b, []);
    expect(s).toContain('Quote tra progetti: almeno 6 FED, massimo 4 DoctorVape, 50% FED e priorità 1: FED.');
    expect(s).toContain('Se avanza tempo: max 3 prospect (aggiunti solo nel tempo residuo');
  });
});

describe('pickWithQuotas', () => {
  it('baseline: per punteggio nessun FED entrerebbe', () => {
    expect(all.slice(0, 10).filter((c) => c.projectName === 'FED')).toHaveLength(0);
  });

  it('riserva i minimi e rispetta i massimi', () => {
    const built = buildProjectQuotas(all, base({ projectRules: [{ type: 'minimum_count', project: 'FED', value: 6 }, { type: 'maximum_count', project: 'DoctorVape', value: 4 }] }).projectRules, 10);
    expect(built.warnings).toEqual([]);
    const picked = pickWithQuotas(all, 10, built.quotas);
    expect([picked.filter((c) => c.projectName === 'FED').length, picked.filter((c) => c.projectName === 'DoctorVape').length]).toEqual([6, 4]);
    expect(picked.filter((c) => c.projectName === 'FED').map((c) => c.key)).toEqual(['fed0', 'fed1', 'fed2', 'fed3', 'fed4', 'fed5']);
  });

  it('massimo da solo: il resto si riempie con gli altri', () => {
    const built = buildProjectQuotas(all, [{ type: 'maximum_count', project: 'DoctorVape', value: 2, priority: null }], 10);
    const picked = pickWithQuotas(all, 10, built.quotas);
    expect([picked.filter((c) => c.projectName === 'DoctorVape').length, picked.length]).toEqual([2, 10]);
  });

  it('exact_count e ratio', () => {
    const built = buildProjectQuotas(all, [{ type: 'exact_count', project: 'FED', value: 5, priority: null }, { type: 'ratio', project: 'DoctorVape', value: 0.5, priority: null }], 10);
    const picked = pickWithQuotas(all, 10, built.quotas);
    expect([picked.filter((c) => c.projectName === 'FED').length, picked.filter((c) => c.projectName === 'DoctorVape').length]).toEqual([5, 5]);
    const noCap = buildProjectQuotas(all, [{ type: 'ratio', project: 'FED', value: 0.5, priority: null }], null);
    expect(noCap.quotas).toHaveLength(0);
    expect(noCap.warnings[0]).toContain('percentuale non è applicabile');
  });

  it('idonei insufficienti: avviso ma si prende il possibile', () => {
    const built = buildProjectQuotas(all, [{ type: 'minimum_count', project: 'FED', value: 12, priority: null }], 15);
    expect(built.warnings[0]).toContain('idonei solo 8');
    expect(pickWithQuotas(all, 15, built.quotas).filter((c) => c.projectName === 'FED')).toHaveLength(8);
  });

  it('obbligatori protetti contano nella quota e non vengono tolti', () => {
    const built = buildProjectQuotas(all, [{ type: 'maximum_count', project: 'DoctorVape', value: 1, priority: null }], 5);
    const picked = pickWithQuotas(all, 5, built.quotas, new Set(['dv11']));
    expect(picked.some((c) => c.key === 'dv11')).toBe(true);
    expect(picked.filter((c) => c.projectName === 'DoctorVape')).toHaveLength(1);
  });

  it('priorità progetto: bonus punteggio decrescente', () => {
    const prio = applyProjectPriority(all, [{ type: 'priority', project: 'FED', value: null, priority: 1 }, { type: 'priority', project: 'DoctorVape', value: null, priority: 2 }]);
    expect([prio.find((c) => c.key === 'fed0')!.score, prio.find((c) => c.key === 'dv0')!.score]).toEqual([70, 100]);
  });
});

describe('planner con quote (OSRM mock: 10 minuti tra tutti)', () => {
  const originalFetch = globalThis.fetch;
  const input = {
    candidates: all, mandatoryKeys: new Set<string>(), start: { lat: 45.18, lng: 9.15, label: 'S' }, end: null,
    tourDate: '2026-06-16', startMin: 540, endMin: 720, dayType: 'clienti' as const, resolvedDayType: 'clienti' as const,
    bufferPct: 0, area: { mode: 'auto' as const },
  };

  beforeAll(() => {
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      const u = String(url);
      const pts = u.split('/driving/')[1].split('?')[0].split(';').length;
      if (u.includes('/table/v1/driving/')) {
        const d = Array.from({ length: pts }, (_, i) => Array.from({ length: pts }, (_, j) => i === j ? 0 : 600));
        return new Response(JSON.stringify({ code: 'Ok', durations: d, distances: d }), { status: 200 });
      }
      return new Response(JSON.stringify({ code: 'Ok', routes: [{ distance: 30000, duration: 3000, geometry: { coordinates: [[9.1, 45.1], [9.2, 45.2]] }, legs: Array.from({ length: pts - 1 }, () => ({ duration: 600, distance: 10000, annotation: { distance: [10000], duration: [600] } })) }] }), { status: 200 });
    }) as typeof fetch;
  });
  afterAll(() => { globalThis.fetch = originalFetch; });

  it('senza quote entrano solo i DoctorVape (punteggio più alto)', async () => {
    const plan = await planTour(input);
    expect(plan.stops.filter((s) => s.candidate.projectName === 'FED')).toHaveLength(0);
  });

  it('con quote il greedy rispetta minimo e massimo e il report è pulito', async () => {
    const q = buildProjectQuotas(all, [{ type: 'minimum_count', project: 'FED', value: 4, priority: null }, { type: 'maximum_count', project: 'DoctorVape', value: 1, priority: null }], null).quotas;
    const plan = await planTour({ ...input, quotas: q });
    expect(plan.stops.filter((s) => s.candidate.projectName === 'FED').length).toBeGreaterThanOrEqual(4);
    expect(plan.stops.filter((s) => s.candidate.projectName === 'DoctorVape')).toHaveLength(1);
    expect(quotaReport(plan.stops.map((s) => s.candidate), q).unmet).toEqual([]);
  });

  it('con un obbligatorio DV il massimo è occupato da lui', async () => {
    const must = cand({ key: 'must', projectName: 'DoctorVape', score: 99, requestedPriority: 2 });
    const q = buildProjectQuotas([must, ...all], [{ type: 'minimum_count', project: 'FED', value: 4, priority: null }, { type: 'maximum_count', project: 'DoctorVape', value: 1, priority: null }], null).quotas;
    const plan = await planTour({ ...input, candidates: [must, ...all], mandatoryKeys: new Set(['must']), quotas: q });
    expect(plan.stops.filter((s) => s.candidate.projectName === 'FED').length).toBeGreaterThanOrEqual(4);
    expect(plan.stops.filter((s) => s.candidate.projectName === 'DoctorVape').map((s) => s.candidate.key)).toEqual(['must']);
  });

  it('quota non raggiunta: report con il motivo', async () => {
    const q = buildProjectQuotas(all, [{ type: 'minimum_count', project: 'FED', value: 4, priority: null }, { type: 'maximum_count', project: 'DoctorVape', value: 1, priority: null }], null).quotas;
    const tight = await planTour({ ...input, endMin: 600, quotas: q });
    const rep = quotaReport(tight.stops.map((s) => s.candidate), q);
    expect(rep.unmet).toHaveLength(1);
    expect(rep.unmet[0]).toContain('Almeno 4 FED: nel giro');
    expect(rep.unmet[0]).toContain('orario o percorso');
  });

  it('riempitivi: vicini al giro, sotto il punteggio minimo, con quota massima', async () => {
    const plan = await planTour(input);
    const fb = base({ selection: { operator: 'AND', conditions: [{ type: 'clients_all' }] }, fillers: [{ selection: { operator: 'AND', conditions: [{ type: 'prospects' }] }, when: 'time_available', target: { mode: 'maximum', value: 3 } }] });
    const prospects = [
      cand({ key: 'p1', entityType: 'prospect', score: 90 }),
      cand({ key: 'p2', entityType: 'prospect', score: 20 }),
      cand({ key: 'pfar', entityType: 'prospect', lat: 46.5, lng: 11.0, score: 95 }),
      cand({ key: 'precent', entityType: 'prospect', daysSinceVisit: 2, score: 60 }),
    ];
    const fs = fillerCandidates(fb, { clients: all, prospects, orphans: [] } as unknown as CandidatePool, plan.stops.map((s) => s.candidate), new Set(), '2026-06-16');
    expect(fs.list.map((c) => c.key)).toEqual(['p1', 'p2']);
    const minMain = Math.min(...plan.stops.map((s) => s.candidate.score));
    expect(fs.list.every((c) => c.score <= minMain - 5)).toBe(true);
    expect([fs.quotas[0].max, fs.quotas[0].label]).toEqual([3, 'Se avanza tempo: max 3 prospect']);
  });
});

describe('contraddizioni su quote e riempitivi', () => {
  const TODAY = '2026-06-15';
  it('regola su progetto non richiesto, con fix che lo aggiunge', () => {
    const b = base({ projectRules: [{ type: 'minimum_count', project: 'Nuvola', value: 3 }] });
    const c = briefConsistencyIssues(b, [], TODAY);
    expect(c).toHaveLength(1);
    expect(c[0].id).toBe('rule-sel-0');
    expect(c[0].fixes[0].apply(b).selection.conditions[0].names).toEqual(['FED', 'DoctorVape', 'Nuvola']);
  });

  it('quote minime oltre il totale delle visite', () => {
    const c = briefConsistencyIssues(base({ projectRules: [{ type: 'minimum_count', project: 'FED', value: 6 }, { type: 'minimum_count', project: 'DoctorVape', value: 6 }] }), [], TODAY);
    expect(c).toHaveLength(1);
    expect(c[0].id).toBe('rule-total');
    expect(c[0].fixes[0].apply(base({})).visitTarget.value).toBe(12);
  });

  it('riempitivo identico alla selezione principale', () => {
    const c = briefConsistencyIssues(base({ fillers: [{ selection: { operator: 'AND', conditions: [{ type: 'project_membership', names: ['FED', 'DoctorVape'] }] }, target: { mode: 'maximum', value: 3 } }] }), [], TODAY);
    expect(c).toHaveLength(1);
    expect(c[0].id).toBe('filler-same-0');
  });

  it('caso reale completo: nessuna contraddizione', () => {
    expect(briefConsistencyIssues(base({ projectRules: [{ type: 'minimum_count', project: 'FED', value: 6 }], fillers: [{ selection: { operator: 'AND', conditions: [{ type: 'prospects' }] }, target: { mode: 'maximum', value: 3 } }] }), [], TODAY)).toEqual([]);
  });
});
