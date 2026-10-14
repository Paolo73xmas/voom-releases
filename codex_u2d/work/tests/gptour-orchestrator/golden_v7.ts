// Golden v7 per l'estrazione planner D3(a): battaglia di conversazioni attraverso il VERO handleTurn con adapter in memoria.
// Dump JSON delle risposte (campi non deterministici mascherati: planId/lastPlanId/durationMs). Prima/dopo l'estrazione devono essere byte-identici.
import { writeFileSync } from 'node:fs';
import { world, say, act, AGENT, TODAY, type World } from './harness.ts';
import { cand, synthSettings } from '../../supabase/functions/_shared/gptour-orchestrator/adapters/memory.ts';
import type { AgendaEvent, Candidate } from '../../supabase/functions/_shared/gptour-orchestrator/ports.ts';
import type { OrchestratorResponse } from '../../supabase/functions/_shared/gptour-orchestrator/contract.ts';

const TOMORROW = '2026-10-16';
const agenda: AgendaEvent[] = [
  { id: 'fu-1', customerId: 'cust-rz4', key: 'rz4', name: 'Tabaccheria Fiordaliso', type: 'follow_up', date: '2026-10-10', time: null, durationMin: 30, overdue: true },
  { id: 'ap-1', customerId: 'cust-op1', key: 'op1', name: 'Tabaccheria Opera Centro', type: 'appointment', date: TOMORROW, time: '11:00', durationMin: 30, overdue: false },
  { id: 'ap-ext', customerId: 'cust-ext', key: 'ext', name: 'Riunione esterna', type: 'appointment', date: TOMORROW, time: '15:00', durationMin: 60, overdue: false },
];
const far = (prefix: string, lat: number, lng: number, n: number, city: string): Candidate[] => Array.from({ length: n }, (_, i) => cand(`${prefix}${i}`, `${city} ${i}`, city, lat + i * 0.003, lng + i * 0.002));
const pool = [...far('rzx', 45.383, 9.15, 12, 'Rozzano'), ...far('pv', 45.185, 9.16, 6, 'Pavia'), ...far('vg', 44.99, 9.01, 6, 'Voghera')];
const multi = { candidates: pool, localities: [{ name: 'Rozzano', provincia: 'MI' }, { name: 'Pavia', provincia: 'PV' }, { name: 'Voghera', provincia: 'PV' }], territory: { comuni: [], province: ['MI', 'PV'] }, settings: synthSettings({ lodgingMaxKmHome: 50, workEnd: '17:00' }) };
const tight = synthSettings({ workEnd: '10:30', lunchBreakMin: 0 });

const ids = new Map<string, string>();
const mask = (v: unknown, k = ''): unknown => {
  if (Array.isArray(v)) return v.map((x) => mask(x));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([kk, x]) => [kk, mask(x, kk)]));
  if ((k === 'planId' || k === 'lastPlanId') && typeof v === 'string') { if (!ids.has(v)) ids.set(v, `<plan-${ids.size + 1}>`); return ids.get(v); }
  if (k === 'durationMs') return '<ms>';
  return v;
};
const out: Array<{ scenario: string; step: string; response: unknown; store: unknown }> = [];
const rec = (scenario: string, step: string, w: World, r: OrchestratorResponse) => out.push({ scenario, step, response: mask(r), store: mask({ sessions: [...w.store.sessions.values()], plans: w.store.plans.size, responses: w.store.responses.size, crmQueries: w.crm.queries, routingCalls: w.routing.calls }) });

