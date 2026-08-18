// Verifica colonna agent_zones.alias (migration 59895b18) leggibile dal client mobile
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
const { data: auth } = await supabase.auth.signInWithPassword({ email: 'roberto.beretta@voomweb.it', password: 'Roberto123!' });
const { data, error } = await supabase.from('agent_zones').select('id, agent_id, zone_name, alias').eq('is_active', true).limit(5);
console.log('err:', error?.message || null, '| zone:', (data || []).map(z => ({ name: z.zone_name, alias: z.alias, mine: z.agent_id === auth.user.id })));
await supabase.auth.signOut();
