import { supabase } from '../../supabase';
import { clearOrchestratorLocalState } from './storage';
/** Local cache cleanup only; never signs in/out, refreshes auth or changes the existing auth store. */
export function observeOrchestratorAccountLifecycle(): () => void {
  let owner: string | null = null;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const next = session?.user.id ?? null;
    if (event === 'SIGNED_OUT' || (owner !== null && next !== null && owner !== next)) {
      // Cleanup barrier prevents late writes from resurrecting an old account's transcript.
      void clearOrchestratorLocalState().catch(() => { /* Reads fail closed until cleanup succeeds. */ });
    }
    owner = next;
  });
  return () => data.subscription.unsubscribe();
}