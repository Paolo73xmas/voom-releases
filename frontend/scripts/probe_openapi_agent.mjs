// Probe: la Edge Function openapi-invoice-proxy autorizza il ruolo agent per il lookup?
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const get = (k) => env.match(new RegExp(`${k}=(.*)`))?.[1]?.trim();
const URL_ = get('EXPO_PUBLIC_SUPABASE_URL');
const ANON = get('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const supabase = createClient(URL_, ANON);

const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: 'gdeintinis@gmail.com',
  password: 'GabrieleDeIntinis123!',
});
if (authErr) { console.log('LOGIN FAIL:', authErr.message); process.exit(1); }

const res = await fetch(`${URL_}/functions/v1/openapi-invoice-proxy`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: ANON,
    Authorization: `Bearer ${auth.session.access_token}`,
  },
  body: JSON.stringify({ action: 'company-start', query: '00905811006' }),
});
const text = await res.text();
console.log('HTTP', res.status);
console.log(text.slice(0, 400));
process.exit(0);
