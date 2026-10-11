import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { probeOrchestratorAccess, type PilotAccess } from '../lib/aitour/gptour-orchestrator-api';
import { APPROVED_ORCHESTRATOR_BINDING } from '../lib/aitour/orchestrator/binding';
export function useOrchestratorAccess(owner: string | null, enabled: boolean) {
  const [result, setResult] = useState<{ owner: string; access: PilotAccess } | null>(null);
  useEffect(() => {
    if (!enabled || !owner) { setResult(null); return; }
    const controller = new AbortController();
    const current = () => !controller.signal.aborted && useAuthStore.getState().user?.id === owner;
    void probeOrchestratorAccess({ binding: APPROVED_ORCHESTRATOR_BINDING }, owner, current, controller.signal)
      .then(access => { if (current()) setResult({ owner, access }); })
      .catch(() => { if (current()) setResult({ owner, access: 'unavailable' }); });
    return () => controller.abort();
  }, [owner, enabled]);
  return enabled && owner ? result?.owner === owner ? result.access : 'checking' : 'off';
}