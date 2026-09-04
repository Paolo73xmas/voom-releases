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

// Random 11-digit VAT
const rndVat = () => String(Math.floor(10000000000 + Math.random() * 89999999999));

const now = new Date();
const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
const past7 = new Date(now); past7.setDate(past7.getDate() - 7);

const fmt = (d) => d.toISOString().slice(0, 10);
const tomorrowDate = fmt(tomorrow);
const past7Date = fmt(past7);

console.log('tomorrow:', tomorrowDate, 'past7:', past7Date);

// Create customer 1
const c1Payload = {
  agent_id: uid,
  business_name: 'TEST FollowUp Bar',
  city: 'Milano',
  province: 'MI',
  address: 'Via Test 1',
  latitude: 45.4642,
  longitude: 9.19,
  vat_number: rndVat(),
  fiscal_code: rndVat(),
  postal_code: '20100',
  contact_name: 'Test',
  contact_surname: 'Test',
  notes: 'TEST DATA - auto-cleanup',
  customer_type: 'bar',
  category: 'prospect',
  first_visit_date: new Date().toISOString().slice(0,10),
  last_visit_date: new Date().toISOString().slice(0,10),
};
const { data: c1, error: c1e } = await supabase.from('customers').insert(c1Payload).select('*').single();
if (c1e) { console.error('cust1 err:', c1e); process.exit(2); }
console.log('customer1 created:', c1.id, c1.business_name);

const c2Payload = {
  agent_id: uid,
  business_name: 'TEST Overdue Tabacchi',
  city: 'Milano',
  province: 'MI',
  address: 'Via Test 2',
  latitude: 45.47,
  longitude: 9.20,
  vat_number: rndVat(),
  fiscal_code: rndVat(),
  postal_code: '20100',
  contact_name: 'Test',
  contact_surname: 'Test',
  notes: 'TEST DATA - auto-cleanup',
  customer_type: 'bar',
  category: 'prospect',
  first_visit_date: new Date().toISOString().slice(0,10),
  last_visit_date: new Date().toISOString().slice(0,10),
};
const { data: c2, error: c2e } = await supabase.from('customers').insert(c2Payload).select('*').single();
if (c2e) { console.error('cust2 err:', c2e); process.exit(3); }
console.log('customer2 created:', c2.id, c2.business_name);

// Create appointments
const a1Payload = {
  agent_id: uid,
  customer_id: c1.id,
  appointment_date: `${tomorrowDate}T10:00:00`,
  appointment_type: 'follow_up',
  status: 'scheduled',
  follow_up_reason: 'Test follow-up mobile',
  created_by_id: uid,
};
const { data: a1, error: a1e } = await supabase.from('appointments').insert(a1Payload).select('*').single();
if (a1e) { console.error('appt1 err:', a1e); process.exit(4); }
console.log('appt1 (tomorrow 10:00):', a1.id);

const a2Payload = {
  agent_id: uid,
  customer_id: c2.id,
  appointment_date: `${past7Date}T11:00:00`,
  appointment_type: 'follow_up',
  status: 'scheduled',
  follow_up_reason: 'Test scaduto mobile',
  created_by_id: uid,
};
const { data: a2, error: a2e } = await supabase.from('appointments').insert(a2Payload).select('*').single();
if (a2e) { console.error('appt2 err:', a2e); process.exit(5); }
console.log('appt2 (past7 11:00):', a2.id);

// Save IDs to file for cleanup
fs.writeFileSync('/tmp/test_seed_ids.json', JSON.stringify({
  agent_id: uid,
  customer1_id: c1.id,
  customer2_id: c2.id,
  appt1_id: a1.id,
  appt2_id: a2.id,
  tomorrow: tomorrowDate,
  past7: past7Date,
}, null, 2));
console.log('SEED OK -> /tmp/test_seed_ids.json');
process.exit(0);
