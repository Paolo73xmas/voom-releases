import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);
await supabase.auth.signInWithPassword({ email: 'tadini@voomweb.it', password: 'Tadini2025!' });
const { data: tours } = await supabase.from('ai_tours').select('*').eq('start_label','TEST SINTETICO OPS');
if (!tours?.length) { console.log('no synth tour'); process.exit(0); }
const t = tours[0]; console.log('TOUR keys:', Object.keys(t));
console.log('  status=',t.status,'lunch_break_start=',t.lunch_break_start,'lunch_break_end=',t.lunch_break_end,'lunch_break_minutes=',t.lunch_break_minutes);
const { data: s } = await supabase.from('ai_tour_stops').select('*').eq('tour_id', t.id).order('actual_sequence');
console.log('STOPS count=', s?.length);
if (s?.length) console.log('  STOP keys:', Object.keys(s[0]));
for (const row of s||[]) console.log(' ', 'seq_act=', row.actual_sequence, 'seq_plan=', row.planned_sequence, row.business_name, 'status=', row.status, 'added_live=', row.added_live);
const { data: ev } = await supabase.from('ai_tour_events').select('*').eq('tour_id', t.id).order('created_at');
console.log('EVENTS count=', ev?.length);
if (ev?.length) console.log('  EV keys:', Object.keys(ev[0]));
for (const e of ev||[]) console.log('  E', e.created_at?.slice(11,19), e.event_type);
