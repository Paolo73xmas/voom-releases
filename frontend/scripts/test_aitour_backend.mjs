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
const uid = auth.user.id;
console.log('agent:', uid);

// 1. RPC ai_tour_order_stats
const { data: os, error: e1 } = await supabase.rpc('ai_tour_order_stats', { p_customer_ids: ['00000000-0000-0000-0000-000000000000'] });
console.log('ai_tour_order_stats:', e1 ? 'ERR ' + e1.message : 'OK rows=' + (os?.length ?? 0));

// 2. RPC ai_tour_learned_durations
const { data: ld, error: e2 } = await supabase.rpc('ai_tour_learned_durations', { p_agent_id: uid });
console.log('ai_tour_learned_durations:', e2 ? 'ERR ' + e2.message : 'OK rows=' + (ld?.length ?? 0));

// 3. RPC ai_tour_free_tabaccherie (bounding box Roma ampia)
const { data: ft, error: e3 } = await supabase.rpc('ai_tour_free_tabaccherie', {
  p_min_lat: 41.5, p_max_lat: 42.2, p_min_lng: 12.1, p_max_lng: 13.0,
  p_limit: 10, p_provincia: null, p_comune: null, p_ref_lat: 41.9, p_ref_lng: 12.5, p_agent_id: uid,
});
console.log('ai_tour_free_tabaccherie:', e3 ? 'ERR ' + e3.message : 'OK rows=' + (ft?.length ?? 0), ft?.slice(0, 2).map(t => `${t.denominazione} (${t.assigned ? 'never' : 'free'})`));

// 4. RPC get_orphan_tabaccherie_ids
const { data: om, error: e4 } = await supabase.rpc('get_orphan_tabaccherie_ids', { p_orphan_a_days: 90, p_orphan_b_days: 180 });
console.log('get_orphan_tabaccherie_ids:', e4 ? 'ERR ' + e4.message : 'OK rows=' + (om?.length ?? 0));

// 5. Tabelle ai_tours / ai_tour_settings / agent_zones
const { error: e5 } = await supabase.from('ai_tours').select('id').limit(1);
console.log('ai_tours table:', e5 ? 'ERR ' + e5.message : 'OK');
const { data: st, error: e6 } = await supabase.from('ai_tour_settings').select('*').eq('agent_id', uid).maybeSingle();
console.log('ai_tour_settings:', e6 ? 'ERR ' + e6.message : 'OK ' + (st ? 'custom' : 'default'));
const { data: az, error: e7 } = await supabase.from('agent_zones').select('id, agent_id, zone_name, coordinates').eq('is_active', true).limit(5);
console.log('agent_zones:', e7 ? 'ERR ' + e7.message : 'OK rows=' + (az?.length ?? 0), az?.map(z => `${z.zone_name}(${z.agent_id === uid ? 'mia' : 'altro'})`));

// 6. RPC comune centroid (geocode fallback)
const { data: cc, error: e8 } = await supabase.rpc('ai_tour_comune_centroid', { p_comune: 'Roma' });
console.log('ai_tour_comune_centroid:', e8 ? 'ERR ' + e8.message : 'OK ' + JSON.stringify(cc?.[0] || null));

// 7. Edge function ai-tour raggiungibile (recommend con stats fittizie)
try {
  const token = (await supabase.auth.getSession()).data.session?.access_token || '';
  const res = await fetch(url.replace(/\/$/, '') + '/functions/v1/ai-tour', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'recommend', payload: { clientsUrgent: 1, clientsOverdue30: 5, prospects: 2, prospectsInterested: 1, orphans: 3, orphansHighValue: 0, topAreas: [] } }),
  });
  const body = await res.text();
  console.log('edge fn ai-tour:', res.status, body.slice(0, 160));
} catch (e) {
  console.log('edge fn ai-tour: FETCH ERR', e.message);
}
process.exit(0);
