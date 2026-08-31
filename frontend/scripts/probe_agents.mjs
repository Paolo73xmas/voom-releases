// READ-ONLY: agenti con clienti + eventuale tour live attivo (per scegliere account test)
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const s = createClient(url, key);
await s.auth.signInWithPassword({ email: 'admin1@voomweb.it', password: 'Test123!' });

const { data: profs } = await s.from('profiles').select('id, email, full_name, role').in('role', ['agent', 'supervisor']);
for (const p of profs || []) {
  const { count } = await s.from('customers').select('id', { count: 'exact', head: true }).eq('agent_id', p.id);
  if (!count) continue;
  const { data: live } = await s.from('ai_tours').select('id, status').eq('agent_id', p.id).in('status', ['active', 'paused']).limit(1);
  console.log(`${p.email} (${p.full_name}) → ${count} clienti, live: ${live?.length ? live[0].status : 'no'}`);
}
process.exit(0);
