import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../lib/theme', () => ({ currentThemeMode: 'light' }));
vi.mock('../lib/supabase', () => ({ supabase: {} }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));
vi.mock('../lib/aitour/tours', () => ({ saveToursBatch: vi.fn() }));
import { runGptour } from '../lib/aitour/gptour-api';
import { DEFAULT_INTENT } from '../lib/aitour/gptour-intent';
import { eventDecision, pendingGptEvents, rescheduleGptFollowUp, type GptEvent } from '../lib/aitour/gptour-followups';
import { saveGptourBatch, reconcileGptourSave, type SaveDependencies } from '../lib/aitour/gptour-save';
import type { TourPlan } from '../lib/aitour/types';

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(() => { throw new Error('NETWORK FORBIDDEN: isolated GPTour tests'); })); });
const session = { data: { session: { user: { id: 'agent-a' }, access_token: 'synthetic-token' } }, error: null };
const request = { agentId: 'agent-a', role: 'agent', messages: [{ role: 'user' as const, content: 'giro' }], pool: [], intent: DEFAULT_INTENT, agentInfo: { agentId: 'forged' } };
const response = { effectiveAgentId: 'agent-a', reply: 'Giro', needsInfo: false, multiDay: false, selection: [], days: [], intent: { wantAll: true } };
const api = (data: unknown = response, error: unknown = null) => ({ auth: { getSession: vi.fn(async () => session) }, functions: { invoke: vi.fn(async () => ({ data, error })) } });

