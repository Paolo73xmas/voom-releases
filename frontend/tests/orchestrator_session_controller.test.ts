import { describe, expect, it, vi } from 'vitest';
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'mock-uuid' }));
import { OrchestratorSession } from '../lib/aitour/orchestrator/session';
import { OrchestratorError } from '../lib/aitour/orchestrator/errors';
import { SessionStore, sessionKey } from '../lib/aitour/orchestrator/storage';
import { fixtureBinding, readySnapshot } from './fixtures/orchestrator-fixtures';
import type { RequestEnvelope, ServerSnapshot } from '../lib/aitour/orchestrator/contract';

type KV = Map<string, string>;
const nextTick = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
};

function memStore(seed?: KV) {
  const db = seed ?? new Map<string, string>();
  return {
    db,
    getItem: vi.fn(async (k: string) => db.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => { db.set(k, v); }),
  };
}

function sessionHarness(overrides?: {
  ownerId?: string;
  targetAgentId?: string;
  currentOwner?: () => string | null;
  send?: (request: RequestEnvelope, ownerId: string, stillCurrent: () => boolean, signal?: AbortSignal) => Promise<ServerSnapshot>;
  store?: SessionStore;
  uuid?: () => string;
}) {
  const uuids = ['sess-uuid', 'req-a', 'req-b', 'req-c', 'req-d', 'req-e'];
  const session = new OrchestratorSession({
    ownerId: overrides?.ownerId ?? 'owner-1',
    targetAgentId: overrides?.targetAgentId,
    currentOwner: overrides?.currentOwner ?? (() => 'owner-1'),
    binding: fixtureBinding,
    send: overrides?.send ?? (async () => readySnapshot()),
    store: overrides?.store,
    uuid: overrides?.uuid ?? (() => uuids.shift() ?? `req-${Math.random()}`),
  });
  return session;
}

