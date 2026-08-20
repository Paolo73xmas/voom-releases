// Crea o elimina un tour ATTIVO sintetico per testare Esci/Riprendi vista live.
// Uso: node scripts/synthetic_tour.mjs create | delete
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
const LABEL = 'TEST SINTETICO ESCI';

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

const { data: cust } = await supabase.from('customers').select('id, business_name, address, city, latitude, longitude')
  .eq('agent_id', uid).not('latitude', 'is', null).limit(1);
const c = cust?.[0];
if (!c) { console.error('nessun cliente'); process.exit(1); }

// modalita' "never": tappa Mai Visitata (tabaccheria assegnata al territorio, senza scheda cliente)
let stopPayload = {
  entity_type: 'client', customer_id: c.id, business_name: c.business_name,
  address: c.address || '', city: c.city || '', province: '', latitude: c.latitude, longitude: c.longitude,
};
if (process.argv[2] === 'create-never') {
  const { data: frees, error: fe } = await supabase.rpc('ai_tour_free_tabaccherie', {
    p_min_lat: 45.05, p_max_lat: 45.35, p_min_lng: 8.95, p_max_lng: 9.45,
    p_limit: 40, p_provincia: null, p_comune: null, p_ref_lat: 45.18, p_ref_lng: 9.16, p_agent_id: uid,
  });
  if (fe) { console.error('ERR free tabs:', fe.message); process.exit(1); }
  const nev = (frees || []).find((t) => t.assigned) || (frees || [])[0];
  if (!nev) { console.error('nessuna tabaccheria mai visitata in zona'); process.exit(1); }
  console.log('tabaccheria scelta:', nev.denominazione, nev.comune, 'assigned:', nev.assigned, nev.lat, nev.lng);
  stopPayload = {
    entity_type: 'never', customer_id: null, tabaccheria_id: nev.id,
    business_name: nev.denominazione || `Tabaccheria Riv. ${nev.codice_rivendita || ''}`,
    address: nev.indirizzo || '', city: nev.comune || '', province: nev.provincia || '',
    latitude: nev.lat, longitude: nev.lng,
  };
}

const { data: tour, error } = await supabase.from('ai_tours').insert({
  agent_id: uid, tour_date: today, start_time: '09:00', end_time: '18:00',
  start_label: LABEL, start_lat: 45.18, start_lng: 9.16,
  end_mode: 'none', tour_type: 'clienti', resolved_tour_type: 'clienti',
  status: 'active', planned_visits: 1, planned_distance_km: 5,
  planned_drive_minutes: 10, planned_visit_minutes: 20, planned_buffer_minutes: 0,
  potential_value: 0, ai_summary: 'test', actual_start: new Date().toISOString(),
}).select('id').single();
if (error) { console.error('ERR tour:', error.message); process.exit(1); }
const { error: e2 } = await supabase.from('ai_tour_stops').insert({
  tour_id: tour.id, ...stopPayload,
  planned_sequence: 1, planned_arrival: '10:00', planned_departure: '10:20', planned_duration_minutes: 20,
  travel_minutes: 10, travel_km: 5, priority_score: 50, priority_class: 'Media', mandatory: false,
  status: 'planned', ai_reason: 'test',
});
console.log('created', tour.id, JSON.stringify({ lat: stopPayload.latitude, lng: stopPayload.longitude, name: stopPayload.business_name }), e2 ? 'STOP ERR ' + e2.message : 'OK');
process.exit(0);
