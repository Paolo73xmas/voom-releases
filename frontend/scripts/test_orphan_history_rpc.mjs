// Verifica RPC ai_tour_customer_order_history (migration 20260908) dal client mobile
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
await supabase.auth.signInWithPassword({ email: 'gdeintinis@gmail.com', password: 'GabrieleDeIntinis123!' });
// prendi un orfano reale: cliente con ordini ma agent_id null non visibile? usare la RPC orphan... 
// più semplice: prendi un cliente visibile qualsiasi e chiama la RPC (SECURITY DEFINER)
const { data: custs } = await supabase.from('customers').select('id, business_name').limit(5);
for (const c of custs || []) {
  const { data, error } = await supabase.rpc('ai_tour_customer_order_history', { p_customer_id: c.id });
  if (error) { console.log(c.business_name, '-> ERR', error.message); continue; }
  console.log(c.business_name, '-> ordini:', (data?.orders || []).length, '| last_visit:', data?.last_visit_date || null);
  if ((data?.orders || []).length > 0) { console.log('  esempio:', JSON.stringify(data.orders[0])); break; }
}
await supabase.auth.signOut();
