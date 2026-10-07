import { describe, expect, it } from 'vitest';
import { isDevelopmentRequest, applyDevelopmentIntent, completeDevelopmentDay, inferTourDate, emptyDevelopmentResult } from '../lib/aitour/gptour-development';
import { DEFAULT_INTENT, type TourIntent } from '../lib/aitour/gptour-intent';
import type { GptResult } from '../lib/aitour/gptour-api';
import type { TourCandidate, AiTourSettings, EntityType } from '../lib/aitour/types';
import { DEFAULT_SETTINGS } from '../lib/aitour/types';

function cand(id: string, type: EntityType, city: string, lat: number, lng: number, over: Partial<TourCandidate> = {}): TourCandidate {
  return {
    key: `${type}:${id}`,
    entityType: type,
    customerId: type === 'free' || type === 'never' ? null : id,
    tabaccheriaId: `tab-${id}`,
    name: `Tab ${id}`,
    address: '', city, province: 'NA', lat, lng,
    lastVisitDate: null, lastInspectionDate: null, lastPhysicalContactDate: null, daysSincePhysicalContact: null, lastOrderDate: null,
    orderCount: 0, totalRevenue: 0, revenue6m: 0, avgOrderValue: 0, avgReorderDays: null, daysSinceOrder: null, daysSinceVisit: null,
    followUpDate: null, appointmentAt: null, notes: null, orphanStatus: null, estimatedRevenue: null,
    score: 0, priorityClass: 'Bassa', reason: '', nextSuggestedVisit: null, visitMinutes: 25, potentialValue: 0, ...over,
  };
}

