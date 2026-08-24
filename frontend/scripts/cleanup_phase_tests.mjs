// Cleanup dati di test fasi 1-4: mini-tour pausa + record stamina di prova.
// Uso: node scripts/cleanup_phase_tests.mjs probe | clean
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);
const { data: auth, error: aerr } = await supabase.auth.signInWithPassword({ email: 'tadini@voomweb.it', password: 'Tadini2025!' });
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }
const uid = auth.user.id;
console.log('uid:', uid);

const MINI_TOUR = 'f760c388-54d3-4f18-a138-2ec2cfb9c83b';
const mode = process.argv[2] || 'probe';

// 1) Mini-tour pausa
{
  const { data, error } = await supabase.from('ai_tours').select('id, status, start_label, tour_date').eq('id', MINI_TOUR);
  console.log('mini-tour:', error ? 'ERR ' + error.message : JSON.stringify(data));
  if (mode === 'clean' && data && data.length) {
    await supabase.from('ai_tour_events').delete().eq('tour_id', MINI_TOUR);
    await supabase.from('ai_tour_stops').delete().eq('tour_id', MINI_TOUR);
    const { error: derr } = await supabase.from('ai_tours').delete().eq('id', MINI_TOUR);
    console.log('mini-tour deleted:', derr ? 'ERR ' + derr.message : 'OK');
  }
}

// 2) Eventuali altri tour sintetici residui (TEST SINTETICO OPS)
{
  const { data } = await supabase.from('ai_tours').select('id, status, start_label, tour_date').eq('agent_id', uid).eq('start_label', 'TEST SINTETICO OPS');
  console.log('tour sintetici residui:', JSON.stringify(data));
  if (mode === 'clean' && data) {
    for (const t of data) {
      await supabase.from('ai_tour_events').delete().eq('tour_id', t.id);
      await supabase.from('ai_tour_stops').delete().eq('tour_id', t.id);
      const { error: derr } = await supabase.from('ai_tours').delete().eq('id', t.id);
      console.log('deleted', t.id, derr ? 'ERR ' + derr.message : 'OK');
    }
  }
}

// 3) Ricerca record stamina di prova: probe tabelle candidate
const candidates = [
  'agent_contribution_settings', 'agent_contributions', 'contribution_settings',
  'agent_stamina', 'stamina_settings', 'ai_tour_contributions', 'agent_daily_contributions',
  'contributions', 'agent_settings',
];
for (const t of candidates) {
  const { data, error } = await supabase.from(t).select('*').limit(3);
  if (!error) console.log(`TABLE ${t}:`, JSON.stringify(data));
  else if (!/does not exist|relation|find the table/i.test(error.message)) console.log(`TABLE ${t} ERR:`, error.message);
}

// 4) RPC stamina attuale
{
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const { data, error } = await supabase.rpc('agent_own_stamina', { p_day: today });
  console.log('agent_own_stamina:', error ? 'ERR ' + error.message : JSON.stringify(data));
}
process.exit(0);
