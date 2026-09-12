import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
if (!url || !key) {
  console.error('Missing Supabase env values');
  process.exit(1);
}

const supabase = createClient(url, key);

const authEmail = 'gdeintinis@gmail.com';
const authPassword = 'GabrieleDeIntinis123!';

const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: authEmail,
  password: authPassword,
});

if (authErr || !auth?.user?.id) {
  console.error('AUTH FAIL', authErr?.message || 'No user');
  process.exit(2);
}

const uid = auth.user.id;
const tag = 'TEST_AUDIT_20260912';
const now = new Date();
const todayIso = now.toISOString();
const today = todayIso.slice(0, 10);
const appointmentDate = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

const rndDigits = () => String(Math.floor(10000000000 + Math.random() * 89999999999));
const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();

const customerPayload = {
  agent_id: uid,
  business_name: `${tag}_${suffix}`,
  city: 'Roma',
  province: 'RM',
  address: 'Via Test Audit 12',
  postal_code: '00100',
  latitude: 41.9028,
  longitude: 12.4964,
  vat_number: rndDigits(),
  fiscal_code: rndDigits().slice(0, 16),
  contact_name: 'Test',
  contact_surname: 'Audit',
  contact_phone: null,
  contact_email: 'test.audit.20260912@example.com',
  notes: `${tag} fixture - delete by manifest`,
  customer_type: 'tabaccheria',
  category: 'prospect',
  first_visit_date: today,
  last_visit_date: today,
};

const { data: customer, error: customerErr } = await supabase
  .from('customers')
  .insert(customerPayload)
  .select('*')
  .single();

if (customerErr || !customer?.id) {
  console.error('CUSTOMER INSERT FAIL', customerErr?.message || customerErr);
  process.exit(3);
}

const visitPayload = {
  customer_id: customer.id,
  agent_id: uid,
  visit_type: 'follow_up',
  visit_date: todayIso,
  notes: `${tag} visit fixture`,
  latitude: customer.latitude,
  longitude: customer.longitude,
};

const { data: visit, error: visitErr } = await supabase
  .from('visits')
  .insert(visitPayload)
  .select('id, visit_date')
  .single();

if (visitErr || !visit?.id) {
  console.error('VISIT INSERT FAIL', visitErr?.message || visitErr);
  process.exit(4);
}

const apptPayload = {
  customer_id: customer.id,
  agent_id: uid,
  created_by_id: uid,
  appointment_type: 'follow_up',
  appointment_date: appointmentDate,
  duration_minutes: 45,
  status: 'scheduled',
  notes: `${tag} appointment fixture`,
  follow_up_reason: 'QA fixture',
};

const { data: appointment, error: apptErr } = await supabase
  .from('appointments')
  .insert(apptPayload)
  .select('id, appointment_date, completed_at')
  .single();

if (apptErr || !appointment?.id) {
  console.error('APPOINTMENT INSERT FAIL', apptErr?.message || apptErr);
  process.exit(5);
}

const manifest = {
  fixture_tag: tag,
  created_at: new Date().toISOString(),
  agent_id: uid,
  customer: {
    id: customer.id,
    business_name: customer.business_name,
  },
  visit: {
    id: visit.id,
    visit_date: visit.visit_date,
  },
  appointment: {
    id: appointment.id,
    appointment_date: appointment.appointment_date,
    completed_at: appointment.completed_at,
  },
  order: null,
};

const manifestPath = '/app/test_reports/artifacts_iter30/fixture_manifest_TEST_AUDIT_20260912.json';
fs.mkdirSync('/app/test_reports/artifacts_iter30', { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`FIXTURE CREATED -> ${manifestPath}`);
console.log(JSON.stringify(manifest));
process.exit(0);
