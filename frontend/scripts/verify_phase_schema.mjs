// Verifica schema/RPC produzione per le fasi 1-4 (operazioni live, ripasso, pausa pranzo, stamina)
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

// 1) Colonne ai_tour_stops (added_live/added_by_admin/preferred_slots)
{
  const { error } = await supabase.from('ai_tour_stops').select('id, added_live, added_by_admin, preferred_slots').limit(1);
  console.log('ai_tour_stops.added_live/added_by_admin ->', error ? `ERR: ${error.message}` : 'OK');
}
// 2) Colonne ai_tours lunch
{
  const { error } = await supabase.from('ai_tours').select('id, lunch_break_start, lunch_break_end, lunch_break_minutes').limit(1);
  console.log('ai_tours.lunch_break_* ->', error ? `ERR: ${error.message}` : 'OK');
}
// 3) ai_tour_settings.lunch_break_minutes
{
  const { data, error } = await supabase.from('ai_tour_settings').select('lunch_break_minutes').limit(1);
  console.log('ai_tour_settings.lunch_break_minutes ->', error ? `ERR: ${error.message}` : `OK: ${JSON.stringify(data)}`);
}
// 4) customers.excluded_visit_days
{
  const { error } = await supabase.from('customers').select('id, excluded_visit_days').limit(1);
  console.log('customers.excluded_visit_days ->', error ? `ERR: ${error.message}` : 'OK');
}
// 5) RPC agent_own_stamina
{
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const { data, error } = await supabase.rpc('agent_own_stamina', { p_day: today });
  console.log('rpc agent_own_stamina ->', error ? `ERR: ${error.message}` : `OK: ${JSON.stringify(data)}`);
}
// 6) RPC contatti estesa (excluded_visit_days nel RETURNS)
{
  const fake = '00000000-0000-0000-0000-000000000001';
  const { data, error } = await supabase.rpc('ai_tour_stop_customer_contacts', { p_stop_id: fake });
  console.log('rpc ai_tour_stop_customer_contacts ->', error ? `ERR: ${error.message}` : `OK (vuoto atteso): ${JSON.stringify(data)}`);
}
process.exit(0);
