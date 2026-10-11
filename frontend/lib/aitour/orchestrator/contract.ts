/** Known request envelope ONLY. Response/action wire schemas await MOBILE_API_HANDOFF.md.
 * The presentation types below are INTERNAL, not a claim about API 1.0 JSON. */
export const CONTRACT_VERSION = '1.0' as const;
export const ACTION_NAMES = ['answer', 'set_date', 'set_start_time', 'follow_up_decision', 'require_stop', 'exclude_stop', 'get_plan', 'reset'] as const;
export const SERVER_STATUSES = ['needs_clarification', 'planning', 'ready', 'infeasible', 'blocked', 'failed'] as const;
export type ActionName = typeof ACTION_NAMES[number];
export type ServerStatus = typeof SERVER_STATUSES[number];
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type Revision = number | string; // Exact revision scalar representation must be confirmed by handoff.
export interface RequestEnvelope {
  contractVersion: typeof CONTRACT_VERSION; sessionId: string; requestId: string; expectedRevision?: Revision;
  message?: string; action?: JsonValue; targetAgentId?: string; departure?: JsonValue; gps?: JsonValue;
}
export interface Command { name: ActionName; input?: JsonValue }
export interface Coordinate { latitude: number; longitude: number }
export interface OptionView { id: string; label: string; command: Command }
export interface QuestionView { id: string; text: string; options: OptionView[] }
export interface StopView {
  id: string; sequence: string; name: string; coordinate: Coordinate; arrival: string; departure: string;
  travel: string; visit: string; wait?: string; mandatory?: boolean; reason?: string; options?: OptionView[];
}
export interface DayView {
  id: string; title: string; date: string; start: { coordinate: Coordinate; label: string };
  end?: { coordinate: Coordinate; label: string } | null;
  stops: StopView[]; geometry: Coordinate[];
  metrics: { id: string; label: string; value: string }[]; // Server values, never locally summed/recomputed.
  breaks: string[]; commitments: string[]; overnight?: string; warnings: string[];
}
export interface PlanView { days: DayView[]; routing: 'verified' | 'estimated' | 'unknown'; warnings: string[] }
export interface ServerSnapshot {
  sessionId: string; revision: Revision; status: ServerStatus;
  messages: { id: string; role: 'user' | 'assistant'; text: string }[];
  questions: QuestionView[]; plan: PlanView | null; warnings: string[];
}
export interface ContractBinding {
  version: typeof CONTRACT_VERSION;
  provenance: 'handoff-verified' | 'isolated-fixture';
  /** No default: whether get_plan accepts expectedRevision is a SERVER contract decision. */
  recoveryRevision: 'omit' | 'confirmed';
  encodeAction: (command: Command) => JsonValue;
  decodeResponse: (raw: unknown, request: Readonly<RequestEnvelope>) => ServerSnapshot;
}
/** Intentionally absent: do not replace with a guessed response schema or enable through a URL flag. */
export const APPROVED_ORCHESTRATOR_BINDING: ContractBinding | null = null;