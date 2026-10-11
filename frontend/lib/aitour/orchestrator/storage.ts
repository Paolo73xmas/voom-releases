import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RequestEnvelope, Revision, ServerSnapshot } from './contract';
import { buildRequest, validRevision } from './request';
import { OrchestratorError } from './errors';
import { assertSnapshot } from './view';

export interface SessionRecord { storageVersion: 1; sessionId: string; revision?: Revision; pending?: RequestEnvelope;
  planId?: string; transcript?: ServerSnapshot['messages']; cache?: Omit<ServerSnapshot, 'messages' | 'plan'>;
  savedAt?: number; retryRequest?: RequestEnvelope; ownerId?: string; targetId?: string }
export interface KeyStorage { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>;
  removeItem?: (key: string) => Promise<void>; getAllKeys?: () => Promise<readonly string[]> }
export const sessionKey = (owner: string, target?: string): string => `voom:orchestrator:1:${encodeURIComponent(owner)}:${encodeURIComponent(target || 'self')}`;
export const TRANSCRIPT_TTL_MS = 24 * 60 * 60 * 1000;
let storageGeneration = 0;
const writes = new Set<Promise<void>>();
const touchedKeys = new Set<string>();
let cleanupBarrier: Promise<void> = Promise.resolve();
/** Clear local Orchestrator data only. Await in-flight writes so logout cannot resurrect a transcript. */
export function clearOrchestratorLocalState(storage: KeyStorage = AsyncStorage): Promise<void> {
  storageGeneration++;
  const previous = cleanupBarrier; const pending = [...writes];
  cleanupBarrier = (async () => {
    await previous.catch(() => {}); await Promise.allSettled(pending);
    const keys = [...new Set([...(await storage.getAllKeys?.() ?? []), ...touchedKeys])].filter(k => k.startsWith('voom:orchestrator:'));
    await Promise.all(keys.map(k => storage.removeItem ? storage.removeItem(k) : storage.setItem(k, '')));
    touchedKeys.clear();
  })();
  return cleanupBarrier;
}
/** Local transcript is presentation cache, never a source for rebuilding a plan. No JWTs or plan geometry stored. */
export class SessionStore {
  private readonly generation = storageGeneration;
  constructor(private readonly storage: KeyStorage = AsyncStorage) {}
  /** A target switch starts a new conversation, while reopening the same target preserves it. */
  async activate(owner: string, target?: string): Promise<void> {
    try {
      await cleanupBarrier;
      if (this.generation !== storageGeneration) throw new Error();
      const key = `voom:orchestrator:active:${encodeURIComponent(owner)}`;
      const next = target || 'self', previous = await this.storage.getItem(key);
      if (previous && previous !== next) {
        await this.clear(owner, previous === 'self' ? undefined : previous);
        await this.clear(owner, target);
      }
      touchedKeys.add(key);
      const promise = this.storage.setItem(key, next); writes.add(promise);
      try { await promise; } finally { writes.delete(promise); }
      if (this.generation !== storageGeneration) throw new Error();
    } catch { throw new OrchestratorError('STORAGE'); }
  }
  async read(owner: string, target?: string): Promise<SessionRecord | null> {
    try {
      await cleanupBarrier;
      const raw = await this.storage.getItem(sessionKey(owner, target));
      if (!raw) return null;
      const r = JSON.parse(raw) as SessionRecord;
      if ((r.ownerId !== undefined && r.ownerId !== owner) || (r.targetId !== undefined && r.targetId !== (target || 'self'))) throw new Error();
      if (r.savedAt !== undefined && !r.pending && Date.now() - r.savedAt >= TRANSCRIPT_TTL_MS) { await this.clear(owner, target); return null; }
      if (r.storageVersion !== 1 || typeof r.sessionId !== 'string' || !r.sessionId.trim()
        || (r.revision !== undefined && !validRevision(r.revision))) throw new Error();
      const pending = r.pending ? buildRequest(r.pending) : undefined;
      if (pending && (pending.sessionId !== r.sessionId || pending.targetAgentId !== target)) throw new Error();
      if (r.transcript && (!Array.isArray(r.transcript) || !r.transcript.every(m => typeof m.id === 'string' && ['user', 'assistant'].includes(m.role) && typeof m.text === 'string'))) throw new Error();
      if (r.planId !== undefined && typeof r.planId !== 'string') throw new Error();
      if (r.cache) assertSnapshot({ ...r.cache, messages: r.transcript ?? [], plan: null,
        status: r.cache.status === 'ready' ? 'planning' : r.cache.status },
        { contractVersion: '1.0', sessionId: r.sessionId, requestId: 'local-cache-validation' });
      const retryRequest = r.retryRequest ? buildRequest(r.retryRequest) : undefined;
      if (retryRequest && (retryRequest.sessionId !== r.sessionId || retryRequest.targetAgentId !== target)) throw new Error();
      return { ...r, pending, retryRequest };
    } catch { throw new OrchestratorError('STORAGE'); }
  }
  async write(owner: string, target: string | undefined, record: SessionRecord): Promise<void> {
    try {
      await cleanupBarrier;
      if (this.generation !== storageGeneration) throw new Error('Disposed storage generation');
      const payload: SessionRecord = { storageVersion: 1, sessionId: record.sessionId,
        ...(record.revision !== undefined ? { revision: record.revision } : {}), ...(record.pending ? { pending: buildRequest(record.pending) } : {}),
        ...(record.transcript ? { ownerId: owner, targetId: target || 'self', transcript: record.transcript, cache: record.cache,
          savedAt: record.savedAt ?? Date.now(), planId: record.planId } : {}), ...(record.retryRequest ? { retryRequest: buildRequest(record.retryRequest) } : {}) };
      const key = sessionKey(owner, target); touchedKeys.add(key);
      const promise = this.storage.setItem(key, JSON.stringify(payload)); writes.add(promise);
      try { await promise; } finally { writes.delete(promise); }
      if (this.generation !== storageGeneration) throw new Error('Account changed');
    } catch { throw new OrchestratorError('STORAGE'); }
  }
  async clear(owner: string, target?: string): Promise<void> {
    await cleanupBarrier;
    const key = sessionKey(owner, target);
    if (this.storage.removeItem) await this.storage.removeItem(key); else await this.storage.setItem(key, '');
  }
}