/**
 * CashBack Processing for Order Collection
 * Handles CashBack usage (debit) and accumulation (credit) after order creation.
 */

import { supabase } from '../supabase';

// ============================================================================
// TYPES
// ============================================================================

interface CashBackConfig {
  id: string;
  customer_id: string;
  is_active: boolean;
  default_percentage: number;
  activation_date: string;
  expiry_date: string | null;
  min_usage_threshold: number;
  max_order_percentage: number;
}

interface CashBackBalance {
  available: number;
  total_accumulated: number;
  total_used: number;
  config: CashBackConfig | null;
}

// ============================================================================
// HELPER: Get CashBack config for a customer
// ============================================================================

async function getCashBackConfig(customerId: string): Promise<CashBackConfig | null> {
  const { data, error } = await supabase
    .from('cashback_config')
    .select('*')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[CashBack] Error fetching config:', error);
    return null;
  }
  return data;
}

// ============================================================================
// HELPER: Create CashBack transaction
// ============================================================================

async function createCashBackTransaction(transaction: {
  customer_id: string;
  order_id: string | null;
  type: 'accumulo' | 'utilizzo';
  amount: number;
  balance_after: number;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase
    .from('cashback_transactions')
    .insert({
      customer_id: transaction.customer_id,
      order_id: transaction.order_id,
      type: transaction.type,
      amount: transaction.amount,
      balance_after: transaction.balance_after,
      notes: transaction.notes ?? null,
    });

  if (error) {
    console.error('[CashBack] Error creating transaction:', error);
    throw error;
  }
}

// ============================================================================
// BALANCE CALCULATION
// ============================================================================

export async function calculateCashBackBalance(customerId: string): Promise<CashBackBalance> {
  const config = await getCashBackConfig(customerId);

  if (!config || !config.is_active) {
    return { available: 0, total_accumulated: 0, total_used: 0, config: null };
  }

  // Check expiry
  if (config.expiry_date && new Date(config.expiry_date) < new Date()) {
    return { available: 0, total_accumulated: 0, total_used: 0, config };
  }

  const { data: transactions, error } = await supabase
    .from('cashback_transactions')
    .select('type, amount')
    .eq('customer_id', customerId);

  if (error) {
    console.error('[CashBack] Error calculating balance:', error);
    throw error;
  }

  let totalAccumulated = 0;
  let totalUsed = 0;

  for (const tx of transactions || []) {
    if (tx.type === 'accumulo') {
      totalAccumulated += tx.amount;
    } else if (tx.type === 'utilizzo') {
      totalUsed += tx.amount;
    }
  }

  const available = Math.max(0, totalAccumulated - totalUsed);

  return {
    available: Math.round(available * 100) / 100,
    total_accumulated: Math.round(totalAccumulated * 100) / 100,
    total_used: Math.round(totalUsed * 100) / 100,
    config,
  };
}

// ============================================================================
// CASHBACK USAGE (debit from balance when used in order)
// ============================================================================

export async function processCashBackUsage(
  customerId: string,
  orderId: string,
  cashBackAmount: number,
  eligibleSubtotal?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const balance = await calculateCashBackBalance(customerId);

    if (cashBackAmount > balance.available) {
      return { success: false, error: 'Importo CashBack superiore al saldo disponibile' };
    }

    if (balance.config?.min_usage_threshold && cashBackAmount < balance.config.min_usage_threshold) {
      return { success: false, error: `Importo minimo di utilizzo: €${balance.config.min_usage_threshold}` };
    }

    // Validate against eligible products subtotal
    if (eligibleSubtotal !== undefined && cashBackAmount > eligibleSubtotal) {
      return {
        success: false,
        error: `Importo CashBack (€${cashBackAmount.toFixed(2)}) superiore al subtotale dei prodotti eligible (€${eligibleSubtotal.toFixed(2)})`,
      };
    }

    const newBalance = Math.round((balance.available - cashBackAmount) * 100) / 100;

    // Create utilizzo transaction
    await createCashBackTransaction({
      customer_id: customerId,
      order_id: orderId,
      type: 'utilizzo',
      amount: cashBackAmount,
      balance_after: newBalance,
      notes: 'Utilizzo CashBack su ordine',
    });

    // Update order: mark as not generating cashback and record cashback used
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        cashback_used: cashBackAmount,
        generates_cashback: false,
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('[CashBack] Error updating order:', updateError);
    }

    return { success: true };
  } catch (error) {
    console.error('[CashBack] Error processing usage:', error);
    return { success: false, error: "Errore durante l'elaborazione del CashBack" };
  }
}

// ============================================================================
// CASHBACK ACCUMULATION (credit to balance for eligible products)
// ============================================================================

export async function processCashBackAccumulation(
  customerId: string,
  orderId: string,
  orderItems: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    cashback_eligible?: boolean;
  }>
): Promise<{ success: boolean; amount: number; error?: string }> {
  try {
    const config = await getCashBackConfig(customerId);
    if (!config || !config.is_active) return { success: true, amount: 0 };

    // Check expiry
    if (config.expiry_date && new Date(config.expiry_date) < new Date()) {
      return { success: true, amount: 0 };
    }

    // Get product-specific rates
    const { data: rates } = await supabase
      .from('cashback_product_rates')
      .select('product_id, percentage')
      .eq('cashback_config_id', config.id);

    const rateMap = new Map<string, number>();
    for (const rate of rates || []) {
      rateMap.set(rate.product_id, rate.percentage);
    }

    // Identify items needing DB lookup for cashback_eligible
    const itemsNeedingLookup = orderItems.filter(item => item.cashback_eligible === undefined);
    const eligibilityMap = new Map<string, boolean>();

    if (itemsNeedingLookup.length > 0) {
      const productIds = [...new Set(itemsNeedingLookup.map(item => item.product_id))];
      const { data: products } = await supabase
        .from('products')
        .select('id, cashback_eligible')
        .in('id', productIds);
      for (const p of products || []) {
        eligibilityMap.set(p.id, p.cashback_eligible === true);
      }
    }

    let totalCashBack = 0;

    for (const item of orderItems) {
      const isEligible = item.cashback_eligible !== undefined
        ? item.cashback_eligible
        : (eligibilityMap.get(item.product_id) === true);

      if (!isEligible) continue;

      const percentage = rateMap.get(item.product_id) ?? config.default_percentage;
      const taxableValue = item.unit_price * item.quantity;
      totalCashBack += taxableValue * (percentage / 100);
    }

    const amount = Math.round(totalCashBack * 100) / 100;

    if (amount <= 0) return { success: true, amount: 0 };

    // Get current balance and create accumulo transaction
    const balance = await calculateCashBackBalance(customerId);
    const newBalance = Math.round((balance.available + amount) * 100) / 100;

    await createCashBackTransaction({
      customer_id: customerId,
      order_id: orderId,
      type: 'accumulo',
      amount,
      balance_after: newBalance,
      notes: 'Accumulo CashBack da ordine',
    });

    return { success: true, amount };
  } catch (error) {
    console.error('[CashBack] Error processing accumulation:', error);
    return { success: false, amount: 0, error: "Errore durante l'accumulo del CashBack" };
  }
}
