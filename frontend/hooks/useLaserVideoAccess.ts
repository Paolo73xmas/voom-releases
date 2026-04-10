import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { checkUserAccess } from '../lib/api/laservideo';

export function useLaserVideoAccess() {
  const { user } = useAuthStore();
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setHasAccess(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const access = await checkUserAccess(user.id);
        if (!cancelled) setHasAccess(access);
      } catch (err) {
        console.error('Error checking LaserVideo access:', err);
        if (!cancelled) setHasAccess(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  return { hasAccess, isLoading };
}
