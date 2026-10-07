type DiscountItem = { product_id: string; quantity: number; unit_price: number };
type DiscountCartItem = { product: { id: string; rottamazione_no?: boolean | null }; quantity: number; unit_price: number };

/** Algoritmo esistente spostato dal wizard, senza cambiare arrotondamenti o ripartizione. */
export function distributeDiscountToItems(items: DiscountItem[], discountAmount: number): (DiscountItem & { original_unit_price: number })[] {
  const itemsTotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  if (itemsTotal <= 0 || discountAmount <= 0) return items.map(i => ({ ...i, original_unit_price: i.unit_price }));
  const rawDiscounts = items.map(item => {
    const lineValue = item.unit_price * item.quantity;
    const proportion = lineValue / itemsTotal;
    return Math.round(discountAmount * proportion * 100) / 100;
  });
  const totalDistributed = rawDiscounts.reduce((sum, d) => sum + d, 0);
  let roundingRemainder = Math.round((discountAmount - totalDistributed) * 100) / 100;
  if (roundingRemainder !== 0) {
    for (let i = items.length - 1; i >= 0 && Math.abs(roundingRemainder) > 0.001; i--) {
      const lineValue = items[i].unit_price * items[i].quantity;
      const maxAbsorbable = lineValue - rawDiscounts[i];
      if (roundingRemainder > 0 && maxAbsorbable > 0) {
        const toAdd = Math.min(roundingRemainder, maxAbsorbable);
        rawDiscounts[i] = Math.round((rawDiscounts[i] + toAdd) * 100) / 100;
        roundingRemainder = Math.round((roundingRemainder - toAdd) * 100) / 100;
      } else if (roundingRemainder < 0) {
        rawDiscounts[i] = Math.round((rawDiscounts[i] + roundingRemainder) * 100) / 100;
        roundingRemainder = 0;
      }
    }
  }
  return items.map((item, index) => {
    const lineValue = item.unit_price * item.quantity;
    const newLineValue = Math.max(0, lineValue - rawDiscounts[index]);
    const newUnitPrice = item.quantity > 0 ? Math.max(0, Math.round((newLineValue / item.quantity) * 100) / 100) : 0;
    return { ...item, original_unit_price: item.unit_price, unit_price: newUnitPrice };
  });
}

/** Prezzi già scontati: discount_percent resta ZERO per evitare lo sconto doppio sul server. */
export function welcomeDiscountItems(cart: DiscountCartItem[]) {
  const eligible = cart.filter(c => c.product.rottamazione_no !== true);
  const excluded = cart.filter(c => c.product.rottamazione_no === true);
  const map = (c: DiscountCartItem) => ({ product_id: c.product.id, quantity: c.quantity, unit_price: c.unit_price, discount_percent: 0 });
  const amount = eligible.reduce((s, c) => s + c.unit_price * c.quantity, 0) * 0.25;
  if (!eligible.length || amount <= 0) return cart.map(map);
  return [...distributeDiscountToItems(eligible.map(map), amount).map(d => ({ ...d, discount_percent: 0 })), ...excluded.map(map)];
}