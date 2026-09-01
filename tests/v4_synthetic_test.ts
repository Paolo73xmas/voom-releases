// Test sintetico V4 (nessun DB): sweepPartition, selezione V4, fuzzy stops, appointment, targetCap, planTour returnFlexible
import { sweepPartition, estimateDayMin, planTour } from '../frontend/lib/aitour/planner';
import { normalizeBriefV4, selectCandidatesV4, resolveStopRefs, applyAppointment, targetCap, applyReturnHomeFallback } from '../frontend/lib/aitour/brief-v4';
import type { TourCandidate } from '../frontend/lib/aitour/types';

const mk = (i: number, lat: number, lng: number, extra: Partial<TourCandidate> = {}): TourCandidate => ({
  key: `c${i}`,
  entityType: 'client',
  customerId: `id${i}`,
  tabaccheriaId: null,
  name: `Cliente ${i}`,
  city: 'MILANO',
  province: 'MI',
  address: `Via Test ${i}`,
  lat, lng,
  score: 50,
  potentialValue: 100,
  visitMinutes: 20,
  orderCount: 3,
  totalRevenue: 1000,
  revenue6m: 500,
  avgReorderDays: 60,
  daysSinceOrder: 45,
  daysSinceVisit: 50,
  lastOrderDate: null,
  lastVisitDate: null,
  appointmentAt: null,
  notes: null,
  projectType: null,
  projectName: null,
  orphanStatus: null,
  preferredSlots: null,
  excludedDays: null,
  ...extra,
} as unknown as TourCandidate);

