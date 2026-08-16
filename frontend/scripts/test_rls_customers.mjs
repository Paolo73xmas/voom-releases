import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim() || env.match(/EXPO_PUBLIC_SUPABASE_KEY=(.+)/)?.[1]?.trim();

const supabase = createClient(url, key);

const { data: auth, error: aerr } = await supabase.auth.signInWithPassword({
  email: 'gdeintinis@gmail.com',
  password: 'GabrieleDeIntinis123!',
});
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }
const userId = auth.user.id;
console.log('Logged in as agent:', userId);

// Old query (eq agent_id)
const { data: oldQ } = await supabase.from('customers').select('id', { count: 'exact' }).eq('agent_id', userId);
console.log('OLD query (eq agent_id):', oldQ?.length ?? 0);

// New query (or agent_id / null)
const { data: newQ } = await supabase.from('customers').select('id, business_name, agent_id').or(`agent_id.eq.${userId},agent_id.is.null`).order('business_name').limit(2000);
console.log('NEW query (own + unassigned):', newQ?.length ?? 0);
const own = newQ?.filter(c => c.agent_id === userId).length;
const unassigned = newQ?.filter(c => c.agent_id === null).length;
console.log('  own:', own, '| unassigned:', unassigned);
console.log('  sample:', newQ?.slice(0, 3).map(c => c.business_name));

// Pure RLS (no filter)
const { data: rlsQ } = await supabase.from('customers').select('id').limit(2000);
console.log('Pure RLS (no filter):', rlsQ?.length ?? 0);
process.exit(0);
