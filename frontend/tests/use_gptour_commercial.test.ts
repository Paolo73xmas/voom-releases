// Real hook + engine + scoped loader + purchases + proposals. Only IO boundaries are fixtures.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TourCandidate, GeoPoint } from '../lib/aitour/types';
import type { TourIntent } from '../lib/aitour/gptour-intent';
const io = vi.hoisted(() => ({ ai: vi.fn(), settings: vi.fn(), pool: vi.fn(), storage: new Map<string, string>(), orders: vi.fn() }));
vi.mock('../lib/theme', () => ({ currentThemeMode: 'light' }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'isolated-id' }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (k: string) => io.storage.get(k) ?? null,
  setItem: async (k: string, v: string) => { io.storage.set(k, v); }, removeItem: async (k: string) => { io.storage.delete(k); },
} }));
vi.mock('../lib/aitour/gptour-api', () => ({ runGptour: io.ai }));
vi.mock('../lib/aitour/tours', () => ({ getSettings: io.settings }));
vi.mock('../lib/aitour/gptour-data', () => ({ loadGptourPool: io.pool }));
vi.mock('../lib/supabase', () => ({ supabase: { from: (table: string) => {
  if (table !== 'orders') throw new Error(`Unexpected Supabase table ${table}`);
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'in', 'eq', 'neq', 'or', 'order', 'range']) chain[method] = () => chain;
  chain.abortSignal = io.orders; return chain;
} } }));
vi.mock('../lib/aitour/gptour-followups', async () => ({
  ...await vi.importActual<Record<string, unknown>>('../lib/aitour/gptour-followups'),
  loadGptourEvents: async () => [], rescheduleGptFollowUp: async () => { throw new Error('Write forbidden'); },
}));
vi.mock('../lib/aitour/gptour-save', () => ({
  saveGptourBatch: async () => { throw new Error('Write forbidden'); }, reconcileGptourSave: async () => { throw new Error('Write forbidden'); },
}));
vi.mock('../lib/aitour/osrm', () => ({
  getMatrix: async (points: GeoPoint[]) => ({ fallback: false, durations: points.map((_, i) => points.map((_, j) => i === j ? 0 : 60)),
    distances: points.map((_, i) => points.map((_, j) => i === j ? 0 : 100)) }),
  getRoute: async (points: GeoPoint[]) => ({ fallback: false, latlngs: points.map(p => [p.lat, p.lng]),
    legs: points.slice(1).map(() => ({ durationMin: 1, distanceKm: .1 })), totalMin: points.length - 1, totalKm: .5, kmUrban: null, kmExtra: null, kmHighway: null }),
}));

function candidate(key: string, type: 'client' | 'never' = 'client', city = 'Rozzano'): TourCandidate {
  return { key, entityType: type, customerId: type === 'client' ? key : null, tabaccheriaId: `tab-${key}`, name: key,
    lat: 45.38, lng: 9.14, city, province: 'MI', address: '', lastVisitDate: null, lastOrderDate: null,
    daysSinceOrder: null, daysSinceVisit: null, daysSincePhysicalContact: null, orderCount: 0, totalRevenue: 0, revenue6m: 0,
    avgOrderValue: 0, avgReorderDays: null, followUpDate: null, appointmentAt: null, notes: null, orphanStatus: null,
    estimatedRevenue: null, score: 50, priorityClass: 'Media', reason: '', nextSuggestedVisit: null, visitMinutes: 20, potentialValue: 0,
    gptourData: { contactKnown: true, orderKnown: false, revenueKnown: true, commercial: { authorized: true,
      relationship: type === 'client' ? 'own' : 'none', newPointVerified: type === 'never' } } };
}
const pool = [candidate('old'), candidate('edge'), candidate('recent'), candidate('never-bought'), candidate('new', 'never'), candidate('opera', 'never', 'Opera')];

