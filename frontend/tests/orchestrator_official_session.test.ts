import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { APPROVED_ORCHESTRATOR_BINDING } from '../lib/aitour/orchestrator/binding';
import { OrchestratorSession } from '../lib/aitour/orchestrator/session';
import { SessionStore, TRANSCRIPT_TTL_MS, clearOrchestratorLocalState, sessionKey } from '../lib/aitour/orchestrator/storage';
import { createOrchestratorTransport, type OrchestratorClient } from '../lib/aitour/gptour-orchestrator-api';
import { OrchestratorError } from '../lib/aitour/orchestrator/errors';
import type { RequestEnvelope } from '../lib/aitour/orchestrator/contract';
import { syntheticOfficialResponse } from './fixtures/orchestrator-official-synthetic';
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), getAllKeys: vi.fn(async () => []) } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'mock-uuid' }));

vi.mock('../lib/supabase', () => ({ supabase: {} }));

type KV = Map<string, string>;

function memStorage(seed?: KV) {
  const db = seed ?? new Map<string, string>();
  return {
    db,
    getItem: vi.fn(async (k: string) => db.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      db.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      db.delete(k);
    }),
    getAllKeys: vi.fn(async () => [...db.keys()]),
  };
}

const responseError = (status: number, body: unknown) => ({ data: null, error: { context: new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }) } });
const fixtureErrors = (): Record<string, { http: number; body: unknown }> => JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/official-handoff/gptour_mobile_handoff/examples/05_errors.json', import.meta.url) as any), 'utf8')) as Record<string, { http: number; body: unknown }>;

function clientWith(invoke: ReturnType<typeof vi.fn>): OrchestratorClient {
  const getSession = vi.fn(async () => ({ data: { session: { access_token: 'token', user: { id: 'owner-1' } } }, error: null }));
  return { auth: { getSession }, functions: { invoke } } as unknown as OrchestratorClient;
}

function makeSession(args: {
  store: SessionStore;
  invoke: ReturnType<typeof vi.fn>;
  owner?: string;
  target?: string;
  uuid?: () => string;
}) {
  const owner = args.owner ?? 'owner-1';
  const send = createOrchestratorTransport({ binding: APPROVED_ORCHESTRATOR_BINDING, client: clientWith(args.invoke), isolatedTest: true, timeoutMs: 50 });
  return new OrchestratorSession({
    ownerId: owner,
    targetAgentId: args.target,
    currentOwner: () => owner,
    binding: APPROVED_ORCHESTRATOR_BINDING,
    send,
    store: args.store,
    uuid: args.uuid ?? (() => `req-${Math.random().toString(16).slice(2, 8)}`),
  });
}

