// Cleanup completo smoke test Tour Live: filtrato SOLO per ID salvati in /tmp/live_smoke_ids.json.
// Ordine: order_items/reservations -> orders -> visits/inspections/appointments -> tour events/stops/tour -> customers.
// Ripristino stock via admin se lo stock attuale differisce dal baseline.
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);
const ids = JSON.parse(fs.readFileSync('/tmp/live_smoke_ids.json', 'utf8'));
const cids = ids.customers.map((c) => c.id);

const { error: aerr } = await sb.auth.signInWithPassword({ email: 'gdeintinis@gmail.com', password: 'GabrieleDeIntinis123!' });
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }

const del = async (table, q) => {
  const { error, count } = await q;
  console.log(`${table}: ${error ? 'ERR ' + error.message : 'ok' + (count != null ? ' (' + count + ')' : '')}`);
};

// Ordini e figli (prima di cancellare: ripristina lo stock per ogni riga via admin)
const { data: ords } = await sb.from('orders').select('id').in('customer_id', cids);
const oids = (ords || []).map((o) => o.id);
console.log('orders found:', oids.length);
if (oids.length) {
  const admin0 = createClient(url, key);
  const { error: ad0 } = await admin0.auth.signInWithPassword({ email: 'admin1@voomweb.it', password: 'Test123!' });
  if (ad0) { console.error('ADMIN AUTH FAIL', ad0.message); process.exit(2); }
  const { data: allItems } = await sb.from('order_items').select('product_id, quantity').in('order_id', oids);
  const byProd = {};
  for (const it of allItems || []) byProd[it.product_id] = (byProd[it.product_id] || 0) + it.quantity;
  for (const [pid, qty] of Object.entries(byProd)) {
    const { data: p } = await admin0.from('products').select('stock_quantity, short_description').eq('id', pid).single();
    const { error: ue } = await admin0.from('products').update({ stock_quantity: p.stock_quantity + qty }).eq('id', pid);
    console.log(`stock +${qty} ${p.short_description}:`, ue ? 'ERR ' + ue.message : `OK -> ${p.stock_quantity + qty}`);
  }
  await del('order_items', sb.from('order_items').delete({ count: 'exact' }).in('order_id', oids));
  await del('stock_reservations', sb.from('stock_reservations').delete({ count: 'exact' }).in('order_id', oids));
  await del('orders', sb.from('orders').delete({ count: 'exact' }).in('id', oids));
}

// Visite / ispezioni / appuntamenti / follow-up
await del('visits', sb.from('visits').delete({ count: 'exact' }).in('customer_id', cids));
const { data: insp } = await sb.from('inspections').select('id').in('customer_id', cids);
const iids = (insp || []).map((i) => i.id);
if (iids.length) {
  // best-effort: rimuovi anche i file dal bucket inspection_photos
  const { data: ph } = await sb.from('inspection_photos').select('photo_url').in('inspection_id', iids);
  const paths = (ph || [])
    .map((r) => {
      const m = (r.photo_url || '').match(/inspection_photos\/(.+)$/);
      return m ? m[1].split('?')[0] : null;
    })
    .filter(Boolean);
  if (paths.length) {
    const { error: se } = await sb.storage.from('inspection_photos').remove(paths);
    console.log('storage remove:', se ? 'ERR ' + se.message : `OK (${paths.length})`);
  }
  await del('inspection_photos', sb.from('inspection_photos').delete({ count: 'exact' }).in('inspection_id', iids));
  await del('inspections', sb.from('inspections').delete({ count: 'exact' }).in('id', iids));
}
await del('appointments', sb.from('appointments').delete({ count: 'exact' }).in('customer_id', cids));

// Tour: events -> stops -> tour
await del('ai_tour_events', sb.from('ai_tour_events').delete({ count: 'exact' }).eq('tour_id', ids.tour_id));
await del('ai_tour_stops', sb.from('ai_tour_stops').delete({ count: 'exact' }).eq('tour_id', ids.tour_id));
await del('ai_tours', sb.from('ai_tours').delete({ count: 'exact' }).eq('id', ids.tour_id));

// Clienti
await del('customers', sb.from('customers').delete({ count: 'exact' }).in('id', cids));

// Stock: ripristino via admin se serve
const { data: prod } = await sb.from('products').select('stock_quantity').eq('id', ids.product.id).single();
console.log('stock now =', prod.stock_quantity, 'baseline =', ids.product.baseline_stock);
if (prod.stock_quantity !== ids.product.baseline_stock) {
  const admin = createClient(url, key);
  const { error: adErr } = await admin.auth.signInWithPassword({ email: 'admin1@voomweb.it', password: 'Test123!' });
  if (adErr) { console.error('ADMIN AUTH FAIL', adErr.message); process.exit(2); }
  const { error: upErr } = await admin.from('products').update({ stock_quantity: ids.product.baseline_stock }).eq('id', ids.product.id);
  console.log('stock restore:', upErr ? 'ERR ' + upErr.message : 'OK -> ' + ids.product.baseline_stock);
}

// Verifica residui
const { data: rc } = await sb.from('customers').select('id').in('id', cids);
const { data: rt } = await sb.from('ai_tours').select('id').eq('id', ids.tour_id);
const { data: ro } = oids.length ? await sb.from('orders').select('id').in('id', oids) : { data: [] };
const { data: rp } = await sb.from('products').select('stock_quantity').eq('id', ids.product.id).single();
console.log('RESIDUI -> customers:', (rc || []).length, '| tours:', (rt || []).length, '| orders:', (ro || []).length, '| stock:', rp.stock_quantity);
process.exit(0);
