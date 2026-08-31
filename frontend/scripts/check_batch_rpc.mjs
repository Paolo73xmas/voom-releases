// Verifica READ-ONLY: esiste la RPC save_tours_batch? (payload vuoto → eccezione PRIMA di ogni insert)
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('/app/frontend/.env', 'utf8');
const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
const s = createClient(url, key);
await s.auth.signInWithPassword({ email: 'admin1@voomweb.it', password: 'Test123!' });
const { error } = await s.rpc('save_tours_batch', { p_tours: [] });
if (!error) console.log('inatteso: nessun errore');
else if (/payload vuoto/.test(error.message)) console.log('RPC ESISTE (migrazione applicata):', error.message);
else console.log('RPC risposta:', error.message);
// Colonna name su ai_tours?
const { error: e2 } = await s.from('ai_tours').select('id, name').limit(1);
console.log('colonna ai_tours.name:', e2 ? 'MANCANTE → ' + e2.message : 'presente');
process.exit(0);
