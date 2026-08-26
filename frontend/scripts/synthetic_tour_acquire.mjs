// Tour ATTIVO sintetico con 1 tappa TABACCHERIA (senza customer) per testare
// il dialog di acquisizione prospect nel Live. Uso: node scripts/synthetic_tour_acquire.mjs create | delete
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);
const { data: auth, error: aerr } = await supabase.auth.signInWithPassword({ email: 'tadini@voomweb.it', password: 'Tadini2025!' });
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }
const uid = auth.user.id;
const today = new Date().toISOString().slice(0, 10);
const LABEL = 'TEST SINTETICO ACQUIRE';

if (process.argv[2] === 'delete') {
  const { data: tours } = await supabase.from('ai_tours').select('id').eq('agent_id', uid).eq('start_label', LABEL);
  for (const t of tours || []) {
    await supabase.from('ai_tour_events').delete().eq('tour_id', t.id);
    await supabase.from('ai_tour_stops').delete().eq('tour_id', t.id);
    const { error } = await supabase.from('ai_tours').delete().eq('id', t.id);
    console.log('deleted', t.id, error ? 'ERR ' + error.message : 'OK');
  }
  process.exit(0);
}

// una tabaccheria non assegnata con GPS (nessun customer collegato)
const { data: tabs } = await supabase.from('tabaccherie')
  .select('id, denominazione, indirizzo, comune, gps_lat, gps_lng, customer_id')
  .is('customer_id', null).not('gps_lat', 'is', null).limit(1);
if (!tabs?.length) { console.error('nessuna tabaccheria libera con GPS'); process.exit(1); }
const tb = tabs[0];

const now = new Date();
const endH = Math.min(23, now.getHours() + 6);
const { data: tour, error } = await supabase.from('ai_tours').insert({
  agent_id: uid, tour_date: today, start_time: '08:00', end_time: `${String(endH).padStart(2, '0')}:00`,
  start_label: LABEL, start_lat: 45.18, start_lng: 9.16,
  end_mode: 'none', tour_type: 'sviluppo', resolved_tour_type: 'sviluppo',
  status: 'active', planned_visits: 1, planned_distance_km: 5,
  planned_drive_minutes: 10, planned_visit_minutes: 20, planned_buffer_minutes: 0,
  potential_value: 0, ai_summary: 'test acquire', actual_start: new Date().toISOString(),
}).select('id').single();
if (error) { console.error('ERR tour:', error.message); process.exit(1); }

const { error: e2 } = await supabase.from('ai_tour_stops').insert({
  tour_id: tour.id,
  entity_type: 'tabaccheria', tabaccheria_id: tb.id, business_name: tb.denominazione,
  address: tb.indirizzo || '', city: tb.comune || '', province: '',
  latitude: Number(tb.gps_lat), longitude: Number(tb.gps_lng),
  planned_sequence: 1, actual_sequence: 1, planned_arrival: '10:00',
  planned_duration_minutes: 20, travel_minutes: 10, travel_km: 4,
  priority_score: 60, priority_class: 'Media', mandatory: false, status: 'planned', ai_reason: 'test acquire',
});
if (e2) { console.error('STOP ERR', e2.message); process.exit(1); }
console.log('created', tour.id, 'tabaccheria:', tb.denominazione);
process.exit(0);
