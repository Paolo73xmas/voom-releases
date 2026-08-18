// Pre-clean any active/orphan tour for roberto (today), so we can start a fresh test
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);
const { data: auth, error: aerr } = await supabase.auth.signInWithPassword({
  email: 'roberto.beretta@voomweb.it', password: 'Roberto123!',
});
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }
const uid = auth.user.id;
const today = new Date().toISOString().slice(0, 10);

const { data: tours } = await supabase.from('ai_tours').select('id, status').eq('agent_id', uid).eq('tour_date', today).eq('status', 'active');
console.log('active tours today:', tours?.length);
for (const t of tours || []) {
  await supabase.from('ai_tour_events').delete().eq('tour_id', t.id);
  await supabase.from('ai_tour_stops').delete().eq('tour_id', t.id);
  const { error } = await supabase.from('ai_tours').delete().eq('id', t.id);
  console.log('  deleted', t.id, error ? 'ERR ' + error.message : 'OK');
}
process.exit(0);
