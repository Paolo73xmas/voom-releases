/* Iteration 67 discovery: verify Igor territory and pick a REAL comune with >=1 cliente/orfano idoneo >=30gg. */
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { build } = require('/usr/lib/node_modules/esbuild');
const { createClient } = require('/app/frontend/node_modules/@supabase/supabase-js');

async function main() {
  process.loadEnvFile('/app/frontend/.env');
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env mancanti');

  const creds = readFileSync('/app/memory/test_credentials.md', 'utf8').match(/# Role: Admin\s*email:\s*(.+)\s*password:\s*(.+)/i);
  if (!creds) throw new Error('Credenziali Admin non trovate in memory/test_credentials.md');
  const adminEmail = creds[1].trim();
  const adminPassword = creds[2].trim();

  const allowedRpcs = new Set([
    'ai_tour_order_stats',
    'ai_tour_contact_stats',
    'ai_tour_learned_durations',
    'ai_tour_no_interest_ids',
    'get_orphan_tabaccherie_ids',
    'ai_tour_free_tabaccherie',
  ]);

  const denied = [];
  const rawFetch = global.fetch;
  const guardedFetch = async (input, init = {}) => {
    const address = String(input);
    const parsed = new URL(address);
    const origin = new URL(url).origin;
    const method = (init.method || 'GET').toUpperCase();
    const path = parsed.pathname;
    const rpc = path.split('/rpc/')[1]?.split('?')[0];
    const auth = path === '/auth/v1/token' && method === 'POST';
    const read = ['GET', 'HEAD'].includes(method) && (path.startsWith('/rest/v1/') || path === '/auth/v1/user');
    const readonlyRpc = method === 'POST' && allowedRpcs.has(rpc);
    if (parsed.origin !== origin || !(auth || read || readonlyRpc)) {
      denied.push({ method, path });
      throw new Error(`Richiesta vietata dal guard readonly: ${method} ${path}`);
    }
    return rawFetch(input, init);
  };

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: guardedFetch },
  });

  const { error: loginError } = await client.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
  if (loginError) throw new Error(`Login admin fallito: ${loginError.message}`);

  global.__gptReadonlyClient = client;
  await build({
    stdin: {
      contents: `export { getSettings } from './lib/aitour/tours'; export { loadGptourPool } from './lib/aitour/gptour-data'; export { loadLatestPurchases } from './lib/aitour/gptour-purchases'; export { pointInZones } from './lib/aitour/territories'; export { daysSince } from './lib/aitour/types';`,
      resolveDir: '/app/frontend',
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: '/tmp/iter67-gptour-discovery-loader.cjs',
    plugins: [{
      name: 'real-supabase-client',
      setup(b) {
        b.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: 'readonly-client', namespace: 'readonly' }));
        b.onLoad({ filter: /.*/, namespace: 'readonly' }, () => ({ contents: 'export const supabase = globalThis.__gptReadonlyClient;', loader: 'js' }));
      },
    }],
  });

  const app = require('/tmp/iter67-gptour-discovery-loader.cjs');
  const { data: profiles, error: profilesError } = await client
    .from('profiles')
    .select('id,full_name,role')
    .in('role', ['agent', 'agentcustom'])
    .ilike('full_name', '%igor%cinquegrani%');
  if (profilesError) throw new Error(`Lookup profilo Igor fallito: ${profilesError.message}`);
  if (!profiles || profiles.length !== 1) throw new Error(`Profilo Igor ambiguo/assente (match=${profiles?.length || 0})`);

  const agent = profiles[0];
  const settings = await app.getSettings(agent.id);
  const pool = await app.loadGptourPool(agent.id, settings);

  const inZone = pool.candidates.filter((c) => app.pointInZones(c.lat, c.lng, pool.zones));
  const eligibleDomain = inZone.filter((c) => c.customerId && c.entityType !== 'prospect' && c.entityType !== 'free');
  const latest = await app.loadLatestPurchases(eligibleDomain.map((c) => c.customerId));

  const comuni = new Map();
  for (const c of eligibleDomain) {
    const row = latest.get(c.customerId);
    const days = app.daysSince(row?.order_date || null);
    const city = String(c.city || '').trim();
    if (!city || days == null || days < 30) continue;
    const keyCity = city.toLowerCase();
    const prev = comuni.get(keyCity) || { comune: city, idonei30gg: 0, clienti: 0, orfani: 0 };
    prev.idonei30gg += 1;
    if (c.entityType === 'orphan') prev.orfani += 1; else prev.clienti += 1;
    comuni.set(keyCity, prev);
  }

  const comuniSorted = [...comuni.values()].sort((a, b) => b.idonei30gg - a.idonei30gg || a.comune.localeCompare(b.comune));
  const chosenComune = comuniSorted.length ? comuniSorted[0].comune : null;

  const artifact = {
    timestamp: new Date().toISOString(),
    selected_agent_id: agent.id,
    territory_aggregates: {
      pooltotal: pool.candidates.length,
      zonecount: pool.zones.length,
      comuni_idonei30gg: comuniSorted,
      warnings: pool.warnings,
    },
    chosen_comune_verificato: chosenComune,
    limit_declared_if_zero: comuniSorted.length === 0,
    denied_requests: denied,
  };

  mkdirSync('/app/test_reports/artifacts_iter67', { recursive: true });
  writeFileSync('/app/test_reports/artifacts_iter67/iter67_igor_territory_discovery.json', JSON.stringify(artifact, null, 2));
  console.log(JSON.stringify({
    selected_agent_id: agent.id,
    pooltotal: pool.candidates.length,
    zonecount: pool.zones.length,
    eligible_comuni_30gg: comuniSorted.length,
    chosen_comune_verificato: chosenComune,
  }, null, 2));
}

main().catch((e) => {
  mkdirSync('/app/test_reports/artifacts_iter67', { recursive: true });
  const fail = { timestamp: new Date().toISOString(), error: e?.message || String(e) };
  writeFileSync('/app/test_reports/artifacts_iter67/iter67_igor_territory_discovery.json', JSON.stringify(fail, null, 2));
  console.error(e?.stack || e?.message || String(e));
  process.exitCode = 1;
});
