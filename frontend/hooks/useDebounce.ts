import { useState, useEffect } from 'react';

/**
 * Debounce hook — returns the value after `delay` ms of no changes.
 * Use for search inputs to avoid filtering on every keystroke.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
