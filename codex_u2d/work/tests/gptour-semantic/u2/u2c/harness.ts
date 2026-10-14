import { TRANSPORT_VERSION } from '../../../../supabase/functions/_shared/gptour-semantic-transport/contract.ts';
// U2-c test harness: ALL dependencies are lab simulations (LLM, planner/routing, catalog, revalidation). Store = memory (L1) or lab PostgREST (L2).
import { makeOp, type LlmPort } from '../../../../supabase/functions/_shared/gptour-semantic/interpreter.ts';
import type { Operation, ReferenceCatalog } from '../../../../supabase/functions/_shared/gptour-semantic/contract.ts';
import { makeMemoryStore } from '../../../../supabase/functions/_shared/gptour-semantic-runtime/store-memory.ts';
import { makePostgrestStore } from '../../../../supabase/functions/_shared/gptour-semantic-runtime/store-postgrest.ts';
import { type SemanticStore, StoreError, type TrustedCaller } from '../../../../supabase/functions/_shared/gptour-semantic-runtime/store-port.ts';
import { type InfeasibleCriterion, isRetryableHttpStatus, LlmProviderError, type PlannerPort, type RevalidationPort, type TurnDeps } from '../../../../supabase/functions/_shared/gptour-semantic-runtime/ports.ts';
import { handle } from '../../../../supabase/functions/_shared/gptour-semantic-runtime/turn.ts';
import { PLAN } from '../golden-cases.ts';

