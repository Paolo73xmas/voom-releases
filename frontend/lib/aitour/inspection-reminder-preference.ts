import AsyncStorage from '@react-native-async-storage/async-storage';

export function inspectionReminderKey(agentId: string) {
  if (!agentId.trim()) throw new Error('Agente non disponibile');
  return `@voom:aitour:inspection-reminder:collapsed:v1:${encodeURIComponent(agentId.trim())}`;
}

/** Preferenza locale per agente, indipendente da cliente, giro e sessione. */
export async function loadInspectionReminderCollapsed(agentId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(inspectionReminderKey(agentId))) === '1';
}

/** Solo la X salva la preferenza. Riaprire il testo NON cancella questo valore. */
export async function collapseInspectionReminderByDefault(agentId: string): Promise<void> {
  await AsyncStorage.setItem(inspectionReminderKey(agentId), '1');
}