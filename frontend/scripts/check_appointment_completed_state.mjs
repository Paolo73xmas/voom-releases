import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const appointmentId = process.argv[2];
if (!appointmentId) {
  console.error('Usage: node check_appointment_completed_state.mjs <appointmentId>');
  process.exit(1);
}

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const supabase = createClient(url, key);

const { error: authErr } = await supabase.auth.signInWithPassword({
  email: 'gdeintinis@gmail.com',
  password: 'GabrieleDeIntinis123!',
});
if (authErr) {
  console.error('AUTH FAIL', authErr.message);
  process.exit(2);
}

const { data, error } = await supabase
  .from('appointments')
  .select('id,appointment_date,completed_at,customer_id,notes')
  .eq('id', appointmentId)
  .maybeSingle();

if (error) {
  console.error('QUERY FAIL', error.message);
  process.exit(3);
}

console.log(JSON.stringify(data || null));
process.exit(0);
