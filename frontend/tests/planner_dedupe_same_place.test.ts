import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

import { dedupeSamePlace } from '../lib/aitour/planner';
import type { TourCandidate } from '../lib/aitour/types';

// Porting del test web tests/aitour/planner_dedupe_same_place.unit.ts
const cand = (key: string, over: Partial<TourCandidate>): TourCandidate => ({
  key, entityType: 'client', customerId: null, tabaccheriaId: null, name: key, address: '', city: 'SAN GIULIANO MILANESE',
  province: 'MI', lat: 45.39, lng: 9.3, lastVisitDate: null, lastOrderDate: null, orderCount: 0, totalRevenue: 0, revenue6m: 0,
  avgOrderValue: 0, avgReorderDays: null, daysSinceOrder: null, daysSinceVisit: null, followUpDate: null, appointmentAt: null,
  notes: null, orphanStatus: null, estimatedRevenue: null, score: 0, priorityClass: 'Media', reason: '', visitMinutes: 20, ...over,
} as TourCandidate);

const prospect = cand('prospect:af01', { entityType: 'prospect', customerId: 'af01', tabaccheriaId: '3f1a', score: 35 });
const orphan = cand('orphan:3f1a', { entityType: 'orphan', customerId: 'af01', tabaccheriaId: '3f1a', score: 45 });
const other = cand('client:zz', { customerId: 'zz', tabaccheriaId: 'tzz', score: 50 });

describe('dedupeSamePlace: un punto vendita = una tappa', () => {
  it('prospect e orfano dello stesso punto vendita: resta il punteggio più alto', () => {
    expect(dedupeSamePlace([prospect, orphan, other], new Set()).map((c) => c.key)).toEqual(['orphan:3f1a', 'client:zz']);
  });

  it('la tappa obbligatoria vince anche con punteggio inferiore', () => {
    expect(dedupeSamePlace([prospect, orphan, other], new Set(['prospect:af01'])).map((c) => c.key)).toEqual(['prospect:af01', 'client:zz']);
  });

  it('match anche solo per tabaccheria_id', () => {
    const registryOrphan = cand('orphan:3f1a', { entityType: 'orphan', customerId: null, tabaccheriaId: '3f1a', score: 45 });
    expect(dedupeSamePlace([registryOrphan, prospect], new Set()).map((c) => c.key)).toEqual(['orphan:3f1a']);
  });

  it('candidati distinti restano intatti e in ordine originale', () => {
    const free = cand('free:t9', { entityType: 'free', tabaccheriaId: 't9', score: 99 });
    expect(dedupeSamePlace([other, free, prospect], new Set()).map((c) => c.key)).toEqual(['client:zz', 'free:t9', 'prospect:af01']);
  });
});
