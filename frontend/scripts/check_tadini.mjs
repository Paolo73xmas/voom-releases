import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const supabase = createClient(url, key);

const { data: auth, error: aerr } = await supabase.auth.signInWithPassword({
  email: 'tadini@voomweb.it',
  password: 'Tadini2025!',
});
if (aerr) { console.error('AUTH FAIL:', aerr.message); process.exit(1); }
console.log('login OK, uid:', auth.user.id);
const { data: prof } = await supabase.from('profiles').select('full_name, role').eq('id', auth.user.id).single();
console.log('profilo:', JSON.stringify(prof));
const { data: zones, error: zerr } = await supabase.from('agent_zones').select('id, alias').eq('agent_id', auth.user.id);
console.log('zone:', zerr ? 'ERR ' + zerr.message : JSON.stringify(zones?.map(z => z.alias || z.id.slice(0, 8))));
const { data: active } = await supabase.from('ai_tours').select('id, status').eq('agent_id', auth.user.id).eq('status', 'active');
console.log('tour attivi:', active?.length ?? 0);
process.exit(0);
