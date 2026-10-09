// Porting del modulo web gptour-purchases.ts @ 2eea9933. Differenze mobile: Hermes non espone
// AbortSignal.timeout/any/throwIfAborted (polyfill abort-controller), quindi timeout e segnale
// esterno sono composti manualmente. Stessa query, stessa paginazione, nessun fallback.
import { supabase } from '../supabase';
import { daysSince, type TourCandidate } from './types';

export interface PurchaseRow { id: string; customer_id: string; order_date: string | null; order_number?: string | null }
export type PurchasePageLoader = (ids: string[], offset: number, signal?: AbortSignal) => Promise<PurchaseRow[]>;
const PAGE_SIZE = 500;
const TIMEOUT_MS = 30000;

function linkedTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; release: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', onAbort);
  return { signal: controller.signal, release: () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); } };
}
function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Verifica degli ultimi acquisti annullata.');
}

const loadPage: PurchasePageLoader = async (ids, offset, signal) => {
  const link = linkedTimeout(signal, TIMEOUT_MS);
  try {
    const { data, error } = await supabase.from('orders')
      .select('id, customer_id, order_date, order_number')
      .in('customer_id', ids).eq('is_deleted', false)
      .or('status.is.null,status.neq.cancelled')
      .order('order_date', { ascending: false, nullsFirst: false }).order('id')
      .range(offset, offset + PAGE_SIZE - 1).abortSignal(link.signal);
    if (error || !Array.isArray(data)) throw new Error('Non riesco a verificare gli ultimi acquisti. Riprova: non considero un errore come assenza di ordini.');
    return data as PurchaseRow[];
  } finally { link.release(); }
};

/** Shared by purchase filtering and tour display: same rows, no snapshot/customer-date fallback. */
export async function loadLatestPurchases(customerIds: string[], loader: PurchasePageLoader = loadPage, signal?: AbortSignal): Promise<Map<string, PurchaseRow>> {
  const ids = [...new Set(customerIds.filter(Boolean))].sort();
  const latest = new Map<string, PurchaseRow>();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      assertNotAborted(signal);
      const rows = await loader(batch, offset, signal);
      for (const row of rows) {
        if (!row.order_date || !Number.isFinite(Date.parse(row.order_date))) {
          throw new Error('Uno storico acquisti contiene una data mancante o non valida. Non posso verificare il periodo senza ordini.');
        }
        const previous = latest.get(row.customer_id);
        const date = Date.parse(row.order_date);
        const previousDate = previous ? Date.parse(previous.order_date!) : -Infinity;
        if (!previous || date > previousDate || (date === previousDate && row.id < previous.id)) latest.set(row.customer_id, row);
      }
      if (rows.length < PAGE_SIZE) break;
    }
  }
  return latest;
}

/** Read-only, paginated and RLS-scoped. Dates are rechecked on every purchase request. */
export async function refreshPurchaseHistory(pool: TourCandidate[], loader: PurchasePageLoader = loadPage): Promise<TourCandidate[]> {
  const latest = await loadLatestPurchases(pool.flatMap(c => c.customerId ? [c.customerId] : []), loader);
  return pool.map(c => {
    const date = c.customerId ? latest.get(c.customerId)?.order_date || null : null;
    // La tabella ordini è la fonte unica: lo stato "storico non verificato" delle statistiche RPC decade.
    return { ...c, lastOrderDate: date, daysSinceOrder: daysSince(date), ...(c.gptourData ? { gptourData: { ...c.gptourData, orderKnown: true } } : {}) };
  });
}
