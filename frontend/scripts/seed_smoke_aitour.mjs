import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);

const { data: auth, error: aerr } = await supabase.auth.signInWithPassword({
  email: 'gdeintinis@gmail.com',
  password: 'GabrieleDeIntinis123!',
});
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }
const uid = auth.user.id;
console.log('LOGIN OK agent_id=', uid);

const today = new Date().toISOString().slice(0, 10);
const rndVat = () => String(Math.floor(10000000000 + Math.random() * 89999999999));
const usedVats = new Set();
const uniqueVat = () => { let v; do { v = rndVat(); } while (usedVats.has(v)); usedVats.add(v); return v; };

const seeds = [
  { business_name: 'SMOKE Tappa 1', city: 'Milano',   province: 'MI', address: 'Via Smoke 1',  latitude: 45.464, longitude: 9.190, postal_code: '20100', phone: '3330000001' },
  { business_name: 'SMOKE Tappa 2', city: 'Milano',   province: 'MI', address: 'Via Smoke 2',  latitude: 45.466, longitude: 9.193, postal_code: '20100', phone: '3330000002' },
  { business_name: 'SMOKE Tappa 3', city: 'Milano',   province: 'MI', address: 'Via Smoke 3',  latitude: 45.468, longitude: 9.188, postal_code: '20100', phone: '3330000003' },
  { business_name: 'SMOKE Far 1',   city: 'Pavia',    province: 'PV', address: 'Via Smoke 4',  latitude: 45.185, longitude: 9.155, postal_code: '27100', phone: '3330000004' },
  { business_name: 'SMOKE Far 2',   city: 'Voghera',  province: 'PV', address: 'Via Smoke 5',  latitude: 44.993, longitude: 9.010, postal_code: '27058', phone: '3330000005' },
  { business_name: 'SMOKE Far 3',   city: 'Stradella',province: 'PV', address: 'Via Smoke 6',  latitude: 45.075, longitude: 9.300, postal_code: '27049', phone: '3330000006' },
];

const ids = [];
for (const s of seeds) {
  const vat = uniqueVat();
  const payload = {
    agent_id: uid,
    business_name: s.business_name,
    city: s.city,
    province: s.province,
    address: s.address,
    latitude: s.latitude,
    longitude: s.longitude,
    vat_number: vat,
    fiscal_code: vat,
    postal_code: s.postal_code,
    contact_name: 'Smoke',
    contact_surname: 'Test',
    contact_phone: s.phone,
    notes: 'TEST DATA',
    customer_type: 'bar',
    category: 'prospect',
    first_visit_date: today,
    last_visit_date: today,
  };
  const { data, error } = await supabase.from('customers').insert(payload).select('id, business_name').single();
  if (error) { console.error('INSERT FAIL', s.business_name, error); process.exit(2); }
  console.log('created', data.business_name, data.id);
  ids.push({ id: data.id, name: data.business_name });
}

fs.writeFileSync('/tmp/smoke_seed_ids.json', JSON.stringify({ agent_id: uid, customers: ids }, null, 2));
console.log('SEED OK -> /tmp/smoke_seed_ids.json');
process.exit(0);
