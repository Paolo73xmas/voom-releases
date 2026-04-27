/**
 * Simple in-memory cache with TTL.
 * Used to avoid duplicate fetches across screen focus events / navigation.
 * Resets on app reload.
 */
type CacheEntry<T> = { value: T; expiresAt: number };

const store = new Map<string, CacheEntry<any>>();

export function setCache<T>(key: string, value: T, ttlMs: number = 30_000): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function getCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function clearCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  Array.from(store.keys()).forEach(k => {
    if (k.startsWith(prefix)) store.delete(k);
  });
}
