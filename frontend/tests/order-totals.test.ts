import { describe, expect, it } from 'vitest';
import { orderBreakdown, orderLineBreakdown } from '../lib/order-totals';

describe('orderLineBreakdown/orderBreakdown fiscal rules', () => {
  it('calculates domestic row with accisa + VAT on (net + accisa)', () => {
    const line = orderLineBreakdown({
      quantity: 2,
      unit_price: 10,
      product: { accisa: 1, iva_percentage: 22, short_description: 'STD-ITEM' },
    }, false);

    expect(line.net).toBe(20);
    expect(line.excise).toBe(2);
    expect(line.vatRate).toBe(22);
    expect(line.vat).toBeCloseTo(4.84, 2);
    expect(line.gross).toBeCloseTo(26.84, 2);
  });

  it('uses VAT 0 correctly when product iva_percentage is 0 (IVA0)', () => {
    const line = orderLineBreakdown({
      quantity: 3,
      unit_price: 9,
      product: { accisa: 0.4, iva_percentage: 0, short_description: 'IVA0' },
    }, false);

    expect(line.net).toBe(27);
    expect(line.excise).toBeCloseTo(1.2, 2);
    expect(line.vatRate).toBe(0);
    expect(line.vat).toBe(0);
    expect(line.gross).toBeCloseTo(28.2, 2);
  });

  it('forces VAT to zero for foreign orders', () => {
    const line = orderLineBreakdown({
      quantity: 1,
      unit_price: 100,
      product: { accisa: 2, iva_percentage: 22, short_description: 'REGULAR' },
    }, true);

    expect(line.vatRate).toBe(0);
    expect(line.vat).toBe(0);
    expect(line.excise).toBe(2);
    expect(line.gross).toBe(102);
  });

  it('forces accisa and VAT to zero for EST- products, even domestic', () => {
    const line = orderLineBreakdown({
      quantity: 5,
      unit_price: 4,
      product: { accisa: 10, iva_percentage: 22, short_description: 'EST-SPECIAL' },
    }, false);

    expect(line.exciseUnit).toBe(0);
    expect(line.excise).toBe(0);
    expect(line.vatRate).toBe(0);
    expect(line.vat).toBe(0);
    expect(line.gross).toBe(20);
  });

  it('uses line_total as NET and does not re-apply discount_percent (no double discount)', () => {
    const line = orderLineBreakdown({
      quantity: 10,
      unit_price: 5,
      discount_percent: 50,
      line_total: 40,
      product: { accisa: 0, iva_percentage: 22, short_description: 'STD' },
    }, false);

    expect(line.net).toBe(40);
    expect(line.vat).toBeCloseTo(8.8, 2);
    expect(line.gross).toBeCloseTo(48.8, 2);
  });

  it('applies shipping VAT only for domestic orders in full breakdown', () => {
    const domestic = orderBreakdown({
      is_foreign: false,
      shipping_cost: 10,
      order_items: [{ quantity: 1, unit_price: 100, product: { accisa: 0, iva_percentage: 22, short_description: 'STD' } }],
    });
    const foreign = orderBreakdown({
      is_foreign: true,
      shipping_cost: 10,
      order_items: [{ quantity: 1, unit_price: 100, product: { accisa: 0, iva_percentage: 22, short_description: 'STD' } }],
    });

    expect(domestic.shipping).toBe(12.2);
    expect(foreign.shipping).toBe(10);
  });
});
