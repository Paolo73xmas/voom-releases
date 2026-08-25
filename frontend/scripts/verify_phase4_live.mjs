// Verifica DB post-E2E live (tour sintetico FASE4 di tadini)
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);
await supabase.auth.signInWithPassword({ email: 'tadini@voomweb.it', password: 'Tadini2025!' });

const { data: tours } = await supabase.from('ai_tours')
  .select('id, status, end_time, area_filter, start_label')
  .eq('start_label', 'TEST SINTETICO FASE4');
const t = tours?.[0];
if (!t) { console.log('tour FASE4 non trovato'); process.exit(1); }
console.log('tour:', t.id, 'status:', t.status, 'end_time:', t.end_time);

const { data: ev } = await supabase.from('ai_tour_events').select('event_type, details').eq('tour_id', t.id).order('created_at');
console.log('eventi:', (ev || []).map((e) => e.event_type).join(', '));
const trashed = (ev || []).find((e) => e.event_type === 'stop_trashed');
const extended = (ev || []).find((e) => e.event_type === 'visits_extended');
const endExt = (ev || []).find((e) => e.event_type === 'end_time_extended');
const badRecalc = (ev || []).filter((e) => e.event_type === 'cancelled_by_recalc');
console.log('stop_trashed:', trashed ? JSON.stringify(trashed.details) : 'MANCANTE');
console.log('end_time_extended:', endExt ? JSON.stringify(endExt.details) : 'MANCANTE');
console.log('visits_extended:', extended ? JSON.stringify(extended.details) : 'MANCANTE');
console.log('cancelled_by_recalc (deve essere 0):', badRecalc.length);

const { data: stops } = await supabase.from('ai_tour_stops')
  .select('business_name, status, skip_reason, added_live')
  .eq('tour_id', t.id).order('actual_sequence');
for (const s of stops || []) {
  console.log(`- ${s.business_name} | ${s.status}${s.skip_reason ? ` | ${s.skip_reason}` : ''}${s.added_live ? ' | added_live' : ''}`);
}
process.exit(0);