describe('gptour development parity (ported web 36 assertions)', () => {
  it('keeps exact web assertion logic and reaches pass===36', () => {
    const settings: AiTourSettings = { ...DEFAULT_SETTINGS, work_start: '08:00', work_end: '18:00', lunch_break_minutes: 60, visit_minutes_prospect: 25 };
    const home = { lat: 40.9665, lng: 14.268 };
    let pass = 0;
    const ok = (c: boolean, m: string) => { expect(c, m).toBe(true); pass++; };

    ok(isDevelopmentRequest('Domani voglio fare una giornata di sviluppo a Bacoli e comuni limitrofi'), 'giornata di sviluppo');
    ok(isDevelopmentRequest('voglio sviluppare la zona di Pozzuoli'), 'sviluppare');
    ok(isDevelopmentRequest('nuovi punti vendita a Bacoli'), 'nuovi punti vendita');
    ok(isDevelopmentRequest('tabaccherie nuove mai visitate'), 'tabaccherie nuove');
    ok(isDevelopmentRequest('acquisizione clienti a Monte di Procida'), 'acquisizione');
    ok(!isDevelopmentRequest('i miei clienti fermi da 30 giorni a Bacoli'), 'clienti fermi NON e sviluppo');
    ok(!isDevelopmentRequest('i miei orfani di Napoli'), 'orfani NON e sviluppo');

    {
      const aiOnlyOrphan: TourIntent = { ...DEFAULT_INTENT, requestedEntityTypes: ['orphan'], requestedArea: { comuni: ['Bacoli'], comune: 'Bacoli', zona: null, provincia: null } };
      const t = applyDevelopmentIntent(aiOnlyOrphan, 'giornata di sviluppo a Bacoli e limitrofi');
      ok(t.requestedEntityTypes.includes('free') && t.requestedEntityTypes.includes('never'), 'aggiunge free+never');
      ok(t.requestedEntityTypes.includes('orphan'), 'conserva orphan scelto dall AI');
      ok(t.requestedArea?.comune === 'Bacoli', 'conserva area');
      const same = applyDevelopmentIntent(t, 'giornata di sviluppo');
      ok(same === t, 'idempotente quando gia completo');
      const untouched = applyDevelopmentIntent(aiOnlyOrphan, 'i miei orfani di Bacoli');
      ok(untouched === aiOnlyOrphan, 'messaggio non di sviluppo: intent invariato');
    }

    {
      const pool: TourCandidate[] = [
        cand('o1', 'orphan', 'Bacoli', 40.797, 14.078, { daysSinceOrder: 200, orphanStatus: 'orphan_b' }),
        cand('o2', 'orphan', 'Bacoli', 40.799, 14.081, { daysSinceOrder: 300, orphanStatus: 'orphan_b' }),
      ];
      for (let i = 0; i < 13; i++) pool.push(cand(`f${i}`, i % 2 ? 'free' : 'never', 'Bacoli', 40.79 + (i % 4) * 0.004, 14.07 + Math.floor(i / 4) * 0.005));
      for (let i = 0; i < 4; i++) pool.push(cand(`m${i}`, 'free', 'Monte di Procida', 40.795 + i * 0.003, 14.05 + i * 0.002));
      for (let i = 0; i < 30; i++) pool.push(cand(`far${i}`, 'free', 'Caserta', 41.07 + i * 0.002, 14.33 + i * 0.002));
      pool.push(cand('p1', 'prospect', 'Bacoli', 40.796, 14.076, { daysSincePhysicalContact: 3 }));

      const intent = applyDevelopmentIntent({ ...DEFAULT_INTENT, requestedEntityTypes: ['orphan'], requestedArea: { comuni: ['Bacoli'], comune: 'Bacoli', zona: null, provincia: null } }, 'giornata di sviluppo a Bacoli e limitrofi');
      const res: GptResult = { reply: '', needsInfo: false, multiDay: false, lodging: null, tourDate: '2026-06-20', startTime: null, endTime: null, selection: [{ key: 'orphan:o1', reason: null }, { key: 'orphan:o2', reason: null }], days: [], notes: null };
      const borders = new Set(['MONTE DI PROCIDA', 'POZZUOLI']);
      const out = completeDevelopmentDay(res, pool, intent, settings, borders, home);
      const sel = out.result.selection.map((s) => s.key);
      ok(out.added > 0, `aggiunge nuovi punti (added=${out.added})`);
      ok(sel[0] === 'orphan:o1' && sel[1] === 'orphan:o2', 'le tappe AI restano in testa');
      ok(sel.filter((k) => k.startsWith('free:') || k.startsWith('never:')).length === out.added, 'solo free/never aggiunti');
      ok(!sel.some((k) => k === 'prospect:p1'), 'prospect non aggiunto (non e un nuovo punto)');
      ok(!sel.some((k) => k.includes(':far')), 'nessun punto di Caserta (fuori comuni richiesti/confinanti)');
      const bacoli = sel.filter((k) => /:(f\d+)$/.test(k)).length;
      const monte = sel.filter((k) => /:m\d+$/.test(k)).length;
      ok(bacoli === 12 && monte === 0, `capienza 14: prima SOLO i punti di Bacoli (bacoli=${bacoli}, monte=${monte})`);
      ok(out.result.selection.length === 14, `rispetta la capienza (n=${out.result.selection.length})`);
      ok(out.comuni.includes('Bacoli'), 'riporta i comuni aggiunti');

      const longDay = { ...settings, work_end: '21:00' };
      const out2 = completeDevelopmentDay(res, pool, intent, longDay, borders, home);
      const sel3 = out2.result.selection.map((s) => s.key);
      ok(sel3.filter((k) => /:(f\d+)$/.test(k)).length === 13, 'tutti i 13 di Bacoli');
      ok(sel3.filter((k) => /:m\d+$/.test(k)).length >= 1, 'poi i confinanti (Monte di Procida)');
      ok(!sel3.some((k) => k.includes(':far')), 'Caserta mai');

      const full = completeDevelopmentDay(out.result, pool, intent, settings, borders, home);
      ok(full.added === 0, 'giornata piena: nessuna aggiunta');

      const orphIntent: TourIntent = { ...DEFAULT_INTENT, requestedEntityTypes: ['orphan'] };
      ok(completeDevelopmentDay(res, pool, orphIntent, settings, borders, home).added === 0, 'intent non sviluppo: invariato');
      ok(completeDevelopmentDay({ ...res, multiDay: true }, pool, intent, settings, borders, home).added === 0, 'multiDay invariato');
      ok(completeDevelopmentDay({ ...res, needsInfo: true }, pool, intent, settings, borders, home).added === 0, 'needsInfo invariato');

      const excl: TourIntent = { ...intent, excludedStops: ['free:f1'], rejectedOpportunityKeys: ['never:f0'] };
      const sel2 = completeDevelopmentDay(res, pool, excl, settings, borders, home).result.selection.map((s) => s.key);
      ok(!sel2.includes('free:f1') && !sel2.includes('never:f0'), 'esclusi e rifiutati mai aggiunti');
    }

    {
      const pool: TourCandidate[] = [cand('o1', 'orphan', 'Bacoli', 40.797, 14.078, { daysSinceOrder: 200 })];
      for (let i = 0; i < 5; i++) pool.push(cand(`n${i}`, 'never', 'Bacoli', 40.79 + i * 0.003, 14.07));
      for (let i = 0; i < 5; i++) pool.push(cand(`far${i}`, 'never', 'Roma', 41.9 + i * 0.003, 12.5));
      const intent = applyDevelopmentIntent({ ...DEFAULT_INTENT, requestedEntityTypes: ['orphan'] }, 'giornata di sviluppo');
      const res: GptResult = { reply: '', needsInfo: false, multiDay: false, lodging: null, tourDate: null, startTime: null, endTime: null, selection: [{ key: 'orphan:o1', reason: null }], days: [], notes: null };
      const sel = completeDevelopmentDay(res, pool, intent, settings, new Set(), home).result.selection.map((s) => s.key);
      ok(sel.filter((k) => k.startsWith('never:n')).length === 5, 'aggiunge i 5 vicini');
      ok(!sel.some((k) => k.includes(':far')), 'Roma (>45 km) esclusa');
    }

    {
      ok(inferTourDate('Domani voglio fare sviluppo', '2026-06-19') === '2026-06-20', 'domani -> +1');
      ok(inferTourDate('dopodomani sviluppo', '2026-06-19') === '2026-06-21', 'dopodomani -> +2');
      ok(inferTourDate('sviluppo a Bacoli', '2026-06-19') === '2026-06-19', 'senza indicazione -> oggi');
      const pool: TourCandidate[] = [];
      for (let i = 0; i < 6; i++) pool.push(cand(`b${i}`, 'free', 'Bacoli', 40.79 + i * 0.003, 14.07));
      const intent = applyDevelopmentIntent({ ...DEFAULT_INTENT, requestedArea: { comuni: ['Bacoli'], comune: 'Bacoli', zona: null, provincia: null } }, 'giornata di sviluppo a Bacoli e limitrofi');
      const aiQuestion: GptResult = { reply: 'Non trovo nuovi punti a Bacoli, vuoi estendere?', needsInfo: true, multiDay: false, lodging: null, tourDate: null, startTime: null, endTime: null, selection: [], days: [], notes: null };
      const base = emptyDevelopmentResult(aiQuestion, '2026-06-20');
      ok(base.needsInfo === false && base.tourDate === '2026-06-20' && base.selection.length === 0, 'risultato vuoto pronto per il motore');
      const out = completeDevelopmentDay(base, pool, intent, settings, new Set(), home);
      ok(out.added === 6 && out.result.selection.length === 6, `giornata costruita dal motore (added=${out.added})`);
      ok(out.result.needsInfo === false, 'needsInfo azzerato: il giro viene generato');
    }

    expect(pass).toBe(36);
  });
});
