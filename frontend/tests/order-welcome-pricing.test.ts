import { describe, expect, it } from 'vitest';
import { orderBreakdown } from '../lib/order-totals';
import { distributeDiscountToItems, welcomeDiscountItems } from '../lib/order-discounts';

type FixtureProduct = {
  id: string;
  rottamazione_no?: boolean;
  accisa: number;
  iva_percentage: number;
  short_description: string;
};

const eligibleProduct: FixtureProduct = {
  id: 'p-eligible',
  rottamazione_no: false,
  accisa: 2,
  iva_percentage: 22,
  short_description: 'STD-ELIGIBLE',
};

const excludedProduct: FixtureProduct = {
  id: 'p-excluded',
  rottamazione_no: true,
  accisa: 1,
  iva_percentage: 22,
  short_description: 'STD-EXCLUDED',
};

const ivaZeroProduct: FixtureProduct = {
  id: 'p-iva0',
  rottamazione_no: false,
  accisa: 0,
  iva_percentage: 0,
  short_description: 'IVA0',
};

describe('welcome discount pricing parity', () => {
  it('applies 25% only on eligible net, leaves excluded line unchanged, discount_percent stays 0', () => {
    const cart = [
      { product: eligibleProduct, quantity: 1, unit_price: 100 },
      { product: excludedProduct, quantity: 1, unit_price: 50 },
    ];
    const frozenSource = JSON.parse(JSON.stringify(cart));

    const discounted = welcomeDiscountItems(cart);
    const eligibleLine = discounted.find((d) => d.product_id === eligibleProduct.id);
    const excludedLine = discounted.find((d) => d.product_id === excludedProduct.id);

    expect(eligibleLine?.unit_price).toBe(75);
    expect(excludedLine?.unit_price).toBe(50);
    expect(discounted.every((d) => d.discount_percent === 0)).toBe(true);
    expect(cart).toEqual(frozenSource);
  });

  it('keeps fiscal consistency in known fixture totals before/after welcome discount', () => {
    const cart = [
      { product: eligibleProduct, quantity: 1, unit_price: 100 },
      { product: excludedProduct, quantity: 1, unit_price: 50 },
    ];

    const before = orderBreakdown({
      is_foreign: false,
      shipping_cost: 10,
      order_items: cart.map((c) => ({
        product: c.product,
        quantity: c.quantity,
        unit_price: c.unit_price,
        discount_percent: 0,
      })),
    });

    const discountedItems = welcomeDiscountItems(cart);
    const discountedWithProduct = discountedItems.map((item) => ({
      ...item,
      product: cart.find((c) => c.product.id === item.product_id)?.product,
    }));

    const after = orderBreakdown({
      is_foreign: false,
      shipping_cost: 10,
      order_items: discountedWithProduct,
    });

    expect(before.gross).toBe(198.86);
    expect(after.gross).toBe(168.36);
    expect(after.net).toBe(125);
    expect(after.excise).toBe(3);
    expect(after.vat).toBe(28.16);
    expect(after.shipping).toBe(12.2);
  });

  it('preserves VAT0 products and recomputes domestic VAT22 lower after discount', () => {
    const cart = [
      { product: eligibleProduct, quantity: 1, unit_price: 100 },
      { product: ivaZeroProduct, quantity: 1, unit_price: 40 },
    ];

    const discountedItems = welcomeDiscountItems(cart);
    const discountedWithProduct = discountedItems.map((item) => ({
      ...item,
      product: cart.find((c) => c.product.id === item.product_id)?.product,
    }));

    const before = orderBreakdown({
      is_foreign: false,
      shipping_cost: 10,
      order_items: cart.map((c) => ({ ...c, discount_percent: 0 })),
    });
    const after = orderBreakdown({
      is_foreign: false,
      shipping_cost: 10,
      order_items: discountedWithProduct,
    });

    expect(before.gross).toBe(176.64);
    expect(after.gross).toBe(136.14);
    expect(after.vat).toBe(16.94);
    expect(after.shipping).toBe(12.2);
    expect(after.net).toBeCloseTo(105, 2);
  });

  it('distributeDiscountToItems keeps source immutable and rounds deterministically', () => {
    const source = [
      { product_id: 'a', quantity: 1, unit_price: 1 },
      { product_id: 'b', quantity: 1, unit_price: 1 },
      { product_id: 'c', quantity: 1, unit_price: 1 },
    ];
    const snapshot = JSON.parse(JSON.stringify(source));

    const out = distributeDiscountToItems(source, 1);
    const discountedTotal = out.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

    expect(source).toEqual(snapshot);
    expect(discountedTotal).toBeCloseTo(2, 2);
    expect(out.every((i) => i.original_unit_price === 1)).toBe(true);
  });

  it('does not change excluded-only or zero-price carts', () => {
    const cart = [{ product: excludedProduct, quantity: 2, unit_price: 50 }];
    expect(welcomeDiscountItems(cart)).toEqual([{ product_id: excludedProduct.id, quantity: 2, unit_price: 50, discount_percent: 0 }]);
    expect(welcomeDiscountItems([{ product: eligibleProduct, quantity: 1, unit_price: 0 }])[0].unit_price).toBe(0);
  });

  it('preserves the existing cashback and rottamazione distribution algorithm', () => {
    const items = [{ product_id: 'a', quantity: 2, unit_price: 100 }, { product_id: 'b', quantity: 1, unit_price: 50 }];
    expect(distributeDiscountToItems(items, 50).map(i => i.unit_price)).toEqual([80, 40]);
    expect(distributeDiscountToItems(items, 81.97).map(i => i.unit_price)).toEqual([67.21, 33.61]);
  });
});