describe('Official Orchestrator session + transport IO-mocked tests', () => {
  it('500 retry reuses exact body/requestId', async () => {
    const errors = fixtureErrors();
    const storage = memStorage();
    const store = new SessionStore(storage);
    const seen: RequestEnvelope[] = [];
    const invoke = vi.fn(async (_name, options?: { body?: RequestEnvelope }) => {
      const req = options?.body as RequestEnvelope;
      seen.push(req);
      if (seen.length === 1) return responseError(500, errors['500'].body);
      return { data: syntheticOfficialResponse(req, 'ready'), error: null };
    });
    const s = makeSession({ store, invoke, uuid: (() => {
      const ids = ['sess-1', 'req-1', 'req-2'];
      return () => ids.shift() ?? 'req-z';
    })() });

    await s.initialize();
    await s.message('Richiesta con possibile 500');
    expect(s.getSnapshot().error?.code).toBe('UNAVAILABLE');
    expect(s.getSnapshot().pending).toBe(true);
    await s.retry();
    expect(seen).toHaveLength(2);
    expect(seen[1]).toEqual(seen[0]);
    expect(seen[1].requestId).toBe(seen[0].requestId);
  });

  it('422 retry keeps same id, does not duplicate transcript, then new message gets new id', async () => {
    const storage = memStorage();
    const store = new SessionStore(storage);
    const seen: RequestEnvelope[] = [];
    const invoke = vi.fn(async (_name, options?: { body?: RequestEnvelope }) => {
      const req = options?.body as RequestEnvelope;
      seen.push(req);
      if (seen.length <= 2) return responseError(422, syntheticOfficialResponse(req, 'failed'));
      return { data: syntheticOfficialResponse(req, 'ready'), error: null };
    });

    const ids = ['sess-2', 'req-a', 'req-b', 'req-c'];
    const s = makeSession({ store, invoke, uuid: () => ids.shift() ?? 'req-last' });
    await s.initialize();
    await s.message('Richiesta destinata a 422/failed');
    expect(s.getSnapshot().canRetryResponse).toBe(true);

    await s.retry();
    expect(seen[1].requestId).toBe(seen[0].requestId);
    const snapAfterRetry = s.getSnapshot().snapshot;
    expect(snapAfterRetry?.status).toBe('failed');
    expect(snapAfterRetry?.revision).toBe(1);
    expect(snapAfterRetry?.messages.filter(m => m.id.endsWith('-u')).length).toBe(1);
    expect(snapAfterRetry?.messages.filter(m => m.id.endsWith('-a')).length).toBe(1);

    await s.message('Messaggio nuovo');
    expect(seen[2].requestId).not.toBe(seen[0].requestId);
    expect(seen[2].expectedRevision).toBe(1);
    expect(s.getSnapshot().snapshot?.status).toBe('ready');
  });

  it('409 aligns revision (0 -> 2), no auto-retry, next message uses new id/current revision', async () => {
    const errors = fixtureErrors();
    const storage = memStorage();
    const store = new SessionStore(storage);
    const seen: RequestEnvelope[] = [];
    const invoke = vi.fn(async (_name, options?: { body?: RequestEnvelope }) => {
      const req = options?.body as RequestEnvelope;
      seen.push(req);
      if (seen.length === 1) return { data: syntheticOfficialResponse(req, 'needs_clarification'), error: null };
      if (seen.length === 2) {
        const body = errors['409_revision_conflict'].body as Record<string, unknown>;
        return responseError(409, { ...body, sessionRevision: 2 });
      }
      return { data: syntheticOfficialResponse(req, 'ready'), error: null };
    });
    const ids = ['sess-3', 'req-1', 'req-2', 'req-3'];
    const s = makeSession({ store, invoke, uuid: () => ids.shift() ?? 'req-final' });

    await s.initialize();
    await s.message('prima');
    expect(s.getSnapshot().snapshot?.revision).toBe(1);
    await s.message('seconda');
    expect(s.getSnapshot().error?.code).toBe('CONFLICT');
    expect(s.getSnapshot().snapshot?.revision).toBe(2);
    expect(invoke).toHaveBeenCalledTimes(2);

    await s.message('terza');
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(seen[2].requestId).not.toBe(seen[1].requestId);
    expect(seen[2].expectedRevision).toBe(2);
  });

  it('resume with stored planId calls get_plan(planId), while clarification restore does not auto-call', async () => {
    const key = sessionKey('owner-1', 'target-1');
    const now = Date.now();

    const seed = new Map<string, string>();
    seed.set(key, JSON.stringify({ storageVersion: 1, sessionId: 'sess-r', revision: 5, planId: 'plan-123', savedAt: now, ownerId: 'owner-1', targetId: 'target-1', transcript: [{ id: 'm1', role: 'assistant', text: 'ok' }], cache: { sessionId: 'sess-r', revision: 5, status: 'planning', questions: [], warnings: [] } }));
    const store = new SessionStore(memStorage(seed));
    const invoke = vi.fn(async (_name, options?: { body?: RequestEnvelope }) => {
      const data = syntheticOfficialResponse(options?.body as RequestEnvelope, 'ready');
      data.planId = 'plan-123'; data.plan!.planId = 'plan-123'; data.plan!.sessionRevision = 5;
      return { data, error: null };
    });

    const s = makeSession({ store, invoke, target: 'target-1', uuid: () => 'new-id' });
    await s.initialize();
    expect(invoke).toHaveBeenCalledTimes(1);
    const sent = invoke.mock.calls[0][1]?.body as RequestEnvelope;
    expect(sent.action).toEqual({ type: 'get_plan', planId: 'plan-123' });
    expect(s.getSnapshot().error).toBeNull();
    expect(s.getSnapshot().snapshot?.planId).toBe('plan-123');
    expect(s.getSnapshot().snapshot?.messages).toEqual([{ id: 'm1', role: 'assistant', text: 'ok' }]);

    const seedNoPlan = new Map<string, string>();
    seedNoPlan.set(key, JSON.stringify({ storageVersion: 1, sessionId: 'sess-r2', revision: 5, savedAt: now, ownerId: 'owner-1', targetId: 'target-1', transcript: [{ id: 'm2', role: 'assistant', text: 'Serve chiarimento' }], cache: { sessionId: 'sess-r2', revision: 5, status: 'needs_clarification', questions: [], warnings: [] } }));
    const invoke2 = vi.fn(async () => ({ data: null, error: null }));
    const s2 = makeSession({ store: new SessionStore(memStorage(seedNoPlan)), invoke: invoke2, target: 'target-1' });
    await s2.initialize();
    expect(invoke2).not.toHaveBeenCalled();
  });

  it('TTL 24h expiration resets transcript and transcript storage excludes geometry', async () => {
    const key = sessionKey('owner-1');
    const oldSeed = new Map<string, string>();
    oldSeed.set(key, JSON.stringify({ storageVersion: 1, sessionId: 'sess-old', revision: 3, savedAt: Date.now() - TRANSCRIPT_TTL_MS - 5 }));
    const storage = memStorage(oldSeed);
    const store = new SessionStore(storage);
    const invoke = vi.fn(async (_name, options?: { body?: RequestEnvelope }) => ({ data: syntheticOfficialResponse(options?.body as RequestEnvelope, 'ready'), error: null }));

    const ids = ['sess-new', 'req-1'];
    const s = makeSession({ store, invoke, uuid: () => ids.shift() ?? 'req-z' });
    await s.initialize();
    await s.message('piano completo');

    const persisted = storage.db.get(key) ?? '';
    expect(persisted).toContain('sess-new');
    expect(persisted).not.toContain('"geometry"');
    expect(persisted).not.toContain('"stops"');
  });

  it('target switch isolates records; logout clear rejects stale in-flight write resurrection', async () => {
    const storage = memStorage();
    const store = new SessionStore(storage);
    await store.activate('owner-1', 'target-a');
    await store.write('owner-1', 'target-a', { storageVersion: 1, sessionId: 'sess-a', revision: 1 });
    await store.activate('owner-1', 'target-b');
    await store.write('owner-1', 'target-b', { storageVersion: 1, sessionId: 'sess-b', revision: 1 });
    expect(await store.read('owner-1', 'target-a')).toBeNull();
    expect(await store.read('owner-1', 'target-b')).toMatchObject({ sessionId: 'sess-b' });

    const delayed = memStorage();
    const staleStore = new SessionStore(delayed);
    await clearOrchestratorLocalState(delayed);
    await expect(staleStore.write('owner-1', undefined, { storageVersion: 1, sessionId: 'sess-delayed', revision: 1 })).rejects.toThrowError(OrchestratorError);
    expect(await delayed.getAllKeys()).toEqual([]);
  });
});
