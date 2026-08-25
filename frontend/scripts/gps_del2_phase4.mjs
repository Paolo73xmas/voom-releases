import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);
await supabase.auth.signInWithPassword({ email: 'tadini@voomweb.it', password: 'Tadini2025!' });
const { data: me } = await supabase.auth.getUser();
// tutti i punti di oggi con le coordinate mock del test
const { data: rows } = await supabase.from('app_4d4e73c9f0_gps_tracking').select('id')
  .eq('user_id', me.user.id).eq('latitude', 45.0189881).eq('longitude', 7.6619132);
console.log('punti mock trovati:', (rows || []).length);
if (rows?.length) {
  const { error, count } = await supabase.from('app_4d4e73c9f0_gps_tracking')
    .delete({ count: 'exact' }).in('id', rows.map((r) => r.id));
  console.log('delete:', error ? 'ERR ' + error.message : count);
}
const { data: check } = await supabase.from('app_4d4e73c9f0_gps_tracking').select('id')
  .eq('user_id', me.user.id).eq('latitude', 45.0189881).eq('longitude', 7.6619132);
console.log('residui:', (check || []).length);
process.exit(0);
