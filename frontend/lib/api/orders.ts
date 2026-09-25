import { supabase } from '../supabase';
import { Order } from '../../types';
import { literalSearch, pageRange, readPage, type ReadPageOptions } from './read-pages';

export async function fetchOrderCounts(userId: string, userRole: string, branchId?: string | null) {
  if (!userId) throw new Error('Agente non disponibile');
  const count = async (statuses?: string[]) => {
    let query = supabase.from('orders').select('id', { count: 'exact', head: true });
    if (userRole === 'branch_admin' && branchId) query = query.eq('branch_id', branchId);
    else if (!['admin', 'supervisor', 'admincustom'].includes(userRole)) query = query.eq('agent_id', userId);
    if (statuses) query = query.in('status', statuses);
    const result = await query;
    if (result.error) throw result.error;
    if (result.count == null) throw new Error('Conteggio ordini non disponibile');
    return result.count;
  };
  const [total, pending] = await Promise.all([count(), count(['confirmed', 'processing'])]);
  return { total, pending };
}

function ordersHistoryQuery(userId: string, userRole: string, branchId: string | null | undefined, search = '', head = false) {
  if (!userId) throw new Error('Agente non disponibile');
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
        ), matched_customer:customers()
      `, { count: 'exact', head });

    if (userRole === 'branch_admin' && branchId) {
      // Branch admin: see orders from all agents in the branch
      query = query.eq('branch_id', branchId);
    } else if (userRole !== 'admin' && userRole !== 'supervisor' && userRole !== 'admincustom') {
      query = query.eq('agent_id', userId);
    }

  if (search.trim()) {
    const term = literalSearch(search);
    const fields = ['business_name', 'city', 'province', 'address', 'postal_code', 'contact_name',
      'contact_surname', 'contact_phone', 'contact_email', 'vat_number', 'fiscal_code', 'pec', 'sdi'];
    query = query.or(fields.map(field => `${field}.ilike.${term}`).join(','), { referencedTable: 'matched_customer' })
      .or(`order_number.ilike.${term},matched_customer.not.is.null`);
  }
  return query;
}

export async function fetchOrdersPage(userId: string, userRole: string, branchId?: string | null, opts: ReadPageOptions = {}) {
  const { offset, end } = pageRange(opts);
  const query = () => ordersHistoryQuery(userId, userRole, branchId, opts.search);
  const { data, error, count } = await query().order('order_date', { ascending: false }).order('id').range(offset, end);
  if (error) throw error;
  const page = readPage((data || []) as unknown as Order[], count, offset);
  if (offset > 0) return page;
  const countStatus = async (statuses: string[]) => {
    const result = await ordersHistoryQuery(userId, userRole, branchId, opts.search, true).in('status', statuses);
    if (result.error) throw result.error;
    if (result.count == null) throw new Error('Conteggio ordini non disponibile');
    return result.count;
  };
  const [delivered, inProgress] = await Promise.all([countStatus(['delivered']), countStatus(['confirmed', 'processing', 'shipped'])]);
  return { ...page, totals: { delivered, inProgress } };
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
