import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../lib/supabase';
import { fetchIsFirstOrder } from '../lib/api/first-order';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

type HeadResult = { count: number | null; error: unknown };

function mockOrdersHead(result: HeadResult, extra?: { throwFrom?: boolean }) {
  const eq = vi.fn();
  const abortSignal = vi.fn();
  const inSpy = vi.fn();
  const orSpy = vi.fn();

  const chain: any = {
    select: vi.fn(() => chain),
    eq,
    abortSignal,
    in: inSpy,
    or: orSpy,
  };

  eq.mockImplementation(() => chain);
  abortSignal.mockImplementation(async () => result);

  if (extra?.throwFrom) {
    vi.mocked(supabase.from).mockImplementation(() => {
      throw new Error('from failed');
    });
  } else {
    vi.mocked(supabase.from).mockReturnValue(chain);
  }

  return { chain, eq, abortSignal, inSpy, orSpy };
}

describe('fetchIsFirstOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when count is exactly 0', async () => {
    mockOrdersHead({ count: 0, error: null });
    const signal = new AbortController().signal;
    await expect(fetchIsFirstOrder('customer-0', signal)).resolves.toBe(true);
  });

  it('returns false when count is greater than 0', async () => {
    mockOrdersHead({ count: 3, error: null });
    const signal = new AbortController().signal;
    await expect(fetchIsFirstOrder('customer-1', signal)).resolves.toBe(false);
  });

  it('fails closed when supabase reports error', async () => {
    mockOrdersHead({ count: 0, error: { message: 'forbidden' } });
    const signal = new AbortController().signal;
    await expect(fetchIsFirstOrder('customer-err', signal)).rejects.toThrow('Impossibile verificare');
  });

  it('fails closed when count is null', async () => {
    mockOrdersHead({ count: null, error: null });
    const signal = new AbortController().signal;
    await expect(fetchIsFirstOrder('customer-null', signal)).rejects.toThrow('Impossibile verificare');
  });

  it.each([Number.NaN, -1, 1.5, Infinity])('fails closed when count is invalid (%s)', async (count) => {
    mockOrdersHead({ count, error: null });
    const signal = new AbortController().signal;
    await expect(fetchIsFirstOrder('customer-bad', signal)).rejects.toThrow('Impossibile verificare');
  });

  it('propagates thrown errors', async () => {
    mockOrdersHead({ count: 0, error: null }, { throwFrom: true });
    const signal = new AbortController().signal;
    await expect(fetchIsFirstOrder('customer-throw', signal)).rejects.toThrow('from failed');
  });

  it('queries only by customer_id and forwards abort signal', async () => {
    const { chain, eq, abortSignal, inSpy, orSpy } = mockOrdersHead({ count: 2, error: null });
    const controller = new AbortController();

    await fetchIsFirstOrder('customer-xyz', controller.signal);

    expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('orders');
    expect(chain.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(eq).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith('customer_id', 'customer-xyz');
    expect(abortSignal).toHaveBeenCalledTimes(1);
    expect(abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(inSpy).not.toHaveBeenCalled();
    expect(orSpy).not.toHaveBeenCalled();
  });
});
