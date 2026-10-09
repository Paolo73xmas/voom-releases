// Porting del modulo web order-download.ts @ 2eea9933: il PDF si genera SOLO dall'ordine riletto
// via client RLS, mai da snapshot del tour o dalla data della scheda cliente.
import { fetchOrderById } from '../api/orders';
import { downloadOrderPdf } from '../pdf/order-pdf';
import type { PurchaseRow } from './gptour-purchases';

export interface DownloadableOrder { id: string; customer_id: string; status: string | null; order_date: string | null; is_deleted?: boolean | null }

export function assertTourOrderDownload(order: DownloadableOrder, expected: PurchaseRow): void {
  if (order.id !== expected.id || order.customer_id !== expected.customer_id || order.status === 'cancelled' || order.is_deleted) {
    throw new Error('Ordine non più disponibile per questa tappa. Aggiorna lo storico.');
  }
  if (!order.order_date || !Number.isFinite(Date.parse(order.order_date))) {
    throw new Error('La data dell’ordine non è valida. Download non disponibile.');
  }
}

/** Fetch again through the ordinary RLS client; never embed privileged URLs or snapshots. */
export async function prepareTourOrderDownload(expected: PurchaseRow): Promise<() => Promise<void>> {
  const order = await fetchOrderById(expected.id);
  if (!order) throw new Error('Ordine non più disponibile per questa tappa. Aggiorna lo storico.');
  assertTourOrderDownload(order as unknown as DownloadableOrder, expected);
  return () => downloadOrderPdf(order);
}
