// Diagnose active tours for tadini + verify synthetic is present
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);
const { data: auth, error } = await supabase.auth.signInWithPassword({ email: 'tadini@voomweb.it', password: 'Tadini2025!' });
if (error) { console.error(error); process.exit(1); }
const uid = auth.user.id;
const today = new Date().toISOString().slice(0,10);
console.log('today =', today, 'uid =', uid);

const { data: tours } = await supabase.from('ai_tours').select('id,tour_date,start_time,end_time,start_label,status,actual_start,created_at').eq('agent_id', uid).order('created_at', { ascending: false }).limit(15);
console.log('recent tours:');
for (const t of tours || []) {
  console.log(`  ${t.id.slice(0,8)}  date=${t.tour_date}  ${t.start_time}-${t.end_time}  status=${t.status}  label="${t.start_label}"  created=${t.created_at?.slice(0,19)}`);
}

// stamina rpc
const { data: st, error: se } = await supabase.rpc('agent_own_stamina');
console.log('agent_own_stamina:', st, 'err:', se?.message);
