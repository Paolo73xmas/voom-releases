import { describe, expect, it } from 'vitest';
import { salesTotals } from '../lib/sales-totals';
import { substitutionLineValue, substitutionTotal } from '../lib/substitution-totals';
import type { SubstitutionItem } from '../lib/api/substitutions';

const item = (extra: Partial<SubstitutionItem> = {}): SubstitutionItem => ({
  id: 'line', substitution_id: 'sub', original_product_id: 'a', replacement_product_id: 'b',
  quantity: 2, original_quantity: 2, replacement_quantity: 2, notes: null,
  original_product: { id: 'a', name: 'A', sku: null, unit_price: 12.8 },
  replacement_product: { id: 'b', name: 'B', sku: null, unit_price: 12 }, ...extra,
});

describe('audit: importi sostituzioni senza aprire il wizard', () => {
  it('usa i due prezzi della richiesta, senza catalogo nello stato', () => {
    expect(substitutionTotal([item()], 'original')).toBe(25.6);
    expect(substitutionTotal([item()], 'replacement')).toBe(24);
  });
  it('mantiene prezzo zero e quantità zero validi', () => {
    expect(substitutionLineValue(item({ original_quantity: 0 }), 'original').total).toBe(0);
    expect(substitutionTotal([item({ original_product: { id: 'a', name: 'A', sku: null, unit_price: 0 } })], 'original')).toBe(0);
  });
  it('non inventa un prezzo zero quando il prodotto non è leggibile', () => {
    expect(substitutionTotal([item({ original_product: undefined })], 'original')).toBeNull();
    expect(substitutionTotal([item({ original_product_id: null })], 'original')).toBe(0);
  });
  it('supporta quantità legacy e lati distinti', () => {
    expect(substitutionLineValue(item({ original_quantity: null, replacement_quantity: 3 }), 'original').quantity).toBe(2);
    expect(substitutionTotal([item({ replacement_quantity: 3 })], 'replacement')).toBe(36);
  });
});

describe('audit: venduto merce con regole del dettaglio ordine', () => {
  const line = { quantity: 1, unit_price: 100, line_total: 100, product: { accisa: 10, iva_percentage: 22, short_description: 'ITA' } };
  it('applica IVA anche sull’accisa, senza spedizioni', () => {
    expect(salesTotals([{ status: 'confirmed', is_foreign: false, order_items: [line] }])).toEqual({ netto: 100, accisa: 10, iva: 24.2, lordo: 134.2, orderCount: 1 });
  });
  it('non converte IVA0 in IVA22', () => {
    expect(salesTotals([{ status: 'confirmed', is_foreign: false, order_items: [{ ...line, product: { ...line.product, iva_percentage: 0 } }] }]).iva).toBe(0);
  });
  it('rispetta estero e prefisso EST-', () => {
    expect(salesTotals([{ status: 'confirmed', is_foreign: true, order_items: [line] }]).iva).toBe(0);
    expect(salesTotals([{ status: 'confirmed', is_foreign: false, order_items: [{ ...line, product: { ...line.product, short_description: ' EST-TEST' } }] }])).toEqual({ netto: 100, accisa: 0, iva: 0, lordo: 100, orderCount: 1 });
  });
  it('esclude annullati senza alterare le righe originali', () => {
    const orders = [{ status: 'cancelled', is_foreign: false, order_items: [line] }];
    const before = JSON.stringify(orders);
    expect(salesTotals(orders).orderCount).toBe(0);
    expect(salesTotals(orders).lordo).toBe(0);
    expect(JSON.stringify(orders)).toBe(before);
  });
  it('rispetta il netto salvato senza riapplicare lo sconto', () => {
    expect(salesTotals([{ status: 'delivered', is_foreign: false, order_items: [{ ...line, line_total: 50, discount_percent: 50 }] }]).netto).toBe(50);
  });
});