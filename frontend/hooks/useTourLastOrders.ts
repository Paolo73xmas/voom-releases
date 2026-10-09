// Ultimi acquisti delle tappe di un tour (web useTourLastOrders @ 2eea993, senza react-query):
// stesso insieme di clienti → una sola richiesta condivisa tra elenco, mappa e dettaglio; nessuno
// snapshot persistito; ricontrollo al rientro in primo piano. Download PDF: ordine riletto via RLS.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { loadLatestPurchases, type PurchaseRow } from '../lib/aitour/gptour-purchases';
import { prepareTourOrderDownload } from '../lib/aitour/order-download';
import type { TourCandidate } from '../lib/aitour/types';

export interface TourLastOrders { data: Map<string, PurchaseRow> | null; loading: boolean; error: string | null; refetch: () => void }
interface OrdersState { key: string; data: Map<string, PurchaseRow> | null; loading: boolean; error: string | null }

export function useTourLastOrders(candidates: readonly Pick<TourCandidate, 'customerId'>[], enabled = true): TourLastOrders {
  const userId = useAuthStore((s) => s.user?.id);
  const idsKey = useMemo(() => [...new Set(candidates.flatMap((c) => (c.customerId ? [c.customerId] : [])))].sort().join('|'), [candidates]);
  const [state, setState] = useState<OrdersState>({ key: '', data: null, loading: false, error: null });
  const [attempt, setAttempt] = useState(0);
  const active = enabled && !!userId;
  useEffect(() => {
    if (!active) return;
    const ids = idsKey ? idsKey.split('|') : [];
    if (!ids.length) { setState({ key: idsKey, data: new Map(), loading: false, error: null }); return; }
    const controller = new AbortController();
    setState((old) => ({ key: idsKey, data: old.key === idsKey ? old.data : null, loading: true, error: null }));
    loadLatestPurchases(ids, undefined, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ key: idsKey, data, loading: false, error: null }); })
      .catch((e) => { if (!controller.signal.aborted) setState({ key: idsKey, data: null, loading: false, error: e instanceof Error ? e.message : 'Ultimo ordine non verificabile.' }); });
    return () => controller.abort();
  }, [idsKey, active, userId, attempt]);
  // Rientro in primo piano = refetchOnWindowFocus del web: nessun dato stantio mostrato come attuale.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setAttempt((n) => n + 1); });
    return () => sub.remove();
  }, []);
  const refetch = useCallback(() => setAttempt((n) => n + 1), []);
  const current = state.key === idsKey;
  return { data: current ? state.data : null, loading: active && (!current ? !!idsKey : state.loading), error: current ? state.error : null, refetch };
}

/** Download del PDF di un ordine riletto dal client RLS; mai da snapshot. Una richiesta alla volta. */
export function useOrderDownload() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const request = useRef(0);
  const userId = useAuthStore((s) => s.user?.id);
  useEffect(() => { request.current++; setBusyId(null); setError(''); }, [userId]);
  useEffect(() => () => { request.current++; }, []);
  const download = useCallback(async (row: PurchaseRow) => {
    if (busyId) return;
    const version = ++request.current;
    setBusyId(row.id); setError('');
    try {
      const save = await prepareTourOrderDownload(row);
      if (version === request.current && userId === useAuthStore.getState().user?.id) await save();
    } catch (e) {
      if (version === request.current) setError(e instanceof Error ? e.message : 'Download non riuscito: ordine non disponibile o non autorizzato. Riprova.');
    } finally {
      if (version === request.current) setBusyId(null);
    }
  }, [busyId, userId]);
  const clearError = useCallback(() => setError(''), []);
  return { busyId, error, download, clearError };
}
