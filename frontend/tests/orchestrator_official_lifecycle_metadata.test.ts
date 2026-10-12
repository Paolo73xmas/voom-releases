import { describe, expect, it, vi } from 'vitest';
import { APPROVED_ORCHESTRATOR_BINDING } from '../lib/aitour/orchestrator/binding';
import { OrchestratorSession } from '../lib/aitour/orchestrator/session';
import { SessionStore } from '../lib/aitour/orchestrator/storage';
import { createOrchestratorTransport, type OrchestratorClient } from '../lib/aitour/gptour-orchestrator-api';
import type { RequestEnvelope } from '../lib/aitour/orchestrator/contract';
import { syntheticOfficialResponse } from './fixtures/orchestrator-official-synthetic';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), getAllKeys: vi.fn(async () => []) } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'mock-uuid' }));
vi.mock('../lib/supabase', () => ({ supabase: {} }));

function memStore(seed?: Map<string, string>) {
  const db = seed ?? new Map<string, string>();
  return {
    db,
    getItem: vi.fn(async (k: string) => db.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => { db.set(k, v); }),
    removeItem: vi.fn(async (k: string) => { db.delete(k); }),
    getAllKeys: vi.fn(async () => [...db.keys()]),
  };
}

function responseError(status: number, body: unknown) {
  return { data: null, error: { context: new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }) } };
}

function makeSession(args: {
  store: SessionStore;
  invoke: ReturnType<typeof vi.fn>;
  owner?: string;
  uuid?: () => string;
}) {
  const owner = args.owner ?? 'owner-1';
  const getSession = vi.fn(async () => ({ data: { session: { access_token: 'token', user: { id: owner } } }, error: null }));
  const client = { auth: { getSession }, functions: { invoke: args.invoke } } as unknown as OrchestratorClient;
  const send = createOrchestratorTransport({ binding: APPROVED_ORCHESTRATOR_BINDING, client, isolatedTest: true, timeoutMs: 5000 });
  return new OrchestratorSession({
    ownerId: owner,
    currentOwner: () => owner,
    binding: APPROVED_ORCHESTRATOR_BINDING,
    send,
    store: args.store,
    uuid: args.uuid ?? (() => `req-${Math.random().toString(16).slice(2, 8)}`),
  });
}

