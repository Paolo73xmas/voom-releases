// Parità web: domanda follow-up in chat e risoluzione deterministica delle date relative.
import { describe, expect, it, vi } from 'vitest';
import { followUpQuestion, resolveRelativeDate, resolveRescheduleTarget, formatDateIt, type GptEvent } from '../lib/aitour/gptour-followups';

vi.mock('../lib/supabase', () => ({ supabase: {} }));
const ev = (id: string, name: string, date: string, time = '10:00'): GptEvent => ({ id, agentId: 'a', customerId: id, key: `client:${id}`, name, date, time, type: 'follow_up', appointmentDate: `${date}T${time}:00Z`, duration: 20 });
const today = '2026-10-02';

describe('followUpQuestion (web parity)', () => {
  it('single tour date lists names and asks keep/some/postpone', () => {
    const q = followUpQuestion([ev('1', 'Rossi', '2026-10-06'), ev('2', 'Bianchi', '2026-10-06')], ['2026-10-06'], today);
    expect(q).toContain('Per martedì 6 ottobre risultano già 2 follow-up programmati: Rossi e Bianchi.');
    expect(q).toContain('Vuoi mantenerli tutti nel giro, inserirne soltanto alcuni oppure rinviarne qualcuno?');
  });
  it('overdue only: "arretrati" with original dates', () => {
    const q = followUpQuestion([ev('1', 'Rossi', '2026-09-20')], ['2026-10-06'], today);
    expect(q).toContain('Prima di preparare il giro ti segnalo che hai anche 1 follow-up arretrato: Rossi, previsto per il 20 settembre.');
    expect(q).toContain('Vuoi inserirli nel giro, riprogrammarli oppure lasciarli fuori?');
  });
  it('formatDateIt', () => { expect(formatDateIt('2026-10-02')).toBe('venerdì 2 ottobre'); expect(formatDateIt('2026-10-02', false)).toBe('2 ottobre'); });
});

describe('resolveRelativeDate / resolveRescheduleTarget', () => {
  it.each([
    ['venerdì', '2026-10-06', '2026-10-09'], ['venerdì prossimo', '2026-10-06', '2026-10-16'], ['domani', '2026-10-06', '2026-10-03'],
    ['tra una settimana', '2026-10-06', '2026-10-13'], ['9 ottobre', '2026-10-06', '2026-10-09'], ['12/10', '2026-10-06', '2026-10-12'], ['2026-11-03', '2026-10-06', '2026-11-03'],
  ])('%s from %s -> %s', (expr, anchor, expected) => expect(resolveRelativeDate(expr, anchor, today)?.date).toBe(expected));
  it('keeps time only when the agent says it; overdue anchor uses today', () => {
    expect(resolveRelativeDate('venerdì alle 15', '2026-09-20', today)).toEqual({ date: '2026-10-09', time: '15:00' });
    expect(resolveRelativeDate('boh', '2026-10-06', today)).toBeNull();
  });
  it('target: ambiguous -> error (no write), past -> error, ok -> date/time', () => {
    const e = ev('1', 'Rossi', '2026-10-06');
    expect(resolveRescheduleTarget({ newDateExpr: null }, e, today)).toHaveProperty('error');
    expect(resolveRescheduleTarget({ newDateExpr: '1 settembre' }, e, today)).toHaveProperty('error');
    expect(resolveRescheduleTarget({ newDateExpr: 'venerdì', newTime: '09:30' }, e, today)).toEqual({ date: '2026-10-09', time: '09:30' });
  });
});
