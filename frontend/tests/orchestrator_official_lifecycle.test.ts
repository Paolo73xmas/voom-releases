import { describe, expect, it, vi } from 'vitest';
import { observeOrchestratorAccountLifecycle } from '../lib/aitour/orchestrator/lifecycle';
const mocks = vi.hoisted(() => ({ callback: undefined as undefined | ((event: string, session: { user: { id: string } } | null) => void),
  clear: vi.fn(async () => {}), unsubscribe: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: (cb: typeof mocks.callback) => {
  mocks.callback = cb; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
} } } }));
vi.mock('../lib/aitour/orchestrator/storage', () => ({ clearOrchestratorLocalState: mocks.clear }));
describe('Orchestrator local-only account lifecycle', () => {
  it('clears on signout even when no orchestrator screen is mounted; unsubscribes', () => {
    const stop = observeOrchestratorAccountLifecycle();
    mocks.callback?.('INITIAL_SESSION', { user: { id: 'a' } });
    mocks.callback?.('TOKEN_REFRESHED', { user: { id: 'a' } });
    expect(mocks.clear).not.toHaveBeenCalled();
    mocks.callback?.('SIGNED_OUT', null); expect(mocks.clear).toHaveBeenCalledTimes(1);
    stop(); expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });
  it('clears on account replacement but not repeated same-user session', () => {
    observeOrchestratorAccountLifecycle();
    mocks.callback?.('SIGNED_IN', { user: { id: 'a' } });
    mocks.callback?.('SIGNED_IN', { user: { id: 'a' } });
    expect(mocks.clear).not.toHaveBeenCalled();
    mocks.callback?.('SIGNED_IN', { user: { id: 'b' } });
    expect(mocks.clear).toHaveBeenCalledTimes(1);
  });
});