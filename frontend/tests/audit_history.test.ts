import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ calls: [] as { table: string; op: string; args: unknown[] }[], replies: {} as Record<string, any[]> }));
vi.mock('../lib/supabase', () => ({ supabase: { from: (table: string) => {
  const query: any = {};
  for (const op of ['select', 'eq', 'neq', 'not', 'in', 'order', 'range', 'gte', 'lte', 'lt', 'or', 'limit']) {
    query[op] = (...args: unknown[]) => { db.calls.push({ table, op, args }); return query; };
  }
  query.then = (resolve: any, reject: any) => {
    const response = db.replies[table]?.shift();
    return (response ? Promise.resolve(response) : Promise.reject(new Error(`Risposta test mancante: ${table}`))).then(resolve, reject);
  };
  return query;
} } }));
vi.mock('../lib/api/photos', () => ({ uploadSinglePhoto: vi.fn() }));
vi.mock('../lib/api/appointments', () => ({ closeDueFollowUps: vi.fn() }));

import { fetchAgentInspectionPage, fetchCustomerInspectionNotes } from '../lib/api/inspections';
import { fetchOrdersPage, fetchOrderCounts } from '../lib/api/orders';
import { fetchSubstitutionsPage } from '../lib/api/substitutions';
import { fetchRimborsiByAgent, fetchRimborsiCategorie } from '../lib/api/rimborsi';
import { literalSearch, pageRange, readPage, readEveryPage } from '../lib/api/read-pages';

const ok = (data: any[], count = data.length) => ({ data, count, error: null });
const ops = (table: string, op: string) => db.calls.filter(c => c.table === table && c.op === op).map(c => c.args);
beforeEach(() => { db.calls.length = 0; db.replies = {}; });

describe('audit: pagine senza tagli e ricerca letterale', () => {
  it('richiede la pagina oltre le300 ispezioni mantenendo agente e totale', async () => {
    db.replies.inspections = [ok([{ id: 'older', inspection_date: '2020-01-01', notes: 'Storica', customers: null, inspection_photos: [] }], 351)];
    const page = await fetchAgentInspectionPage('agent', { offset: 300, search: 'Milano' });
    expect(page.count).toBe(351); expect(page.rows[0].id).toBe('older');
    expect(ops('inspections', 'range')).toEqual([[300, 349]]);
    expect(ops('inspections', 'eq')).toContainEqual(['agent_id', 'agent']);
    expect(ops('inspections', 'order')).toContainEqual(['id']);
    expect(ops('inspections', 'or')[1][0]).toContain('matched_customer.not.is.null');
    expect(ops('inspections', 'limit')).toHaveLength(0);
  });
  it('nega query ispezioni senza agente prima della rete', async () => {
    await expect(fetchAgentInspectionPage('')).rejects.toThrow();
    await expect(fetchCustomerInspectionNotes('customer', '')).rejects.toThrow();
    expect(db.calls).toHaveLength(0);
  });
  it('il giorno finale include tutte le frazioni di secondo in orario locale', async () => {
    db.replies.inspections = [ok([])];
    await fetchAgentInspectionPage('agent', { dateFrom: '2026-09-01', dateTo: '2026-09-30' });
    expect(ops('inspections', 'gte')).toEqual([['inspection_date', '2026-08-31T22:00:00.000Z']]);
    expect(ops('inspections', 'lt')).toEqual([['inspection_date', '2026-09-30T22:00:00.000Z']]);
  });
  it('ordini oltre200 con stessa visibilità e conteggio esatto', async () => {
    db.replies.orders = [ok([{ id: 'old-order' }], 530)];
    const page = await fetchOrdersPage('agent', 'agent', null, { offset: 200 });
    expect(page.count).toBe(530); expect(page.rows[0].id).toBe('old-order');
    expect(ops('orders', 'eq')).toContainEqual(['agent_id', 'agent']);
    expect(ops('orders', 'range')).toEqual([[200, 249]]);
  });
  it('totali ordini della ricerca non sono conteggi della sola pagina', async () => {
    db.replies.orders = [ok([{ id: 'order' }], 530), ok([], 80), ok([], 350)];
    const page = await fetchOrdersPage('admin', 'admin', null, { search: 'Milano' });
    expect(page.count).toBe(530); expect(page.totals).toEqual({ delivered: 80, inProgress: 350 });
    expect(ops('orders', 'or')).toHaveLength(6);
  });
  it('dashboard conta tutto con scope filiale, non la lunghezza lista', async () => {
    db.replies.orders = [ok([], 1200), ok([], 260)];
    expect(await fetchOrderCounts('agent', 'branch_admin', 'branch')).toEqual({ total: 1200, pending: 260 });
    expect(ops('orders', 'eq')).toEqual([['branch_id', 'branch'], ['branch_id', 'branch']]);
  });
  it('sostituzioni oltre100 e prezzi disponibili senza catalogo wizard', async () => {
    db.replies.substitutions = [ok([{ id: 'sub', substitution_items: [{ original_product_id: 'p', replacement_product_id: null }] }], 180)];
    db.replies.products = [ok([{ id: 'p', unit_price: 12.8 }])];
    const page = await fetchSubstitutionsPage('agent', 'all', { offset: 100, userRole: 'agent' });
    expect(page.count).toBe(180); expect(page.rows[0].substitution_items?.[0].original_product?.unit_price).toBe(12.8);
    expect(ops('substitutions', 'range')).toEqual([[100, 149]]);
    expect(ops('substitutions', 'eq')).toContainEqual(['agent_id', 'agent']);
  });
  it('non trasforma errori lettura filiale/prodotti in dati vuoti', async () => {
    db.replies.profiles = [{ error: { message: 'network' }, data: null }];
    await expect(fetchSubstitutionsPage('agent', 'all', { userRole: 'branch_admin', branchId: 'branch' })).rejects.toEqual({ message: 'network' });
    db.replies.substitutions = [ok([{ id: 'sub', substitution_items: [{ original_product_id: 'p' }] }])];
    db.replies.products = [{ error: { message: 'network' }, data: null }];
    await expect(fetchSubstitutionsPage('agent')).rejects.toEqual({ message: 'network' });
  });
  it('quote, virgole, parentesi e wildcard non cambiano la grammatica della ricerca', () => {
    expect(literalSearch('  Milano  ')).toBe('"%Milano%"');
    expect(literalSearch('a,b(x)')).toBe('"%a,b(x)%"');
    expect(literalSearch('a"b')).toBe('"%a\\"b%"');
    expect(literalSearch('%_')).toBe('"%\\\\%\\\\_%"');
    expect(pageRange({ offset: 300 })).toEqual({ offset: 300, size: 50, end: 349 });
    expect(() => readPage([], null, 0)).toThrow();
  });
});

