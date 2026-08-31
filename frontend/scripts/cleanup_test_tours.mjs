// Cleanup: elimina i tour di TEST creati durante la verifica (account test gdeintinis)
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const s = createClient(url, key);
const { data: auth, error: aerr } = await s.auth.signInWithPassword({ email: 'gdeintinis@gmail.com', password: 'GabrieleDeIntinis123!' });
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }
const me = auth.user.id;
const { data: tours, error } = await s
  .from('ai_tours')
  .select('id, name, tour_date, status')
  .eq('agent_id', me)
  .in('name', ['Test Batch Mobile', 'Test Week Mobile']);
if (error) { console.error(error.message); process.exit(1); }
console.log('tour di test trovati:', tours.length);
for (const t of tours) {
  const { error: e1 } = await s.from('ai_tour_events').delete().eq('tour_id', t.id);
  const { error: e2 } = await s.from('ai_tour_stops').delete().eq('tour_id', t.id);
  const { error: e3 } = await s.from('ai_tours').delete().eq('id', t.id);
  console.log(`${t.tour_date} "${t.name}" → ${e3 ? 'ERR ' + e3.message : 'eliminato'}${e1 ? ' (events: ' + e1.message + ')' : ''}${e2 ? ' (stops: ' + e2.message + ')' : ''}`);
}
const { data: left } = await s.from('ai_tours').select('id').eq('agent_id', me).in('name', ['Test Batch Mobile', 'Test Week Mobile']);
console.log('rimasti dopo cleanup:', left?.length ?? '?');
process.exit(0);
