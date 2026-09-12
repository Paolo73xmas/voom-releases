import { beforeEach, describe, expect, it, vi } from 'vitest';

type InsertPayload = Record<string, any>;

let insertError: any = null;
let maybeSingleData: any = null;
let maybeSingleError: any = null;
let capturedInsert: InsertPayload | null = null;
let capturedFilters: Array<{ method: string; args: any[] }> = [];
let mockRows: any[] = [];

function resetMocks() {
  insertError = null;
  maybeSingleData = null;
  maybeSingleError = null;
  capturedInsert = null;
  capturedFilters = [];
  mockRows = [];
}

vi.mock('../lib/supabase', () => {
  const chain = {
    insert: vi.fn(async (payload: InsertPayload) => {
      capturedInsert = payload;
      return { error: insertError };
    }),
    select: vi.fn(() => chain),
    eq: vi.fn((...args: any[]) => {
      capturedFilters.push({ method: 'eq', args });
      return chain;
    }),
    is: vi.fn((...args: any[]) => {
      capturedFilters.push({ method: 'is', args });
      return chain;
    }),
    gte: vi.fn((...args: any[]) => {
      capturedFilters.push({ method: 'gte', args });
      return chain;
    }),
    lt: vi.fn((...args: any[]) => {
      capturedFilters.push({ method: 'lt', args });
      return chain;
    }),
    order: vi.fn(async () => ({ data: mockRows, error: null })),
    maybeSingle: vi.fn(async () => ({ data: maybeSingleData, error: maybeSingleError })),
  };

  return {
    supabase: {
      from: vi.fn(() => chain),
    },
  };
});

import { createAppointment, localAppointmentDate } from '../lib/api/appointments';
import { freeAppointmentCandidate } from '../lib/aitour/agenda-candidate';
import { fetchFollowUpsForDates } from '../lib/aitour/followups';

describe('appointments + AI Tour agenda (iter32)', () => {
  beforeEach(() => resetMocks());

  it('localAppointmentDate validates invalid date/time', () => {
    expect(() => localAppointmentDate('2026-02-31', '10:00')).toThrow();
    expect(() => localAppointmentDate('2026-09-12', '25:00')).toThrow();
    const ok = localAppointmentDate('2026-09-12', '09:30');
    expect(ok.getFullYear()).toBe(2026);
  });

  it('createAppointment free payload stores empty quick fields (not null)', async () => {
    await createAppointment({
      id: 'free-1',
      agentId: 'agent-1',
      customerId: null,
      title: 'TEST_FREE',
      date: '2026-09-12',
      time: '09:00',
      duration: 30,
      notes: '',
      address: '',
      city: '',
    });

    expect(capturedInsert?.customer_id).toBeNull();
    expect(capturedInsert?.quick_customer_name).toBe('TEST_FREE');
    expect(capturedInsert?.quick_customer_address).toBe('');
    expect(capturedInsert?.quick_customer_city).toBe('');
    expect(capturedInsert?.quick_customer_phone).toBe('');
  });

  it('createAppointment handles duplicate (23505) by reading existing id', async () => {
    insertError = { code: '23505', message: 'duplicate key' };
    maybeSingleData = { id: 'dup-1' };

    const id = await createAppointment({
      id: 'dup-1',
      agentId: 'agent-1',
      customerId: null,
      title: 'TEST_DUP',
      date: '2026-09-12',
      time: '09:00',
      duration: 30,
      notes: '',
      address: '',
      city: '',
    });

    expect(id).toBe('dup-1');
  });

  it('freeAppointmentCandidate keeps entity free and strict slot', () => {
    const candidate = freeAppointmentCandidate(
      {
        id: 'a1',
        title: 'PROMEMORIA',
        address: '',
        city: 'Milano',
        time: '10:15',
        duration: 30,
        notes: null,
        appointmentAt: '2026-09-12T08:15:00.000Z',
      },
      { lat: 45.4, lng: 9.1, label: 'Via Roma 1, Milano' }
    );

    expect(candidate.entityType).toBe('free');
    expect(candidate.customerId).toBeNull();
    expect(candidate.preferredSlots?.[0]?.strict).toBe(true);
  });

  it('fetchFollowUpsForDates applies scheduled + not completed filters', async () => {
    mockRows = [];
    await fetchFollowUpsForDates('agent-1', ['2026-09-12']);

    expect(capturedFilters.some((f) => f.method === 'eq' && f.args[0] === 'status' && f.args[1] === 'scheduled')).toBe(true);
    expect(capturedFilters.some((f) => f.method === 'is' && f.args[0] === 'completed_at' && f.args[1] === null)).toBe(true);
  });
});
