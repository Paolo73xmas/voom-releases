// Verifica stato smoke test Tour Live: tour, stops, ordini, items, stock, visite/ispezioni.
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);
const ids = JSON.parse(fs.readFileSync('/tmp/live_smoke_ids.json', 'utf8'));

const { error: aerr } = await sb.auth.signInWithPassword({ email: 'gdeintinis@gmail.com', password: 'GabrieleDeIntinis123!' });
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }

const { data: tour } = await sb.from('ai_tours').select('id, status, actual_start, actual_end').eq('id', ids.tour_id).maybeSingle();
console.log('TOUR:', JSON.stringify(tour));

const { data: stops } = await sb.from('ai_tour_stops').select('id, business_name, planned_sequence, status, outcome, skip_reason, actual_arrival').eq('tour_id', ids.tour_id).order('planned_sequence');
for (const s of stops || []) console.log(`STOP ${s.planned_sequence} ${s.business_name}: status=${s.status} outcome=${s.outcome ?? '-'} skip=${s.skip_reason ?? '-'} arrived=${s.actual_arrival ?? '-'}`);

const cids = ids.customers.map((c) => c.id);
const { data: orders } = await sb.from('orders').select('id, customer_id, total_amount, status, notes, created_at').in('customer_id', cids).order('created_at');
for (const o of orders || []) {
  const cname = ids.customers.find((c) => c.id === o.customer_id)?.name;
  console.log(`ORDER ${o.id} | ${cname} | tot=€${o.total_amount} | ${o.status} | notes=${(o.notes || '').slice(0, 160)}`);
  const { data: items } = await sb.from('order_items').select('product_id, quantity, unit_price, discount_percent').eq('order_id', o.id);
  for (const it of items || []) console.log(`   item prod=${it.product_id.slice(0, 8)} qty=${it.quantity} price=€${it.unit_price} disc=${it.discount_percent}%`);
}

const { data: prod } = await sb.from('products').select('stock_quantity').eq('id', ids.product.id).single();
console.log(`STOCK ${ids.product.id.slice(0, 8)}: now=${prod.stock_quantity} baseline=${ids.product.baseline_stock}`);

const { data: visits } = await sb.from('visits').select('id, customer_id, visit_type, outcome').in('customer_id', cids);
console.log('VISITS:', (visits || []).length, JSON.stringify((visits || []).map((v) => ({ t: v.visit_type, o: v.outcome }))));
const { data: insp } = await sb.from('inspections').select('id, customer_id, status').in('customer_id', cids);
console.log('INSPECTIONS:', (insp || []).length);
const { data: apps } = await sb.from('appointments').select('id, customer_id, appointment_date').in('customer_id', cids);
console.log('APPOINTMENTS:', (apps || []).length);
process.exit(0);
