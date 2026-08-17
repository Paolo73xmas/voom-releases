import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth } = await supabase.auth.signInWithPassword({ email: 'gdeintinis@gmail.com', password: 'GabrieleDeIntinis123!' });
const args = { p_min_lat: 41.8, p_max_lat: 42.1, p_min_lng: 12.4, p_max_lng: 12.9, p_limit: 20, p_provincia: null, p_comune: null, p_ref_lat: 41.95, p_ref_lng: 12.65 };
for (const [label, aid] of [['senza agent_id', null], ['con agent_id', auth.user.id]]) {
  const t0 = Date.now();
  const r = await supabase.rpc('ai_tour_free_tabaccherie', { ...args, p_agent_id: aid });
  console.log(label + ':', r.error ? 'ERR ' + r.error.message : `${r.data.length} righe (assigned: ${r.data.filter(x => x.assigned).length})`, `in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
await supabase.auth.signOut();
