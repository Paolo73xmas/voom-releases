// Cleanup completo test fase4: tour tadini creati oggi dai test + residuo roberto di stamattina + gps tracking di test
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();

async function wipeTour(supabase, id, label) {
  await supabase.from('ai_tour_events').delete().eq('tour_id', id);
  await supabase.from('ai_tour_stops').delete().eq('tour_id', id);
  const { error } = await supabase.from('ai_tours').delete().eq('id', id);
  console.log('wipe', label, id, error ? 'ERR ' + error.message : 'OK');
}

// --- TADINI ---
{
  const supabase = createClient(url, key);
  await supabase.auth.signInWithPassword({ email: 'tadini@voomweb.it', password: 'Tadini2025!' });
  const today = new Date().toISOString().slice(0, 10);
  const { data: tours } = await supabase.from('ai_tours').select('id, start_label, status, created_at')
    .gte('created_at', `${today}T15:00:00Z`); // i test sono iniziati dopo le 16:30Z
  for (const t of tours || []) await wipeTour(supabase, t.id, `tadini ${t.start_label} (${t.status})`);
  // gps tracking scritti dai beat del live di test (oggi)
  const { data: me } = await supabase.auth.getUser();
  const { error: gpsErr, count } = await supabase.from('app_4d4e73c9f0_gps_tracking')
    .delete({ count: 'exact' }).eq('agent_id', me.user.id).gte('recorded_at', `${today}T15:00:00Z`);
  console.log('gps tadini rimossi:', gpsErr ? 'ERR ' + gpsErr.message : count);
  const { data: act } = await supabase.from('ai_tours').select('id').eq('status', 'active');
  console.log('tadini active residui:', (act || []).length);
  await supabase.auth.signOut();
}

// --- ROBERTO (residuo test di stamattina f2a2c9c8) ---
{
  const supabase = createClient(url, key);
  await supabase.auth.signInWithPassword({ email: 'roberto.beretta@voomweb.it', password: 'Roberto123!' });
  await wipeTour(supabase, 'f2a2c9c8-0752-439b-82fc-b446ecb6233e', 'roberto residuo');
  const { data: act } = await supabase.from('ai_tours').select('id').eq('status', 'active');
  console.log('roberto active residui:', (act || []).length);
  await supabase.auth.signOut();
}
process.exit(0);
