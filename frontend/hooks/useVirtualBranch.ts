/**
 * Hook to detect if the current user's branch is virtual.
 * Aligned with web app /src/hooks/useVirtualBranch.ts
 *
 * Virtual branches don't have their own warehouse and use the central warehouse stock.
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

const VIRTUAL_BRANCH_ROLES = ['branch_admin', 'admin', 'admincustom', 'supervisor', 'agent'];

export function useVirtualBranch(): { isVirtualBranch: boolean; isLoading: boolean } {
  const { user } = useAuthStore();
  const [isVirtualBranch, setIsVirtualBranch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const branchId = user?.branchId;
    const role = user?.role;

    if (!branchId || !role || !VIRTUAL_BRANCH_ROLES.includes(role)) {
      setIsVirtualBranch(false);
      setIsLoading(false);
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('is_virtual')
          .eq('id', branchId)
          .maybeSingle();

        if (cancelled) return;
        if (error) {
          console.warn('[useVirtualBranch] error:', error.message);
          setIsVirtualBranch(false);
        } else {
          setIsVirtualBranch(data?.is_virtual === true);
        }
        setIsLoading(false);
      } catch (e) {
        if (!cancelled) {
          console.warn('[useVirtualBranch] exception:', e);
          setIsVirtualBranch(false);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.branchId, user?.role]);

  return { isVirtualBranch, isLoading };
}
