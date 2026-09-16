import { describe, expect, it } from 'vitest';
import { getShippingBaseCost, isPaymentAllowed, isShippingAllowed } from '../lib/order-checkout';
import type { PaymentMethod, ShippingMethod } from '../lib/api/order-collection';

describe('order-checkout helpers: Italia/Estero filters', () => {
  // payment_methods rules
  it('Italia: allows all active payment methods', () => {
    const methods: PaymentMethod[] = [
      { id: 'pm-cash', name: 'Contanti', is_active: true },
      { id: 'pm-courier', name: 'Contanti al Corriere', is_active: true },
      { id: 'pm-check', name: 'Assegno', is_active: true },
      { id: 'pm-inactive', name: 'Bonifico', is_active: false },
    ];

    expect(isPaymentAllowed(methods[0], false)).toBe(true);
    expect(isPaymentAllowed(methods[1], false)).toBe(true);
    expect(isPaymentAllowed(methods[2], false)).toBe(true);
    expect(isPaymentAllowed(methods[3], false)).toBe(false);
  });

  it('Estero: allows only exact Contanti (case/trim normalized), excludes others/inactive', () => {
    const contantiVariants: PaymentMethod[] = [
      { id: 'pm-cash-1', name: 'Contanti', is_active: true },
      { id: 'pm-cash-2', name: '  CONTANTI  ', is_active: true },
      { id: 'pm-cash-3', name: 'CoNtAnTi', is_active: true },
    ];
    const blocked: PaymentMethod[] = [
      { id: 'pm-courier', name: 'Contanti al Corriere', is_active: true },
      { id: 'pm-check', name: 'Assegno', is_active: true },
      { id: 'pm-inactive', name: 'Contanti', is_active: false },
    ];

    for (const pm of contantiVariants) expect(isPaymentAllowed(pm, true)).toBe(true);
    for (const pm of blocked) expect(isPaymentAllowed(pm, true)).toBe(false);
  });

  // shipping_methods rules
  it('Estero: allows Cassiopea 3% and the foreign_only Ritiro in sede', () => {
    const methods: ShippingMethod[] = [
      { id: 'sm-cass', name: 'Cassiopea 3%', is_active: true, foreign_only: true, cost: 0 },
      { id: 'sm-cass-spaced', name: ' cassiopea   3 % ', is_active: true, foreign_only: true, cost: 0 },
      { id: 'sm-cass-no-foreign', name: 'Cassiopea 3%', is_active: true, foreign_only: false, cost: 0 },
      { id: 'sm-ritiro-foreign', name: 'RITIRO IN SEDE', is_active: true, foreign_only: true, cost: 0 },
      { id: 'sm-ritiro-italia', name: 'Ritiro in sede', is_active: true, foreign_only: false, cost: 0 },
      { id: 'sm-brt', name: 'BRT', is_active: true, foreign_only: false, cost: 0 },
      { id: 'sm-cass-inactive', name: 'Cassiopea 3%', is_active: false, foreign_only: true, cost: 0 },
    ];

    expect(isShippingAllowed(methods[0], true)).toBe(true);
    expect(isShippingAllowed(methods[1], true)).toBe(true);
    expect(isShippingAllowed(methods[2], true)).toBe(false);
    expect(isShippingAllowed(methods[3], true)).toBe(true);
    expect(isShippingAllowed(methods[4], true)).toBe(false);
    expect(isShippingAllowed(methods[5], true)).toBe(false);
    expect(isShippingAllowed(methods[6], true)).toBe(false);
  });

  it('Italia: allows national shipping + ritiro non foreign_only, no duplicate ritiro', () => {
    const methods: ShippingMethod[] = [
      { id: 'sm-brt', name: 'BRT', is_active: true, foreign_only: false, cost: 0 },
      { id: 'sm-ritiro-italia', name: 'Ritiro in sede', is_active: true, foreign_only: false, cost: 0 },
      { id: 'sm-ritiro-foreign', name: 'RITIRO IN SEDE', is_active: true, foreign_only: true, cost: 0 },
      { id: 'sm-cass', name: 'Cassiopea 3%', is_active: true, foreign_only: true, cost: 0 },
      { id: 'sm-inactive', name: 'GLS', is_active: false, foreign_only: false, cost: 0 },
    ];

    expect(isShippingAllowed(methods[0], false)).toBe(true);
    expect(isShippingAllowed(methods[1], false)).toBe(true);
    expect(isShippingAllowed(methods[2], false)).toBe(false);
    expect(isShippingAllowed(methods[3], false)).toBe(false);
    expect(isShippingAllowed(methods[4], false)).toBe(false);
  });
});

describe('order-checkout helpers: shipping percentage parity with web', () => {
  // pricing helper parity
  const cassiopeaConfig: ShippingMethod = {
    id: 'sm-cass',
    name: 'Cassiopea 3%',
    is_active: true,
    foreign_only: true,
    cost: 0,
    cost_type: 'percentage',
    cost_percentage: 3,
    min_cost: 10,
    threshold_min: 300,
    threshold_max: 2000,
  };

  it('keeps fixed method unchanged', () => {
    const fixed: ShippingMethod = {
      id: 'sm-fixed',
      name: 'BRT',
      is_active: true,
      foreign_only: false,
      cost: 7.5,
      cost_type: 'fixed',
      cost_percentage: null,
      min_cost: null,
      threshold_min: null,
      threshold_max: null,
    };
    expect(getShippingBaseCost(fixed, 1000)).toBe(7.5);
  });

  it('matches configured Cassiopea 3% threshold behavior', () => {
    expect(getShippingBaseCost(cassiopeaConfig, 0)).toBe(10);
    expect(getShippingBaseCost(cassiopeaConfig, 300)).toBe(10);
    expect(getShippingBaseCost(cassiopeaConfig, 301)).toBe(9.03);
    expect(getShippingBaseCost(cassiopeaConfig, 1000)).toBe(30);
    expect(getShippingBaseCost(cassiopeaConfig, 2000)).toBe(60);
    expect(getShippingBaseCost(cassiopeaConfig, 3000)).toBe(60);
  });

  it('uses unlimited top threshold when threshold_max is 0', () => {
    const unlimited: ShippingMethod = { ...cassiopeaConfig, threshold_max: 0 };
    expect(getShippingBaseCost(unlimited, 3000)).toBe(90);
  });

  it('returns 0 when method is undefined', () => {
    expect(getShippingBaseCost(undefined, 1000)).toBe(0);
  });
});