describe('authenticated existing Edge adapter', () => {
  it('invalid times and unrecognized follow-up actions never become a plan/decision', async () => {
    await expect(runGptour(request, api({ ...response, startTime: '99:99' }) as never)).rejects.toThrow('non valida');
    await expect(runGptour(request, api({ ...response, followUpActions: [{ action: 'delete', followUpId: 'f1' }] }) as never)).rejects.toThrow('non valide');
  });
  it('same function, same body; guarded agent ID wins', async () => {
    const client = api(); const out = await runGptour(request, client as never);
    expect(client.functions.invoke).toHaveBeenCalledWith('ai-tour-gptour', expect.objectContaining({ body: expect.objectContaining({ agentInfo: { agentId: 'agent-a' } }) }));
    expect(out.intent?.wantAll).toBe(true);
  });
  it.each(['agent', 'agentcustom'])('rejects %s impersonation before network', async (role) => {
    const client = api(); await expect(runGptour({ ...request, role, agentId: 'other' }, client as never)).rejects.toThrow('403'); expect(client.functions.invoke).not.toHaveBeenCalled();
  });
  it('403 preserves failure instead of constructing a plan', async () => { await expect(runGptour(request, api(null, { context: { status: 403 } }) as never)).rejects.toThrow('403'); });
  it.each([undefined, 'wrong-agent'])('missing/mismatched effective agent (%s)', async (id) => { await expect(runGptour(request, api({ ...response, effectiveAgentId: id }) as never)).rejects.toThrow('Nessun piano'); });
  it('sign-out during request discards response', async () => {
    const client = api(); client.auth.getSession.mockResolvedValueOnce(session).mockResolvedValueOnce({ data: { session: null }, error: null } as never);
    await expect(runGptour(request, client as never)).rejects.toThrow('Account cambiato');
  });
  it('unknown/incomplete edge payload is rejected to keep previous plan unchanged', async () => {
    await expect(runGptour(request, api({ effectiveAgentId: 'agent-a', reply: 'ok' }) as never)).rejects.toThrow('incompleta');
  });
});
const event: GptEvent = { id: 'f1', agentId: 'agent-a', customerId: 'c1', key: 'client:c1', name: 'Cliente isolato', date: '2099-10-05', time: '09:00', type: 'follow_up', appointmentDate: '2099-10-05T07:00:00Z', duration: 20 };
const eventApi = () => ({
  auth: { getSession: vi.fn(async () => session) },
  from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: event.id, agent_id: event.agentId, customer_id: event.customerId, status: 'scheduled', appointment_type: 'follow_up', appointment_date: event.appointmentDate }, error: null })) })) })) })) })),
  rpc: vi.fn(async () => ({ data: { id: event.id, local_date: '2099-10-06', local_time: '10:00:00', appointment_date: '2099-10-06T08:00:00Z' }, error: null })),
});
describe('follow-up events, not appointments', () => {
  it('keep/exclude per ID: another event of the same client remains pending', () => {
    const keep = eventDecision(event, 'keep'); expect(keep.decision).toBe('required');
    expect(pendingGptEvents([event, { ...event, id: 'f2' }], { ...DEFAULT_INTENT, followUpDecisions: [keep] }).map((e) => e.id)).toEqual(['f2']);
    expect(eventDecision(event, 'exclude').decision).toBe('excluded');
    expect(() => eventDecision({ ...event, type: 'visit' }, 'keep')).toThrow('appuntamento');
  });
  it('requires confirmation, no RPC on cancel', async () => {
    const client = eventApi(); await expect(rescheduleGptFollowUp(event, '2099-10-06', '10:00', { role: 'agent', agentId: 'agent-a', confirmed: false }, client as never)).rejects.toThrow('Conferma'); expect(client.rpc).not.toHaveBeenCalled();
  });
  it('owner check blocks foreign event before writing', async () => {
    const client = eventApi(); await expect(rescheduleGptFollowUp({ ...event, agentId: 'other' }, '2099-10-06', '10:00', { role: 'agentcustom', agentId: 'agent-a', confirmed: true }, client as never)).rejects.toThrow('non modificabile'); expect(client.rpc).not.toHaveBeenCalled();
  });
  it('actual RPC argument contract and confirmation only after success', async () => {
    const client = eventApi(); const out = await rescheduleGptFollowUp(event, '2099-10-06', '10:00', { role: 'agent', agentId: 'agent-a', confirmed: true }, client as never);
    expect(client.rpc).toHaveBeenCalledWith('ai_tour_reschedule_follow_up', { p_follow_up_id: 'f1', p_customer_id: 'c1', p_new_date: '2099-10-06', p_new_time: '10:00:00' });
    expect(out.decision.decision).toBe('rescheduled'); expect(out.event.date).toBe('2099-10-06');
  });
  it('RPC failure is not a success', async () => {
    const client = eventApi(); client.rpc.mockResolvedValue({ data: null, error: { message: 'isolated error' } } as never);
    await expect(rescheduleGptFollowUp(event, '2099-10-06', '10:00', { role: 'agent', agentId: 'agent-a', confirmed: true }, client as never)).rejects.toThrow('non confermato');
  });
});
const plan = (date: string): TourPlan => ({ stops: [], requiredStops: [], tourDate: date, finishMin: 500, endMin: 1080, routingFallback: false,
  areaFilter: { mode: 'auto', gptourContext: { version: 1, groupId: 'group', facts: [], intent: DEFAULT_INTENT } } } as unknown as TourPlan);
