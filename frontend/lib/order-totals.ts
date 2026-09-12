/** Display-only breakdown. Supabase line_total is the NET discounted merchandise amount. */
export type FiscalItem = {
  quantity: number; unit_price: number; discount_percent?: number | null; line_total?: number | null;
  product?: { accisa?: number | null; iva_percentage?: number | null; short_description?: string | null } | null;
};
const r2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function orderLineBreakdown(item: FiscalItem, isForeign: boolean) {
  const estPrefix = (item.product?.short_description ?? '').trim().toUpperCase().startsWith('EST-');
  const net = Number(item.line_total ?? (item.quantity * item.unit_price * (1 - (item.discount_percent ?? 0) / 100)));
  const exciseUnit = estPrefix ? 0 : Number(item.product?.accisa ?? 0);
  const excise = exciseUnit * Number(item.quantity);
  const vatRate = isForeign || estPrefix ? 0 : Number(item.product?.iva_percentage ?? 0);
  const vat = (net + excise) * vatRate / 100;
  return { net, exciseUnit, excise, vatRate, vat, gross: net + excise + vat };
}

export function orderBreakdown(order: { order_items?: FiscalItem[]; is_foreign: boolean; shipping_cost?: number | null }) {
  const lines = (order.order_items ?? []).map(item => orderLineBreakdown(item, order.is_foreign));
  const net = lines.reduce((sum, line) => sum + line.net, 0);
  const excise = lines.reduce((sum, line) => sum + line.excise, 0);
  const vat = lines.reduce((sum, line) => sum + line.vat, 0);
  const shipping = Number(order.shipping_cost ?? 0) * (order.is_foreign ? 1 : 1.22);
  return { net: r2(net), excise: r2(excise), vat: r2(vat), shipping: r2(shipping), gross: r2(net + excise + vat + shipping) };
}