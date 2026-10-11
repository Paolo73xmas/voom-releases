import { supabase } from '../supabase';
import type { ContractBinding, RequestEnvelope, ServerSnapshot } from './orchestrator/contract';
import { buildRequest } from './orchestrator/request';
import { OrchestratorError, httpError } from './orchestrator/errors';
import { assertSnapshot } from './orchestrator/view';

export type OrchestratorClient = Pick<typeof supabase, 'auth' | 'functions'>;
export interface TransportOptions { binding: ContractBinding | null; client?: OrchestratorClient; isolatedTest?: boolean; timeoutMs?: number }
export type SendRequest = (request: RequestEnvelope, ownerId: string, stillCurrent: () => boolean, signal?: AbortSignal) => Promise<ServerSnapshot>;

/** No retries here: the session coordinator owns the persisted exact requestId/body. */
export function createOrchestratorTransport(options: TransportOptions): SendRequest {
  const client = options.client ?? supabase;
  return async (input, ownerId, stillCurrent, outerSignal) => {
    const binding = options.binding;
    if (!binding || binding.version !== '1.0' || (binding.provenance !== 'handoff-verified' && !(options.isolatedTest && options.client)))
      throw new OrchestratorError('HANDOFF_REQUIRED');
    const body = buildRequest(input);
    const controller = new AbortController();
    let rejectCancellation!: (reason: OrchestratorError) => void;
    const cancellation = new Promise<never>((_, reject) => { rejectCancellation = reject; });
    const cancel = () => { controller.abort(); rejectCancellation(new OrchestratorError('CANCELLED')); };
    outerSignal?.addEventListener('abort', cancel);
    if (outerSignal?.aborted) cancel();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      if (!stillCurrent()) throw new OrchestratorError('ACCOUNT_CHANGED');
      if (outerSignal?.aborted) throw new OrchestratorError('CANCELLED');
      if (controller.signal.aborted) throw new OrchestratorError('NETWORK');
    };
    const run = async (): Promise<ServerSnapshot> => {
      check();
      const before = await client.auth.getSession(); check();
      if (before.error || !before.data.session?.access_token) throw new OrchestratorError('AUTH_REQUIRED');
      if (before.data.session.user.id !== ownerId) throw new OrchestratorError('ACCOUNT_CHANGED');
      const result = await client.functions.invoke('gptour-orchestrator', { body,
        headers: { Authorization: `Bearer ${before.data.session.access_token}` }, signal: controller.signal });
      check();
      const after = await client.auth.getSession(); check();
      if (after.error) throw new OrchestratorError('AUTH_REQUIRED');
      if (!after.data.session || after.data.session.user.id !== ownerId) throw new OrchestratorError('ACCOUNT_CHANGED');
      if (result.error) throw httpError((result.error as { context?: { status?: number } }).context?.status);
      let snapshot: ServerSnapshot;
      try { snapshot = binding.decodeResponse(result.data, body); assertSnapshot(snapshot, body); }
      catch { throw new OrchestratorError('INVALID_RESPONSE'); }
      return snapshot;
    };
    try {
      const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => {
        controller.abort(); reject(new OrchestratorError('NETWORK'));
      }, options.timeoutMs ?? 30000); });
      return await Promise.race([run(), deadline, cancellation]);
    } catch (e) {
      check(); // Never render or persist an old account's result/error.
      throw e instanceof OrchestratorError ? e : new OrchestratorError('NETWORK');
    } finally { if (timer) clearTimeout(timer); outerSignal?.removeEventListener('abort', cancel); }
  };
}