describe('official lifecycle metadata/session persistence coverage', () => {
  it('get_plan for the same planning revision keeps an active question linked to its original assistant message', async () => {
    const storage = memStore();
    let response: ReturnType<typeof syntheticOfficialResponse>;
    const invoke = vi.fn(async (_name, options?: { body?: RequestEnvelope }) => {
      const req = options?.body as RequestEnvelope;
      if (!response) {
        response = syntheticOfficialResponse(req, 'planning');
        response.message = response.question!.text;
      }
      return { data: { ...response, requestId: req.requestId }, error: null };
    });
    const ids = ['session', 'turn', 'recovery'];
    const s = makeSession({ store: new SessionStore(storage), invoke, uuid: () => ids.shift()! });
    await s.initialize(); await s.message('richiesta');
    const before = s.getSnapshot().snapshot!;
    await s.recover();
    const after = s.getSnapshot().snapshot!;
    expect(after.questions[0].messageId).toBe('turn-a');
    expect(after.messages).toEqual(before.messages);
    expect(invoke).toHaveBeenCalledTimes(2);
  });
  it('rapid two actions while pending produce one invoke (official binding + session store)', async () => {
    const storage = memStore();
    const gate = (() => {
      let resolve!: () => void;
      const promise = new Promise<void>(r => { resolve = r; });
      return { promise, resolve };
    })();
    const seen: RequestEnvelope[] = [];
    const invoke = vi.fn(async (_name, options?: { body?: RequestEnvelope }) => {
      const req = options?.body as RequestEnvelope;
      seen.push(req);
      await gate.promise;
      return { data: syntheticOfficialResponse(req, 'ready'), error: null };
    });
    const ids = ['sess-1', 'req-a', 'req-b'];
    const s = makeSession({ store: new SessionStore(storage), invoke, uuid: () => ids.shift() ?? 'req-z' });

    await s.initialize();
    const p1 = s.action({ name: 'set_start_time', input: { time: '08:00' } });
    const p2 = s.action({ name: 'set_date', input: { date: '2026-10-20' } });
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    gate.resolve();
    await Promise.all([p1, p2]);
    expect(seen).toHaveLength(1);
  });

  it('stores/restores distinct question metadata with messageId and historic message.question', async () => {
    const storage = memStore();
    const invoke = vi.fn(async (_name, options?: { body?: RequestEnvelope }) => {
      const req = options?.body as RequestEnvelope;
      const payload = syntheticOfficialResponse(req, 'planning');
      payload.message = 'Messaggio distinto dalla domanda';
      if (payload.question) {
        payload.question.id = 'q-distinct-1';
        payload.question.text = 'Domanda distinta?';
      }
      return { data: payload, error: null };
    });
    const ids = ['sess-2', 'req-1'];
    const store = new SessionStore(storage);
    const s = makeSession({ store, invoke, uuid: () => ids.shift() ?? 'req-last' });

    await s.initialize();
    await s.message('prima richiesta');

    const key = [...storage.db.keys()].find(k => k.startsWith('voom:orchestrator:1:owner-1:self'))!;
    const saved = JSON.parse(storage.db.get(key)!);
    expect(saved.transcript.some((m: { question?: { id: string; text: string } }) => m.question?.id === 'q-distinct-1')).toBe(true);
    expect(saved.cache.questions[0].messageId).toBe('req-1-a');

    const invokeRecover = vi.fn(async (_name, options?: { body?: RequestEnvelope }) => {
      const req = options?.body as RequestEnvelope;
      const payload = syntheticOfficialResponse(req, 'ready');
      payload.message = 'Messaggio di recovery';
      return { data: payload, error: null };
    });
    const restored = makeSession({ store: new SessionStore(storage), invoke: invokeRecover, uuid: () => 'req-recover' });
    await restored.initialize();
    const snap = restored.getSnapshot().snapshot;
    expect(snap?.messages.some(m => m.id === 'req-1-a' && m.question?.id === 'q-distinct-1')).toBe(true);
    // get_plan may return ready without active question options; historic metadata must still persist in transcript.
    expect(snap?.messages.some(m => m.question?.text === 'Domanda distinta?')).toBe(true);
  });

  it('preserves repeated question text across turns (no global dedup) with distinct turn ids', async () => {
    const storage = memStore();
    let turn = 0;
    const invoke = vi.fn(async (_name, options?: { body?: RequestEnvelope }) => {
      const req = options?.body as RequestEnvelope;
      turn += 1;
      const payload = syntheticOfficialResponse(req, 'planning');
      payload.message = 'Stessa risposta';
      if (payload.question) {
        payload.question.id = `q-repeat-${turn}`;
        payload.question.text = 'Stessa domanda?';
      }
      return { data: payload, error: null };
    });
    const ids = ['sess-3', 'req-a', 'req-b', 'req-c'];
    const s = makeSession({ store: new SessionStore(storage), invoke, uuid: () => ids.shift() ?? 'req-x' });

    await s.initialize();
    await s.message('turno uno');
    await s.message('turno due');
    const snap = s.getSnapshot().snapshot!;

    const assistantRepeats = snap.messages.filter(m => m.role === 'assistant' && m.text === 'Stessa risposta');
    expect(assistantRepeats).toHaveLength(2);
    expect(new Set(assistantRepeats.map(m => m.id)).size).toBe(2);
    expect(snap.messages.filter(m => m.question?.text === 'Stessa domanda?').length).toBe(2);
  });

  it('503 retry keeps same requestId/body and get_plan recovery preserves historic metadata', async () => {
    const storage = memStore();
    const seen: RequestEnvelope[] = [];
    let call = 0;
    const invoke = vi.fn(async (_name, options?: { body?: RequestEnvelope }) => {
      const req = options?.body as RequestEnvelope;
      seen.push(req);
      call += 1;
      if (call === 1) return responseError(503, { error: 'temporary' });
      if (call === 3) {
        const payload = syntheticOfficialResponse(req, 'ready');
        payload.message = 'Recovery get_plan';
        return { data: payload, error: null };
      }
      const payload = syntheticOfficialResponse(req, 'planning');
      payload.message = 'Stato con domanda';
      if (payload.question) {
        payload.question.id = 'q-503';
        payload.question.text = 'Domanda 503';
      }
      return { data: payload, error: null };
    });
    const ids = ['sess-4', 'req-1', 'req-2', 'req-3'];
    const s = makeSession({ store: new SessionStore(storage), invoke, uuid: () => ids.shift() ?? 'req-last' });

    await s.initialize();
    await s.message('retry503 scenario');
    expect(s.getSnapshot().error?.code).toBe('UNAVAILABLE');
    await s.retry();
    expect(seen[1]).toEqual(seen[0]);
    expect(seen[1].requestId).toBe(seen[0].requestId);

    const before = s.getSnapshot().snapshot!;
    const beforeQuestionIds = before.messages.filter(m => m.question).map(m => m.question!.id);
    await s.recover();
    const recoverReq = seen[2];
    expect(recoverReq.action).toEqual({ type: 'get_plan', planId: before.planId });
    expect(recoverReq.requestId).not.toBe(seen[1].requestId);

    const after = s.getSnapshot().snapshot!;
    expect(after.messages.map(m => m.id)).toEqual(before.messages.map(m => m.id));
    expect(after.messages.filter(m => m.question).map(m => m.question!.id)).toEqual(beforeQuestionIds);
  });
});
