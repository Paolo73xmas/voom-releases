import { supabase } from '../supabase';
import { salesTotals, type SalesOrder } from '../sales-totals';
import { readEveryPage } from './read-pages';

export async function fetchMonthlySales(agentId: string, now = new Date()) {
  if (!agentId) throw new Error('Agente non disponibile');
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const orders = await readEveryPage((from, to) => supabase.from('orders')
    .select('id, status, is_foreign, order_items(quantity, unit_price, discount_percent, line_total, product:products(accisa, iva_percentage, short_description))')
    .eq('agent_id', agentId).neq('status', 'cancelled')
    .gte('created_at', start).lt('created_at', end)
    .order('created_at', { ascending: false }).order('id').range(from, to));
  return { ...salesTotals(orders as unknown as SalesOrder[]), monthLabel: `${months[now.getMonth()]} ${now.getFullYear()}` };
}