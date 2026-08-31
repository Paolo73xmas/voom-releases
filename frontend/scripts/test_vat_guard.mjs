// Test READ-ONLY vat-guard: parse errori + RPC find_customer_by_vat con P.IVA reale
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Replica parseVatGuardError (il file TS non è importabile da node direttamente)
function parseVatGuardError(message) {
  if (!message) return null;
  if (message.includes('[VAT_PLACEHOLDER]')) return { type: 'placeholder' };
  const m = message.match(/\[VAT_DUPLICATE\|([0-9a-fA-F-]+)\|([^|\]]*)\|([^\]]*)\]/);
  if (m) return { type: 'duplicate', id: m[1], name: m[2], where: m[3] };
  return null;
}

const sample = "P.IVA gia' registrata su un'altra anagrafica [VAT_DUPLICATE|4376ba42-e099-4f8f-95a8-5f1db6ce7e35|Tabaccheria Rossi|Via Roma 1, L'Aquila]";
console.log('parse duplicate:', JSON.stringify(parseVatGuardError(sample)));
console.log('parse placeholder:', JSON.stringify(parseVatGuardError("P.IVA non valida: 11111111111 [VAT_PLACEHOLDER]")));
console.log('parse altro errore:', JSON.stringify(parseVatGuardError('network timeout')));

const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const s = createClient(url, key);
await s.auth.signInWithPassword({ email: 'admin1@voomweb.it', password: 'Test123!' });

// Prendi una P.IVA valida esistente e verifica che l'RPC la trovi
const { data: withVat } = await s.from('customers').select('id, business_name, vat_number').not('vat_number', 'is', null).neq('vat_number', '').limit(5);
const real = (withVat || []).find((c) => /^\d{11}$/.test(c.vat_number || '') && !/^(.)\1+$/.test(c.vat_number));
if (!real) { console.log('nessuna P.IVA reale trovata nel campione'); process.exit(0); }
const { data: hit, error } = await s.rpc('find_customer_by_vat', { p_vat: real.vat_number });
console.log('RPC con P.IVA reale:', error ? 'ERR ' + error.message : `trovate ${hit.length} schede, prima=${hit[0]?.business_name} (match id: ${hit.some((h) => h.id === real.id)})`);
// Placeholder deve tornare 0 righe
const { data: ph } = await s.rpc('find_customer_by_vat', { p_vat: '11111111111' });
console.log('RPC con placeholder 11111111111: righe =', ph?.length ?? 'ERR');
process.exit(0);
