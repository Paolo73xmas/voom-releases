import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
for (const acct of [['tadini@voomweb.it', 'Tadini2025!'], ['roberto.beretta@voomweb.it', 'Roberto123!']]) {
  const supabase = createClient(url, key);
  await supabase.auth.signInWithPassword({ email: acct[0], password: acct[1] });
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from('ai_tours').select('id, status, start_label, created_at').gte('created_at', `${today}T00:00:00Z`);
  console.log(acct[0], '-> tour creati oggi:', (data || []).length, JSON.stringify(data || []));
  await supabase.auth.signOut();
}
process.exit(0);
