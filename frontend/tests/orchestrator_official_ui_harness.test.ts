import { describe, expect, it, vi } from 'vitest';
import { APPROVED_ORCHESTRATOR_BINDING } from '../lib/aitour/orchestrator/binding';
import { OrchestratorSession } from '../lib/aitour/orchestrator/session';
import { SessionStore } from '../lib/aitour/orchestrator/storage';
import { createOrchestratorTransport, type OrchestratorClient } from '../lib/aitour/gptour-orchestrator-api';
import type { RequestEnvelope } from '../lib/aitour/orchestrator/contract';
import { definitivePlan, visibleServerPlan } from '../lib/aitour/orchestrator/view';
import { syntheticOfficialResponse } from './fixtures/orchestrator-official-synthetic';
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), getAllKeys: vi.fn(async () => []) } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'mock-uuid' }));

vi.mock('../lib/supabase', () => ({ supabase: {} }));

function memStore() {
  const db = new Map<string, string>();
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

describe('Temporary UI harness (controller+binding real, IO mocked)', () => {
  it('follow-up -> planning draft visible/non-confirmable -> ready verified, warnings/excluded/day picker, 503 retry', async () => {
    const storage = memStore();
    const store = new SessionStore(storage);
    const seen: RequestEnvelope[] = [];
    let phase = 0;
    const invoke = vi.fn(async (_name, options?: { body?: RequestEnvelope }) => {
      const req = options?.body as RequestEnvelope;
      seen.push(req);
      phase += 1;
      if (phase === 1) return { data: syntheticOfficialResponse(req, 'planning'), error: null };
      if (phase === 2) return { data: syntheticOfficialResponse(req, 'ready'), error: null };
      if (phase === 3) return responseError(503, { error: 'gptour-orchestrator non attivo', engineVersion: 'gptour-orchestrator/0.2.0' });
      return { data: syntheticOfficialResponse(req, 'ready'), error: null };
    });

    const getSession = vi.fn(async () => ({ data: { session: { access_token: 'token', user: { id: 'owner-1' } } }, error: null }));
    const client = { auth: { getSession }, functions: { invoke } } as unknown as OrchestratorClient;
    const send = createOrchestratorTransport({ binding: APPROVED_ORCHESTRATOR_BINDING, client, isolatedTest: true });

    const ids = ['sess-1', 'req-1', 'req-2', 'req-3', 'req-4'];
    const s = new OrchestratorSession({
      ownerId: 'owner-1',
      currentOwner: () => 'owner-1',
      binding: APPROVED_ORCHESTRATOR_BINDING,
      send,
      store,
      uuid: () => ids.shift() ?? 'req-final',
    });

    await s.initialize();
    await s.message('Organizzami un giro');
    const planning = s.getSnapshot().snapshot;
    expect(planning?.status).toBe('planning');
    expect(visibleServerPlan(planning ?? null, false)).toBeTruthy();
    expect(definitivePlan(planning ?? null, false)).toBeNull();
    expect(planning?.questions[0].followUps?.map(f => f.id)).toEqual(['fu-1', 'fu-2']);

    await s.action({ name: 'follow_up_decision', input: { followUpId: 'fu-1', decision: 'exclude' } });
    const ready = s.getSnapshot().snapshot;
    expect(ready?.status).toBe('ready');
    expect(definitivePlan(ready ?? null, false)?.routing).toBe('verified');
    expect(ready?.plan?.warnings.length).toBeGreaterThan(0);
    expect(ready?.plan?.excluded?.length).toBeGreaterThan(0);
    expect(ready?.plan?.days.map(d => d.id)).toEqual(['1', '2']);

    await s.message('Riprova in caso di 503');
    expect(s.getSnapshot().error?.code).toBe('UNAVAILABLE');
    expect(s.getSnapshot().pending).toBe(true);
    await s.retry();
    expect(s.getSnapshot().error).toBeNull();
    expect(seen[3]).toEqual(seen[2]);
    expect(invoke.mock.calls.every(call => call[0] === 'gptour-orchestrator')).toBe(true);
  });
});
