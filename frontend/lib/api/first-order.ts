import { supabase } from '../supabase';

/** Un conteggio assente o fallito NON dimostra che il cliente sia al primo ordine. */
export async function fetchIsFirstOrder(customerId: string, signal: AbortSignal): Promise<boolean> {
  const { count, error } = await supabase.from('orders')
    .select('id', { count: 'exact', head: true }).eq('customer_id', customerId).abortSignal(signal);
  if (error || typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new Error('Impossibile verificare lo storico ordini del cliente.');
  }
  return count === 0;
}