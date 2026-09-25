import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReadPage } from '../lib/api/read-pages';

const initial = <T,>(key: string) => ({ key, rows: [] as T[], count: 0, hasMore: false,
  totals: {} as Record<string, number>, offset: 0, loading: true, refreshing: false,
  loadingMore: false, error: '', failedOffset: 0 });

/** Risposte vecchie/filtri precedenti non possono sostituire la lista corrente. */
export function usePagedHistory<T extends { id: string }>(key: string, fetchPage: (offset: number) => Promise<ReadPage<T>>) {
  const [state, setState] = useState(() => initial<T>(key));
  const stateRef = useRef(state);
  const loader = useRef(fetchPage);
  const keyRef = useRef(key);
  const sequence = useRef(0);
  stateRef.current = state;
  loader.current = fetchPage;
  keyRef.current = key;

  const load = useCallback(async (offset: number, refresh = false) => {
    const requestKey = keyRef.current;
    if (!requestKey) return;
    const request = ++sequence.current;
    const current = () => sequence.current === request && keyRef.current === requestKey;
    setState(prev => ({ ...(prev.key === requestKey ? prev : initial<T>(requestKey)),
      error: '', loading: offset === 0 && !refresh, refreshing: refresh, loadingMore: offset > 0, failedOffset: offset }));
    try {
      const page = await loader.current(offset);
      if (!current()) return;
      setState(prev => {
        const rows = offset === 0 ? page.rows : [...new Map([...prev.rows, ...page.rows].map(row => [row.id, row])).values()];
        return { ...prev, rows, count: page.count, hasMore: page.hasMore,
          totals: page.totals ?? (offset === 0 ? {} : prev.totals), offset: offset + page.rows.length,
          loading: false, refreshing: false, loadingMore: false, error: '' };
      });
    } catch (error) {
      if (!current()) return;
      const rangeChanged = (error as { code?: string })?.code === 'PGRST103';
      setState(prev => ({ ...prev, loading: false, refreshing: false, loadingMore: false,
        failedOffset: rangeChanged ? 0 : offset,
        error: rangeChanged ? 'Lo storico è cambiato. Premi Riprova per aggiornarlo.' : 'Impossibile caricare lo storico. Controlla la connessione e riprova.' }));
    }
  }, []);

  useEffect(() => {
    void load(0);
    return () => { sequence.current += 1; };
  }, [key, load]);
  const refresh = useCallback(() => load(0, true), [load]);
  const retry = useCallback(() => load(stateRef.current.failedOffset, stateRef.current.failedOffset === 0), [load]);
  const loadMore = useCallback(() => {
    const s = stateRef.current;
    if (s.key === keyRef.current && s.hasMore && !s.loading && !s.loadingMore && !s.refreshing) return load(s.offset);
  }, [load]);
  return { ...(state.key === key ? state : initial<T>(key)), refresh, retry, loadMore };
}