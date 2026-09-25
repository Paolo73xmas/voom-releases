import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({ values: new Map<string, string>(), getItem: vi.fn(), setItem: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));
import { collapseInspectionReminderByDefault, inspectionReminderKey, loadInspectionReminderCollapsed } from '../lib/aitour/inspection-reminder-preference';

beforeEach(() => {
  storage.values.clear();
  storage.getItem.mockReset().mockImplementation(async key => storage.values.get(key) ?? null);
  storage.setItem.mockReset().mockImplementation(async (key, value) => { storage.values.set(key, value); });
});

describe('preferenza promemoria ispezione persistente per agente', () => {
  it('mostra inizialmente il testo completo se non è mai stata premuta la X', async () => {
    expect(await loadInspectionReminderCollapsed('agent-a')).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('la X salva il default collassato e letture successive lo mantengono', async () => {
    await collapseInspectionReminderByDefault('agent-a');
    expect(await loadInspectionReminderCollapsed('agent-a')).toBe(true);
    expect(await loadInspectionReminderCollapsed('agent-a')).toBe(true);
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(inspectionReminderKey('agent-a'), '1');
  });
  it('ritrova la preferenza con un modulo nuovo, senza affidarsi alla memoria della schermata', async () => {
    await collapseInspectionReminderByDefault('agent-a');
    vi.resetModules();
    const fresh = await import('../lib/aitour/inspection-reminder-preference');
    expect(await fresh.loadInspectionReminderCollapsed('agent-a')).toBe(true);
  });
  it('non applica la scelta a un altro agente sullo stesso dispositivo', async () => {
    await collapseInspectionReminderByDefault('agent-a');
    expect(await loadInspectionReminderCollapsed('agent-b')).toBe(false);
    expect(await loadInspectionReminderCollapsed('agent-a')).toBe(true);
  });
  it('non modifica le altre preferenze locali', async () => {
    storage.values.set('@voom_theme_mode', 'dark');
    await collapseInspectionReminderByDefault('agent-a');
    expect(storage.values.get('@voom_theme_mode')).toBe('dark');
    expect(storage.values.size).toBe(2);
  });
  it('salvataggi ripetuti restano idempotenti, mai false o cancellazioni', async () => {
    await collapseInspectionReminderByDefault('agent-a');
    await collapseInspectionReminderByDefault('agent-a');
    expect(storage.values.size).toBe(1);
    expect([...storage.values.values()]).toEqual(['1']);
  });
  it('non nasconde silenziosamente errori di lettura o scrittura', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('read failure'));
    await expect(loadInspectionReminderCollapsed('agent-a')).rejects.toThrow('read failure');
    storage.setItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(collapseInspectionReminderByDefault('agent-a')).rejects.toThrow('disk full');
    expect(storage.values.size).toBe(0);
  });
  it('non crea una preferenza condivisa in assenza di agente', async () => {
    await expect(loadInspectionReminderCollapsed('  ')).rejects.toThrow('Agente non disponibile');
    await expect(collapseInspectionReminderByDefault('')).rejects.toThrow('Agente non disponibile');
    expect(storage.getItem).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('valori non riconosciuti non eliminano il promemoria e non vengono riscritti', async () => {
    storage.values.set(inspectionReminderKey('agent-a'), 'corrupted');
    expect(await loadInspectionReminderCollapsed('agent-a')).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});