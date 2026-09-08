// Seed per lo smoke test Tour Live completo (gdeintinis):
// - 3 clienti SMOKE Tappa 1/2/3 (tappe del tour) + 1 cliente SMOKE Nuovo Benvenuto (mai ordinato)
// - 1 ai_tour ACTIVE con 3 stops (planned) per oggi
// Salva gli ID in /tmp/live_smoke_ids.json (cleanup filtrato per ID, non per nome).
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

const today = new Date().toISOString().slice(0, 10);
const rndVat = () => String(Math.floor(10000000000 + Math.random() * 89999999999));

const seeds = [
  { business_name: 'SMOKE Tappa 1', address: 'Via Smoke 1', lat: 45.464, lng: 9.190, phone: '3330000001' },
  { business_name: 'SMOKE Tappa 2', address: 'Via Smoke 2', lat: 45.466, lng: 9.193, phone: '3330000002' },
  { business_name: 'SMOKE Tappa 3', address: 'Via Smoke 3', lat: 45.468, lng: 9.188, phone: '3330000003' },
  { business_name: 'SMOKE Nuovo Benvenuto', address: 'Via Smoke 9', lat: 45.470, lng: 9.195, phone: '3330000009' },
];

const customers = [];
for (const s of seeds) {
  const vat = rndVat();
  const { data, error } = await sb.from('customers').insert({
    agent_id: uid, business_name: s.business_name, city: 'Milano', province: 'MI',
    address: s.address, latitude: s.lat, longitude: s.lng, vat_number: vat, fiscal_code: vat,
    postal_code: '20100', contact_name: 'Smoke', contact_surname: 'Test', contact_phone: s.phone,
    notes: 'TEST DATA LIVE SMOKE', customer_type: 'bar', category: 'prospect',
    first_visit_date: today, last_visit_date: today,
  }).select('id, business_name').single();
  if (error) { console.error('INSERT FAIL', s.business_name, error.message); process.exit(2); }
  console.log('created customer', data.business_name, data.id);
  customers.push({ id: data.id, name: data.business_name, lat: s.lat, lng: s.lng, address: s.address });
}

// Tour ACTIVE con le prime 3 tappe
const { data: tour, error: terr } = await sb.from('ai_tours').insert({
  agent_id: uid, tour_date: today, start_time: '09:00', end_time: '19:00',
  start_label: 'SMOKE LIVE TEST', start_lat: 45.4642, start_lng: 9.19,
  end_mode: 'none', tour_type: 'clienti', resolved_tour_type: 'clienti',
  status: 'active', planned_visits: 3, planned_distance_km: 4,
  planned_drive_minutes: 15, planned_visit_minutes: 60, planned_buffer_minutes: 10,
  potential_value: 0, ai_summary: 'Smoke test Tour Live completo', actual_start: new Date().toISOString(),
}).select('id').single();
if (terr) { console.error('TOUR FAIL', terr.message); process.exit(3); }
console.log('created tour', tour.id);

const stopIds = [];
for (let i = 0; i < 3; i++) {
  const c = customers[i];
  const hh = 10 + i;
  const { data: st, error: serr } = await sb.from('ai_tour_stops').insert({
    tour_id: tour.id, entity_type: 'client', customer_id: c.id,
    business_name: c.name, address: c.address, city: 'Milano', province: 'MI',
    latitude: c.lat, longitude: c.lng,
    planned_sequence: i + 1, planned_arrival: `${hh}:00`, planned_departure: `${hh}:20`,
    planned_duration_minutes: 20, travel_minutes: 5, travel_km: 1.2,
    priority_score: 50, priority_class: 'Media', mandatory: false,
    status: 'planned', ai_reason: 'smoke test',
  }).select('id').single();
  if (serr) { console.error('STOP FAIL', c.name, serr.message); process.exit(4); }
  console.log('created stop', i + 1, c.name, st.id);
  stopIds.push(st.id);
}

// Baseline stock prodotto test (VOOM POD TOBACCO 20)
const PROD_ID = '32fdf95a-94cf-497f-ad2c-f9f9a9936c16';
const { data: prod } = await sb.from('products').select('id, short_description, stock_quantity, unit_price').eq('id', PROD_ID).single();
console.log('baseline product:', prod.short_description, 'stock =', prod.stock_quantity);

fs.writeFileSync('/tmp/live_smoke_ids.json', JSON.stringify({
  agent_id: uid, tour_id: tour.id, stop_ids: stopIds, customers,
  product: { id: PROD_ID, baseline_stock: prod.stock_quantity, unit_price: prod.unit_price },
  seeded_at: new Date().toISOString(),
}, null, 2));
console.log('SEED DONE -> /tmp/live_smoke_ids.json');
process.exit(0);
