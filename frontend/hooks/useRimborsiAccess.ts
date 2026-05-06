/**
 * Hook to check if current user has access to Rimborsi module.
 * Aligned with web app /src/hooks/useRimborsiAccess.ts
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { checkRimborsiAccess } from '../lib/api/rimborsi';

export function useRimborsiAccess(): { hasAccess: boolean; isLoading: boolean } {
  const { user } = useAuthStore();
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id || !user.role) {
        if (!cancelled) {
          setHasAccess(false);
          setIsLoading(false);
        }
        return;
      }
      const access = await checkRimborsiAccess(user.id, user.role);
      if (!cancelled) {
        setHasAccess(access);
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role]);

  return { hasAccess, isLoading };
}
