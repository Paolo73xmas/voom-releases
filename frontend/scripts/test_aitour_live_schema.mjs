import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const supabase = createClient(url, key);

const { data: auth, error: aerr } = await supabase.auth.signInWithPassword({
  email: 'gdeintinis@gmail.com',
  password: 'GabrieleDeIntinis123!',
});
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }
const uid = auth.user.id;

// 1. Colonne live su ai_tours
const { error: e1 } = await supabase.from('ai_tours').select('id, actual_start, actual_end, last_lat, last_lng, last_position_at, route_geometry').limit(1);
console.log('ai_tours live cols:', e1 ? 'ERR ' + e1.message : 'OK');

// 2. Colonne live su ai_tour_stops
const { error: e2 } = await supabase.from('ai_tour_stops').select('id, actual_arrival, actual_end, actual_duration_minutes, outcome, outcome_note, follow_up_date, skip_reason, actual_sequence, tabaccheria_id, status').limit(1);
console.log('ai_tour_stops live cols:', e2 ? 'ERR ' + e2.message : 'OK');

// 3. ai_tour_events insert-ready (select per esistenza)
const { error: e3 } = await supabase.from('ai_tour_events').select('id').limit(1);
console.log('ai_tour_events:', e3 ? 'ERR ' + e3.message : 'OK');

// 4. GPS tracking table
const { error: e4 } = await supabase.from('app_4d4e73c9f0_gps_tracking').select('id').eq('user_id', uid).limit(1);
console.log('gps_tracking:', e4 ? 'ERR ' + e4.message : 'OK');

// 5. visits + appointments (per esiti/follow-up)
const { error: e5 } = await supabase.from('visits').select('id').limit(1);
console.log('visits:', e5 ? 'ERR ' + e5.message : 'OK');
const { error: e6 } = await supabase.from('appointments').select('id').limit(1);
console.log('appointments:', e6 ? 'ERR ' + e6.message : 'OK');

// 6. Nessun tour attivo residuo per l'agente di test
const { data: act } = await supabase.from('ai_tours').select('id, status, tour_date').eq('agent_id', uid).eq('status', 'active');
console.log('tour attivi agente test:', act?.length ?? 0);
process.exit(0);
