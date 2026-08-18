import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const supabase = createClient(url, key);

const { error: aerr } = await supabase.auth.signInWithPassword({
  email: 'roberto.beretta@voomweb.it',
  password: 'Roberto123!',
});
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }

const fake = '00000000-0000-0000-0000-000000000001';
for (const fn of ['ai_tour_stop_customer_contacts', 'ai_tour_reassign_orphan', 'ai_tour_refresh_customer_status']) {
  const { data, error } = await supabase.rpc(fn, { p_stop_id: fake });
  console.log(fn, '->', error ? `ERR: ${error.message}` : `OK: ${JSON.stringify(data)}`);
}
process.exit(0);
