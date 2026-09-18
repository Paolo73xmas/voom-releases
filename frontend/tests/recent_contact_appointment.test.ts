import { describe, expect, it } from 'vitest';
import { isRecentlyServed, splitRecentlyServed, RECENT_CONTACT_DAYS } from '../lib/aitour/scoring';
import type { TourCandidate } from '../lib/aitour/types';

// Parità web (tests/aitour/recent_contact_appointment.unit.ts): l'appuntamento futuro
// non annulla la regola dei 15 giorni, solo quello dovuto entro la data del giro.
function cand(over: Partial<TourCandidate>): TourCandidate {
  return {
    key: 'k1', entityType: 'client', customerId: 'c1', tabaccheriaId: null,
    name: 'Cliente', address: 'Via Roma', city: 'Segrate', province: 'MI', lat: 45.5, lng: 9.27,
    lastVisitDate: null, lastOrderDate: null, orderCount: 3, totalRevenue: 0, revenue6m: 0,
    avgOrderValue: 0, avgReorderDays: null, daysSinceOrder: null, daysSinceVisit: null,
    followUpDate: null, appointmentAt: null, notes: null, orphanStatus: null,
    estimatedRevenue: null, visitMinutes: 20, score: 0, priorityClass: 'Media', reason: '',
    ...over,
  } as TourCandidate;
}

describe('isRecentlyServed: regola 15 giorni e appuntamenti', () => {
  const visitedRecentFutureAppt = cand({ daysSinceVisit: 3, appointmentAt: '2026-09-29T09:00:00+00:00' });

  it('cliente visitato 3 gg fa con appuntamento fra 14 gg resta escluso', () => {
    expect(isRecentlyServed(visitedRecentFutureAppt, RECENT_CONTACT_DAYS, '2026-09-18')).toBe(true);
  });

  it('il giorno dell\'appuntamento il cliente rientra nel giro', () => {
    expect(isRecentlyServed(visitedRecentFutureAppt, RECENT_CONTACT_DAYS, '2026-09-29')).toBe(false);
  });

  it('follow-up già scaduto sospende la regola dei 15 giorni', () => {
    expect(isRecentlyServed(cand({ daysSinceVisit: 2, followUpDate: '2026-09-10' }), RECENT_CONTACT_DAYS, '2026-09-18')).toBe(false);
  });

  it('tappa di follow-up scelta per la giornata resta sempre ammessa', () => {
    expect(isRecentlyServed(cand({ daysSinceVisit: 1, isFollowUp: true }), RECENT_CONTACT_DAYS, '2026-09-18')).toBe(false);
  });

  it('senza appuntamento vale la regola classica', () => {
    expect(isRecentlyServed(cand({ daysSinceVisit: 3 }), RECENT_CONTACT_DAYS, '2026-09-18')).toBe(true);
    expect(isRecentlyServed(cand({ daysSinceVisit: 40 }), RECENT_CONTACT_DAYS, '2026-09-18')).toBe(false);
    expect(isRecentlyServed(cand({ daysSinceOrder: 5 }), RECENT_CONTACT_DAYS, '2026-09-18')).toBe(true);
  });

  it('splitRecentlyServed usa la stessa data di riferimento', () => {
    const split = splitRecentlyServed([visitedRecentFutureAppt, cand({ key: 'k2', daysSinceVisit: 40 })], RECENT_CONTACT_DAYS, '2026-09-18');
    expect(split.kept).toHaveLength(1);
    expect(split.excluded).toHaveLength(1);
    expect(split.kept[0].key).toBe('k2');
  });
});
