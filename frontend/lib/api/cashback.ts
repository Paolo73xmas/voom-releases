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
  // ✅ Parità web (security audit): l'RPC server-side ricalcola il saldo reale e
  // cappa l'importo — le scritture dirette su cashback_transactions sono bloccate da RLS.
  void customerId; void eligibleSubtotal;
  try {
    const { data, error } = await supabase.rpc('cashback_process_usage', {
      p_order_id: orderId,
      p_amount: cashBackAmount,
    });
    if (error) {
      console.error('[CashBack] Error processing usage (RPC):', error);
      return { success: false, error: "Errore durante l'elaborazione del CashBack" };
    }
    const res = data as { success: boolean; error?: string };
    return { success: res?.success === true, error: res?.error };
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
  // ✅ Parità web (security audit): l'RPC server-side ricalcola l'importo dai soli
  // order_items reali in DB — il client non passa l'importo e non può gonfiare il saldo.
  void customerId; void orderItems;
  try {
    const { data, error } = await supabase.rpc('cashback_process_accumulation', {
      p_order_id: orderId,
    });
    if (error) {
      console.error('[CashBack] Error processing accumulation (RPC):', error);
      return { success: false, amount: 0, error: "Errore durante l'accumulo del CashBack" };
    }
    const res = data as { success: boolean; amount?: number; error?: string };
    return { success: res?.success === true, amount: res?.amount ?? 0, error: res?.error };
  } catch (error) {
    console.error('[CashBack] Error processing accumulation:', error);
    return { success: false, amount: 0, error: "Errore durante l'accumulo del CashBack" };
  }
}
