import * as Crypto from 'expo-crypto';
import { ACTION_NAMES, CONTRACT_VERSION, type Command, type ContractBinding, type JsonValue, type RequestEnvelope, type ServerSnapshot } from './contract';
import { buildRequest } from './request';
import { OrchestratorError, safeError } from './errors';
import { SessionStore, type SessionRecord } from './storage';
import type { SendRequest } from '../gptour-orchestrator-api';
import { assertSnapshot } from './view';

export interface SessionState {
  phase: 'idle' | 'hydrating' | 'sending' | 'resume_pending' | 'error';
  snapshot: ServerSnapshot | null; error: OrchestratorError | null; pending: boolean;
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
      this.check(); const saved = await this.store.read(this.options.ownerId, this.target); this.check();
      this.record = saved ?? { storageVersion: 1, sessionId: this.uuid() };
      if (!saved) await this.store.write(this.options.ownerId, this.target, this.record);
      this.check(); recover = !!saved && !saved.pending;
      this.set({ phase: saved?.pending ? 'resume_pending' : 'idle', pending: !!saved?.pending });
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
    try { await this.newRequest({ action: this.options.binding.encodeAction({ name: 'get_plan' }) }, true); }
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
      this.record = { ...this.record, pending: request };
      await this.execute();
    } catch (e) { this.failed(e); }
  }
  async retry(): Promise<void> {
    if (this.busy || !this.record?.pending) return;
    if (this.state.error && !this.state.error.retryable && this.state.error.code !== 'STORAGE') return;
    await this.execute();
  }
  private async execute(): Promise<void> {
    if (this.busy || !this.record?.pending) return;
    this.busy = true; this.abort = new AbortController();
    const pending = buildRequest(this.record.pending);
    this.set({ phase: 'sending', error: null, pending: true });
    try {
      this.check(); await this.store.write(this.options.ownerId, this.target, this.record); this.check();
      const snapshot = await this.options.send(pending, this.options.ownerId, this.current, this.abort.signal); this.check();
      assertSnapshot(snapshot, pending);
      const confirmed: SessionRecord = { storageVersion: 1, sessionId: snapshot.sessionId, revision: snapshot.revision };
      await this.store.write(this.options.ownerId, this.target, confirmed); this.check();
      this.record = confirmed;
      this.set({ phase: 'idle', snapshot, error: null, pending: false });
    } catch (e) { this.failed(e); }
    finally { this.busy = false; this.abort = null; }
  }
  private failed(e: unknown) {
    // A blocked second tap must not erase the original retry/conflict/auth recovery path.
    if (e instanceof OrchestratorError && e.code === 'PENDING_REQUEST' && this.state.error && this.current()) return;
    const error = this.current() ? safeError(e) : new OrchestratorError('ACCOUNT_CHANGED');
    this.set({ phase: 'error', error, pending: !!this.record?.pending, ...(error.code === 'ACCOUNT_CHANGED' ? { snapshot: null } : {}) });
  }
  dispose(): void { this.disposed = true; this.abort?.abort(); this.listeners.clear(); this.state = EMPTY_SESSION; this.record = null; }
}