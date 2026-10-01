import { describe, expect, it, vi, beforeEach } from 'vitest';
import { saveToursBatch } from '../lib/aitour/tours';
import type { TourCandidate, TourPlan } from '../lib/aitour/types';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('../lib/theme', () => ({ currentThemeMode: 'light' }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }));
// Use the REAL serializer and saveToursBatch; only the network boundary is simulated.

function plan(): TourPlan {
  const candidate = (isFollowUp?: boolean): TourCandidate => ({ key: isFollowUp ? 'client:follow' : 'client:normal',
    entityType: 'client', customerId: isFollowUp ? 'follow' : 'normal', tabaccheriaId: null, name: isFollowUp ? 'Follow-up fixture' : 'Normale fixture',
    lat: 45.4, lng: 9.1, city: 'Rozzano', province: 'MI', address: 'Via fixture', lastVisitDate: null, lastOrderDate: null,
    daysSinceVisit: null, daysSinceOrder: null, orderCount: 0, totalRevenue: 0, revenue6m: 0, avgOrderValue: 0, avgReorderDays: null,
    followUpDate: null, appointmentAt: null, notes: null, orphanStatus: null, estimatedRevenue: null, score: 0, priorityClass: 'Media',
    reason: '', nextSuggestedVisit: null, visitMinutes: 20, potentialValue: 0, ...(isFollowUp === undefined ? {} : { isFollowUp }) });
  return { tourDate: '2099-10-05', startMin: 540, endMin: 1080, finishMin: 600, start: { lat: 45.4, lng: 9.1, label: 'Casa' }, end: null,
    stops: [candidate(), candidate(true)].map((c, i) => ({ candidate: c, sequence: i + 1, arrivalMin: 540 + 30 * i, departureMin: 560 + 30 * i,
      travelMinFromPrev: 10, travelKmFromPrev: 1, waitMin: 0, outsideWindow: false, mandatory: !!c.isFollowUp })),
    dayType: 'ai', resolvedDayType: 'mista', areaLabel: 'Fixture', geometry: [], totalKm: 2, kmUrban: null, kmExtra: null, kmHighway: null,
    driveMin: 20, visitMin: 40, bufferMin: 480, returnMin: 0, returnKm: 0, potentialValue: 0, avgScore: 0, excluded: [],
    aiSummary: '', aiRecommendation: null, warnings: [], routingFallback: false, areaFilter: { mode: 'auto' } };
}
beforeEach(() => { rpc.mockReset(); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Real network forbidden'); })); });
describe('real save_tours_batch payload — is_follow_up', () => {
  it('normal stop false and follow-up true in actual p_tours serializer', async () => {
    rpc.mockResolvedValue({ data: ['tour-fixture'], error: null });
    await expect(saveToursBatch('agent-fixture', [plan()], 'Fixture')).resolves.toEqual(['tour-fixture']);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe('save_tours_batch');
    expect(args.p_tours[0].stops.map((s: { is_follow_up: boolean }) => s.is_follow_up)).toEqual([false, true]);
    expect(args.p_tours[0].stops[1]).toMatchObject({ customer_id: 'follow', mandatory: true, is_follow_up: true });
  });
  it('multi-day retains the flag in every day and is a single RPC call', async () => {
    rpc.mockResolvedValue({ data: ['tour-a', 'tour-b'], error: null });
    const first = plan(), second = { ...plan(), tourDate: '2099-10-06' };
    await saveToursBatch('agent-fixture', [first, second]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1].p_tours.map((p: { stops: { is_follow_up: boolean }[] }) => p.stops.map((s) => s.is_follow_up))).toEqual([[false, true], [false, true]]);
  });
  it('batch RPC error is propagated; no fallback inserts, retries or operational writes', async () => {
    const error = { code: 'fixture-error', message: 'Isolated batch failure' }; rpc.mockResolvedValue({ data: null, error });
    await expect(saveToursBatch('agent-fixture', [plan()])).rejects.toBe(error); expect(rpc).toHaveBeenCalledTimes(1);
  });
});