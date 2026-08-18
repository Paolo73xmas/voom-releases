import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const supabase = createClient(url, key);

const { data: auth, error: aerr } = await supabase.auth.signInWithPassword({
  email: 'roberto.beretta@voomweb.it',
  password: 'Roberto123!',
});
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }
const uid = auth.user.id;
const today = new Date().toISOString().slice(0, 10);

// 1) Ripristino contatti cliente di test (originali: mobile vuoto, email stellaefa@yahoo.it)
const { data: cust } = await supabase.from('customers').select('id, business_name, contact_mobile, contact_email').eq('contact_email', 'test.aitour@voomweb.it');
console.log('clienti con email di test:', cust?.length ?? 0);
for (const c of cust || []) {
  console.log('  ->', c.business_name, '| mobile:', c.contact_mobile);
  const { error } = await supabase.from('customers').update({ contact_mobile: null, contact_email: 'stellaefa@yahoo.it' }).eq('id', c.id);
  console.log('  ripristino contatti:', error ? 'ERR ' + error.message : 'OK');
}

// 2) Tour di test di oggi (eventi, stops, tour)
const { data: tours } = await supabase.from('ai_tours').select('id, status, created_at').eq('agent_id', uid).gte('created_at', today + 'T00:00:00');
console.log('tour di test da eliminare:', tours?.length ?? 0);
for (const t of tours || []) {
  await supabase.from('ai_tour_events').delete().eq('tour_id', t.id);
  await supabase.from('ai_tour_stops').delete().eq('tour_id', t.id);
  const { error } = await supabase.from('ai_tours').delete().eq('id', t.id);
  console.log('  deleted tour', t.id, t.status, error ? 'ERR ' + error.message : 'OK');
}

// 3) Visite CRM create dall'esito di test oggi (notes [AI Tour]%)
const { data: vis } = await supabase.from('visits').select('id, notes').eq('agent_id', uid).like('notes', '[AI Tour]%').gte('created_at', today + 'T00:00:00');
console.log('visite [AI Tour] di oggi:', vis?.length ?? 0);
for (const v of vis || []) {
  const { error } = await supabase.from('visits').delete().eq('id', v.id);
  console.log('  deleted visit', v.id, error ? 'ERR ' + error.message : 'OK');
}

// 4) GPS heartbeat di oggi
const { error: gerr } = await supabase.from('app_4d4e73c9f0_gps_tracking').delete().eq('user_id', uid).gte('created_at', today + 'T00:00:00');
console.log('gps cleanup:', gerr ? 'ERR ' + gerr.message : 'OK');

// Verifica finale
const { data: left } = await supabase.from('ai_tours').select('id').eq('agent_id', uid).in('status', ['active']);
const { data: c2 } = await supabase.from('customers').select('id').eq('contact_email', 'test.aitour@voomweb.it');
console.log('tour attivi residui:', left?.length ?? 0, '| clienti con email test residui:', c2?.length ?? 0);
process.exit(0);
