// Web parity: comune/zona richiesti guidano la selezione, non scartano; la provincia resta rigida.
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_INTENT, type TourIntent } from '../lib/aitour/gptour-intent';
import { candidateIntentProblems, outsideRequestedComune } from '../lib/aitour/gptour-criteria';
import { prepareGptDays } from '../lib/aitour/gptour-engine';
import { DEFAULT_SETTINGS, type TourCandidate, type EntityType } from '../lib/aitour/types';
import type { GptResult } from '../lib/aitour/gptour-api';

vi.mock('../lib/theme', () => ({ currentThemeMode: 'light' }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
const date = '2099-10-05', settings = { ...DEFAULT_SETTINGS, work_start: '09:00', work_end: '18:00', lunch_break_minutes: 0 };
function candidate(type: EntityType, key: string, patch: Partial<TourCandidate> = {}): TourCandidate {
  return { key, customerId: key, tabaccheriaId: null, entityType: type, name: key, lat: 45.41, lng: 9.11,
    city: 'Liscate', province: 'MI', address: '', lastVisitDate: null, lastOrderDate: null,
    daysSinceVisit: null, daysSinceOrder: null, daysSincePhysicalContact: null, orderCount: 0, totalRevenue: 0,
    revenue6m: 600, avgOrderValue: 0, avgReorderDays: null, followUpDate: null, appointmentAt: null,
    notes: null, orphanStatus: null, estimatedRevenue: null, score: 0, priorityClass: 'Media', reason: '',
    nextSuggestedVisit: null, visitMinutes: 20, potentialValue: 0, isOwnOrphan: false,
    gptourData: { contactKnown: true, orderKnown: true, revenueKnown: true, zoneNames: ['Est'] }, ...patch };
}
const liscate = candidate('prospect', 'liscate'), paullo = candidate('prospect', 'paullo', { city: 'Paullo' });
const melzo = candidate('prospect', 'melzo', { city: 'Melzo' }), torino = candidate('prospect', 'torino', { city: 'Torino', province: 'TO' });
const pool = [liscate, paullo, melzo, torino];
const result = (keys: string[]): GptResult => ({ reply: 'Fixture', needsInfo: false, multiDay: false, lodging: 'home',
  tourDate: date, startTime: null, endTime: null, selection: keys.map((key) => ({ key, reason: null })), days: [], notes: null });
const intent: TourIntent = { ...DEFAULT_INTENT, requestedEntityTypes: ['prospect'], requestedArea: { provincia: 'MI', zona: 'tra Liscate e Paullo' } };

describe('GPTour area: web parity', () => {
  it('free-text zona from the Edge Function never empties the pool', () => {
    for (const c of [liscate, paullo, melzo]) expect(candidateIntentProblems(c, intent)).toEqual([]);
    expect(candidateIntentProblems(torino, intent)).toEqual(['provincia diversa o non verificata']);
  });
  it('AI picks outside the requested comune are kept with a warning, not removed', () => {
    const prepared = prepareGptDays(result(['liscate', 'paullo']), pool, { ...intent, requestedArea: { comune: 'Liscate', provincia: 'MI' } }, settings, date);
    expect(prepared.days[0].selection.map((s) => s.key)).toEqual(['liscate', 'paullo']);
    expect(prepared.warnings).toEqual(['paullo: fuori dal comune richiesto (Paullo), mantenuto come scelto']);
    expect(outsideRequestedComune(paullo, { ...intent, requestedArea: { comune: 'Liscate' } })).toBe(true);
    expect(outsideRequestedComune(paullo, intent)).toBe(false);
  });
  it('province stays strict: out-of-province AI picks are excluded, not silently kept', () => {
    const prepared = prepareGptDays(result(['liscate', 'torino']), pool, intent, settings, date);
    expect(prepared.days[0].selection.map((s) => s.key)).toEqual(['liscate']);
    expect(prepared.warnings).toEqual(['torino: escluso (provincia diversa o non verificata)']);
  });
  it('wantAll completes only within the requested comune', () => {
    const prepared = prepareGptDays(result(['liscate']), pool, { ...intent, wantAll: true, requestedArea: { comune: 'Liscate', provincia: 'MI' } }, settings, date);
    expect(prepared.days.flatMap((d) => d.selection.map((s) => s.key))).toEqual(['liscate']);
    const all = prepareGptDays(result(['liscate']), pool, { ...intent, wantAll: true }, settings, date);
    expect(all.days.flatMap((d) => d.selection.map((s) => s.key)).sort()).toEqual(['liscate', 'melzo', 'paullo']);
  });
});
