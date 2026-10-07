import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchIsFirstOrder } from '../lib/api/first-order';

export type FirstOrderStatus = 'idle' | 'loading' | 'eligible' | 'ineligible' | 'error';
type Check = { customerId?: string; status: FirstOrderStatus };

/** Ogni ingresso (elenco, mappa, tour, bozza, duplicazione) segue il cliente selezionato. */
export function useFirstOrder(customerId?: string) {
  const [check, setCheck] = useState<Check>({ status: 'idle' });
  const sequence = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const retry = useCallback(async () => {
    const request = ++sequence.current;
    pending.current?.abort();
    if (!customerId) { setCheck({ status: 'idle' }); return; }
    const controller = new AbortController();
    pending.current = controller;
    setCheck({ customerId, status: 'loading' });
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const eligible = await fetchIsFirstOrder(customerId, controller.signal);
      if (controller.signal.aborted) throw new Error('Verifica annullata');
      if (sequence.current === request) setCheck({ customerId, status: eligible ? 'eligible' : 'ineligible' });
    } catch {
      if (sequence.current === request) setCheck({ customerId, status: 'error' });
    } finally { clearTimeout(timer); }
  }, [customerId]);
  useEffect(() => {
    void retry();
    return () => { sequence.current += 1; pending.current?.abort(); };
  }, [retry]);
  const status = check.customerId === customerId ? check.status : customerId ? 'loading' : 'idle';
  return { status, isFirstOrder: status === 'eligible', retry };
}