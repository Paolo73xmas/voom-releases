import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RequestEnvelope, Revision } from './contract';
import { buildRequest, validRevision } from './request';
import { OrchestratorError } from './errors';

export interface SessionRecord { storageVersion: 1; sessionId: string; revision?: Revision; pending?: RequestEnvelope }
export interface KeyStorage { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> }
export const sessionKey = (owner: string, target?: string): string => `voom:orchestrator:1:${encodeURIComponent(owner)}:${encodeURIComponent(target || 'self')}`;
/** Persist identifiers and unconfirmed OUTBOUND request only, never tokens, server history or plans. */
export class SessionStore {
  constructor(private readonly storage: KeyStorage = AsyncStorage) {}
  async read(owner: string, target?: string): Promise<SessionRecord | null> {
    try {
      const raw = await this.storage.getItem(sessionKey(owner, target));
      if (!raw) return null;
      const r = JSON.parse(raw) as SessionRecord;
      if (r.storageVersion !== 1 || typeof r.sessionId !== 'string' || !r.sessionId.trim()
        || (r.revision !== undefined && !validRevision(r.revision))) throw new Error();
      const pending = r.pending ? buildRequest(r.pending) : undefined;
      if (pending && (pending.sessionId !== r.sessionId || pending.targetAgentId !== target)) throw new Error();
      return { storageVersion: 1, sessionId: r.sessionId, ...(r.revision !== undefined ? { revision: r.revision } : {}), ...(pending ? { pending } : {}) };
    } catch { throw new OrchestratorError('STORAGE'); }
  }
  async write(owner: string, target: string | undefined, record: SessionRecord): Promise<void> {
    try {
      const payload: SessionRecord = { storageVersion: 1, sessionId: record.sessionId,
        ...(record.revision !== undefined ? { revision: record.revision } : {}), ...(record.pending ? { pending: buildRequest(record.pending) } : {}) };
      await this.storage.setItem(sessionKey(owner, target), JSON.stringify(payload));
    } catch { throw new OrchestratorError('STORAGE'); }
  }
}