describe('audit: note storiche e letture fallite', () => {
  const note = (i: number, text: string) => ({ id: `n-${i}`, inspection_date: '2026-01-01', notes: text, inspection_photos: [] });
  it('non perde la prima nota utile se preceduta da50 note di soli spazi', async () => {
    db.replies.inspections = [ok(Array.from({ length: 50 }, (_, i) => note(i, '  '))), ok([note(51, '  Nota storica  ')])];
    const rows = await fetchCustomerInspectionNotes('customer', 'agent');
    expect(rows).toHaveLength(1); expect(rows[0].notes).toBe('Nota storica');
    expect(ops('inspections', 'range')).toEqual([[0, 49], [50, 99]]);
    expect(ops('inspections', 'eq')).toEqual([['customer_id', 'customer'], ['agent_id', 'agent'], ['customer_id', 'customer'], ['agent_id', 'agent']]);
  });
  it('restituisce più di30 note e distingue errore su una pagina successiva', async () => {
    const first = Array.from({ length: 50 }, (_, i) => note(i, 'Nota'));
    db.replies.inspections = [ok(first), ok([note(51, 'Ultima')])];
    expect(await fetchCustomerInspectionNotes('customer', 'agent')).toHaveLength(51);
    db.replies.inspections = [ok(first), { data: null, error: { message: 'offline' } }];
    await expect(fetchCustomerInspectionNotes('customer', 'agent')).rejects.toEqual({ message: 'offline' });
  });
  it('un EOF dopo una pagina piena non azzera lo storico letto', async () => {
    const read = vi.fn().mockResolvedValueOnce(ok([1, 2])).mockResolvedValueOnce({ data: null, error: { code: 'PGRST103' } });
    expect(await readEveryPage(read, 2)).toEqual([1, 2]);
  });
  it('i rimborsi propagano gli errori invece di inventare liste vuote', async () => {
    db.replies.rimborsi = [{ error: { message: 'offline' }, data: null }];
    db.replies.rimborsi_categorie = [{ error: { message: 'offline' }, data: null }];
    await expect(fetchRimborsiByAgent('agent')).rejects.toEqual({ message: 'offline' });
    await expect(fetchRimborsiCategorie()).rejects.toEqual({ message: 'offline' });
  });
});