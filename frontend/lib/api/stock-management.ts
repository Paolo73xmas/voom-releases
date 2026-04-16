/**
 * Stock Management Service (Mobile)
 * Mirrors the web app's stock-management.ts for order stock subtraction.
 *
 * Key flow (matching OrderCollection.tsx in web app):
 * 1. After insert_order_items_safe
 * 2. After create_stock_reservation
 * 3. Call subtractStockForOrder (RPC subtract_stock_for_order)
 * 4. Call verifyAndSetStockSubtracted (check movements + set flag)
 */

import { supabase } from '../supabase';

// ==================== STOCK SUBTRACTION ====================

/**
 * Subtract stock when an order is created (agent flow).
 * Uses the SECURITY DEFINER RPC `subtract_stock_for_order` to bypass RLS.
 * The RPC internally handles:
 * - stock_management_enabled check
 * - is_virtual branch guard
 * - product stock update
 * - stock_movement recording
 * - linked product sync (Italia ↔ Estero)
 *
 * NON-BLOCKING: errors are logged but never thrown.
 *
 * @param items    Array of { product_id, quantity }
 * @param userId   The agent user ID
 * @param orderId  The order UUID (used for branch guard check)
 */
export async function subtractStockForOrder(
  items: Array<{ product_id: string; quantity: number }>,
  userId: string,
  orderId?: string
): Promise<void> {
  console.log('[STOCK-AUDIT] ════════════════════════════════════════════════════');
  console.log('[STOCK-AUDIT] 📦 subtractStockForOrder CALLED (mobile, via RPC)');
  console.log('[STOCK-AUDIT] orderId:', orderId ?? 'NOT PROVIDED');
  console.log('[STOCK-AUDIT] userId:', userId);
  console.log('[STOCK-AUDIT] itemCount:', items.length);

  if (items.length === 0) {
    console.log('[STOCK-AUDIT] ⚠️ No items to subtract, returning');
    console.log('[STOCK-AUDIT] ════════════════════════════════════════════════════');
    return;
  }

  // Build the JSONB array for the RPC
  const p_items = items.map(i => ({
    product_id: i.product_id,
    quantity: i.quantity,
  }));

  const rpcParams: Record<string, unknown> = {
    p_items: p_items,
    p_user_id: userId,
  };

  // Pass orderId if available — the RPC uses it for the is_virtual branch guard
  if (orderId) {
    rpcParams.p_order_id = orderId;
  }

  console.log('[STOCK-AUDIT] 🔄 Calling RPC subtract_stock_for_order...');

  const { data, error } = await supabase.rpc('subtract_stock_for_order', rpcParams);

  if (error) {
    console.error('[STOCK-AUDIT] ❌ RPC subtract_stock_for_order ERROR:', error.message);
    console.log('[STOCK-AUDIT] ════════════════════════════════════════════════════');
    // Don't throw — log the error but don't block the order submission
    return;
  }

  // Parse the RPC result
  const result = data as {
    status: string;
    processed?: number;
    errors?: string[];
    reason?: string;
    branch_id?: string;
  } | null;

  if (!result) {
    console.warn('[STOCK-AUDIT] ⚠️ RPC returned null result');
    console.log('[STOCK-AUDIT] ════════════════════════════════════════════════════');
    return;
  }

  if (result.status === 'skipped') {
    console.log(`[STOCK-AUDIT] ⚠️ Stock management is DISABLED - skipped (reason: ${result.reason})`);
  } else if (result.status === 'blocked') {
    console.log(`[STOCK-AUDIT] 🛑 GUARD BLOCKED: Non-virtual branch order (branch_id: ${result.branch_id}). Global stock NOT subtracted.`);
  } else if (result.status === 'ok') {
    console.log(`[STOCK-AUDIT] ✅ RPC completed: ${result.processed} items processed`);
    if (result.errors && result.errors.length > 0) {
      console.warn('[STOCK-AUDIT] ⚠️ RPC errors:', result.errors);
    }
  } else {
    console.warn('[STOCK-AUDIT] ⚠️ Unexpected RPC result:', JSON.stringify(result));
  }

  console.log('[STOCK-AUDIT] ════════════════════════════════════════════════════');
}

