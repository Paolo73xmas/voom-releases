/**
 * Hook to detect if the current user's branch is virtual.
 * Aligned with web app /src/hooks/useVirtualBranch.ts
 *
 * Virtual branches don't have their own warehouse and use the central warehouse stock.
 *
 * Also returns whether the branch is enabled for foreign (estero) orders.
 * This is used to hide the Italy/Estero toggle when a virtual branch is not authorized.
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

const VIRTUAL_BRANCH_ROLES = ['branch_admin', 'admin', 'admincustom', 'supervisor', 'agent'];

export function useVirtualBranch(): {
  isVirtualBranch: boolean;
  esteroOrdersEnabled: boolean;
  isLoading: boolean;
} {
  const { user } = useAuthStore();
  const [isVirtualBranch, setIsVirtualBranch] = useState(false);
  const [esteroOrdersEnabled, setEsteroOrdersEnabled] = useState(true); // default: allowed
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const branchId = user?.branchId;
    const role = user?.role;

    if (!branchId || !role || !VIRTUAL_BRANCH_ROLES.includes(role)) {
      setIsVirtualBranch(false);
      setEsteroOrdersEnabled(true);
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('is_virtual, estero_orders_enabled')
          .eq('id', branchId)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          console.warn('[useVirtualBranch] error:', error.message);
          setIsVirtualBranch(false);
          setEsteroOrdersEnabled(true);
        } else {
          setIsVirtualBranch(data?.is_virtual === true);
          // Default to true (allowed) if column missing/null, only false if explicitly false
          setEsteroOrdersEnabled(data?.estero_orders_enabled !== false);
        }
        setIsLoading(false);
      } catch (e) {
        if (!cancelled) {
          console.warn('[useVirtualBranch] exception:', e);
          setIsVirtualBranch(false);
          setEsteroOrdersEnabled(true);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.branchId, user?.role]);

  return { isVirtualBranch, esteroOrdersEnabled, isLoading };
}
