// Verifica "un solo giro live": il sintetico deve essere stato chiuso da startLiveTour
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);
await supabase.auth.signInWithPassword({ email: 'tadini@voomweb.it', password: 'Tadini2025!' });

// Tour sintetico
const { data: synths } = await supabase.from('ai_tours').select('id, status, actual_end').eq('start_label', 'TEST SINTETICO FASE4');
const synth = synths?.[0];
console.log('sintetico:', synth?.id, 'status:', synth?.status, 'actual_end:', synth?.actual_end);
if (synth) {
  const { data: ev } = await supabase.from('ai_tour_events').select('event_type, details').eq('tour_id', synth.id).order('created_at');
  const closed = (ev || []).find((e) => e.event_type === 'closed_by_new_tour');
  console.log('closed_by_new_tour:', closed ? JSON.stringify(closed.details) : 'MANCANTE');
  const { data: st } = await supabase.from('ai_tour_stops').select('business_name, status, skip_reason').eq('tour_id', synth.id);
  const auto = (st || []).filter((s) => s.skip_reason === 'Giro chiuso automaticamente: avviato un nuovo tour');
  console.log(`tappe chiuse automaticamente: ${auto.length} (${auto.map((s) => s.business_name).join(', ')})`);
}

// Tour attivi rimasti (deve essere 1: il nuovo)
const { data: actives } = await supabase.from('ai_tours').select('id, start_label, tour_date, area_filter, created_at').eq('status', 'active');
console.log('tour active adesso:', (actives || []).length);
for (const a of actives || []) console.log('-', a.id, a.start_label, a.tour_date, 'area_filter:', JSON.stringify(a.area_filter));
process.exit(0);
