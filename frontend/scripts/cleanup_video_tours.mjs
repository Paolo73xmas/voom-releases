// Elenca ed elimina i tour di TEST salvati da tadini durante le registrazioni video (19/08, status planned).
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const supabase = createClient(url, key);

const { data: auth, error: aerr } = await supabase.auth.signInWithPassword({
  email: 'tadini@voomweb.it',
  password: 'Tadini2025!',
});
if (aerr) { console.error('AUTH FAIL:', aerr.message); process.exit(1); }
const uid = auth.user.id;

const { data: tours, error } = await supabase
  .from('ai_tours')
  .select('id, tour_date, status, created_at')
  .eq('agent_id', uid)
  .order('created_at', { ascending: false })
  .limit(20);
if (error) { console.error('ERR:', error.message); process.exit(1); }
console.log('tour recenti:', JSON.stringify(tours, null, 1));

const doDelete = process.argv.includes('--delete');
if (doDelete) {
  // elimina SOLO i tour planned del 2026-08-19 creati oggi dalle registrazioni
  const targets = tours.filter(t => t.status === 'planned' && t.tour_date === '2026-08-19');
  for (const t of targets) {
    await supabase.from('ai_tour_stops').delete().eq('tour_id', t.id);
    const { error: derr } = await supabase.from('ai_tours').delete().eq('id', t.id);
    console.log('delete', t.id, t.created_at, derr ? 'ERR ' + derr.message : 'OK');
  }
}
process.exit(0);
