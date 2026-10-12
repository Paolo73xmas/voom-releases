import { describe, expect, it } from 'vitest';
import { clearOrchestratorLocalState, SessionStore } from '../lib/aitour/orchestrator/storage';

function memoryStorage(seed?: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    map,
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: async (key: string) => {
      map.delete(key);
    },
    getAllKeys: async () => [...map.keys()],
  };
}

describe('orchestrator lifecycle namespace cleanup', () => {
  it('clearOrchestratorLocalState removes only voom:orchestrator keys', async () => {
    const storage = memoryStorage({
      '@order_drafts': JSON.stringify([{ id: 'd1' }]),
      'gptour:draft:v1:owner-1': JSON.stringify({ text: 'bozza' }),
      'voom:orchestrator:1:owner-1:self': JSON.stringify({ storageVersion: 1, sessionId: 'sess-a' }),
      'voom:orchestrator:active:owner-1': 'self',
      'another:key': 'keep-me',
    });

    await clearOrchestratorLocalState(storage);

    expect(storage.map.get('@order_drafts')).toBeTruthy();
    expect(storage.map.get('gptour:draft:v1:owner-1')).toBeTruthy();
    expect(storage.map.get('another:key')).toBe('keep-me');
    expect(storage.map.get('voom:orchestrator:1:owner-1:self')).toBeUndefined();
    expect(storage.map.get('voom:orchestrator:active:owner-1')).toBeUndefined();
  });

  it('cleanup barrier prevents stale orchestrator write from recreating cleared data', async () => {
    const storage = memoryStorage({
      '@order_drafts': JSON.stringify([{ id: 'd1' }]),
      'gptour:draft:v1:owner-1': JSON.stringify({ text: 'bozza' }),
    });
    const stale = new SessionStore(storage);
    await clearOrchestratorLocalState(storage);

    await expect(
      stale.write('owner-1', undefined, { storageVersion: 1, sessionId: 'late', revision: 1 }),
    ).rejects.toMatchObject({ code: 'STORAGE' });

    expect(storage.map.get('@order_drafts')).toBeTruthy();
    expect(storage.map.get('gptour:draft:v1:owner-1')).toBeTruthy();
    expect([...storage.map.keys()].some(k => k.startsWith('voom:orchestrator:'))).toBe(false);
  });
});
