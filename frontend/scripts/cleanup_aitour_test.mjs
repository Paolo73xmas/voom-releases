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
const today = new Date().toISOString().slice(0, 10);

// Tour di test creati oggi dall'agente
const { data: tours } = await supabase.from('ai_tours').select('id, status, created_at').eq('agent_id', uid).gte('created_at', today + 'T00:00:00');
console.log('tour di test da eliminare:', tours?.length ?? 0);
for (const t of tours || []) {
  await supabase.from('ai_tour_events').delete().eq('tour_id', t.id);
  await supabase.from('ai_tour_stops').delete().eq('tour_id', t.id);
  const { error } = await supabase.from('ai_tours').delete().eq('id', t.id);
  console.log('  deleted tour', t.id, error ? 'ERR ' + error.message : 'OK');
}

// Visite CRM ai_tour create oggi dall'agente (se presenti)
const { data: vis } = await supabase.from('visits').select('id').eq('agent_id', uid).eq('visit_type', 'ai_tour').gte('created_at', today + 'T00:00:00');
console.log('visite ai_tour di oggi:', vis?.length ?? 0);
for (const v of vis || []) {
  const { error } = await supabase.from('visits').delete().eq('id', v.id);
  console.log('  deleted visit', v.id, error ? 'ERR ' + error.message : 'OK');
}

// GPS tracking di test di oggi
const { data: gps } = await supabase.from('app_4d4e73c9f0_gps_tracking').select('id').eq('user_id', uid).gte('created_at', today + 'T00:00:00');
console.log('gps points di oggi:', gps?.length ?? 0);
if ((gps || []).length > 0) {
  const { error } = await supabase.from('app_4d4e73c9f0_gps_tracking').delete().eq('user_id', uid).gte('created_at', today + 'T00:00:00');
  console.log('  gps cleanup:', error ? 'ERR ' + error.message : 'OK');
}

// Verifica finale
const { data: left } = await supabase.from('ai_tours').select('id').eq('agent_id', uid).gte('created_at', today + 'T00:00:00');
console.log('tour residui:', left?.length ?? 0);
process.exit(0);
