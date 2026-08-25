import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);
await supabase.auth.signInWithPassword({ email: 'tadini@voomweb.it', password: 'Tadini2025!' });
const { data: me } = await supabase.auth.getUser();
const cutoff = Date.now() - 3 * 3600 * 1000; // punti delle ultime 3 ore (i test)
const { error, count } = await supabase.from('app_4d4e73c9f0_gps_tracking')
  .delete({ count: 'exact' }).eq('user_id', me.user.id).gte('timestamp', cutoff);
console.log('gps rimossi:', error ? 'ERR ' + error.message : count);
process.exit(0);
