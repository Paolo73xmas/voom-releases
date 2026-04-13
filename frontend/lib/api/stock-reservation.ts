/**
 * Stock Reservation Service
 * Manages stock reservations (prenotazioni) for draft orders.
 *
 * Key concepts:
 * - Reservations are created when an agent creates a draft order
 * - Reservations are released when the order is sent to supplier or cancelled
 * - Available stock = physical stock - reservations (direct + linked Italia↔Estero)
 * - Non-blocking: warnings only, never prevents order creation
 */

import { supabase } from '../supabase';
import type {
  ReservationItem,
  ReservationResult,
  ReleaseResult,
  AvailableStockInfo,
  AvailableStockMap,
} from '../../types/reservation';

// Re-export types
export type {
  ReservationItem,
  ReservationResult,
  ReleaseResult,
  AvailableStockInfo,
  AvailableStockMap,
};

// ==================== CORE OPERATIONS ====================

/**
 * Create stock reservations for a draft order.
 * Called after insert_order_items_safe.
 *
 * @param orderId  The order UUID
 * @param items    Array of {product_id, quantity} to reserve
 * @param userId   The user creating the reservation
 * @param branchId Optional branch ID for non-virtual branch orders
 */
export async function createReservation(
  orderId: string,
  items: ReservationItem[],
  userId: string,
  branchId?: string
): Promise<ReservationResult> {
  console.log(`[stock-reservation] 📦 Creating reservation for order ${orderId}, ${items.length} items, branch: ${branchId || 'HQ'}`);

  if (!items || items.length === 0) {
    console.log('[stock-reservation] ℹ️ No items to reserve');
    return { status: 'ok', warnings: [] };
  }

  const p_items = items.map(i => ({
    product_id: i.product_id,
    quantity: i.quantity,
  }));

  const rpcParams: Record<string, unknown> = {
    p_order_id: orderId,
    p_items: p_items,
    p_user_id: userId,
  };

  if (branchId) {
    rpcParams.p_branch_id = branchId;
  }

  const { data, error } = await supabase.rpc('create_stock_reservation', rpcParams);

  if (error) {
    console.error('[stock-reservation] ❌ RPC create_stock_reservation error:', error.message);
    // Non-blocking: return ok with no warnings rather than throwing
    return { status: 'ok', warnings: [] };
  }

  const result = data as { status: string; warnings: Array<{ product_id: string; requested: number; available: number }> } | null;

  if (!result) {
    console.warn('[stock-reservation] ⚠️ RPC returned null');
    return { status: 'ok', warnings: [] };
  }

  console.log(`[stock-reservation] ✅ Reservation created. Warnings: ${result.warnings?.length || 0}`);

  if (result.warnings && result.warnings.length > 0) {
    console.warn('[stock-reservation] ⚠️ Availability warnings:', result.warnings);
  }

  return {
    status: result.status === 'ok' ? 'ok' : 'error',
    warnings: result.warnings || [],
  };
}

/**
 * Release all reservations for an order.
 * Called when order is sent to supplier or cancelled.
 *
 * @param orderId The order UUID
 */
export async function releaseReservation(orderId: string): Promise<ReleaseResult> {
  console.log(`[stock-reservation] 🔓 Releasing reservation for order ${orderId}`);

  const { data, error } = await supabase.rpc('release_stock_reservation', {
    p_order_id: orderId,
  });

  if (error) {
    console.error('[stock-reservation] ❌ RPC release_stock_reservation error:', error.message);
    return { status: 'error', global_released: 0, branch_released: 0 };
  }

  const result = data as { status: string; global_released: number; branch_released: number } | null;

  if (!result) {
    console.warn('[stock-reservation] ⚠️ RPC returned null');
    return { status: 'ok', global_released: 0, branch_released: 0 };
  }

  console.log(`[stock-reservation] ✅ Released: ${result.global_released} global, ${result.branch_released} branch`);

  return {
    status: result.status === 'ok' ? 'ok' : 'error',
    global_released: result.global_released || 0,
    branch_released: result.branch_released || 0,
  };
}

// ==================== AVAILABILITY QUERIES ====================

/**
 * Get available stock for a list of products (global).
 * Includes reservations from linked Italia↔Estero products.
 *
 * @param productIds Array of product UUIDs
 * @returns Map of product_id -> AvailableStockInfo
 */
export async function getAvailableStock(productIds: string[]): Promise<AvailableStockMap> {
  const result = new Map<string, AvailableStockInfo>();

  if (!productIds || productIds.length === 0) return result;

  // Process in batches of 500 to avoid parameter limits
  const BATCH_SIZE = 500;
  for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
    const batch = productIds.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase.rpc('get_available_stock', {
      p_product_ids: batch,
    });

    if (error) {
      console.error('[stock-reservation] ❌ RPC get_available_stock error:', error.message);
      continue;
    }

    if (data && Array.isArray(data)) {
      for (const row of data) {
        result.set(row.product_id, {
          product_id: row.product_id,
          stock_quantity: row.stock_quantity ?? 0,
          reserved_quantity: Number(row.reserved_quantity ?? 0),
          available_quantity: Number(row.available_quantity ?? 0),
        });
      }
    }
  }

  return result;
}

/**
 * Get available stock for a list of products in a specific branch.
 *
 * @param branchId  The branch UUID
 * @param productIds Array of product UUIDs
 * @returns Map of product_id -> AvailableStockInfo
 */
export async function getBranchAvailableStock(
  branchId: string,
  productIds: string[]
): Promise<AvailableStockMap> {
  const result = new Map<string, AvailableStockInfo>();

  if (!productIds || productIds.length === 0) return result;

  const BATCH_SIZE = 500;
  for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
    const batch = productIds.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase.rpc('get_branch_available_stock', {
      p_branch_id: branchId,
      p_product_ids: batch,
    });

    if (error) {
      console.error('[stock-reservation] ❌ RPC get_branch_available_stock error:', error.message);
      continue;
    }

    if (data && Array.isArray(data)) {
      for (const row of data) {
        result.set(row.product_id, {
          product_id: row.product_id,
          stock_quantity: row.stock_quantity ?? 0,
          reserved_quantity: Number(row.reserved_quantity ?? 0),
          available_quantity: Number(row.available_quantity ?? 0),
        });
      }
    }
  }

  return result;
}
