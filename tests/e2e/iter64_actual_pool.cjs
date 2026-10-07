/* Diagnostic readonly: real app loaders, no copied pool algorithm, no persisted sessions/data. */
const { readFileSync, writeFileSync } = require('node:fs');
const { build } = require('/usr/lib/node_modules/esbuild');
const { createClient } = require('/app/frontend/node_modules/@supabase/supabase-js');

async function main() {
  process.loadEnvFile('/app/frontend/.env');
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const match = readFileSync('/app/memory/test_credentials.md', 'utf8').match(/# Role: Admin\s*email:\s*(.+)\s*password:\s*(.+)/);
  if (!match || !url || !key) throw new Error('Configurazione readonly mancante');
  const allowed = new Set(['ai_tour_order_stats', 'ai_tour_contact_stats', 'ai_tour_learned_durations', 'ai_tour_no_interest_ids', 'get_orphan_tabaccherie_ids', 'ai_tour_free_tabaccherie']);
  const rawFetch = global.fetch, cache = new Map(), pages = [], denied = [];
  let baseline = false, aiCalls = 0;
  const guardedFetch = async (input, init = {}) => {
    const address = String(input), parsed = new URL(address), method = (init.method || 'GET').toUpperCase();
    const path = parsed.pathname, rpc = path.split('/rpc/')[1];
    const auth = path === '/auth/v1/token' && method === 'POST';
    const ai = path === '/functions/v1/ai-tour-gptour' && method === 'POST' && process.argv.includes('--ai') && aiCalls === 0;
    const read = ['GET', 'HEAD'].includes(method) && (path.startsWith('/rest/v1/') || path === '/auth/v1/user');
    if (parsed.origin !== new URL(url).origin || !(auth || ai || read || (method === 'POST' && allowed.has(rpc)))) {
      denied.push({ method, path }); throw new Error('Richiesta vietata dal controllo readonly');
    }
    if (ai) aiCalls++;
    const cacheKey = `${method}:${address}:${init.body || ''}`;
    if (baseline) {
      // Emula la vecchia singola risposta PostgREST usando LO STESSO snapshot reale.
      if (rpc === 'ai_tour_free_tabaccherie' && Number(parsed.searchParams.get('offset')) > 0) return new Response('[]');
      const hit = cache.get(cacheKey);
      if (!hit) throw new Error('Confronto baseline: lettura non presente nello snapshot');
      return new Response(hit.body, { status: hit.status, headers: hit.headers });
    }
    const response = await rawFetch(input, init);
    if (!auth && !ai) {
      const body = await response.clone().text();
      cache.set(cacheKey, { body, status: response.status, headers: Object.fromEntries(response.headers) });
      if (rpc === 'ai_tour_free_tabaccherie') {
        if (!response.ok) throw new Error(`RPC free HTTP ${response.status}`);
        const rows = JSON.parse(body);
        const count = (city) => rows.filter(r => (r.comune || '').trim().toLowerCase() === city).length;
        pages.push({ offset: Number(parsed.searchParams.get('offset')), limit: Number(parsed.searchParams.get('limit')), rows: rows.length,
          bacoli: count('bacoli'), monte: count('monte di procida'), assignedFieldPresent: rows.every(r => 'assigned' in r),
          free: rows.filter(r => !r.assigned).length, never: rows.filter(r => r.assigned).length,
          uniqueIds: new Set(rows.map(r => r.id)).size });
      }
    }
    return response;
  };
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: guardedFetch } });
  const { error: authError } = await client.auth.signInWithPassword({ email: match[1].trim(), password: match[2].trim() });
  if (authError) throw new Error('Login readonly non riuscito');
  global.__gptReadonlyClient = client;
  await build({ stdin: { contents: `export { getSettings } from './lib/aitour/tours'; export { loadGptourPool } from './lib/aitour/gptour-data'; export * from './lib/aitour/gptour-development'; export { DEFAULT_INTENT, mergeIntent } from './lib/aitour/gptour-intent'; export { runGptour } from './lib/aitour/gptour-api'; export { todayRome } from './lib/aitour/gptour-dates';`, resolveDir: '/app/frontend', loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: '/tmp/gptour-readonly-loader.cjs', plugins: [{ name: 'real-supabase-client', setup(b) {
    b.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: 'readonly-client', namespace: 'readonly' }));
    b.onLoad({ filter: /.*/, namespace: 'readonly' }, () => ({ contents: 'export const supabase = globalThis.__gptReadonlyClient;', loader: 'js' }));
  } }] });
  const app = require('/tmp/gptour-readonly-loader.cjs');
  const profiles = await client.from('profiles').select('id,full_name,role').eq('full_name', 'DELLA VOLPE VINCENZO');
  if (profiles.error || profiles.data?.length !== 1) throw new Error('Profilo target assente o ambiguo');
  const agent = profiles.data[0];
  const settings = await app.getSettings(agent.id);
  // Identico istante per filtri temporali GET e replay (non modifiche ai dati).
  const RealDate = global.Date, fixedNow = RealDate.now();
  global.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [fixedNow])); }
    static now() { return fixedNow; }
  };
  const pool = await app.loadGptourPool(agent.id, settings);
  baseline = true;
  const before = await app.loadGptourPool(agent.id, settings);
  baseline = false;
  global.Date = RealDate;
  const summary = p => ({ total: p.candidates.length, complete: p.complete, warnings: p.warnings,
    types: p.candidates.reduce((a,c) => ({ ...a, [c.entityType]: (a[c.entityType] || 0) + 1 }), {}),
    bacoli: p.candidates.filter(c => c.city.trim().toLowerCase() === 'bacoli').length,
    monte: p.candidates.filter(c => c.city.trim().toLowerCase() === 'monte di procida').length,
    authorized: p.authorizedCandidates.length, zones: p.zones.length });
  const report = { timestamp: new Date().toISOString(), target: agent.full_name, pages, before: summary(before), after: summary(pool), ai: { attempted: false }, denied, crmWrites: 0 };
  if (process.argv.includes('--ai')) {
    const text = 'Domani voglio fare una giornata di sviluppo a Bacoli e comuni limitrofi';
    const home = { lat: settings.home_lat, lng: settings.home_lng, label: settings.home_address };
    try {
      const result = await app.runGptour({ agentId: agent.id, role: 'admin', messages: [{ role: 'user', content: text }], pool: pool.candidates, intent: app.DEFAULT_INTENT, agentInfo: {
        today: app.todayRome(), nome: agent.full_name, nClienti: pool.candidates.length, nComuni: new Set(pool.candidates.map(c=>c.city)).size, poolComplete: pool.complete,
        orarioLavoro: { inizio: settings.work_start, fine: settings.work_end }, pausaPranzoMin: settings.lunch_break_minutes,
        durataVisitaMin: { cliente: settings.visit_minutes_client, prospect: settings.visit_minutes_prospect, orfano: settings.visit_minutes_orphan, nuova: settings.visit_minutes_prospect },
        casa: { indirizzo: home.label, lat: home.lat, lng: home.lng }, ufficio: null, partenza: { indirizzo: home.label, lat: home.lat, lng: home.lng }, maxBufferMin: settings.max_daily_buffer_minutes,
      } }, client);
      const intent = app.applyDevelopmentIntent(app.mergeIntent(app.DEFAULT_INTENT, result.intent), text);
      const borders = await app.developmentBorders(intent);
      const fallback = (result.needsInfo || !(result.selection.length || result.days.length)) && !result.followUpActions?.length;
      const seed = fallback ? app.emptyDevelopmentResult(result, app.inferTourDate(text, app.todayRome())) : result;
      const completed = app.completeDevelopmentDay(seed, pool.candidates, intent, settings, borders, home);
      report.ai = { attempted: true, success: true, needsInfo: result.needsInfo, originalSelection: result.selection.length, fallback, completedSelection: completed.result.selection.length, added: completed.added, comuniAdded: completed.comuni, followUpActions: result.followUpActions?.length || 0, tourDate: completed.result.tourDate, routingAndSaveExecuted: false };
    } catch (e) { report.ai = { attempted: true, success: false, message: e.message }; }
  }
  report.aiCalls = aiCalls;
  const file = process.argv.includes('--ai') ? 'actual_client_pool.json' : 'actual_client_pool_verified.json';
  writeFileSync(`/app/test_reports/artifacts_iter64/${file}`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (denied.length) process.exitCode = 1;
}
main().catch(() => { console.error('Probe readonly fallita; nessun dato sensibile registrato.'); process.exitCode = 1; });