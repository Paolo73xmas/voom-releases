// Verifica delta commit 9b8218b: visits accetta visit_type 'follow_up' + outcome mappato,
// mentre 'ai_tour' (vecchio codice) viene rifiutato dal check constraint.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email: 'gdeintinis@gmail.com', password: 'GabrieleDeIntinis123!' });
if (authErr) { console.error('login fail:', authErr.message); process.exit(1); }
const uid = auth.user.id;

const { data: cust } = await supabase.from('customers').select('id, business_name, latitude, longitude').not('latitude', 'is', null).limit(1);
if (!cust?.length) { console.error('nessun cliente'); process.exit(1); }
const c = cust[0];
console.log('cliente test:', c.business_name);

// 1) Vecchio codice: visit_type 'ai_tour' -> atteso FALLIMENTO (check constraint)
const oldIns = await supabase.from('visits').insert({
  customer_id: c.id, agent_id: uid, visit_type: 'ai_tour', visit_date: new Date().toISOString(),
  latitude: c.latitude, longitude: c.longitude, gps_accuracy: 0, notes: '[TEST-DELETE]', outcome: 'trattativa',
}).select('id');
console.log('vecchio codice (ai_tour):', oldIns.error ? `RIFIUTATO come atteso -> ${oldIns.error.message.slice(0, 80)}` : 'ACCETTATO (inatteso!)');
if (oldIns.data?.length) await supabase.from('visits').delete().eq('id', oldIns.data[0].id);

// 2) Nuovo codice: visit_type 'follow_up' + outcome mappato -> atteso SUCCESSO
const newIns = await supabase.from('visits').insert({
  customer_id: c.id, agent_id: uid, visit_type: 'follow_up', visit_date: new Date().toISOString(),
  latitude: c.latitude, longitude: c.longitude, gps_accuracy: 0,
  notes: '[TEST-DELETE] [AI Tour] Esito: trattativa', outcome: 'positive', next_appointment_date: null,
}).select('id');
if (newIns.error) { console.error('nuovo codice FALLITO:', newIns.error.message); process.exit(1); }
console.log('nuovo codice (follow_up/positive): INSERITO ok, id', newIns.data[0].id);
// cleanup
const del = await supabase.from('visits').delete().eq('id', newIns.data[0].id);
console.log('cleanup visita test:', del.error ? del.error.message : 'ok');
await supabase.auth.signOut();
