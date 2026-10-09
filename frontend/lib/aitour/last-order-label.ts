// Testi dello stato "ultimo acquisto" di una tappa (web LastOrderInfo @ 2eea993), condivisi tra
// componente RN e popup della mappa. Unica fonte: le righe di loadLatestPurchases (tabella ordini),
// mai la data della scheda cliente o uno snapshot del tour.
import { daysSince } from './types';
import type { PurchaseRow } from './gptour-purchases';

export type LastOrderState = 'nocustomer' | 'loading' | 'error' | 'none' | 'ready';
export interface LastOrdersSource { data: Map<string, PurchaseRow> | null; loading: boolean; error: string | null }
export interface LastOrderView { state: LastOrderState; text: string; number: string | null; row: PurchaseRow | null }
/** Voce del popup mappa: stato + testo + numero ordine (cliccabile) + download in corso. */
export interface LastOrderPopup { state: LastOrderState; text: string; number: string | null; busy?: boolean }

export const formatOrderDate = (iso: string): string => new Date(iso).toLocaleDateString('it-IT');

export function describeLastOrder(customerId: string | null | undefined, orders: LastOrdersSource): LastOrderView {
  const view = (state: LastOrderState, text: string, row: PurchaseRow | null = null): LastOrderView => ({ state, text, number: row?.order_number || null, row });
  if (!customerId) return view('nocustomer', 'Ultimo ordine: nessun ordine collegato (senza scheda cliente)');
  if (orders.loading || (!orders.data && !orders.error)) return view('loading', 'Verifica ultimo ordine…');
  if (orders.error) return view('error', 'Ultimo ordine non verificabile.');
  const row = orders.data?.get(customerId);
  if (!row) return view('none', 'Ultimo ordine: nessun ordine visibile');
  const days = daysSince(row.order_date);
  const ago = days == null ? '' : days < 0 ? ' (data futura)' : ` (${days} ${days === 1 ? 'giorno fa' : 'giorni fa'})`;
  return view('ready', `Ultimo ordine: ${formatOrderDate(row.order_date!)}${ago}`, row);
}

export function lastOrdersByKey(items: readonly { key: string; customerId: string | null | undefined }[], orders: LastOrdersSource, busyOrderId: string | null = null): Record<string, LastOrderPopup> {
  const out: Record<string, LastOrderPopup> = {};
  for (const item of items) {
    const v = describeLastOrder(item.customerId, orders);
    out[item.key] = { state: v.state, text: v.text, number: v.number, busy: !!v.row && v.row.id === busyOrderId };
  }
  return out;
}
