// Pre-test DB probe as roberto: verify auth, list current tours, get target customer contacts snapshot
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);

const { data: auth, error: aerr } = await supabase.auth.signInWithPassword({
  email: 'roberto.beretta@voomweb.it',
  password: 'Roberto123!',
});
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }
const uid = auth.user.id;
console.log('AUTH OK uid=', uid);

const today = new Date().toISOString().slice(0, 10);

// Existing tours today (should be cleaned up if any pre-existing)
const { data: tours } = await supabase.from('ai_tours').select('id, status, created_at, tour_date').eq('agent_id', uid).eq('tour_date', today);
console.log('EXISTING tours today for roberto:', JSON.stringify(tours, null, 2));

// Active LIVE tours (any date)
const { data: liveTours } = await supabase.from('ai_tours').select('id, status, tour_date').eq('agent_id', uid).eq('status', 'live');
console.log('LIVE tours (any date):', JSON.stringify(liveTours, null, 2));

process.exit(0);