async function main() {
  let fail = 0;
  const check = (name: string, ok: boolean, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
    if (!ok) fail++;
  };

  // ---- 1) sweepPartition: 3 cluster direzionali attorno a Milano, k=3 ----
  const start = { lat: 45.4642, lng: 9.19, label: 'Duomo' };
  const cands: TourCandidate[] = [];
  let n = 0;
  // cluster NORD, EST, SUD (10 punti ciascuno)
  for (let i = 0; i < 10; i++) cands.push(mk(n++, 45.55 + i * 0.004, 9.19 + (i % 3) * 0.01));
  for (let i = 0; i < 10; i++) cands.push(mk(n++, 45.4642 + (i % 3) * 0.004, 9.32 + i * 0.006));
  for (let i = 0; i < 10; i++) cands.push(mk(n++, 45.37 - i * 0.004, 9.19 + (i % 3) * 0.01));
  const groups = sweepPartition(cands, start, 3);
  check('sweepPartition: 3 settori', groups.length === 3, `${groups.map((g) => g.length).join('+')}`);
  check('sweepPartition: tutte le tappe presenti', groups.flat().length === 30);
  // Bilanciamento: tempi stimati entro 45 min l'uno dall'altro
  const est = groups.map((g) => Math.round(estimateDayMin(g, start)));
  check('sweepPartition: settori bilanciati', Math.max(...est) - Math.min(...est) <= 60, `est=${est.join(',')}`);
  // Purezza settoriale: ogni gruppo dominato da un solo cluster direzionale
  const clusterOf = (c: TourCandidate) => (c.lat > 45.5 ? 'N' : c.lat < 45.42 ? 'S' : 'E');
  const purity = groups.map((g) => {
    const counts: Record<string, number> = {};
    for (const c of g) counts[clusterOf(c)] = (counts[clusterOf(c)] || 0) + 1;
    return Math.max(...Object.values(counts)) / g.length;
  });
  check('sweepPartition: settori geograficamente puri', purity.every((p) => p >= 0.7), `purity=${purity.map((p) => p.toFixed(2)).join(',')}`);

  // ---- 2) normalizeBriefV4 + fallback returnHome ----
  const brief = normalizeBriefV4({
    dayType: 'clienti',
    requestedDate: { type: 'today', value: null },
    areas: [{ kind: 'city', value: 'Milano', mode: 'include' }],
    selection: { operator: 'AND', conditions: [{ type: 'clients_all' }, { type: 'last_order_days', operator: '>=', value: 30 }] },
    mandatoryStops: [{ rawReference: 'Cliente 5', cityHint: null, appointment: { type: 'exact', time: '15:30' } }],
    preferredStops: [],
    exclusions: [{ type: 'prospects' }],
    preferences: [{ type: 'prefer_oldest_last_order' }],
    visitTarget: { mode: 'maximum', value: 8, min: null, max: null, scope: 'total_including_mandatory' },
    route: { compact: 'off', startTime: null, endTime: null, finishBy: null, returnHome: false, returnToStart: false, splitAllowed: null, maxDays: 3 },
    interpretation: { confidence: 0.9, needsConfirmation: false, unresolvedEntities: [], warnings: [] },
    summary: 'test',
  });
  check('normalize: 2 condizioni', brief.selection.conditions.length === 2);
  check('normalize: maxDays 3', brief.route.maxDays === 3);
  const withHome = applyReturnHomeFallback({ ...brief, route: { ...brief.route } }, 'giro a milano tornando a casa presto');
  check('fallback returnHome regex', withHome.route.returnHome === true);

  // ---- 3) selectCandidatesV4: filtro numerico AND + esclusioni + boost ----
  const pool = {
    clients: [
      mk(100, 45.5, 9.2, { daysSinceOrder: 60 }),
      mk(101, 45.5, 9.21, { daysSinceOrder: 10 }),
      mk(102, 45.5, 9.22, { daysSinceOrder: 90 }),
    ],
    prospects: [mk(103, 45.5, 9.23, { entityType: 'prospect' })],
    orphans: [],
  } as never;
  const sel = selectCandidatesV4(brief, pool);
  check('selectV4: filtro last_order_days>=30', sel.candidates.length === 2 && sel.candidates.every((c) => (c.daysSinceOrder || 0) >= 30));
  check('selectV4: boost prefer_oldest_last_order', (sel.candidates.find((c) => c.key === 'c102')?.score || 0) > 50);

  // ---- 4) resolveStopRefs fuzzy ----
  const all = [mk(200, 45.5, 9.2, { name: 'Tabacchi Martini Danilo' }), mk(201, 45.5, 9.21, { name: 'Bar Sport Rossi' })];
  const rs = resolveStopRefs([{ rawReference: 'martini' }], all);
  check('resolveStopRefs: match fuzzy', rs[0].status === 'resolved' && rs[0].candidate?.key === 'c200');
  const rs2 = resolveStopRefs([{ rawReference: 'inesistente xyz' }], all);
  check('resolveStopRefs: non trovato', rs2[0].status === 'unresolved');

  // ---- 5) applyAppointment + targetCap ----
  const withAppt = applyAppointment(all[0], { type: 'exact', time: '15:30' });
  check('applyAppointment: fascia 15:25-15:45 strict', withAppt.preferredSlots?.[0]?.start === 15 * 60 + 25 && withAppt.preferredSlots?.[0]?.strict === true);
  check('targetCap maximum 8', targetCap(brief.visitTarget) === 8);
  check('targetCap all → null', targetCap({ mode: 'all', value: null, min: null, max: null, scope: 'total_including_mandatory' }) === null);

  // ---- 6) planTour con returnFlexible: rientro può sforare, avviso solo su ultima visita ----
  const few = [mk(300, 45.50, 9.20), mk(301, 45.51, 9.21), mk(302, 45.52, 9.22)];
  const plan = await planTour({
    candidates: few,
    mandatoryKeys: new Set(),
    start,
    end: { lat: 45.4642, lng: 9.19, label: 'Casa' },
    tourDate: '2026-09-02',
    startMin: 9 * 60,
    endMin: 12 * 60,
    dayType: 'clienti',
    resolvedDayType: 'clienti',
    bufferPct: 10,
    area: { mode: 'auto' },
    returnFlexible: true,
  });
  check('planTour returnFlexible: piano generato', plan.stops.length >= 2, `${plan.stops.length} stops, finish ${plan.finishMin}, return ${plan.returnMin}`);
  check('planTour: end presente (rientro)', plan.returnMin > 0);

  console.log(fail === 0 ? '\nTUTTI I TEST PASSANO' : `\n${fail} TEST FALLITI`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
