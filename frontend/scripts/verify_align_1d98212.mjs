// Verifica allineamento commit: colonne km_*, ricerca per denominazione registro, crm name lookup
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const supabase = createClient(url, key);

const { error: aerr } = await supabase.auth.signInWithPassword({ email: 'tadini@voomweb.it', password: 'Tadini2025!' });
if (aerr) { console.error('AUTH FAIL:', aerr.message); process.exit(1); }

// 1. Colonne km_urban/km_extra/km_highway su ai_tours (migration 20260917)
const { data: t1, error: e1 } = await supabase.from('ai_tours').select('id, km_urban, km_extra, km_highway').limit(1);
console.log('1) colonne km ai_tours:', e1 ? 'ERR ' + e1.message : 'OK ' + JSON.stringify(t1));

// 2. Ricerca per denominazione registro -> scheda CRM collegata (es. Fossati)
const { data: tabs, error: e2 } = await supabase
  .from('tabaccherie').select('id, denominazione, customer_id')
  .ilike('denominazione', '%fossati%').not('customer_id', 'is', null).limit(5);
console.log('2) tabaccherie "fossati" con CRM:', e2 ? 'ERR ' + e2.message : JSON.stringify(tabs));
if (tabs && tabs.length > 0) {
  const ids = tabs.map((t) => t.id).join(',');
  const { data: cust, error: e3 } = await supabase
    .from('customers').select('id, business_name, tabaccheria_id')
    .or(`business_name.ilike.%fossati%,tabaccheria_id.in.(${ids})`).limit(5);
  console.log('   ricerca clienti estesa:', e3 ? 'ERR ' + e3.message : JSON.stringify(cust));
}

// 3. Lookup crm name per orfani (customers select su id collegati)
const { data: orph } = await supabase.from('tabaccherie').select('id, denominazione, customer_id').not('customer_id', 'is', null).limit(3);
if (orph && orph.length) {
  const { data: linked, error: e4 } = await supabase.from('customers').select('id, business_name').in('id', orph.map((o) => o.customer_id));
  console.log('3) crm names lookup:', e4 ? 'ERR ' + e4.message : `OK ${linked?.length ?? 0} leggibili su ${orph.length}`);
}

// 4. Colonna entity_type patchabile (solo lettura per verifica esistenza stop schema)
const { error: e5 } = await supabase.from('ai_tour_stops').select('id, entity_type, customer_id').limit(1);
console.log('4) ai_tour_stops schema:', e5 ? 'ERR ' + e5.message : 'OK');
process.exit(0);
