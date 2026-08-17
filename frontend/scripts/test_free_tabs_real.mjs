import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth } = await supabase.auth.signInWithPassword({ email: 'gdeintinis@gmail.com', password: 'GabrieleDeIntinis123!' });
// Box che l'app usa per Sviluppo con 0 candidati propri: partenza Via del Corso ±0.09
const args = { p_min_lat: 41.815, p_max_lat: 41.995, p_min_lng: 12.388, p_max_lng: 12.568, p_limit: 80, p_provincia: null, p_comune: null, p_ref_lat: 41.905, p_ref_lng: 12.478, p_agent_id: auth.user.id };
const t0 = Date.now();
const r = await supabase.rpc('ai_tour_free_tabaccherie', args);
console.log('box generazione reale:', r.error ? 'ERR ' + r.error.message : `${r.data.length} righe`, `in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await supabase.auth.signOut();