// ==================== POST-SUBTRACTION VERIFICATION ====================

/**
 * Verify that stock was actually subtracted by checking for recent stock_movements,
 * then set the stock_subtracted flag on the order accordingly.
 *
 * Called AFTER subtractStockForOrder. Checks for unload movements created within
 * the last 60 seconds for the given product_ids. If found, marks order
 * stock_subtracted = true, otherwise false.
 *
 * @param orderId  The order UUID
 * @param items    The items that were supposed to be subtracted
 */
export async function verifyAndSetStockSubtracted(
  orderId: string,
  items: Array<{ product_id: string; quantity: number }>
): Promise<void> {
  if (!orderId || items.length === 0) return;

  try {
    const productIds = items.map(i => i.product_id);
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString();

    console.log(`[STOCK-VERIFY] 🔍 Verifying stock movements for order ${orderId}...`);
    console.log(`[STOCK-VERIFY]    Checking ${productIds.length} products since ${sixtySecondsAgo}`);

    // Check if recent unload movements exist for these products
    const { data: movements, error: movError } = await supabase
      .from('stock_movements')
      .select('id, product_id')
      .in('product_id', productIds)
      .eq('movement_type', 'unload')
      .gte('created_at', sixtySecondsAgo)
      .limit(1);

    if (movError) {
      console.warn(`[STOCK-VERIFY] ⚠️ Error querying stock_movements: ${movError.message}`);
      return;
    }

    const found = movements && movements.length > 0;

    console.log(`[STOCK-VERIFY] ${found ? '✅' : '❌'} Movements ${found ? 'FOUND' : 'NOT FOUND'} for order ${orderId}`);

    const { error: updateError } = await supabase
      .from('orders')
      .update({ stock_subtracted: found })
      .eq('id', orderId);

    if (updateError) {
      console.warn(`[STOCK-VERIFY] ⚠️ Error updating stock_subtracted flag: ${updateError.message}`);
    } else {
      console.log(`[STOCK-VERIFY] ✅ stock_subtracted set to ${found} for order ${orderId}`);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[STOCK-VERIFY] ❌ Unexpected error: ${errMsg}`);
    // Non-blocking — don't throw
  }
}


// ==================== BRANCH STOCK SUBTRACTION ====================

/**
 * Subtract stock from a specific branch (non-virtual branch flow).
 * Uses the RPC `subtract_branch_stock_for_order`.
 * NON-BLOCKING.
 */
export async function subtractBranchStockForOrder(
  branchId: string,
  items: Array<{ product_id: string; quantity: number }>,
  userId: string
): Promise<void> {
  console.log('[STOCK-AUDIT] ════════════════════════════════════════════════════');
  console.log('[STOCK-AUDIT] 📦 subtractBranchStockForOrder CALLED');
  console.log('[STOCK-AUDIT] branchId:', branchId);
  console.log('[STOCK-AUDIT] itemCount:', items.length);

  if (items.length === 0) {
    console.log('[STOCK-AUDIT] ⚠️ No items, returning');
    return;
  }

  const { data, error } = await supabase.rpc('subtract_branch_stock_for_order', {
    p_branch_id: branchId,
    p_items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
    p_user_id: userId,
  });

  if (error) {
    console.error('[STOCK-AUDIT] ❌ RPC subtract_branch_stock_for_order ERROR:', error.message);
    return;
  }

  const result = data as { status: string; processed?: number; errors?: string[] } | null;
  if (result?.status === 'ok') {
    console.log(`[STOCK-AUDIT] ✅ Branch stock subtracted: ${result.processed} items`);
  } else {
    console.warn('[STOCK-AUDIT] ⚠️ Branch RPC result:', JSON.stringify(result));
  }
  console.log('[STOCK-AUDIT] ════════════════════════════════════════════════════');
}

// ==================== BRANCH VIRTUAL CHECK ====================

/**
 * Check if a branch is virtual.
 */
export async function isBranchVirtual(branchId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('branches')
      .select('is_virtual')
      .eq('id', branchId)
      .single();
    if (error || !data) return true; // Default to virtual (global stock) on error
    return data.is_virtual === true;
  } catch {
    return true;
  }
}
