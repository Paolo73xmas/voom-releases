import * as Crypto from 'expo-crypto';
import { ACTION_NAMES, CONTRACT_VERSION, type Command, type ContractBinding, type JsonValue, type RequestEnvelope, type ServerSnapshot } from './contract';
import { buildRequest } from './request';
import { OrchestratorError, safeError } from './errors';
import { SessionStore, type SessionRecord } from './storage';
import type { SendRequest } from '../gptour-orchestrator-api';
import { assertSnapshot } from './view';
import { recoveredQuestionLinks } from './conversation';

export interface SessionState {
  phase: 'idle' | 'hydrating' | 'sending' | 'resume_pending' | 'error';
  snapshot: ServerSnapshot | null; error: OrchestratorError | null; pending: boolean;
  restored?: boolean; canRecover?: boolean; canRetryResponse?: boolean;
}
export const EMPTY_SESSION: SessionState = { phase: 'idle', snapshot: null, error: null, pending: false };
export interface SessionOptions {
  ownerId: string; targetAgentId?: string; currentOwner: () => string | null;
  binding: ContractBinding; send: SendRequest; store?: SessionStore; uuid?: () => string;
}
/** Request coordinator, NOT a planning engine. At most one in-flight command; no optimistic server state. */
export class OrchestratorSession {
  private state: SessionState = EMPTY_SESSION;
  private record: SessionRecord | null = null;
  private busy = false;
  private disposed = false;
  private abort: AbortController | null = null;
  private listeners = new Set<() => void>();
  private readonly store: SessionStore;
  private readonly uuid: () => string;
  private readonly target?: string;
  constructor(private readonly options: SessionOptions) {
    this.store = options.store ?? new SessionStore(); this.uuid = options.uuid ?? Crypto.randomUUID;
    this.target = options.targetAgentId === options.ownerId ? undefined : options.targetAgentId;
  }
  getSnapshot = (): SessionState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private current = (): boolean => !this.disposed && this.options.currentOwner() === this.options.ownerId;
  private set(patch: Partial<SessionState>) { if (this.disposed) return; this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  private check() { if (!this.current()) throw new OrchestratorError('ACCOUNT_CHANGED'); }
  async initialize(): Promise<void> {
    if (this.busy) return;
    this.busy = true; this.set({ phase: 'hydrating', snapshot: null, error: null });
    let recover = false;
    try {
      this.check();
      if (this.options.binding.historyMode === 'local-transcript') await this.store.activate(this.options.ownerId, this.target);
      const saved = await this.store.read(this.options.ownerId, this.target); this.check();
      this.record = saved ?? { storageVersion: 1, sessionId: this.uuid() };
      if (!saved) await this.store.write(this.options.ownerId, this.target, this.record);
      this.check(); recover = !!saved && !saved.pending && (this.options.binding.historyMode !== 'local-transcript' || !!saved.planId);
      const cached = saved?.cache && saved.transcript ? { ...saved.cache, messages: saved.transcript, plan: null } : null;
      this.set({ phase: saved?.pending ? 'resume_pending' : 'idle', pending: !!saved?.pending, snapshot: cached,
        restored: !!cached, canRecover: !!saved?.planId, canRetryResponse: !!saved?.retryRequest });
    } catch (e) { this.failed(e); } finally { this.busy = false; }
    if (recover && this.current()) await this.recover();
  }
  async message(message: string, location?: { departure?: JsonValue; gps?: JsonValue }): Promise<void> {
    await this.newRequest({ message, ...location });
  }
  async action(command: Command): Promise<void> {
    try {
      if (!ACTION_NAMES.includes(command.name)) throw new OrchestratorError('INVALID_REQUEST');
      await this.newRequest({ action: this.options.binding.encodeAction(command) });
    }
    catch (e) { this.failed(e); }
  }
  async recover(): Promise<void> {
    if (this.busy) return;
    if (!this.record) return this.initialize();
    // Synchronization is an explicit read action; its revision policy is supplied by the verified binding.
    if (this.options.binding.historyMode === 'local-transcript' && !this.record.planId) return;
    try { await this.newRequest({ action: this.options.binding.encodeAction({ name: 'get_plan', ...(this.record.planId ? { input: { planId: this.record.planId } } : {}) }) }, true); }
    catch (e) { this.failed(e); }
  }
  private async newRequest(content: Pick<RequestEnvelope, 'message' | 'action' | 'departure' | 'gps'>, recovery = false): Promise<void> {
    if (this.busy) return;
    try {
      this.check(); if (!this.record) throw new OrchestratorError('STORAGE');
      if (this.record.pending && !recovery) throw new OrchestratorError('PENDING_REQUEST');
      if (recovery && this.record.pending && !['CONFLICT', 'REQUEST_REJECTED', 'INVALID_RESPONSE'].includes(this.state.error?.code || ''))
        throw new OrchestratorError('PENDING_REQUEST'); // Timeout/503 must reuse original ID, never replace uncertain writes.
      const revision = recovery && this.options.binding.recoveryRevision === 'omit' ? undefined : this.record.revision;
      const request = buildRequest({ contractVersion: CONTRACT_VERSION, sessionId: this.record.sessionId, requestId: this.uuid(),
        ...(revision !== undefined ? { expectedRevision: revision } : {}), ...(this.target ? { targetAgentId: this.target } : {}), ...content });
      this.options.binding.validateRequest?.(request);
      this.record = { ...this.record, pending: request, retryRequest: undefined };
      await this.execute();
    } catch (e) { this.failed(e); }
  }
  async retry(): Promise<void> {
    if (this.busy || !this.record || (!this.record.pending && !this.record.retryRequest)) return;
    if (this.state.error && !this.state.error.retryable && this.state.error.code !== 'STORAGE') return;
    if (!this.record.pending) this.record = { ...this.record, pending: this.record.retryRequest };
    await this.execute();
  }
  async newConversation(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.set({ phase: 'hydrating' });
    try {
      this.check(); await this.store.clear(this.options.ownerId, this.target); this.check();
      this.record = null; this.set({ ...EMPTY_SESSION, restored: false, canRecover: false, canRetryResponse: false });
      this.busy = false;
      await this.initialize();
    } catch { this.failed(new OrchestratorError('STORAGE')); } finally { this.busy = false; }
  }
  private async execute(): Promise<void> {
    if (this.busy || !this.record?.pending) return;
    this.busy = true; this.abort = new AbortController();
    const pending = buildRequest(this.record.pending);
    this.set({ phase: 'sending', error: null, pending: true, restored: false, canRetryResponse: false });
    try {
      this.check(); await this.store.write(this.options.ownerId, this.target, this.record); this.check();
      let snapshot = await this.options.send(pending, this.options.ownerId, this.current, this.abort.signal); this.check();
      assertSnapshot(snapshot, pending);
      const local = this.options.binding.historyMode === 'local-transcript';
      const getPlan = (pending.action as { type?: string } | undefined)?.type === 'get_plan';
      if (local) {
        const history = this.record.transcript ?? [];
        const incoming = [...(!getPlan ? [{ id: `${pending.requestId}-u`, role: 'user' as const,
          text: pending.message ?? this.actionLabel(pending) }] : []), ...(!getPlan ? snapshot.messages : [])];
        const ids = new Set(history.map(m => m.id));
        snapshot = { ...snapshot, messages: [...history, ...incoming.filter(m => !ids.has(m.id))],
          // Presentation linkage only: a get_plan read has no new transcript turn.
          questions: getPlan ? recoveredQuestionLinks(snapshot, this.record.cache, history) : snapshot.questions };
      }
      const confirmed: SessionRecord = { storageVersion: 1, sessionId: snapshot.sessionId,
        ...(snapshot.revisionConfirmed === false ? this.record.revision !== undefined ? { revision: this.record.revision } : {} : { revision: snapshot.revision }) };
      if (local) {
        const { plan: _plan, messages, ...cache } = snapshot;
        Object.assign(confirmed, { transcript: messages, cache, planId: snapshot.planId ?? undefined, savedAt: Date.now(),
          ...(snapshot.status === 'failed' ? { retryRequest: pending } : {}) });
      }
      await this.store.write(this.options.ownerId, this.target, confirmed); this.check();
      this.record = confirmed;
      this.set({ phase: 'idle', snapshot, error: null, pending: false, restored: false, canRecover: !!confirmed.planId, canRetryResponse: !!confirmed.retryRequest });
    } catch (e) {
      if (this.current() && this.record && this.options.binding.historyMode === 'local-transcript' && e instanceof OrchestratorError) {
        if (e.code === 'CONFLICT' && e.details?.revision !== undefined) {
          const cache = this.record.cache ? { ...this.record.cache, revision: e.details.revision, status: 'failed' as const, questions: [], planId: null } : undefined;
          this.record = { ...this.record, pending: undefined, retryRequest: undefined, revision: e.details.revision, cache, planId: undefined };
          this.set({ snapshot: this.state.snapshot ? { ...this.state.snapshot, revision: e.details.revision, status: 'failed', plan: null, planId: null, questions: [] } : null,
            restored: false, canRecover: false, canRetryResponse: false });
          try { await this.store.write(this.options.ownerId, this.target, this.record); } catch (storageError) { this.failed(storageError); return; }
        } else if (['AUTH_REQUIRED', 'FORBIDDEN', 'REQUEST_REJECTED'].includes(e.code)) {
          this.record = { ...this.record, pending: undefined, retryRequest: undefined };
          try { await this.store.write(this.options.ownerId, this.target, this.record); } catch (storageError) { this.failed(storageError); return; }
        }
      }
      this.failed(e);
    }
    finally { this.busy = false; this.abort = null; }
  }
  private failed(e: unknown) {
    // A blocked second tap must not erase the original retry/conflict/auth recovery path.
    if (e instanceof OrchestratorError && e.code === 'PENDING_REQUEST' && this.state.error && this.current()) return;
    const error = this.current() ? safeError(e) : new OrchestratorError('ACCOUNT_CHANGED');
    this.set({ phase: 'error', error, pending: !!this.record?.pending, ...(error.code === 'ACCOUNT_CHANGED' ? { snapshot: null } : {}) });
  }
  private actionLabel(request: RequestEnvelope): string {
    const action = request.action as { type?: string; questionId?: string; optionId?: string } | undefined;
    const option = this.state.snapshot?.questions.find(q => q.id === action?.questionId)?.options.find(o => o.id === action?.optionId);
    return option?.label ?? `Azione: ${action?.type ?? 'richiesta'}`;
  }
  dispose(): void { this.disposed = true; this.abort?.abort(); this.listeners.clear(); this.state = EMPTY_SESSION; this.record = null; }
}