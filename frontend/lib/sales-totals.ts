import { orderBreakdown, type FiscalItem } from './order-totals';

export type SalesOrder = { status: string; is_foreign: boolean; order_items?: FiscalItem[] };
export const emptySalesTotals = () => ({ netto: 0, accisa: 0, iva: 0, lordo: 0, orderCount: 0 });

/** Venduto merce personale: stesse regole del dettaglio, spedizioni escluse. Nessuna scrittura. */
export function salesTotals(orders: SalesOrder[]) {
  const result = emptySalesTotals();
  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    const totals = orderBreakdown({ ...order, shipping_cost: 0 });
    result.netto += totals.net;
    result.accisa += totals.excise;
    result.iva += totals.vat;
    result.lordo += totals.gross;
    result.orderCount += 1;
  }
  for (const key of ['netto', 'accisa', 'iva', 'lordo'] as const) {
    result[key] = Math.round((result[key] + Number.EPSILON) * 100) / 100;
  }
  return result;
}