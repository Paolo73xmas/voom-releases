import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const supabase = createClient(url, key);
await supabase.auth.signInWithPassword({ email: 'roberto.beretta@voomweb.it', password: 'Roberto123!' });
const { data: tours, error: terr } = await supabase.from('ai_tours').select('id, status, tour_date, created_at').eq('status', 'active');
if (terr) console.log('ERR:', terr.message);
console.log(JSON.stringify(tours, null, 1));
for (const t of tours || []) {
  const { data: ev } = await supabase.from('ai_tour_events').select('event_type, created_at').eq('tour_id', t.id).order('created_at', { ascending: true }).limit(10);
  console.log('eventi:', JSON.stringify(ev));
  const { data: sk } = await supabase.from('ai_tour_stops').select('id, status, skip_reason').eq('tour_id', t.id).eq('status', 'skipped');
  console.log('saltate:', JSON.stringify(sk));
}
console.log('ora server:', new Date().toISOString());
process.exit(0);
