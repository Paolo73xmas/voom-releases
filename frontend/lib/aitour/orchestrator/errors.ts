export type ErrorCode = 'HANDOFF_REQUIRED' | 'INVALID_REQUEST' | 'INVALID_RESPONSE' | 'AUTH_REQUIRED' | 'FORBIDDEN'
  | 'ACCOUNT_CHANGED' | 'CONFLICT' | 'UNAVAILABLE' | 'NETWORK' | 'CANCELLED' | 'STORAGE' | 'PENDING_REQUEST' | 'REQUEST_REJECTED';
const messages: Record<ErrorCode, string> = {
  HANDOFF_REQUIRED: 'Integrazione in preparazione: manca la specifica API verificata. Nessuna richiesta è stata inviata.',
  INVALID_REQUEST: 'Richiesta non valida. Nessun dato è stato inviato.',
  INVALID_RESPONSE: 'Risposta server non riconosciuta o non coerente. Il piano non è confermato.',
  AUTH_REQUIRED: 'Sessione non disponibile o scaduta. Accedi nuovamente.',
  FORBIDDEN: 'Accesso al pilota o all’agente selezionato non autorizzato dal server. Nessun passaggio automatico al legacy.',
  ACCOUNT_CHANGED: 'Account cambiato: risposta ignorata e dati della conversazione rimossi dalla schermata.',
  CONFLICT: 'La sessione è cambiata sul server. Recupera lo stato aggiornato prima di una nuova richiesta.',
  UNAVAILABLE: 'Motore centrale temporaneamente non disponibile. Puoi riprovare la stessa richiesta.',
  NETWORK: 'Risposta non ricevuta. La richiesta potrebbe essere stata elaborata: riprova con lo stesso identificativo.',
  CANCELLED: 'Attesa interrotta. L’elaborazione server potrebbe continuare; nessun piano è stato confermato.',
  STORAGE: 'Impossibile conservare gli identificativi della richiesta. Nessuna nuova richiesta può partire in sicurezza.',
  PENDING_REQUEST: 'Una richiesta attende conferma: riprovala prima di inviarne un’altra.',
  REQUEST_REJECTED: 'Richiesta respinta dal motore centrale. Recupera lo stato della sessione.',
};
export class OrchestratorError extends Error {
  constructor(public readonly code: ErrorCode) { super(messages[code]); this.name = 'OrchestratorError'; }
  get retryable(): boolean { return ['NETWORK', 'UNAVAILABLE', 'CANCELLED', 'PENDING_REQUEST'].includes(this.code); }
}
export function httpError(status: number | undefined): OrchestratorError {
  return new OrchestratorError(status === 401 ? 'AUTH_REQUIRED' : status === 403 ? 'FORBIDDEN' : status === 409 ? 'CONFLICT'
    : status === 503 || status === 502 || status === 504 ? 'UNAVAILABLE'
      : status && status >= 400 ? 'REQUEST_REJECTED' : 'NETWORK');
}
export const safeError = (e: unknown): OrchestratorError => e instanceof OrchestratorError ? e : new OrchestratorError('NETWORK');