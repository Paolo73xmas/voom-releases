// Finite lease renewal (stops in finally, never beyond deadline/execution budget) + pre-dispatch residual check.
import type { SemanticStore, TrustedCaller } from './store-port.ts';
export interface LeaseHandle { stop(): void; ensureResidual(requiredMs: number): Promise<boolean>; renewals: number; leaseUntilMs: number }
export function startLease(store: SemanticStore, c: TrustedCaller, sid: string, rid: string, token: string,
  o: { now: () => number; intervalMs: number; deadlineMs: number; executionBudgetMs: number; initialLeaseMs: number }): LeaseHandle {
  const startedAt = o.now(), stopAt = Math.min(o.deadlineMs, startedAt + o.executionBudgetMs);
  const h: LeaseHandle = { renewals: 0, leaseUntilMs: startedAt + o.initialLeaseMs, stop: () => clearInterval(timer),
    async ensureResidual(requiredMs) {
      if (h.leaseUntilMs - o.now() >= requiredMs && o.deadlineMs - o.now() >= requiredMs) return true;
      if (!(await renew())) return false;
      return h.leaseUntilMs - o.now() >= requiredMs && o.deadlineMs - o.now() >= requiredMs;
    } };
  async function renew(): Promise<boolean> {
    if (o.now() >= stopAt) { h.stop(); return false; }
    try { const r = await store.renewLease(c, sid, rid, token); h.renewals++; h.leaseUntilMs = Date.parse(r.leaseUntil); return true; }
    catch { h.stop(); return false; } // fencing lost or store unreachable: stop renewing, the turn will observe the failure
  }
  const timer = setInterval(() => { void renew(); }, o.intervalMs);
  return h;
}
