import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn());
const inMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { readNewPointEvidence } from '../lib/aitour/gptour-commercial-data';
import type { TourCandidate } from '../lib/aitour/types';

function point(id: string): TourCandidate {
  return {
    key: `free:${id}`,
    entityType: 'free',
    customerId: null,
    tabaccheriaId: id,
    name: id,
    lat: 45.4,
    lng: 9.1,
    city: 'Rozzano',
    province: 'MI',
    address: '',
    lastVisitDate: null,
    lastOrderDate: null,
    daysSinceVisit: null,
    daysSinceOrder: null,
    orderCount: 0,
    totalRevenue: 0,
    revenue6m: 0,
    avgOrderValue: 0,
    avgReorderDays: null,
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
    potentialValue: 0,
  };
}

beforeEach(() => {
  fromMock.mockReset();
  selectMock.mockReset();
  inMock.mockReset();
  fromMock.mockReturnValue({ select: selectMock });
  selectMock.mockReturnValue({ in: inMock });
});

describe('readNewPointEvidence: boundary classification on direct Supabase chain', () => {
  it('positive_non_visitato: verifies only rows with explicit non_visitato + not linked + not closed', async () => {
    inMock.mockResolvedValue({
      data: [
        { id: 'p1', customer_id: null, stato_visita: 'non_visitato', chiusa: false },
      ],
      error: null,
    });

    await expect(readNewPointEvidence([point('p1')])).resolves.toEqual(new Set(['p1']));
  });

  it('null status is unknown (not verified)', async () => {
    inMock.mockResolvedValue({
      data: [{ id: 'p2', customer_id: null, stato_visita: null, chiusa: false }],
      error: null,
    });

    await expect(readNewPointEvidence([point('p2')])).resolves.toEqual(new Set());
  });

  it('closed row is excluded', async () => {
    inMock.mockResolvedValue({
      data: [{ id: 'p3', customer_id: null, stato_visita: 'non_visitato', chiusa: true }],
      error: null,
    });

    await expect(readNewPointEvidence([point('p3')])).resolves.toEqual(new Set());
  });

  it('linked row is excluded even if non_visitato', async () => {
    inMock.mockResolvedValue({
      data: [{ id: 'p4', customer_id: 'linked-customer', stato_visita: 'non_visitato', chiusa: false }],
      error: null,
    });

    await expect(readNewPointEvidence([point('p4')])).resolves.toEqual(new Set());
  });

  it('missing row stays unknown (read-unknown fail-closed)', async () => {
    inMock.mockResolvedValue({ data: [], error: null });

    await expect(readNewPointEvidence([point('missing')])).resolves.toEqual(new Set());
  });

  it('read error throws verification failure', async () => {
    inMock.mockResolvedValue({ data: null, error: { message: 'fixture read error' } });

    await expect(readNewPointEvidence([point('p5')])).rejects.toThrow('Classificazione dei nuovi punti non verificata');
  });

  it('200batch: chunks IDs by 200 and accumulates verified results across batches', async () => {
    const ids = Array.from({ length: 401 }, (_, i) => `p-${i + 1}`);
    const input = ids.map(point);

    inMock.mockImplementation(async (_field: string, batchIds: string[]) => ({
      data: batchIds.map((id, idx) => ({
        id,
        customer_id: null,
        stato_visita: idx % 2 === 0 ? 'non_visitato' : 'visitato',
        chiusa: false,
      })),
      error: null,
    }));

    const out = await readNewPointEvidence(input);
    expect(inMock).toHaveBeenCalledTimes(3);
    expect(inMock.mock.calls[0][1]).toHaveLength(200);
    expect(inMock.mock.calls[1][1]).toHaveLength(200);
    expect(inMock.mock.calls[2][1]).toHaveLength(1);
    expect(out.size).toBe(201);
  });
});
