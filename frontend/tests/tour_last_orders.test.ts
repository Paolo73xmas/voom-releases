// Parità con web tests/aitour/tour_last_orders.unit.ts @ 2eea9933 (23 asserzioni).
// Fonte unica degli ultimi acquisti: loadLatestPurchases (tabella ordini, paginata, senza fallback
// da scheda cliente o snapshot del tour) + guardia del download PDF sull'ordine riletto via RLS.
import assert from 'node:assert/strict';
import { describe, expect, it, vi } from 'vitest';
import { loadLatestPurchases, refreshPurchaseHistory, type PurchaseRow } from '../lib/aitour/gptour-purchases';
import { assertTourOrderDownload } from '../lib/aitour/order-download';
import type { TourCandidate } from '../lib/aitour/types';

vi.mock('../lib/supabase', () => ({ supabase: {} }));
vi.mock('../lib/api/orders', () => ({ fetchOrderById: vi.fn(), getOrderStatusLabel: (s: string) => s }));
vi.mock('../lib/pdf/order-pdf', () => ({ downloadOrderPdf: vi.fn() }));

const cand = (over: Partial<TourCandidate> = {}): TourCandidate => ({
  key: over.key || 'k1',
  name: over.name || 'Cliente Test',
  entityType: over.entityType || 'client',
  customerId: over.customerId ?? 'c1',
  tabaccheriaId: over.tabaccheriaId ?? null,
  lat: over.lat ?? 45.46,
  lng: over.lng ?? 9.19,
  visitMinutes: over.visitMinutes ?? 20,
  score: over.score ?? 70,
  priorityClass: over.priorityClass || 'Media',
  reason: over.reason || 'test',
  daysSinceOrder: over.daysSinceOrder ?? 999,
  ...over,
} as TourCandidate);

