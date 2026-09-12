import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const supabase = createClient(url, key);

const { error: authErr } = await supabase.auth.signInWithPassword({
  email: 'admin1@voomweb.it',
  password: 'Test123!',
});
if (authErr) {
  console.error('AUTH FAIL', authErr.message);
  process.exit(1);
}

const { data: customers, error: cErr } = await supabase
  .from('customers')
  .select('id,business_name,created_at,notes')
  .ilike('business_name', 'TEST_AUDIT_20260912%')
  .order('created_at', { ascending: false });

if (cErr) {
  console.error('CUSTOMER LIST FAIL', cErr.message);
  process.exit(2);
}

const customerIds = (customers || []).map(c => c.id);
let appointments = [];
let visits = [];
if (customerIds.length) {
  const { data: appts } = await supabase
    .from('appointments')
    .select('id,customer_id,appointment_date,completed_at')
    .in('customer_id', customerIds)
    .order('appointment_date', { ascending: false });
  appointments = appts || [];

  const { data: vs } = await supabase
    .from('visits')
    .select('id,customer_id,visit_date,notes')
    .in('customer_id', customerIds)
    .order('visit_date', { ascending: false });
  visits = vs || [];
}

const out = {
  customers: customers || [],
  appointments,
  visits,
};
const path = '/app/test_reports/artifacts_iter30/fixture_entities_TEST_AUDIT_20260912.json';
fs.writeFileSync(path, JSON.stringify(out, null, 2));
console.log(path);
console.log(JSON.stringify(out));
