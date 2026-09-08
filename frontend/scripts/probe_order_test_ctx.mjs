// Probe read-only: rottamazione_config + prodotti VOOM pod + stock
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);
const { error: aerr } = await sb.auth.signInWithPassword({ email: 'gdeintinis@gmail.com', password: 'GabrieleDeIntinis123!' });
if (aerr) { console.error('AUTH FAIL', aerr.message); process.exit(1); }

const { data: cfg } = await sb.from('rottamazione_config').select('*');
console.log('rottamazione_config:', JSON.stringify(cfg));

const { data: prods, error: pe } = await sb.from('products')
  .select('id, name, unit_price, stock_quantity, is_active, rottamazione_no, cashback_eligible, estero, iva_percentage')
  .ilike('name', '%pod%').eq('is_active', true).order('name');
if (pe) console.error('prod err', pe.message);
for (const p of prods || []) console.log(`PROD ${p.name} | €${p.unit_price} | stock=${p.stock_quantity} | rott_no=${p.rottamazione_no} | estero=${p.estero}`);
process.exit(0);
