import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const supabase = createClient(url, key);

const { data: auth, error: aerr } = await supabase.auth.signInWithPassword({
  email: 'gdeintinis@gmail.com',
  password: 'GabrieleDeIntinis123!',
});
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }
const uid = auth.user.id;

// 1. Badge: count tour planned >= oggi
const today = new Date().toISOString().slice(0, 10);
const { count, error: e1 } = await supabase.from('ai_tours').select('id', { count: 'exact', head: true }).eq('agent_id', uid).eq('status', 'planned').gte('tour_date', today);
console.log('badge planned count:', e1 ? 'ERR ' + e1.message : count);

// 2. Orphan map paginata (parità web fix 9aa8b56)
const PAGE = 1000;
let from = 0;
const map = new Map();
for (;;) {
  const { data, error } = await supabase.rpc('get_orphan_tabaccherie_ids', { p_orphan_a_days: 90, p_orphan_b_days: 180 }).range(from, from + PAGE - 1);
  if (error) { console.error('RPC ERR', error.message); break; }
  const rows = Array.isArray(data) ? data : [];
  for (const r of rows) map.set(r.tabaccheria_id, r.orphan_status);
  console.log(`  pagina from=${from}: ${rows.length} righe`);
  if (rows.length < PAGE) break;
  from += PAGE;
}
console.log('orphan map totale (paginata):', map.size);
process.exit(0);