describe('AI Tour ultimi acquisti delle tappe (parità web tour_last_orders)', () => {
  it('23 asserzioni identiche al web', async () => {
    let checks = 0;
    const ok = (value: unknown, label: string) => { assert.ok(value, label); checks++; };

    // --- loadLatestPurchases: dedupe, ordinamento, riga più recente con id deterministico ---
    const rows: PurchaseRow[] = [
      { id: 'b2', customer_id: 'c2', order_date: '2026-10-01', order_number: '200' },
      { id: 'a2', customer_id: 'c2', order_date: '2026-10-01', order_number: '201' },
      { id: 'z1', customer_id: 'c1', order_date: '2026-09-01', order_number: '100' },
      { id: 'a1', customer_id: 'c1', order_date: '2026-09-02', order_number: '101' },
    ];
    const calls: Array<{ ids: string[]; offset: number }> = [];
    const out = await loadLatestPurchases(['c2', 'c1', 'c2', ''], async (ids, offset) => {
      calls.push({ ids: [...ids], offset });
      return offset === 0 ? rows : [];
    });
    ok(calls.length === 1, 'dedupe customer ids: single page call');
    ok(calls[0].ids.join(',') === 'c1,c2', 'ids sorted asc and deduplicated');
    ok(out.get('c1')?.id === 'a1' && out.get('c1')?.order_number === '101', 'latest row keeps id+number+date together for c1');
    ok(out.get('c2')?.id === 'a2', 'tie on same date resolved by deterministic ascending id');

    // --- batch da 100 clienti e paginazione oltre 1.000 righe ---
    const ids = Array.from({ length: 1200 }, (_, i) => `c${String(i + 1).padStart(4, '0')}`);
    const offsets: number[] = [];
    const big = await loadLatestPurchases(ids, async (batch, offset) => {
      offsets.push(offset);
      if (offset === 0 || offset === 500) {
        return Array.from({ length: 500 }, (_, n) => {
          const id = batch[n % batch.length];
          return { id: `o-${offset}-${n}-${id}`, customer_id: id, order_date: '2026-10-02', order_number: `N-${id}` };
        });
      }
      if (offset === 1000) {
        const id = batch[0];
        return [{ id: `o-${offset}-${id}`, customer_id: id, order_date: '2026-10-01', order_number: `N-${id}` }];
      }
      return [];
    });
    ok(offsets.filter((v) => v === 0).length === 12, 'batch-100 loop executed across >1000 customers');
    ok(offsets.filter((v) => v === 500).length === 12 && offsets.filter((v) => v === 1000).length === 12, 'page-500/page-1000 pagination checked for each batch');
    ok(big.size === 1200, 'all >1000 customers resolved');

    // --- errori e annullamento: mai "nessun ordine" al posto di un errore ---
    await assert.rejects(loadLatestPurchases(['c1'], async () => [{ id: 'x', customer_id: 'c1', order_date: null }]), /data mancante|non valida/i); checks++;
    await assert.rejects(loadLatestPurchases(['c1'], async () => [{ id: 'x', customer_id: 'c1', order_date: 'not-a-date' }]), /data mancante|non valida/i); checks++;
    await assert.rejects(loadLatestPurchases(['c1'], async () => { throw new Error('network down'); }), /network down/); checks++;
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(loadLatestPurchases(['c1'], async () => [], ac.signal)); checks++;
    ok((await loadLatestPurchases([], async () => { throw new Error('must not call'); })).size === 0, 'no-customer returns empty map');

    // --- refreshPurchaseHistory: la data del candidato non sopravvive senza riga nello storico ---
    const pool = [
      cand({ key: 'k-no-customer', customerId: null, lastOrderDate: '2026-01-01' as unknown as null }),
      cand({ key: 'k-no-row', customerId: 'c-no-row', lastOrderDate: '2025-12-31' as unknown as null }),
      cand({ key: 'k-ok', customerId: 'c-ok' }),
    ];
    const refreshed = await refreshPurchaseHistory(pool, async () => [
      { id: 'ok-1', customer_id: 'c-ok', order_date: '2026-10-03', order_number: '900' },
    ]);
    ok(refreshed.find((c) => c.key === 'k-no-customer')?.lastOrderDate === null, 'no customer keeps order empty');
    ok(refreshed.find((c) => c.key === 'k-no-row')?.lastOrderDate === null, 'missing history does not keep stale candidate.lastOrderDate');
    ok(refreshed.find((c) => c.key === 'k-ok')?.lastOrderDate === '2026-10-03', 'fresh order date applied from live history');

    // --- assertTourOrderDownload: PDF solo dall'ordine riletto che coincide con la riga della tappa ---
    const expected: PurchaseRow = { id: 'o1', customer_id: 'c1', order_date: '2026-10-04', order_number: '1001' };
    assertTourOrderDownload({ id: 'o1', customer_id: 'c1', order_date: '2026-10-04', status: null }, expected); checks++;
    assertTourOrderDownload({ id: 'o1', customer_id: 'c1', order_date: '2026-10-04', status: 'draft' }, expected); checks++;
    assert.throws(() => assertTourOrderDownload({ id: 'o2', customer_id: 'c1', order_date: '2026-10-04', status: 'draft' }, expected), /non più disponibile/i); checks++;
    assert.throws(() => assertTourOrderDownload({ id: 'o1', customer_id: 'c2', order_date: '2026-10-04', status: 'draft' }, expected), /non più disponibile/i); checks++;
    assert.throws(() => assertTourOrderDownload({ id: 'o1', customer_id: 'c1', order_date: '2026-10-04', status: 'cancelled' }, expected), /non più disponibile/i); checks++;
    assert.throws(() => assertTourOrderDownload({ id: 'o1', customer_id: 'c1', order_date: '2026-10-04', status: 'draft', is_deleted: true }, expected), /non più disponibile/i); checks++;
    assert.throws(() => assertTourOrderDownload({ id: 'o1', customer_id: 'c1', order_date: null, status: 'draft' }, expected), /data dell’ordine non è valida|data dell'ordine non è valida/i); checks++;
    assert.throws(() => assertTourOrderDownload({ id: 'o1', customer_id: 'c1', order_date: 'bad-date', status: 'draft' }, expected), /data dell’ordine non è valida|data dell'ordine non è valida/i); checks++;

    expect(checks).toBe(23);
  });
});