async function run(scenario: string, w: World, steps: Array<[string, string] | [string, Parameters<typeof act>[2]] | [string, 'fail-routing' | 'fail-territory']>, sid = scenario) {
  for (const [label, s] of steps) {
    if (s === 'fail-routing') { w.routing.failNext = true; continue; }
    if (s === 'fail-territory') { w.crm.loadTerritory = async () => { throw new Error('permission denied for table agent_zones'); }; continue; }
    const r = typeof s === 'string' ? await say(w, sid, s) : await act(w, sid, s);
    rec(scenario, label, w, r);
  }
}
async function main() {
  await run('plan_mixed_verified', world(), [['t1', 'domani a Rozzano e Opera i clienti e le nuove tabaccherie'], ['t2', 'parti alle 10'], ['t3', 'escludi Tabacchi Via Curiel']]);
  await run('plan_estimate', world({ verified: false }), [['t1', 'domani a Rozzano i clienti']]);
  await run('inactive_30', world(), [['t1', 'domani a Rozzano clienti che non comprano da 30 giorni']]);
  await run('inactive_needs_days', world(), [['t1', 'domani a Rozzano i clienti inattivi'], ['t2', '30']]);
  await run('want_all_infeasible_then_reduce', world({ data: { settings: tight } }), [['t1', 'domani tutti i clienti di Rozzano e Opera'], ['t2', { type: 'answer', optionId: 'reduce' }]]);
  await run('want_all_infeasible_extend', world({ data: { settings: tight } }), [['t1', 'domani tutti i clienti di Rozzano e Opera'], ['t2', { type: 'answer', optionId: 'extend', value: '18:00' }]]);
  await run('no_candidates', world(), [['t1', 'domani a Milano i clienti']]);
  await run('no_candidates_inactive', world(), [['t1', 'domani a Milano clienti che non comprano da 30 giorni']]);
  await run('province_tv', world(), [['t1', 'domani tabaccherie di Castelfranco Veneto in provincia di Treviso']]);
  await run('agenda_include_all', world({ data: { agenda } }), [['t1', 'domani a Rozzano e Opera i clienti'], ['t2', 'includili tutti'], ['t3', { type: 'get_plan', planId: '' }]]);
  await run('agenda_exclude', world({ data: { agenda } }), [['t1', 'domani a Rozzano e Opera i clienti'], ['t2', 'lasciali fuori dal giro']]);
  await run('agenda_reschedule', world({ data: { agenda } }), [['t1', 'domani a Rozzano i clienti'], ['t2', 'spostali a lunedì']]);
  await run('agenda_appointment_only', world({ data: { agenda: [{ ...agenda[1] }] } }), [['t1', 'domani a Rozzano e Opera i clienti']]);
  await run('multiday_ask_then_split', world({ data: multi }), [['t1', 'domani tutti i clienti di Rozzano, Pavia e Voghera'], ['t2', 'dividilo in tre giorni']]);
  await run('multiday_direct', world({ data: { ...multi, settings: synthSettings({ lodgingMaxKmHome: null, workEnd: '17:00' }) } }), [['t1', 'domani tutti i clienti di Rozzano, Pavia e Voghera in tre giorni']]);
  await run('multiday_two_days', world({ data: multi }), [['t1', 'domani tutti i clienti di Rozzano, Pavia e Voghera in due giorni']]);
  await run('routing_failure_then_retry', world(), [['x', 'fail-routing'], ['t1', 'domani a Rozzano i clienti'], ['t2', 'domani a Rozzano i clienti']]);
  await run('territory_failure', world(), [['x', 'fail-territory'], ['t1', 'domani a Rozzano i clienti']]);
  await run('purchases_failure', world({ data: { failures: { purchases: 'timeout ordini' } } }), [['t1', 'domani a Rozzano clienti che non comprano da 30 giorni']]);
  await run('candidates_failure', world({ data: { failures: { candidates: 'RLS registro' } } }), [['t1', 'domani a Rozzano i clienti']]);
  await run('truncated_pool', world({ data: { truncated: true } }), [['t1', 'domani a Rozzano i clienti']]);
  await run('required_not_eligible', world(), [['t1', { type: 'require_stop', key: 'rz5' }], ['t2', 'domani a Rozzano i clienti']]);
  await run('required_ok_and_exclude_key', world(), [['t1', { type: 'require_stop', key: 'rz3' }], ['t2', { type: 'exclude_stop', key: 'rz1' }], ['t3', 'domani a Rozzano i clienti']]);
  await run('departure_gps', world(), [['t1', 'domani a Rozzano e Opera i clienti']], 'gps');
  { const w = world(); const r = await say(w, 'gps2', 'domani a Rozzano e Opera i clienti', AGENT, { departure: { lat: 45.37, lng: 9.21, label: 'Opera' } }); rec('departure_explicit', 't1', w, r); }
  await run('non_working_then_confirm', world(), [['t1', 'sabato a Rozzano i clienti'], ['t2', 'sì']]);
  await run('reset_and_replan', world(), [['t1', 'domani a Rozzano i clienti'], ['t2', 'ricomincia da capo'], ['t3', 'domani a Opera i clienti']]);
  await run('today_late', world({ now: '2026-10-15T15:50:00Z' }), [['t1', 'oggi a Rozzano i clienti']]);
  await run('today_ok', world({ now: '2026-10-15T07:00:00Z' }), [['t1', 'oggi a Rozzano i clienti']]);
  // get_plan on the real plan id of scenario plan_mixed_verified
  { const w = world(); const r1 = await say(w, 'gp', 'domani a Rozzano i clienti'); rec('get_plan', 't1', w, r1); const r2 = await act(w, 'gp', { type: 'get_plan', planId: r1.planId! }); rec('get_plan', 't2', w, r2); }
  const path = process.env.GOLDEN_OUT || '/tmp/golden_v7.json';
  writeFileSync(path, JSON.stringify(out, null, 1));
  console.log(`GOLDEN v7: ${out.length} risposte registrate → ${path} (today ${TODAY})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
