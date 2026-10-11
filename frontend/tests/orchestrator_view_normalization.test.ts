import { describe, expect, it } from 'vitest';
import { assertSnapshot, definitivePlan } from '../lib/aitour/orchestrator/view';
import { displayCoordinates } from '../lib/aitour/orchestrator/coordinates';
import { buildRequest } from '../lib/aitour/orchestrator/request';
import { OrchestratorError } from '../lib/aitour/orchestrator/errors';
import { readySnapshot, REQUEST_BASE, statusSnapshot } from './fixtures/orchestrator-fixtures';

describe('orchestrator internal view-model normalization', () => {
  it('rejects malformed optional display fields instead of letting React render objects', () => {
    for (const field of ['start', 'overnight', 'wait', 'mandatory', 'reason']) {
      const snapshot = readySnapshot(); const day = snapshot.plan!.days[0];
      if (field === 'start') day.start.label = { invalid: true } as never;
      else if (field === 'overnight') day.overnight = { invalid: true } as never;
      else Object.assign(day.stops[0], { [field]: { invalid: true } });
      expect(() => assertSnapshot(snapshot, REQUEST_BASE)).toThrowError(OrchestratorError);
    }
  });
  it('ready-only plan visibility is enforced', () => {
    const ready = statusSnapshot('ready');
    expect(definitivePlan(ready, false)).toBeTruthy();
    for (const status of ['needs_clarification', 'planning', 'infeasible', 'blocked', 'failed'] as const)
      expect(definitivePlan(statusSnapshot(status), false)).toBeNull();
    expect(definitivePlan(ready, true)).toBeNull();
  });

  it('all six server states pass structural validation when payload is coherent', () => {
    for (const status of ['needs_clarification', 'planning', 'ready', 'infeasible', 'blocked', 'failed'] as const) {
      const req = buildRequest({ ...REQUEST_BASE, requestId: `req-${status}` });
      expect(() => assertSnapshot(statusSnapshot(status), req)).not.toThrow();
    }
  });

  it('invalid/malformed state, revision regression or session mismatch is rejected', () => {
    const req = buildRequest({ ...REQUEST_BASE, expectedRevision: 3 });
    expect(() => assertSnapshot(readySnapshot({ sessionId: 'other' }), req)).toThrowError(OrchestratorError);
    expect(() => assertSnapshot(readySnapshot({ revision: 2 }), req)).toThrowError(OrchestratorError);
    expect(() => assertSnapshot({ ...readySnapshot(), status: 'UNKNOWN' as never }, buildRequest(REQUEST_BASE))).toThrowError(OrchestratorError);
  });

  it('coordinate conversion is explicit; invalid/ambiguous input is rejected', () => {
    expect(displayCoordinates([[45.4, 9.1]], 'lat_lng')).toEqual([{ latitude: 45.4, longitude: 9.1 }]);
    expect(displayCoordinates([[9.1, 45.4]], 'lng_lat')).toEqual([{ latitude: 45.4, longitude: 9.1 }]);
    expect(() => displayCoordinates([[45.4, Number.NaN]], 'lat_lng')).toThrowError(OrchestratorError);
    expect(() => displayCoordinates([[45.4, 9.1, 7]], 'lat_lng')).toThrowError(OrchestratorError);
    expect(() => displayCoordinates([[45.4, 9.1]], undefined as never)).toThrowError(OrchestratorError);
  });

  it('server stop/day order and original strings are preserved (no local sorting/calculation)', () => {
    const snapshot = readySnapshot();
    const req = buildRequest(REQUEST_BASE);
    const before = structuredClone(snapshot);
    assertSnapshot(snapshot, req);
    expect(snapshot.plan?.days[0].stops.map(s => s.id)).toEqual(['s1', 's2', 's3']);
    expect(snapshot.plan?.days[0].stops.map(s => s.sequence)).toEqual(['1', '2', '3']);
    expect(snapshot.plan?.days[0].metrics.map(m => `${m.id}:${m.value}`)).toEqual(['drive:01:20', 'visit:01:00', 'wait:00:05', 'return:00:30', 'break:00:30', 'distance:18,4 km', 'total:03:25']);
    expect(snapshot.plan?.days[0].breaks[0]).toBe('Pausa pranzo 12:30');
    expect(snapshot.plan?.days[0].commitments[0]).toBe('Consegna 11:00');
    expect(snapshot).toEqual(before);
  });

  it('question options carry exact server commands unchanged', () => {
    const q = statusSnapshot('planning');
    q.questions = [{
      id: 'q1',
      text: 'Scegli opzione',
      options: [
        { id: 'a', label: 'Oggi', command: { name: 'set_date', input: { date: 'today' } } },
        { id: 'b', label: 'Nuovo giro', command: { name: 'reset', input: { mode: 'full' } } },
      ],
    }];
    const req = buildRequest({ ...REQUEST_BASE, requestId: 'req-q' });
    expect(() => assertSnapshot(q, req)).not.toThrow();
    expect(q.questions[0].options[0].command).toEqual({ name: 'set_date', input: { date: 'today' } });
    expect(q.questions[0].options[1].command).toEqual({ name: 'reset', input: { mode: 'full' } });
  });

  it('user utterances stay literal in envelope (no local parser rewrite)', () => {
    for (const utterance of ['Clienti senza ordini da 15 giorni', 'Clienti inattivi da 20 giorni', 'Ultimo acquisto almeno 30 giorni fa',
      'Clienti e nuovi punti vendita mai visitati', 'Organizzami domani un giro a Milano', 'Oggi sono le 12:30',
      'Partiamo alle 10', 'Aggiungi anche Opera', 'Togli i nuovi punti vendita', 'Voglio terminare entro le 16']) {
      const req = buildRequest({ ...REQUEST_BASE, requestId: `r-${utterance}`, message: utterance });
      expect(req.message).toBe(utterance);
    }
  });
});