function harness() {
  const states: unknown[] = [], refs: { current: unknown }[] = [], effects: { deps?: unknown[]; cleanup?: void | (() => void) }[] = [];
  let si = 0, ri = 0, ei = 0, mounted = true;
  return {
    react: {
      useState<T>(initial: T): [T, (v: T | ((old: T) => T)) => void] {
        const n = si++; if (!(n in states)) states[n] = initial;
        return [states[n] as T, v => { if (mounted) states[n] = typeof v === 'function' ? (v as (old: T) => T)(states[n] as T) : v; }];
      },
      useRef<T>(initial: T) { const n = ri++; refs[n] ??= { current: initial }; return refs[n] as { current: T }; },
      useCallback<T>(fn: T) { return fn; },
      useEffect(fn: () => void | (() => void), deps?: unknown[]) {
        const n = ei++, prev = effects[n];
        if (!prev || !deps || deps.some((d, i) => !Object.is(d, prev.deps?.[i]))) { prev?.cleanup?.(); effects[n] = { deps, cleanup: fn() }; }
      },
    },
    render<T>(fn: () => T) { si = 0; ri = 0; ei = 0; return fn(); },
    unmount() { mounted = false; effects.forEach(e => e?.cleanup?.()); },
  };
}
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
async function mount() {
  vi.resetModules(); const h = harness(); vi.doMock('react', () => h.react);
  const { useGptour } = await import('../hooks/useGptour');
  const actor = { id: 'isolated-agent', role: 'agent' };
  const render = () => h.render(() => useGptour(actor, actor.id, 'Fixture'));
  render(); await settle(); render(); await settle();
  return { render, unmount: h.unmount };
}
beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Real network forbidden'); }));
  io.storage.clear(); io.ai.mockReset(); io.orders.mockReset();
  const { DEFAULT_SETTINGS } = await import('../lib/aitour/types');
  io.settings.mockResolvedValue({ ...DEFAULT_SETTINGS, work_start: '08:00', work_end: '18:00', home_lat: 45.38, home_lng: 9.14, home_address: 'Casa' });
  io.pool.mockImplementation(async () => ({ candidates: structuredClone(pool), authorizedCandidates: structuredClone(pool.filter(c => c.entityType === 'client')), zones: [], complete: true, warnings: [] }));
  io.orders.mockResolvedValue({ data: [['old', 21], ['edge', 20], ['recent', 19]].map(([id, days]) => ({
    id: `order-${id}`, customer_id: id, order_date: new Date(Date.now() - Number(days) * 86400000).toISOString().slice(0, 10), status: 'confirmed', is_deleted: false,
  })), error: null });
  io.ai.mockImplementation(async (req: { pool: TourCandidate[]; intent: TourIntent }) => ({
    reply: 'Fixture', needsInfo: false, multiDay: false, lodging: 'home', tourDate: '2099-10-06', startTime: null, endTime: null,
    selection: req.pool.map(c => ({ key: c.key, reason: null })), days: [], notes: null, intentReset: true,
    intent: { commercialGroups: { newPoints: false }, requestedEntityTypes: ['orphan'], orderMinDays: null, requireOrderHistory: false,
      requestedArea: { comune: 'Roma' }, tourDates: ['2099-10-06'], allowNearby: true },
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const stops = (h: ReturnType<Awaited<ReturnType<typeof mount>>['render']>) => h.days.flatMap(d => d.plan.stops.map(s => s.candidate.key));

describe('real GPTour orchestration with real purchase scope, engine and opportunities', () => {
  it('legacy AI omitting new points cannot erase the explicitly requested group', async () => {
    const implementation = io.ai.getMockImplementation()!;
    io.ai.mockImplementation(async req => ({ ...await implementation(req), selection: req.pool.filter((c: TourCandidate) => c.customerId).map((c: TourCandidate) => ({ key: c.key, reason: null })) }));
    const env = await mount(); let h = env.render();
    await h.send('Domani clienti senza ordini da 20 giorni e nuovi punti vendita a Rozzano'); h = env.render();
    expect(h.error).toBe(''); expect(stops(h).sort()).toEqual(['edge', 'new', 'old']);
    expect(io.ai.mock.calls[1][0].intent).toMatchObject({ requireOrderHistory: false, orderMinDays: null, commercialGroups: { inactiveDays: 20 } });
    env.unmount();
  });
  it('empty AI selection falls back to BOTH requested groups, not development-only', async () => {
    const implementation = io.ai.getMockImplementation()!;
    io.ai.mockImplementation(async req => ({ ...await implementation(req), selection: [] }));
    const env = await mount(); let h = env.render();
    await h.send('Domani clienti senza ordini da 20 giorni e nuovi punti vendita a Rozzano'); h = env.render();
    expect(h.error).toBe(''); expect(stops(h).sort()).toEqual(['edge', 'new', 'old']);
    env.unmount();
  });
  it('missing threshold asks before AI and numeric response uses two verified passes', async () => {
    const env = await mount(); let h = env.render();
    await h.send('Clienti inattivi negli acquisti'); h = env.render();
    expect(io.ai).not.toHaveBeenCalled(); expect(h.intent.commercialGroups?.needsDays).toBe(true);
    expect(h.messages.at(-1)?.content).toContain('Da quanti giorni');
    await h.send('20giorni'); h = env.render();
    expect(h.error).toBe(''); expect(io.ai).toHaveBeenCalledTimes(2);
    expect(h.intent.commercialGroups).toMatchObject({ inactiveDays: 20, needsDays: false });
    expect(stops(h).sort()).toEqual(['edge', 'old']); env.unmount();
  });
  it.each(['da 20 giorni', 'da20giorni'])('mixed %s → 09:00 → Opera → remove new → persisted draft/rebuild', async period => {
    const env = await mount(); let h = env.render();
    await h.send(`Domani clienti che non comprano ${period} e nuovi punti vendita a Rozzano`); h = env.render();
    expect(h.error).toBe(''); expect(stops(h).sort()).toEqual(['edge', 'new', 'old']);
    const date = h.intent.tourDates[0]; expect(date).toBeTruthy();
    expect(h.intent.commercialGroups).toMatchObject({ existing: true, newPoints: true, inactiveDays: 20 });
    expect(h.days[0].plan.tourDate).toBe(date);
    await h.send('Parti alle09:00'); h = env.render();
    expect(h.error).toBe(''); expect(h.intent.requestedStartTime).toBe('09:00'); expect(h.days[0].plan.startMin).toBe(540);
    await h.send('Aggiungi anche Opera'); h = env.render();
    expect(h.error).toBe(''); expect(h.intent.requestedArea?.comuni).toEqual(['Rozzano', 'Opera']);
    expect(h.intent.allowNearby).toBe(false); expect(stops(h).sort()).toEqual(['edge', 'new', 'old', 'opera']);
    expect(h.intent.tourDates).toEqual([date]);
    await h.send(`No, lascia perdere i nuovi clienti. Solo quelli che non ordinano ${period}.`); h = env.render();
    expect(h.error).toBe(''); expect(stops(h).sort()).toEqual(['edge', 'old']);
    expect(h.intent.commercialGroups).toMatchObject({ newPoints: false, inactiveDays: 20 });
    expect(h.proposal?.candidates.length || 0).toBe(0);
    expect(io.ai).toHaveBeenCalledTimes(8);
    await settle(); env.unmount();
    const reopened = await mount(); h = reopened.render();
    expect(h.intent.commercialGroups).toMatchObject({ newPoints: false, inactiveDays: 20 });
    expect(h.intent.tourDates).toEqual([date]); expect(h.intent.requestedArea?.comuni).toEqual(['Rozzano', 'Opera']);
    await h.rebuild(); h = reopened.render();
    expect(h.error).toBe(''); expect(stops(h).sort()).toEqual(['edge', 'old']); expect(io.ai).toHaveBeenCalledTimes(8);
    reopened.unmount();
  });
  it('B includes existing never-buyers and new points, A rejects them without expanding fill', async () => {
    const env = await mount(); let h = env.render();
    await h.send('Domani i miei clienti e le tabaccherie nuove a Rozzano'); h = env.render();
    expect(h.error).toBe(''); expect(stops(h)).toContain('never-bought'); expect(stops(h)).toContain('new');
    await h.send('Solo clienti senza ordini da almeno 20 giorni'); h = env.render();
    expect(h.error).toBe(''); expect(stops(h).sort()).toEqual(['edge', 'old']);
    expect(h.proposal?.candidates.length || 0).toBe(0); env.unmount();
  });
});