export const A: TrustedCaller = { uid: 'a0000000-0000-4000-8000-00000000000a' }, B: TrustedCaller = { uid: 'b0000000-0000-4000-8000-00000000000b' };
export const CATALOG: ReferenceCatalog = { localities: [{ name: 'Milano', provincia: 'MI' }, { name: 'Monza', provincia: 'MB' }], provinces: [{ sigla: 'MI', nome: 'Milano' }, { sigla: 'MB', nome: 'Monza e Brianza' }], events: [], stops: [], projects: [] };
export const ENGINE = 'gptour-semantic-runtime/u2-c';
let pass = 0, fail = 0;
export const check = (ok: unknown, label: string, detail: unknown = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ' :: ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 400)}`); };
export const done = (suite: string) => { console.log(`${suite} DONE checks=${pass + fail} pass=${pass} fail=${fail}; LLM/planner/catalog/revalidation MOCKED`); if (fail) Deno.exit(1); };

export interface LabConfig { kind: 'memory' | 'postgrest'; baseUrl?: string; backendJwt?: string; psql?: string[]; sid?: string }
export function labConfig(): LabConfig {
  const p = Deno.env.get('U2C_CONFIG');
  return p ? JSON.parse(Deno.readTextFileSync(p)) as LabConfig : { kind: 'memory' };
}
export interface Lab { store: SemanticStore; kind: LabConfig['kind']; now: () => number; advance(ms: number): void; expireLease(sid: string, rid: string): Promise<void>; expireDeadline?(sid: string, rid: string): Promise<void>; revoke(uid: string, on: boolean): Promise<void>; sqlFault?(on: boolean): Promise<void> }
export function makeLab(cfg: LabConfig): Lab {
  if (cfg.kind === 'memory') {
    let t = Date.parse('2026-10-15T21:59:00.000Z'); const revoked = new Set<string>();
    const store = makeMemoryStore({ now: () => t, authorized: (uid, agentId) => uid === A.uid && agentId === uid && !revoked.has(uid) });
    return { store, kind: 'memory', now: () => t, advance: ms => { t += ms; }, async expireLease(sid, rid) { const r = store.requests.get(`${sid}|${rid}`)!; r.leaseUntil = t - 1; r.nextRetryAt = null; }, async revoke(uid, on) { on ? revoked.add(uid) : revoked.delete(uid); } };
  }
  const store = makePostgrestStore({ baseUrl: cfg.baseUrl!, backendJwt: cfg.backendJwt! });
  const psql = async (sqlText: string) => { const c = new Deno.Command(cfg.psql![0], { args: [...cfg.psql!.slice(1), '-c', sqlText], stdout: 'piped', stderr: 'piped' }); const o = await c.output(); if (!o.success) throw new Error(new TextDecoder().decode(o.stderr)); };
  return { store, kind: 'postgrest', now: () => Date.now(), advance: () => { throw new Error('real clock: time cannot be advanced on L2'); },
    expireLease: (sid, rid) => psql(`set role gptour_semantic_owner; update public.gptour_semantic_requests set lease_until = clock_timestamp() - interval '1 second', next_retry_at = null where session_id='${sid}' and request_id='${rid}'; reset role`),
    // TIME SIMULATION ONLY (lab superuser, same pattern as U2-b B5): backdates the immutable deadline inside one transaction with the guard trigger re-enabled.
    expireDeadline: (sid, rid) => psql(`begin; set local role gptour_semantic_owner; alter table public.gptour_semantic_requests disable trigger gptour_semantic_requests_guard; update public.gptour_semantic_requests set processing_deadline = clock_timestamp() - interval '1 second', lease_until = clock_timestamp() - interval '1 second' where session_id='${sid}' and request_id='${rid}'; alter table public.gptour_semantic_requests enable trigger gptour_semantic_requests_guard; commit;`),
    revoke: (uid, on) => psql(`update public.gptour_orchestrator_user_access set enabled = ${on ? 'false' : 'true'} where user_id = '${uid}'`),
    // LAB ONLY: real SQL fault after the session UPDATE inside commit_success (same pattern as U2-b B12), removed by the harness.
    sqlFault: on => psql(on ? "create schema if not exists u2b_fault; create table if not exists u2b_fault.flags(name text primary key); insert into u2b_fault.flags values ('after_session_update') on conflict do nothing; create or replace function u2b_fault.after_session_update() returns trigger language plpgsql security definer set search_path = '' as $$ begin if exists (select 1 from u2b_fault.flags where name = 'after_session_update') then raise exception 'U2C LAB FAULT after session update' using errcode = 'U2F01'; end if; return null; end $$; grant usage on schema u2b_fault to gptour_semantic_owner; set role gptour_semantic_owner; drop trigger if exists u2b_fault_after_update on public.gptour_semantic_sessions; create trigger u2b_fault_after_update after update on public.gptour_semantic_sessions for each row execute function u2b_fault.after_session_update(); reset role"
      : "set role gptour_semantic_owner; drop trigger if exists u2b_fault_after_update on public.gptour_semantic_sessions; reset role; drop schema if exists u2b_fault cascade") };
}
/** Scripted LLM (MOCKED): each entry is consumed by one dispatch. `http` throws the STRUCTURED LlmProviderError (401/403 permanent; 408/429/5xx retryable). */
export type LlmStep = { kind: 'ok'; locality?: string; ops?: Operation[] } | { kind: 'timeout' } | { kind: 'invalid' } | { kind: 'raw'; text: string } | { kind: 'http'; status: number } | { kind: 'hang_then_ok'; ms: number };
export function scriptedLlm(steps: LlmStep[], timeoutMs: number): LlmPort & { calls: number } {
  const port = { model: 'MOCKED-llm', calls: 0, async complete(call: { user: string; signal: AbortSignal }) {
    port.calls++; const s = steps.shift() ?? { kind: 'ok' as const };
    const ok = (ops: Operation[]) => JSON.stringify({ operations: ops, clarification: null });
    if (s.kind === 'ok') return ok(s.ops ?? [makeOp({ op: 'add_locality', locality: s.locality ?? 'Milano', provincia: null, evidence: s.locality ?? 'Milano' })]);
    if (s.kind === 'invalid') return '{"operations":"nope"}';
    if (s.kind === 'raw') return s.text;
    if (s.kind === 'http') throw new LlmProviderError(s.status, isRetryableHttpStatus(s.status), `MOCKED provider http ${s.status}`);
    const ms = s.kind === 'timeout' ? timeoutMs + 50 : s.ms;
    await new Promise(res => setTimeout(res, ms)); return ok([makeOp({ op: 'add_locality', locality: 'Milano', provincia: null, evidence: 'Milano' })]);
  } };
  return port;
}
export const plannerMock = (mode: 'plan' | 'infeasible' = 'plan', criterion: InfeasibleCriterion = 'area', reason = 'MOCKED no candidates'): PlannerPort & { calls: number; mode: 'plan' | 'infeasible' } => ({ calls: 0, mode, async plan(_p, ctx) { this.calls++; return this.mode === 'plan' ? { kind: 'plan', plan: { ...PLAN, sessionId: ctx.sessionId, sessionRevision: ctx.sessionRevision, generatedAt: ctx.acceptedAt, engineVersion: 'MOCKED-planner', verification: 'estimated_routing' }, dataQuality: null } : { kind: 'infeasible', reason, criterion }; } });
export const revalidationMock = (code: 'context_changed' | 'engine_changed' | null = null): RevalidationPort => ({ async check() { return code ? { ok: false, code } : { ok: true }; } });
export function deps(lab: Lab, o: Partial<TurnDeps> & { llmSteps?: LlmStep[]; workingDays?: number[] | null } = {}): TurnDeps & { llm: ReturnType<typeof scriptedLlm> | null; planner: ReturnType<typeof plannerMock> } {
  let n = 0; const timeout = o.llmTimeoutMs ?? 300; const { llmSteps: _s, workingDays, ...rest } = o; void _s;
  return { store: lab.store, llm: o.llm === null ? null : scriptedLlm(o.llmSteps ?? [{ kind: 'ok' }], timeout), catalog: { async load() { return CATALOG; } }, settings: { async workingDays() { return workingDays ?? null; } }, planner: plannerMock(), revalidation: revalidationMock(),
    engineVersion: ENGINE, promptVersion: 'p1', model: 'MOCKED-llm', llmTimeoutMs: timeout, leaseIntervalMs: 15000, executionBudgetMs: 60000, now: lab.now, newId: () => `inv-${++n}-${crypto.randomUUID()}`, ...rest } as TurnDeps & { llm: ReturnType<typeof scriptedLlm> | null; planner: ReturnType<typeof plannerMock> };
}
/** Public create_session (201) → sessionId from the semantic-1.1 snapshot (never from internal rows). */
export async function newSession(lab: Lab, caller: TrustedCaller = A): Promise<string> {
  const r = await handle({ operation: 'create_session', contractVersion: TRANSPORT_VERSION }, caller, deps(lab));
  if (r.http !== 201) throw new Error(`create_session http ${r.http}: ${JSON.stringify(r.body).slice(0, 200)}`);
  return (r.body.state as { sessionId: string }).sessionId;
}
export const getState = async (lab: Lab, sid: string) => (await handle({ operation: 'get_state', contractVersion: TRANSPORT_VERSION, sessionId: sid }, A, deps(lab))).body.state as Record<string, unknown>;
/** Store wrapper injecting faults per RPC: 'throw_before' (never executed) or 'ack_lost' (executed, answer lost → StoreError NET). One-shot. */
export function faultyStore(inner: SemanticStore, faults: Partial<Record<keyof SemanticStore, 'throw_before' | 'ack_lost'>>): SemanticStore {
  const used = new Set<string>();
  return new Proxy(inner, { get(t, k: string) {
    const fn = (t as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[k]; if (typeof fn !== 'function') return fn;
    return async (...a: unknown[]) => {
      const f = faults[k as keyof SemanticStore];
      if (f && !used.has(k)) { used.add(k); if (f === 'throw_before') throw new StoreError('NET', 0, `lab fault before ${k}`); await fn.apply(t, a); throw new StoreError('NET', 0, `lab fault: ack lost after ${k}`); }
      return fn.apply(t, a);
    }; } });
}
export const turnReq = (sid: string, rid: string, rev: number, msg: string | { action: Record<string, unknown> } = 'Vai a Milano', platform: 'web' | 'mobile' = 'web') =>
  ({ operation: 'turn', contractVersion: TRANSPORT_VERSION, client: { platform }, sessionId: sid, requestId: rid, expectedRevision: rev, ...(typeof msg === 'string' ? { message: msg } : msg) });
