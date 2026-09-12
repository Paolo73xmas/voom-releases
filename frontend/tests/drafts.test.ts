import { beforeEach, describe, expect, it, vi } from 'vitest';

type StoreMap = Record<string, string>;

const memoryStore: StoreMap = {};
let failSetItem = false;
let delays: { get: number; set: number } = { get: 0, set: 0 };

vi.mock('@react-native-async-storage/async-storage', () => {
  return {
    default: {
      getItem: vi.fn(async (key: string) => {
        if (delays.get) await new Promise(r => setTimeout(r, delays.get));
        return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
      }),
      setItem: vi.fn(async (key: string, value: string) => {
        if (delays.set) await new Promise(r => setTimeout(r, delays.set));
        if (failSetItem) throw new Error('setItem failed');
        memoryStore[key] = value;
      }),
    },
  };
});

import { deleteDraft, getDrafts, saveDraft, type OrderDraft } from '../lib/drafts';

const buildDraft = (id: string, overrides: Partial<OrderDraft> = {}): OrderDraft => ({
  id,
  customerId: `customer-${id}`,
  customerName: `TEST_Customer_${id}`,
  cart: [{ product: { id: `p-${id}` }, quantity: 1, unit_price: 12.5 }],
  currentStep: 1,
  isForeignOrder: false,
  selectedPaymentId: 'pm-1',
  selectedShippingId: 'sm-1',
  customShippingAddress: '',
  notes: '',
  rottamazioneAmount: 0,
  rottamazioneDescription: '',
  cashBackToUse: 0,
  scontoBenvenuto: false,
  orderChannel: 'visita',
  totalAmount: 12.5,
  productCount: 1,
  savedAt: new Date(0).toISOString(),
  ...overrides,
});

describe('drafts manager', () => {
  beforeEach(() => {
    for (const key of Object.keys(memoryStore)) delete memoryStore[key];
    failSetItem = false;
    delays = { get: 0, set: 0 };
  });

  it('serializes parallel writes to avoid lost drafts in queue', async () => {
    delays.get = 25;
    delays.set = 25;

    const a = buildDraft('A', { customerName: 'TEST_A' });
    const b = buildDraft('B', { customerName: 'TEST_B' });

    await Promise.all([saveDraft(a), saveDraft(b)]);
    const all = await getDrafts();
    const ids = all.map(d => d.id);

    expect(ids).toContain('A');
    expect(ids).toContain('B');
    expect(all.length).toBe(2);
  });

  it('propagates delete failure when persistence write fails', async () => {
    await saveDraft(buildDraft('X'));
    failSetItem = true;

    await expect(deleteDraft('X')).rejects.toThrow('setItem failed');
  });

  it('persists scontoBenvenuto and orderChannel values', async () => {
    const draft = buildDraft('Y', {
      scontoBenvenuto: true,
      orderChannel: 'remoto',
      notes: 'TEST note persist',
    });

    await saveDraft(draft);
    const loaded = await getDrafts();
    const restored = loaded.find(d => d.id === 'Y');

    expect(restored?.scontoBenvenuto).toBe(true);
    expect(restored?.orderChannel).toBe('remoto');
    expect(restored?.notes).toBe('TEST note persist');
  });
});
