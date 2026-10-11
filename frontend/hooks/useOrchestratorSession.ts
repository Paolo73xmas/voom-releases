import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAuthStore } from '../store/authStore';
import type { ContractBinding } from '../lib/aitour/orchestrator/contract';
import { createOrchestratorTransport } from '../lib/aitour/gptour-orchestrator-api';
import { EMPTY_SESSION, OrchestratorSession } from '../lib/aitour/orchestrator/session';
const emptySubscribe = () => () => {};
const emptySnapshot = () => EMPTY_SESSION;
export function useOrchestratorSession(ownerId: string | null, binding: ContractBinding | null, enabled: boolean) {
  const [instance, setInstance] = useState<{ owner: string; binding: ContractBinding; session: OrchestratorSession } | null>(null);
  useEffect(() => {
    if (!ownerId || !binding || !enabled) { setInstance(null); return; }
    // Allocate per effect lifetime: StrictMode cleanup must not reuse an already-disposed coordinator.
    const session = new OrchestratorSession({ ownerId, binding,
      currentOwner: () => useAuthStore.getState().user?.id ?? null, send: createOrchestratorTransport({ binding }) });
    setInstance({ owner: ownerId, binding, session }); void session.initialize();
    return () => session.dispose();
  }, [ownerId, binding, enabled]);
  // Hide the previous account synchronously, before effect cleanup or async initialization.
  const session = enabled && instance?.owner === ownerId && instance.binding === binding ? instance.session : null;
  const state = useSyncExternalStore(session?.subscribe ?? emptySubscribe, session?.getSnapshot ?? emptySnapshot, emptySnapshot);
  return { session, state };
}