// GPTour — contratto semantico condiviso Web/App (versione "semantic-1.0.1": 1.0 + operazione additiva decline_consent).
// L'LLM produce SOLO operazioni sui criteri; il server le valida e le applica. Nessuna dipendenza runtime.
export const SEMANTIC_CONTRACT_VERSION = 'semantic-1.0.1';
export const SEMANTIC_TIMEZONE = 'Europe/Rome';

export type Category = 'client' | 'prospect' | 'orphan' | 'free' | 'never';
export const CATEGORIES: readonly Category[] = ['client', 'prospect', 'orphan', 'free', 'never'];

/** Gruppo commerciale: categorie + filtri propri. Acquisti (ordini) e visite (contatto fisico) sono campi distinti. */
export interface Segment {
  categories: Category[];
  /** "tutte le tipologie": tutte le categorie, NON implica "tutti i punti". */
  allCategories: boolean;
  minDaysSinceOrder: number | null;
  minDaysSinceVisit: number | null;
  /** "i miei clienti" / "i miei orfani": solo relazioni dell'agente. */
  ownOnly: boolean;
}

export interface AreaLocality { name: string; provincia: string | null }
export interface Area { localities: AreaLocality[]; provincia: string | null; allowNearby: boolean }
export interface StopRef { key: string; name: string }
export type ConsentKind = 'extra_days' | 'non_working_day' | 'exceed_end_time' | 'outside_territory';
export const CONSENT_KINDS: readonly ConsentKind[] = ['extra_days', 'non_working_day', 'exceed_end_time', 'outside_territory'];

export interface SemanticCriteria {
  schema: 1;
  segments: Segment[];
  area: Area | null;
  dates: string[];
  startTime: string | null;
  endTime: string | null;
  revenue: { min: number | null; max: number | null } | null;
  project: string | null;
  /** "tutti i punti" = all_matching (tutti i soggetti che soddisfano i criteri). */
  coverage: 'selection' | 'all_matching';
  maxDays: number | null;
  /** Cosa fare se i punti non entrano: 'ask' = chiedere all'agente (nessun consenso implicito). */
  overflowPolicy: 'ask' | 'extend_days' | 'drop_excess' | null;
  lodging: { mode: 'home' | 'away' | 'conditional'; maxKmHome: number | null } | null;
  followUpsMode: 'consider' | 'skip';
  stops: { required: StopRef[]; excluded: StopRef[] };
  followUps: Array<{ eventId: string; label: string; decision: 'include' | 'exclude' }>;
  /** Solo PROPOSTE di spostamento: nessuna modifica dell'agenda; la conferma è un'azione separata del backend. */
  rescheduleProposals: Array<{ eventId: string; label: string; fromDate: string; proposedDate: string; status: 'proposed' }>;
  /** detail = giornate accettate (proposta extra_days). dates = date ESATTE autorizzate (non_working_day): il consenso
   *  vale solo per quelle e viene invalidato quando le date del giro cambiano o vengono azzerate. */
  consents: Array<{ kind: ConsentKind; source: 'answer' | 'action'; turn: number; detail: number | null; dates: string[] | null }>;
}

/** Riferimenti verificati dal server (CRM in sola lettura): l'LLM può solo citarli, mai inventarne. */
export interface ReferenceCatalog {
  localities: AreaLocality[];
  provinces: Array<{ sigla: string; nome: string }>;
  events: Array<{ id: string; type: 'follow_up' | 'appointment'; label: string; date: string; time: string | null }>;
  stops: Array<{ key: string; name: string; city: string }>;
  projects: string[];
}

export type QuestionKind = 'area_ambiguous' | 'unsupported_criteria' | 'locality_ambiguous' | 'locality_unknown' | 'reference_unknown' | 'reference_ambiguous' | 'consent' | 'invalid_value' | 'unclear' | 'llm_error';
export interface QuestionOption { id: string; label: string }
export interface PublicQuestion { id: string; kind: QuestionKind; text: string; options: QuestionOption[] }
/** Proposta di espansione generata dal SISTEMA (es. il planner: "servono 4 giornate"): richiede consenso esplicito. */
export interface ExpansionProposal { kind: ConsentKind; days: number | null; dates?: string[] | null }
/** Domanda pendente lato server: le operazioni sospese vengono riapplicate dopo la risposta, senza nuova chiamata LLM. */
/** Provenienza di un'operazione: l'LLM (con il messaggio ORIGINALE del turno) o il server (pulsante/risposta deterministica). */
export type OpSource = { kind: 'llm'; turn: number; message: string } | { kind: 'server'; reason: string };
export interface SourcedOp { op: Operation; source: OpSource }
export interface PendingQuestion extends PublicQuestion { deferred: SourcedOp[] | null; opIndex: number | null; consentKind: ConsentKind | null; askedAtTurn: number; proposal?: ExpansionProposal | null;
  /** Domanda precedente ancora aperta (pila): torna attiva quando questa viene risolta. */
  previous?: PendingQuestion | null }

