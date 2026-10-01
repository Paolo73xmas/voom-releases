export const GPTOUR_ROLES = ['admin', 'admincustom', 'agent', 'agentcustom'] as const;
export function canUseGptour(role: string | undefined): boolean { return GPTOUR_ROLES.some((r) => r === role); }
export function resolveGptourAgent(role: string, uid: string, requested?: string | null): string {
  if (!uid) throw new Error('Sessione scaduta. Accedi nuovamente.');
  if (!canUseGptour(role)) throw new Error('Il tuo ruolo non è abilitato a GPTour (403).');
  if ((role === 'agent' || role === 'agentcustom') && requested && requested !== uid)
    throw new Error('Puoi creare un giro GPTour soltanto per il tuo account (403).');
  return role === 'admin' || role === 'admincustom' ? requested || uid : uid;
}
export function assertEffectiveAgent(expected: string, received: unknown): void {
  if (received !== expected) throw new Error('Risposta GPTour non coerente con l’agente richiesto. Nessun piano è stato costruito.');
}
export function normalizeGptourAgents(raw: unknown): { id: string; full_name: string }[] {
  if (!Array.isArray(raw) || raw.some((a) => !a || typeof a.id !== 'string' || (a.full_name != null && typeof a.full_name !== 'string')))
    throw new Error('Elenco agenti non valido. Riprova il caricamento: nessun agente è stato selezionato automaticamente.');
  return raw.map((a) => ({ id: a.id, full_name: a.full_name?.trim() || a.id }));
}