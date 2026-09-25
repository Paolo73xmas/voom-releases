export interface ReadPage<T> { rows: T[]; count: number; hasMore: boolean; totals?: Record<string, number> }
export interface ReadPageOptions { offset?: number; pageSize?: number; search?: string }

export function pageRange(opts: ReadPageOptions = {}) {
  const offset = Math.max(0, Math.floor(opts.offset || 0));
  const size = Math.max(1, Math.min(200, Math.floor(opts.pageSize || 50)));
  return { offset, size, end: offset + size - 1 };
}

export function readPage<T>(rows: T[], count: number | null, offset: number): ReadPage<T> {
  if (count == null) throw new Error('Conteggio dello storico non disponibile. Riprova.');
  return { rows, count, hasMore: offset + rows.length < count };
}

/** Un intervallo diventato vuoto dopo cancellazioni concorrenti non è un errore di rete. */
export function isPageEnd(error: { code?: string } | null, offset: number) {
  return offset > 0 && error?.code === 'PGRST103';
}

/** Valore ILIKE letterale: niente wildcard o grammatica PostgREST provenienti dall'input. */
export function literalSearch(input: string) {
  const sql = input.trim().replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  return `"%${sql.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}%"`;
}

export async function readEveryPage<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code?: string } | null }>, size = 200) {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await read(from, from + size - 1);
    if (isPageEnd(error, from)) return rows;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < size) return rows;
  }
}