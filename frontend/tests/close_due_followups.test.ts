import { beforeEach, describe, expect, it, vi } from 'vitest';

// Bug reale: un'ispezione alle 07:45 non chiudeva il follow-up previsto alle 09:00 dello
// stesso giorno (confronto con l'istante esatto). Il confine corretto è la fine della giornata.
type Filter = { col: string; value: string };
let filters: Filter[] = [];
let updatePayload: Record<string, unknown> | null = null;
let rows: { id: string }[] = [];
let updateError: { message: string } | null = null;

vi.mock('../lib/supabase', () => {
  const builder = () => {
    const self: Record<string, unknown> = {};
    const chain = (col: string) => (c: string, v: string) => { filters.push({ col: `${col}:${c}`, value: v }); return self; };
    self.update = (payload: Record<string, unknown>) => { updatePayload = payload; return self; };
    self.eq = chain('eq');
    self.lte = chain('lte');
    self.select = () => Promise.resolve({ data: rows, error: updateError });
    return self;
  };
  return { supabase: { from: () => builder() } };
});

const { closeDueFollowUps } = await import('../lib/api/appointments');

describe('closeDueFollowUps', () => {
  beforeEach(() => { filters = []; updatePayload = null; rows = [{ id: 'a1' }]; updateError = null; });

  it('chiude i follow-up fino alla fine della giornata della visita', async () => {
    const closed = await closeDueFollowUps('cust-1', 'agent-1', new Date(2026, 8, 23, 7, 45));
    expect(closed).toBe(1);
    expect(updatePayload).toEqual({ status: 'completed' });
    const limit = filters.find((f) => f.col === 'lte:appointment_date')!.value;
    const end = new Date(limit);
    expect([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours(), end.getMinutes()]).toEqual([2026, 8, 23, 23, 59]);
    // un follow-up alle 09:00 dello stesso giorno rientra nel confine
    expect(new Date(2026, 8, 23, 9, 0).getTime()).toBeLessThanOrEqual(end.getTime());
    // quello del mese successivo resta aperto
    expect(new Date(2026, 9, 23, 9, 0).getTime()).toBeGreaterThan(end.getTime());
  });

  it('filtra per cliente, agente, tipo e stato', async () => {
    await closeDueFollowUps('cust-1', 'agent-1', new Date(2026, 8, 23, 7, 45));
    expect(filters.filter((f) => f.col.startsWith('eq:'))).toEqual([
      { col: 'eq:customer_id', value: 'cust-1' },
      { col: 'eq:agent_id', value: 'agent-1' },
      { col: 'eq:appointment_type', value: 'follow_up' },
      { col: 'eq:status', value: 'scheduled' },
    ]);
  });

  it('non blocca mai la visita in caso di errore', async () => {
    updateError = { message: 'permission denied' };
    rows = [];
    await expect(closeDueFollowUps('cust-1', 'agent-1')).resolves.toBe(0);
  });
});
