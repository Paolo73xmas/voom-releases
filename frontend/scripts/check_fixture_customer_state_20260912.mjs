import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const customerId = 'af5816d1-bc16-4b60-84d3-52bbf77a8f1b';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const supabase = createClient(url, key);

const { error: authErr } = await supabase.auth.signInWithPassword({
  email: 'gdeintinis@gmail.com',
  password: 'GabrieleDeIntinis123!',
});
if (authErr) {
  console.error('AUTH FAIL', authErr.message);
  process.exit(1);
}

const { data, error } = await supabase
  .from('customers')
  .select('id,business_name,contact_name,contact_surname,contact_phone,contact_email,address,city,province,postal_code,vat_number,fiscal_code,pec,sdi')
  .eq('id', customerId)
  .maybeSingle();

if (error) {
  console.error('QUERY FAIL', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data || null));
process.exit(0);
