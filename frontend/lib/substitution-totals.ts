import type { SubstitutionItem } from './api/substitutions';

type Side = 'original' | 'replacement';

/** I prezzi sono quelli di listino letti con la richiesta, non quelli del wizard. */
export function substitutionLineValue(item: SubstitutionItem, side: Side) {
  const raw = item[`${side}_product`]?.unit_price;
  const price = raw == null || !Number.isFinite(Number(raw)) ? null : Number(raw);
  const quantity = Number(item[`${side}_quantity`] ?? item.quantity ?? 0);
  return { price, quantity, total: price == null ? null : price * quantity };
}

export function substitutionTotal(items: SubstitutionItem[], side: Side): number | null {
  let total = 0;
  for (const item of items.filter(row => row[`${side}_product_id`])) {
    const line = substitutionLineValue(item, side);
    if (line.total == null) return null; // Non spacciare un prodotto non leggibile per gratuito.
    total += line.total;
  }
  return Math.round((total + Number.EPSILON) * 100) / 100;
}