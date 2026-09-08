// Cleanup dello smoke test AI Tour per gdeintinis:
// - elimina i clienti SMOKE (business_name LIKE 'SMOKE %') e le entità figlie collegate
// - elimina eventuali ai_tour_events/ai_tour_stops/ai_tours residui
// Sicuro: opera solo su record dell'agente gdeintinis con business_name che inizia con "SMOKE ".
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);

const { data: auth, error: aerr } = await sb.auth.signInWithPassword({
  email: 'gdeintinis@gmail.com',
  password: 'GabrieleDeIntinis123!',
});
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }
const uid = auth.user.id;
console.log('LOGIN OK agent_id=', uid);

const { data: custs } = await sb.from('customers').select('id, business_name').eq('agent_id', uid).ilike('business_name', 'SMOKE %');
const cids = (custs || []).map((c) => c.id);
console.log('SMOKE customers found:', cids.length);

if (cids.length > 0) {
  // visits / appointments / orders (child->parent order dove serve)
  const { error: v } = await sb.from('visits').delete().in('customer_id', cids);
  if (v) console.warn('visits del err:', v.message);
  const { error: a } = await sb.from('appointments').delete().in('customer_id', cids);
  if (a) console.warn('appointments del err:', a.message);
  // orders: cerca ordini SMOKE, poi cancella righe/movimenti; se qualcuno fallisce, log e prosegue
  const { data: ords } = await sb.from('orders').select('id').in('customer_id', cids);
  const oids = (ords || []).map((o) => o.id);
  if (oids.length > 0) {
    await sb.from('order_items').delete().in('order_id', oids).then(({ error }) => error && console.warn('order_items:', error.message));
    await sb.from('stock_reservations').delete().in('order_id', oids).then(({ error }) => error && console.warn('stock_reservations:', error.message));
    await sb.from('orders').delete().in('id', oids).then(({ error }) => error && console.warn('orders:', error.message));
  }
}

// AI Tour residuals (agent-scoped)
const { data: tours } = await sb.from('ai_tours').select('id, name').eq('agent_id', uid).ilike('name', 'SMOKE%');
const tids = (tours || []).map((t) => t.id);
console.log('SMOKE tours found:', tids.length);
if (tids.length > 0) {
  await sb.from('ai_tour_events').delete().in('tour_id', tids).then(({ error }) => error && console.warn('ai_tour_events:', error.message));
  await sb.from('ai_tour_stops').delete().in('tour_id', tids).then(({ error }) => error && console.warn('ai_tour_stops:', error.message));
  await sb.from('ai_tours').delete().in('id', tids).then(({ error }) => error && console.warn('ai_tours:', error.message));
}

// customers
if (cids.length > 0) {
  const { error } = await sb.from('customers').delete().in('id', cids);
  if (error) console.warn('customers del err:', error.message);
}

// residuals report
const { data: r1 } = await sb.from('customers').select('id').eq('agent_id', uid).ilike('business_name', 'SMOKE %');
const { data: r2 } = await sb.from('ai_tours').select('id').eq('agent_id', uid).ilike('name', 'SMOKE%');
console.log('RESIDUALS -> customers:', (r1||[]).length, 'ai_tours:', (r2||[]).length);
process.exit(0);
