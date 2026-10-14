// PostgREST adapter over the U2-b RPCs. Backend credential is injected (lab: synthetic JWT); never a service role; no hidden retry.
import { type SemanticStore, StoreError, type TrustedCaller } from './store-port.ts';
export interface PostgrestStoreConfig { baseUrl: string; backendJwt: string; timeoutMs?: number; fetchImpl?: typeof fetch }
export function makePostgrestStore(cfg: PostgrestStoreConfig): SemanticStore {
  const f = cfg.fetchImpl ?? fetch;
  async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), cfg.timeoutMs ?? 10000);
    let res: Response;
    try { res = await f(`${cfg.baseUrl}/rpc/gptour_semantic_${name}`, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.backendJwt}` }, body: JSON.stringify(args) }); }
    catch (e) { throw new StoreError('NET', 0, `rpc ${name}: ${(e as Error).message}`); }
    finally { clearTimeout(timer); }
    const text = await res.text();
    if (!res.ok) { let code = 'HTTP' + res.status, msg = text; try { const j = JSON.parse(text); code = j.code ?? code; msg = j.message ?? msg; } catch { /* raw */ } throw new StoreError(code, res.status, `rpc ${name}: ${msg}`); }
    return JSON.parse(text) as T;
  }
  const base = (c: TrustedCaller, s?: string, r?: string, t?: string) => ({ p_caller_uid: c.uid, ...(s ? { p_session_id: s } : {}), ...(r ? { p_request_id: r } : {}), ...(t ? { p_token: t } : {}) });
  return {
    createSession: (c, a, cv, ev) => rpc('create_session', { ...base(c), p_agent_id: a, p_contract_version: cv, p_engine_version: ev }),
    claim: (c, s, r, h, rev) => rpc('claim', { ...base(c, s, r), p_payload_hash: h, p_expected_revision: rev }),
    renewLease: (c, s, r, t) => rpc('renew_lease', base(c, s, r, t)),
    storeContext: (c, s, r, t, ctx) => rpc('store_context', { ...base(c, s, r, t), p_context: ctx }),
    beginLlm: (c, s, r, t, inv) => rpc('begin_llm', { ...base(c, s, r, t), p_invocation_id: inv }),
    storeLlm: (c, s, r, t, inv, out) => rpc('store_llm', { ...base(c, s, r, t), p_invocation_id: inv, p_output: out }),
    recoverWork: (c, s, r, t) => rpc('recover_work', base(c, s, r, t)),
    commitSuccess: (c, s, r, t, st, op, plan, body) => rpc('commit_success', { ...base(c, s, r, t), p_new_state: st, p_operational: op, p_plan: plan, p_body: body }),
    finishError: (c, s, r, t, http, body) => rpc('finish_error', { ...base(c, s, r, t), p_http_status: http, p_body: body }),
    releaseRecoverable: (c, s, r, t, code, ms) => rpc('release_recoverable', { ...base(c, s, r, t), p_error_code: code, p_retry_after_ms: ms }),
    getState: (c, s) => rpc('get_state', base(c, s)),
    getRequest: (c, s, r) => rpc('get_request', base(c, s, r)),
    getPlan: (c, p) => rpc('get_plan', { ...base(c), p_plan_id: p }),
  };
}
