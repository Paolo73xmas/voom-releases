import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth } = await supabase.auth.signInWithPassword({ email: 'gdeintinis@gmail.com', password: 'GabrieleDeIntinis123!' });
// Box piccolissimo (~5km) attorno a Tivoli, limite 5
const args = { p_min_lat: 41.94, p_max_lat: 41.99, p_min_lng: 12.75, p_max_lng: 12.82, p_limit: 5, p_provincia: null, p_comune: null, p_ref_lat: 41.96, p_ref_lng: 12.79, p_agent_id: null };
const t0 = Date.now();
const r = await supabase.rpc('ai_tour_free_tabaccherie', args);
console.log('box piccolo:', r.error ? 'ERR ' + r.error.message : `${r.data.length} righe`, `in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await supabase.auth.signOut();
