import { describe, expect, it, vi } from 'vitest';
import { APPROVED_ORCHESTRATOR_BINDING as binding, decodeOfficialResponse } from '../lib/aitour/orchestrator/binding';
import { createOrchestratorTransport, type OrchestratorClient } from '../lib/aitour/gptour-orchestrator-api';
import { syntheticOfficialResponse } from './fixtures/orchestrator-official-synthetic';
import { presentQuestion } from '../lib/aitour/orchestrator/presentation';
import type { RequestEnvelope } from '../lib/aitour/orchestrator/contract';
import { OrchestratorSession } from '../lib/aitour/orchestrator/session';
import { SessionStore, clearOrchestratorLocalState } from '../lib/aitour/orchestrator/storage';
vi.mock('../lib/supabase', () => ({ supabase: {} }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'unused' }));
const request: RequestEnvelope = { contractVersion: '1.0', sessionId: 's', requestId: 'r', message: 'oggi domani clienti 15/20/30 ore 10 aggiungi Opera fine 16' };
const data = () => structuredClone(syntheticOfficialResponse(request, 'ready'));
const storeData = () => {
  const map = new Map<string, string>();
  return { map, getItem: async (k: string) => map.get(k) ?? null, setItem: async (k: string, v: string) => { map.set(k, v); },
    removeItem: async (k: string) => { map.delete(k); }, getAllKeys: async () => [...map.keys()] };
};
describe('Official edge conditions and faithful presentation', () => {
  it('rejects malformed outbound fields before auth/invoke', async () => {
    const client = { auth: { getSession: vi.fn() }, functions: { invoke: vi.fn() } } as unknown as OrchestratorClient;
    const send = createOrchestratorTransport({ binding, client });
    const invalid = [{ sessionId: 's'.repeat(129) }, { requestId: 'r'.repeat(129) }, { message: 'x'.repeat(2001) },
      { expectedRevision: '1' }, { expectedRevision: 0.5 }, { departure: { lat: 45, lng: 9, label: 3 } },
      { gps: { lat: 45, lng: 9, accuracyM: -1, capturedAt: 'now' } }, { departure: { lat: 45, lng: 9, extra: true } }];
    for (const patch of invalid) await expect(send({ ...request, ...patch } as RequestEnvelope, 'owner', () => true)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(client.auth.getSession).not.toHaveBeenCalled(); expect(client.functions.invoke).not.toHaveBeenCalled();
  });
  it('keeps geometry LAT,LNG and exact order, does not recalculate totals', () => {
    const raw = data(); raw.plan!.days![0].totals.totalKm = 123.4;
    const plan = decodeOfficialResponse(raw, request).plan!;
    expect(plan.days[0].geometry).toEqual(raw.plan!.days![0].geometry.map(([latitude, longitude]) => ({ latitude, longitude })));
    expect(plan.days[0].stops.map(s => s.name)).toEqual(raw.plan!.days![0].stops.map(s => s.name));
    expect(plan.days[0].metrics.find(m => m.id === 'distance')?.value).toBe('123,4 km');
    expect(plan.days[0].overnight).toContain('61,0 km');
    expect(plan.days[1].start.label).toContain('fine giornata precedente');
  });
  it('supports single-day without generating any geometry when the server provides none', () => {
    const raw = data(); delete raw.plan!.days; raw.plan!.geometry = [];
    const day = decodeOfficialResponse(raw, request).plan!.days[0];
    expect(day.geometryKind).toBe('missing');
    expect(day.geometry).toEqual([]);
    expect(day.stops[0].arrival).toBe('07:50');
    expect(day.stops[1].lunch).toBe('30 min');
    expect(day.stops[0].lastOrder).toBe('2026-09-18 · 24 giorni');
  });
  it('rejects ready-estimated and planning-verified inconsistent responses', () => {
    const raw = data(); raw.plan!.verification = 'estimated_routing';
    expect(() => decodeOfficialResponse(raw, request)).toThrow();
    const other = data(); other.status = 'planning';
    expect(() => decodeOfficialResponse(other, request)).toThrow();
  });
  it('rejects mismatched retrieved planId and allows older stored plan revision in current session', () => {
    const raw = data(); raw.sessionRevision = 8;
    const req = { ...request, message: undefined, action: { type: 'get_plan', planId: raw.planId! }, expectedRevision: 8 };
    expect(decodeOfficialResponse(raw, req).planId).toBe(raw.planId);
    expect(() => decodeOfficialResponse(raw, { ...req, action: { type: 'get_plan', planId: 'another-plan' } })).toThrow();
    raw.plan!.sessionRevision = 9; expect(() => decodeOfficialResponse(raw, req)).toThrow();
  });
  it('preserves all warnings/quality notes/pending decisions and server exclusion reasons', () => {
    const raw = data(); raw.conflicts = ['conflict']; raw.dataQuality.notes = ['nota']; raw.pendingDecisions = ['reschedule_proposals_not_applied'];
    raw.plan!.days![0].warnings = ['avviso giorno']; raw.plan!.days![0].conflicts = ['conflitto giorno'];
    const snap = decodeOfficialResponse(raw, request);
    expect(snap.warnings).toEqual(['conflict', 'nota']); expect(snap.pendingDecisions).toEqual(raw.pendingDecisions);
    expect(snap.plan!.warnings).toEqual(raw.plan!.warnings); expect(snap.plan!.excluded).toEqual(raw.plan!.selectionReasons.excluded);
    expect(snap.plan!.days[0].warnings).toEqual(['avviso giorno', 'conflitto giorno']);
  });
  it.each(['infeasible', 'failed', 'blocked'] as const)('%s never displays a plan', status => {
    const raw = syntheticOfficialResponse(request, status);
    expect(decodeOfficialResponse(raw, request).plan).toBeNull();
    raw.plan = data().plan; raw.planId = raw.plan!.planId;
    expect(() => decodeOfficialResponse(raw, request)).toThrow();
  });
  it('never guesses followup row mapping, all decisions are exact wire actions', () => {
    expect(presentQuestion({ id: 'followups:a,b', kind: 'follow_ups', text: '• solo una riga', options: [] }).followUps).toBeUndefined();
    for (const decision of ['include', 'exclude', 'propose_reschedule']) expect(binding.encodeAction({ name: 'follow_up_decision', input: { followUpId: 'event-1', decision, proposedDate: '2026-10-13' } })).toEqual({ type: 'follow_up_decision', followUpId: 'event-1', decision, proposedDate: '2026-10-13' });
  });
  it('new conversation generates a fresh session without reset/CRM network calls', async () => {
    let id = 0; const sent: RequestEnvelope[] = [];
    const s = new OrchestratorSession({ ownerId: 'owner', currentOwner: () => 'owner', binding, uuid: () => String(++id), store: new SessionStore(storeData()),
      send: async r => { sent.push(r); return decodeOfficialResponse(syntheticOfficialResponse(r, 'ready'), r); } });
    await s.initialize(); await s.message('first'); const old = sent[0].sessionId;
    await s.newConversation(); expect(s.getSnapshot().snapshot).toBeNull(); expect(sent).toHaveLength(1);
    await s.message('second'); expect(sent[1].sessionId).not.toBe(old); expect(sent[1].expectedRevision).toBeUndefined();
  });
  it('logout waits for an already in-flight storage write and prevents transcript resurrection', async () => {
    const storage = storeData(); let release!: () => void; let started!: () => void;
    const began = new Promise<void>(resolve => { started = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const original = storage.setItem;
    storage.setItem = async (k, v) => { started(); await gate; await original(k, v); };
    const stale = new SessionStore(storage);
    const write = stale.write('owner', undefined, { storageVersion: 1, sessionId: 'old' });
    const caught = expect(write).rejects.toMatchObject({ code: 'STORAGE' });
    await began; const cleanup = clearOrchestratorLocalState(storage); release(); await cleanup; await caught;
    expect([...storage.map.keys()]).toEqual([]);
    const fresh = new SessionStore(storage); await fresh.write('new-owner', undefined, { storageVersion: 1, sessionId: 'new' });
    expect(await fresh.read('new-owner')).toMatchObject({ sessionId: 'new' });
  });
});