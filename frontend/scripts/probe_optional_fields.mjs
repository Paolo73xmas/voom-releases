// Probe: verifica che customers.contact_email/contact_phone siano nullable e che
// il vincolo chk_customers_pec_or_sdi sia stato rimosso (migration web 20261003).
// Inserisce un cliente di test SENZA telefono/email/PEC/SDI e lo cancella subito.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const get = (k) => env.match(new RegExp(`${k}=(.*)`))?.[1]?.trim();
const supabase = createClient(get('EXPO_PUBLIC_SUPABASE_URL'), get('EXPO_PUBLIC_SUPABASE_ANON_KEY'));

const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: 'gdeintinis@gmail.com',
  password: 'GabrieleDeIntinis123!',
});
if (authErr) { console.log('LOGIN FAIL:', authErr.message); process.exit(1); }
console.log('login ok:', auth.user.id);

const { data: cust, error: insErr } = await supabase.from('customers').insert({
  business_name: 'PROBE OPTIONAL FIELDS (DELETE ME)',
  address: 'VIA TEST 1', city: 'MILANO', province: 'MI', postal_code: '20100',
  latitude: 45.46, longitude: 9.19,
  contact_name: 'PROBE', contact_surname: 'TEST',
  contact_phone: null, contact_email: null, pec: null, sdi: null,
  vat_number: '00000000000', fiscal_code: 'PRBTST00A01F205X',
  customer_type: 'tabaccheria', category: 'prospect',
  agent_id: auth.user.id, notes: 'probe campi facoltativi',
  first_visit_date: new Date().toISOString(), last_visit_date: new Date().toISOString(),
}).select('id').single();

if (insErr) {
  console.log('INSERT FAIL:', insErr.message);
} else {
  console.log('insert ok (campi facoltativi accettati):', cust.id);
  const { error: delErr } = await supabase.from('customers').delete().eq('id', cust.id);
  console.log(delErr ? `DELETE FAIL: ${delErr.message}` : 'cleanup ok');
}

// Verifica lettura area_filter + RPC no-interest
const { data: t, error: tErr } = await supabase.from('ai_tours').select('id, area_filter').limit(1);
console.log('area_filter select:', tErr ? `FAIL ${tErr.message}` : 'OK');
const { data: ni, error: niErr } = await supabase.rpc('ai_tour_no_interest_ids');
console.log('rpc no_interest:', niErr ? `FAIL ${niErr.message}` : `OK (${(ni || []).length} righe)`);
process.exit(0);