function saveDeps(): SaveDependencies & { writes: Map<string, string> } {
  const writes = new Map<string, string>();
  return { writes, storage: { getItem: vi.fn(async (key: string) => writes.get(key) || null), setItem: vi.fn(async (key: string, value: string) => { writes.set(key, value); }) },
    session: vi.fn(async () => 'agent-a'), batch: vi.fn(async () => ['id1', 'id2']), lookup: vi.fn(async () => []) };
}
describe('atomic batch boundary and safe uncertainty', () => {
  it('one batch call for all days; completed retries return same IDs', async () => {
    const d = saveDeps(), days = [plan('2099-10-05'), plan('2099-10-06')];
    expect(await saveGptourBatch('agent-a', 'agent-a', 'agent', days, 'group', d)).toEqual(['id1', 'id2']);
    expect(await saveGptourBatch('agent-a', 'agent-a', 'agent', days, 'group', d)).toEqual(['id1', 'id2']); expect(d.batch).toHaveBeenCalledTimes(1);
  });
  it('RPC day-N failure never falls back to individual header writes or blind retry', async () => {
    const d = saveDeps(), days = [plan('2099-10-05'), plan('2099-10-06')]; vi.mocked(d.batch).mockRejectedValue(new Error('transaction rolled back at day2'));
    await expect(saveGptourBatch('agent-a', 'agent-a', 'agent', days, 'group', d)).rejects.toThrow('verificare');
    await expect(saveGptourBatch('agent-a', 'agent-a', 'agent', days, 'group', d)).rejects.toThrow('verificare'); expect(d.batch).toHaveBeenCalledTimes(1);
  });
  it('lost success reconciles complete batch and never duplicates', async () => {
    const d = saveDeps(), days = [plan('2099-10-05'), plan('2099-10-06')]; vi.mocked(d.batch).mockRejectedValue(new Error('response lost after commit'));
    await expect(saveGptourBatch('agent-a', 'agent-a', 'agent', days, 'group', d)).rejects.toThrow();
    vi.mocked(d.lookup).mockResolvedValue([{ id: 'id1', tour_date: '2099-10-05' }, { id: 'id2', tour_date: '2099-10-06' }]);
    expect(await reconcileGptourSave('agent-a', 'agent-a', 'agent', 'group', d)).toEqual(['id1', 'id2']); expect(d.batch).toHaveBeenCalledTimes(1);
  });
  it('local journal failure stops before RPC', async () => {
    const d = saveDeps(); vi.mocked(d.storage.setItem).mockRejectedValue(new Error('disk full'));
    await expect(saveGptourBatch('agent-a', 'agent-a', 'agent', [plan('2099-10-05')], 'group', d)).rejects.toThrow('disk full'); expect(d.batch).not.toHaveBeenCalled();
  });
  it('storage failure AFTER successful commit remains uncertain, not a safe-to-repeat failure', async () => {
    const d = saveDeps(); const original = d.storage.setItem;
    vi.mocked(d.storage.setItem).mockImplementationOnce(async (k, v) => { d.writes.set(k, v); });
    vi.mocked(original).mockRejectedValue(new Error('disk full after commit'));
    await expect(saveGptourBatch('agent-a', 'agent-a', 'agent', [plan('2099-10-05'), plan('2099-10-06')], 'group', d)).rejects.toThrow('Esito del batch da verificare');
    await expect(saveGptourBatch('agent-a', 'agent-a', 'agent', [plan('2099-10-05'), plan('2099-10-06')], 'group', d)).rejects.toThrow('verificare');
    expect(d.batch).toHaveBeenCalledTimes(1);
  });
  it('session changed or foreign target never reaches batch', async () => {
    const d = saveDeps(); await expect(saveGptourBatch('foreign', 'agent-a', 'agentcustom', [plan('2099-10-05')], 'group', d)).rejects.toThrow('403'); expect(d.batch).not.toHaveBeenCalled();
  });
  it('reconcile refuses partial lookup and never issues a second batch call', async () => {
    const d = saveDeps(), days = [plan('2099-10-05'), plan('2099-10-06')];
    vi.mocked(d.batch).mockRejectedValue(new Error('response lost after commit'));
    await expect(saveGptourBatch('agent-a', 'agent-a', 'agent', days, 'group', d)).rejects.toThrow('verificare');
    vi.mocked(d.lookup).mockResolvedValue([{ id: 'id1', tour_date: '2099-10-05' }]);
    await expect(reconcileGptourSave('agent-a', 'agent-a', 'agent', 'group', d)).rejects.toThrow('Esito ancora');
    expect(d.batch).toHaveBeenCalledTimes(1);
  });
});