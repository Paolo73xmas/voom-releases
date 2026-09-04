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

// Find test customers by TEST prefix
const { data: cust } = await supabase.from('customers').select('id, business_name').eq('agent_id', uid).ilike('business_name', 'TEST%');
console.log('TEST customers found:', cust?.length ?? 0, cust?.map(c=>c.business_name));

const custIds = (cust || []).map(c => c.id);

// Delete appointments for these customers
if (custIds.length) {
  const { data: apts, error: aerr2 } = await supabase.from('appointments').select('id').in('customer_id', custIds);
  console.log('appointments to del:', apts?.length ?? 0);
  if (apts?.length) {
    const { error } = await supabase.from('appointments').delete().in('id', apts.map(a=>a.id));
    console.log('appts delete:', error?.message || 'OK');
  }
}

// Delete tours for gdeintinis (any status) - only ones created today or with TEST in name
const today = new Date().toISOString().slice(0, 10);
const { data: tours } = await supabase.from('ai_tours').select('id, name, created_at').eq('agent_id', uid);
console.log('tours found:', tours?.length ?? 0, tours);
for (const t of tours || []) {
  await supabase.from('ai_tour_events').delete().eq('tour_id', t.id);
  await supabase.from('ai_tour_stops').delete().eq('tour_id', t.id);
  const { error } = await supabase.from('ai_tours').delete().eq('id', t.id);
  console.log('  deleted tour', t.id, error?.message || 'OK');
}

// Delete customers
if (custIds.length) {
  const { error } = await supabase.from('customers').delete().in('id', custIds);
  console.log('customers delete:', error?.message || 'OK');
}

// Final verify
const { data: leftC } = await supabase.from('customers').select('id').eq('agent_id', uid).ilike('business_name', 'TEST%');
const { data: leftA } = await supabase.from('appointments').select('id').eq('agent_id', uid);
const { data: leftT } = await supabase.from('ai_tours').select('id').eq('agent_id', uid);
console.log('RESIDUALS: customers TEST:', leftC?.length ?? 0, 'appointments:', leftA?.length ?? 0, 'tours:', leftT?.length ?? 0);
process.exit(0);