describe('OrchestratorSession + SessionStore coordinator behavior', () => {
  it('all structured commands use only the binding, never a legacy planner or CRM write', async () => {
    const sent: RequestEnvelope[] = [];
    const s = sessionHarness({ store: new SessionStore(memStore()), send: async r => { sent.push(r); return readySnapshot({ sessionId: r.sessionId }); } });
    await s.initialize();
    for (const name of ['answer', 'set_date', 'set_start_time', 'follow_up_decision', 'require_stop', 'exclude_stop', 'get_plan', 'reset'] as const)
      await s.action({ name, input: { opaqueServerChoice: name } });
    expect(sent).toHaveLength(8);
    expect(new Set(sent.map(r => r.requestId)).size).toBe(8);
    expect(sent.every(r => !r.message && !r.targetAgentId)).toBe(true);
    await s.action({ name: 'invented' as never }); expect(sent).toHaveLength(8);
  });
  it('unbound second message cannot replace a conflict with a retryable error', async () => {
    const send = vi.fn(async () => { throw new OrchestratorError('CONFLICT'); });
    const s = sessionHarness({ store: new SessionStore(memStore()), send });
    await s.initialize(); await s.message('first'); await s.message('second'); await s.retry();
    expect(s.getSnapshot().error?.code).toBe('CONFLICT'); expect(send).toHaveBeenCalledTimes(1);
  });
  it('storage contains only identifiers/outbound pending, never confirmed messages or plans', async () => {
    const storage = memStore();
    const s = sessionHarness({ store: new SessionStore(storage), send: async r => readySnapshot({ sessionId: r.sessionId }) });
    await s.initialize(); await s.message('clienti senza ordini da 20 giorni più nuovi punti vendita');
    const stored = JSON.parse(storage.db.get(sessionKey('owner-1'))!);
    expect(Object.keys(stored).sort()).toEqual(['revision', 'sessionId', 'storageVersion']);
    expect(stored).not.toHaveProperty('messages'); expect(stored).not.toHaveProperty('plan');
  });
  it('resume error is recoverable if local storage temporarily fails', async () => {
    const storage = memStore(); storage.getItem.mockRejectedValueOnce(new Error('temporary'));
    const send = vi.fn(async (r: RequestEnvelope) => readySnapshot({ sessionId: r.sessionId }));
    const s = sessionHarness({ store: new SessionStore(storage), send });
    await s.initialize(); expect(s.getSnapshot().error?.code).toBe('STORAGE');
    await s.recover(); expect(s.getSnapshot().error).toBeNull(); expect(send).not.toHaveBeenCalled();
  });
  it('new session creates UUID record; confirmed revision used on next request only', async () => {
    const storage = memStore();
    const store = new SessionStore(storage);
    const sent: RequestEnvelope[] = [];
    const s = sessionHarness({ store, send: async request => { sent.push(request); return readySnapshot({ sessionId: request.sessionId, revision: 7 }); } });
    await s.initialize();
    await s.message('prima richiesta');
    await s.message('seconda richiesta');
    expect(sent[0].expectedRevision).toBeUndefined();
    expect(sent[1].expectedRevision).toBe(7);
    expect(s.getSnapshot().pending).toBe(false);
  });

  it('persist pending BEFORE network; double tap triggers one invoke; pending blocks new message', async () => {
    const storage = memStore();
    const store = new SessionStore(storage);
    const gate = deferred<void>();
    const send = vi.fn(async (request: RequestEnvelope) => { await gate.promise; return readySnapshot({ sessionId: request.sessionId, revision: 3 }); });
    const s = sessionHarness({ store, send });
    await s.initialize();

    void s.message('tap-1');
    void s.message('tap-2');
    await nextTick();

    expect(storage.setItem).toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
    gate.resolve(undefined);
    await nextTick();

    send.mockRejectedValueOnce(new OrchestratorError('UNAVAILABLE'));
    await s.message('will-pend');
    expect(s.getSnapshot().pending).toBe(true);
    await s.message('blocked-while-pending');
    expect(s.getSnapshot().error?.code).toBe('UNAVAILABLE');
    await s.retry();
    expect(s.getSnapshot().pending).toBe(false);
  });

  it('503/timeout retry uses exact same request body and requestId', async () => {
    const storage = memStore();
    const store = new SessionStore(storage);
    const sent: RequestEnvelope[] = [];
    const send = vi.fn(async request => {
      sent.push(request);
      if (sent.length === 1) throw new OrchestratorError('UNAVAILABLE');
      return readySnapshot({ sessionId: request.sessionId, revision: 9 });
    });
    const s = sessionHarness({ store, send });
    await s.initialize();
    await s.message('retry me');
    expect(s.getSnapshot().pending).toBe(true);
    await s.retry();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
    expect(sent[1].requestId).toBe(sent[0].requestId);
  });

  it('409 has no auto-retry; explicit recover sends get_plan with new id and confirmed revision', async () => {
    const storage = memStore();
    const store = new SessionStore(storage);
    const sent: RequestEnvelope[] = [];
    const send = vi.fn(async request => {
      sent.push(request);
      if (sent.length === 1) return readySnapshot({ sessionId: request.sessionId, revision: 11 });
      if (sent.length === 2) throw new OrchestratorError('CONFLICT');
      return readySnapshot({ sessionId: request.sessionId, revision: 12, status: 'planning', plan: null });
    });
    const s = sessionHarness({ store, send });
    await s.initialize();
    await s.message('ok first');
    await s.message('conflict second');
    expect(s.getSnapshot().error?.code).toBe('CONFLICT');
    expect(send).toHaveBeenCalledTimes(2);

    await s.recover();
    expect(send).toHaveBeenCalledTimes(3);
    expect(sent[2].requestId).not.toBe(sent[1].requestId);
    expect(sent[2].expectedRevision).toBe(11);
    expect(sent[2].action).toEqual({ _fixtureWire: 'get_plan', payload: null });
  });

  it('storage failure before invoke makes zero network calls', async () => {
    const storage = memStore();
    storage.setItem.mockRejectedValue(new Error('disk fail before invoke'));
    const send = vi.fn(async () => readySnapshot());
    const s = sessionHarness({ store: new SessionStore(storage), send });
    await s.initialize();
    await s.message('blocked by storage');
    expect(send).toHaveBeenCalledTimes(0);
    expect(s.getSnapshot().error?.code).toBe('STORAGE');
  });

  it('storage failure after valid response keeps pending requestId for retry', async () => {
    const storage = memStore();
    const original = storage.setItem;
    storage.setItem = vi.fn(async (k: string, v: string) => {
      if (storage.setItem.mock.calls.length === 3) throw new Error('disk fail after response');
      return original(k, v);
    }) as never;
    const sent: RequestEnvelope[] = [];
    const send = vi.fn(async request => { sent.push(request); return readySnapshot({ sessionId: request.sessionId, revision: 13 }); });
    const s = sessionHarness({ store: new SessionStore(storage), send });
    await s.initialize();
    await s.message('storage fail post-response');
    expect(s.getSnapshot().error?.code).toBe('STORAGE');
    expect(s.getSnapshot().pending).toBe(true);
    await s.retry();
    expect(sent).toHaveLength(2);
    expect(sent[1].requestId).toBe(sent[0].requestId);
  });

  it('owner/account switch never renders stale success or stale error', async () => {
    let owner: string | null = 'owner-1';
    const gate = deferred<void>();
    const send = vi.fn(async (request: RequestEnvelope) => { await gate.promise; return readySnapshot({ sessionId: request.sessionId, revision: 14 }); });
    const s = sessionHarness({ currentOwner: () => owner, send });
    await s.initialize();
    void s.message('switch account');
    owner = 'owner-2';
    gate.resolve(undefined);
    await nextTick();
    expect(s.getSnapshot().error?.code).toBe('ACCOUNT_CHANGED');
    expect(s.getSnapshot().snapshot).toBeNull();

    const s2 = sessionHarness({ currentOwner: () => owner, send: async () => { throw new OrchestratorError('NETWORK'); } });
    owner = 'owner-1';
    await s2.initialize();
    const p = s2.message('error path');
    owner = 'owner-2';
    await p;
    expect(s2.getSnapshot().error?.code).toBe('ACCOUNT_CHANGED');
  });

  it('dispose aborts in-flight request and clears state', async () => {
    const send = vi.fn(async (_req, _owner, _still, signal) => {
      await new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new OrchestratorError('CANCELLED'))));
      return readySnapshot();
    });
    const s = sessionHarness({ send });
    await s.initialize();
    void s.message('dispose me');
    await nextTick();
    s.dispose();
    expect(s.getSnapshot()).toEqual({ phase: 'idle', snapshot: null, error: null, pending: false });
  });

  it('cold restart resumes stored pending id; confirmed record auto-recovers with get_plan', async () => {
    const seed = new Map<string, string>();
    const key = sessionKey('owner-1', 'target-1');
    seed.set(key, JSON.stringify({ storageVersion: 1, sessionId: 'sess-old', pending: {
      contractVersion: '1.0', sessionId: 'sess-old', requestId: 'req-old', targetAgentId: 'target-1', message: 'pending body',
    } }));
    const store = new SessionStore(memStore(seed));
    const send = vi.fn(async (request: RequestEnvelope) => readySnapshot({ sessionId: request.sessionId, revision: 20 }));
    const s = sessionHarness({ store, send, targetAgentId: 'target-1', uuid: () => 'new-id' });
    await s.initialize();
    expect(s.getSnapshot().phase).toBe('resume_pending');
    await s.retry();
    expect(send.mock.calls[0][0].requestId).toBe('req-old');

    const seed2 = new Map<string, string>();
    seed2.set(key, JSON.stringify({ storageVersion: 1, sessionId: 'sess-old', revision: 21 }));
    const send2 = vi.fn(async (request: RequestEnvelope) => readySnapshot({
      sessionId: request.sessionId,
      revision: 22,
      status: 'planning',
      plan: null,
      questions: [{ id: 'q1', text: 'Serve data', options: [{ id: 'o1', label: 'Oggi', command: { name: 'set_date', input: { date: '2099-10-05' } } }] }],
    }));
    const s2 = sessionHarness({ store: new SessionStore(memStore(seed2)), send: send2, targetAgentId: 'target-1', uuid: () => 'recover-new-id' });
    await s2.initialize();
    await nextTick();
    expect(send2).toHaveBeenCalledTimes(1);
    expect(send2.mock.calls[0][0].action).toEqual({ _fixtureWire: 'get_plan', payload: null });
    expect(send2.mock.calls[0][0].expectedRevision).toBe(21);
  });

  it('storage keys are isolated by owner and target', () => {
    expect(sessionKey('owner-1', undefined)).not.toBe(sessionKey('owner-1', 'target-1'));
    expect(sessionKey('owner-1', 'target-1')).not.toBe(sessionKey('owner-2', 'target-1'));
  });
});
