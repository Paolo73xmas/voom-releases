import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);
await supabase.auth.signInWithPassword({ email: 'tadini@voomweb.it', password: 'Tadini2025!' });
const { data, error } = await supabase.rpc('tabaccherie_points_in_bbox', {
  p_min_lat: 45.0, p_max_lat: 45.2, p_min_lng: 8.9, p_max_lng: 9.3, p_limit: 5000,
}).range(0, 9);
console.log(error ? 'RPC ERR: ' + error.message : `RPC OK, sample ${data.length} righe: ` + JSON.stringify(data.slice(0, 2)));
process.exit(0);
