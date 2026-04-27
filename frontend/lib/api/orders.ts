import { supabase } from '../supabase';
import { Order } from '../../types';
import { getCache, setCache } from '../memory-cache';

export async function fetchOrders(userId: string, userRole: string, branchId?: string | null, opts?: { force?: boolean }): Promise<Order[]> {
  const cacheKey = `orders:${userRole}:${userId}:${branchId || ''}`;
  if (!opts?.force) {
    const cached = getCache<Order[]>(cacheKey);
    if (cached) return cached;
  }
  try {
    let query = supabase
      .from('orders')
      .select(`
        id, order_number, order_date, status, total_amount, customer_id, agent_id, branch_id,
        customer:customers (
          id,
          business_name,
          city,
          province,
          address,
          postal_code,
          contact_name,
          contact_surname,
          contact_phone,
          contact_email,
          vat_number,
          fiscal_code,
          pec,
          sdi
        )
      `)
      .order('order_date', { ascending: false })
      .limit(200);

    if (userRole === 'branch_admin' && branchId) {
      // Branch admin: see orders from all agents in the branch
      query = query.eq('branch_id', branchId);
    } else if (userRole !== 'admin' && userRole !== 'supervisor' && userRole !== 'admincustom') {
      query = query.eq('agent_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    const result = (data || []) as unknown as Order[];
    setCache(cacheKey, result, 60_000);
    return result;
  } catch (error) {
    console.error('[fetchOrders] Error:', error);
    throw error;
  }
}

export async function fetchOrderById(id: string): Promise<Order | null> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers (*),
        order_items (
          *,
          product:products (*)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[fetchOrderById] Error:', error);
    throw error;
  }
}

export function getOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Bozza',
    confirmed: 'Confermato',
    processing: 'In Elaborazione',
    shipped: 'Spedito',
    delivered: 'Consegnato',
    cancelled: 'Annullato',
  };
  return labels[status] || status;
}

export function getOrderStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: '#9CA3AF',
    confirmed: '#3B82F6',
    processing: '#F59E0B',
    shipped: '#8B5CF6',
    delivered: '#10B981',
    cancelled: '#EF4444',
  };
  return colors[status] || '#9CA3AF';
}
