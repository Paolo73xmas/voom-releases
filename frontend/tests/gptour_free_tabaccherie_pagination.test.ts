import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiTourSettings } from '../lib/aitour/types';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }));

const settings: AiTourSettings = {
  work_start: '08:00', work_end: '18:00', lunch_break_minutes: 60,
  visit_minutes_client: 20, visit_minutes_prospect: 25, visit_minutes_orphan: 25,
  buffer_pct_clienti: 15, buffer_pct_sviluppo: 20, buffer_pct_mista: 20,
  buffer_max_min: 60, max_daily_buffer_minutes: 120,
  cadence_weeks_active: 4, cadence_weeks_low: 8,
  home_address: null, home_lat: null, home_lng: null, office_address: null, office_lat: null, office_lng: null,
};

const bounds = { minLat: 40.6, maxLat: 41.1, minLng: 13.9, maxLng: 14.4 };
const filters = { provincia: 'NA', comune: 'Bacoli', refLat: 40.8, refLng: 14.1, agentId: 'agent-1' };

const mkRow = (id: number, comune = 'Bacoli') => ({
  id: `tab-${id}`,
  denominazione: `Tab ${id}`,
  codice_rivendita: `${id}`,
  indirizzo: 'Via Roma',
  comune,
  provincia: 'NA',
  lat: 40.79 + (id % 10) * 0.001,
  lng: 14.07 + (id % 10) * 0.001,
  assigned: id % 2 === 0,
});

type FreeHandler = (from: number, to: number) => { data: unknown[]; error: unknown };

async function loadModuleWithHandlers(handler: FreeHandler) {
  vi.resetModules();
  rpc.mockReset();
  rpc.mockImplementation((fn: string, args?: Record<string, unknown>) => {
    if (fn === 'ai_tour_no_interest_ids') return Promise.resolve({ data: [], error: null });
    if (fn !== 'ai_tour_free_tabaccherie') throw new Error(`Unexpected rpc ${fn}`);
    return {
      range: async (from: number, to: number) => {
        expect(args).toMatchObject({
          p_min_lat: bounds.minLat, p_max_lat: bounds.maxLat, p_min_lng: bounds.minLng, p_max_lng: bounds.maxLng,
          p_limit: expect.any(Number), p_provincia: filters.provincia, p_comune: filters.comune,
          p_ref_lat: filters.refLat, p_ref_lng: filters.refLng, p_agent_id: filters.agentId,
        });
        return handler(from, to);
      },
    };
  });
  return import('../lib/aitour/data');
}

describe('loadFreeTabaccherie pagination parity', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('uses fixed pages .range(0-999,1000-1999,2000-2499) with invariant p_limit=2500', async () => {
    const ranges: Array<[number, number]> = [];
    const rows = Array.from({ length: 2500 }, (_, i) => mkRow(i));
    const { loadFreeTabaccherie } = await loadModuleWithHandlers((from, to) => {
      ranges.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    });
    const out = await loadFreeTabaccherie(bounds, new Set(), settings, filters, 2500, false, { allowLimit: true });
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2499]]);
    expect(out).toHaveLength(2500);
    const freeCalls = rpc.mock.calls.filter(([name]) => name === 'ai_tour_free_tabaccherie');
    expect(freeCalls).toHaveLength(3);
    for (const [, args] of freeCalls) expect((args as Record<string, unknown>).p_limit).toBe(2500);
  });

  it('short page stops early (1000 + 426)', async () => {
    const ranges: Array<[number, number]> = [];
    const { loadFreeTabaccherie } = await loadModuleWithHandlers((from, to) => {
      ranges.push([from, to]);
      if (from === 0) return { data: Array.from({ length: 1000 }, (_, i) => mkRow(i, 'Pozzuoli')), error: null };
      return { data: Array.from({ length: 426 }, (_, i) => mkRow(1000 + i, 'Bacoli')), error: null };
    });
    const out = await loadFreeTabaccherie(bounds, new Set(), settings, filters, 2500, false, { allowLimit: true });
    expect(ranges).toEqual([[0, 999], [1000, 1999]]);
    expect(out).toHaveLength(1426);
    expect(out.filter((x) => x.city === 'Bacoli')).toHaveLength(426);
  });

  it('empty first page returns empty list', async () => {
    const { loadFreeTabaccherie } = await loadModuleWithHandlers(() => ({ data: [], error: null }));
    const out = await loadFreeTabaccherie(bounds, new Set(), settings, filters, 2500, false);
    expect(out).toEqual([]);
  });

  it('limit 60 only requests first small page', async () => {
    const ranges: Array<[number, number]> = [];
    const { loadFreeTabaccherie } = await loadModuleWithHandlers((from, to) => {
      ranges.push([from, to]);
      return { data: Array.from({ length: 60 }, (_, i) => mkRow(i)), error: null };
    });
    const out = await loadFreeTabaccherie(bounds, new Set(), settings, filters, 60, false);
    expect(ranges).toEqual([[0, 59]]);
    expect(out).toHaveLength(60);
  });

  it('strict mode throws on second-page error and does not keep partial first-page data', async () => {
    const { loadFreeTabaccherie } = await loadModuleWithHandlers((from) => {
      if (from === 0) return { data: Array.from({ length: 1000 }, (_, i) => mkRow(i)), error: null };
      return { data: [], error: { message: 'page2-fail' } };
    });
    await expect(loadFreeTabaccherie(bounds, new Set(), settings, filters, 2500, true)).rejects.toThrow('Ricerca nel registro tabaccherie non disponibile');
  });

  it('non-strict mode returns [] (not partial page) on second-page error', async () => {
    const { loadFreeTabaccherie } = await loadModuleWithHandlers((from) => {
      if (from === 0) return { data: Array.from({ length: 1000 }, (_, i) => mkRow(i)), error: null };
      return { data: [], error: { message: 'page2-fail' } };
    });
    const out = await loadFreeTabaccherie(bounds, new Set(), settings, filters, 2500, false);
    expect(out).toEqual([]);
  });

  it('at cap=2500: strict default throws, GPTour allowLimit returns data and warning callback', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => mkRow(i, i >= 2487 ? 'Bacoli' : 'Altro'));
    const warning = vi.fn();
    const { loadFreeTabaccherie } = await loadModuleWithHandlers((from, to) => ({ data: rows.slice(from, to + 1), error: null }));

    await expect(loadFreeTabaccherie(bounds, new Set(), settings, filters, 2500, true)).rejects.toThrow('Area di sviluppo troppo ampia');

    const out = await loadFreeTabaccherie(bounds, new Set(), settings, filters, 2500, true, { allowLimit: true, onLimitReached: warning });
    expect(out).toHaveLength(2500);
    expect(out.filter((x) => x.city === 'Bacoli')).toHaveLength(13);
    expect(warning).toHaveBeenCalledTimes(1);
  });
});