export type OpName = 'set' | 'clear' | 'add_segment' | 'replace_segments' | 'remove_segment' | 'add_locality' | 'remove_locality' | 'replace_area'
  | 'require_stop' | 'exclude_stop' | 'follow_up' | 'propose_reschedule' | 'grant_consent' | 'decline_consent' | 'reset_all';
export type SetField = 'dates' | 'start_time' | 'end_time' | 'revenue_min' | 'revenue_max' | 'project' | 'coverage' | 'max_days' | 'overflow_policy'
  | 'lodging_mode' | 'lodging_max_km' | 'follow_ups_mode' | 'allow_nearby';
export type ClearField = 'segments' | 'purchase_filter' | 'visit_filter' | 'revenue' | 'area' | 'dates' | 'start_time' | 'end_time' | 'project'
  | 'coverage' | 'max_days' | 'overflow_policy' | 'lodging' | 'stops' | 'follow_ups';

/** Operazione piatta (stessa forma dello schema LLM). Campi non pertinenti = null. `evidence` = citazione letterale dal messaggio. */
export interface Operation {
  op: OpName; field: SetField | ClearField | null;
  text: string | null; number: number | null; flag: boolean | null; dates: string[] | null;
  categories: Category[] | null; allCategories: boolean | null; minDaysSinceOrder: number | null; minDaysSinceVisit: number | null; ownOnly: boolean | null;
  locality: string | null; provincia: string | null;
  refId: string | null; mention: string | null; decision: 'include' | 'exclude' | null; proposedDate: string | null;
  consent: ConsentKind | null; evidence: string;
}
export interface LlmOutput { operations: Operation[]; clarification: { reason: 'ambiguous' | 'missing_info' | 'unrelated'; question: string } | null }

/** Azioni dei pulsanti: deterministiche, MAI reinterpretate dall'LLM. */
export type SemanticAction =
  | { type: 'answer'; questionId: string; optionId: string }
  | { type: 'follow_up_decision'; eventId: string; decision: 'include' | 'exclude' }
  | { type: 'propose_reschedule'; eventId: string; proposedDate: string }
  | { type: 'require_stop'; key: string }
  | { type: 'exclude_stop'; key: string }
  | { type: 'grant_consent'; kind: ConsentKind; dates?: string[] }
  /** Annulla la domanda in cima: si scarta l'operazione problematica, le altre sospese vengono applicate. */
  | { type: 'dismiss_question'; questionId: string }
  | { type: 'set_date'; date: string }
  | { type: 'reset' };

export interface SemanticRequest {
  contractVersion: string; sessionId: string; requestId: string; expectedRevision: number;
  message?: string; action?: SemanticAction;
  /** Solo diagnostica: non entra MAI nel prompt né nelle regole (stesso input ⇒ stesso esito su Web e App). */
  client?: { platform: 'web' | 'mobile'; appVersion?: string };
}

export interface SemanticState {
  sessionId: string; revision: number; turn: number; criteria: SemanticCriteria; pendingQuestion: PendingQuestion | null;
  history: Array<{ role: 'agent' | 'assistant'; text: string }>;
}

export type SemanticErrorCode = 'unsupported_contract' | 'invalid_request' | 'revision_conflict' | 'llm_unavailable' | 'llm_timeout' | 'llm_invalid_output' | 'unknown_question';
export interface SemanticResult {
  contractVersion: string; sessionId: string; requestId: string;
  status: 'updated' | 'needs_clarification' | 'error';
  revision: number; criteria: SemanticCriteria; changed: string[];
  applied: Operation[]; rejected: Array<{ op: OpName; reason: string }>;
  /** Domanda da mostrare: nuova oppure ANCORA APERTA (anche con status 'updated', se il turno non l'ha risolta). */
  question: PublicQuestion | null; errorCode: SemanticErrorCode | null; message: string;
  /** Avvisi espliciti, es. consensi non più validi perché le date sono cambiate. */
  notices: string[];
  diagnostics: { interpreter: 'llm' | 'structured_action' | 'none'; llmCalls: number; model: string | null; ms: number };
}

export function emptySemanticCriteria(): SemanticCriteria {
  return {
    schema: 1, segments: [], area: null, dates: [], startTime: null, endTime: null, revenue: null, project: null,
    coverage: 'selection', maxDays: null, overflowPolicy: null, lodging: null, followUpsMode: 'consider',
    stops: { required: [], excluded: [] }, followUps: [], rescheduleProposals: [], consents: [],
  };
}
export function newSemanticState(sessionId: string): SemanticState {
  return { sessionId, revision: 0, turn: 0, criteria: emptySemanticCriteria(), pendingQuestion: null, history: [] };
}
