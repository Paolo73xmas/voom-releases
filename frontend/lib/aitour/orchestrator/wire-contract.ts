// Reviewed type-only transcription of the official 2026-10-11 handoff, API1.0 / Edgev6.
// Not a second planner. Keep server field names unchanged.
export const GPTOUR_CONTRACT_VERSION = '1.0';
export const GPTOUR_ENGINE_VERSION = 'gptour-orchestrator/0.2.0';
export interface GeoPoint { lat: number; lng: number; label?: string }
export type StructuredAction =
  | { type: 'answer'; questionId: string; optionId: string; value?: string }
  | { type: 'set_date'; date: string }
  | { type: 'set_start_time'; time: string }
  | { type: 'follow_up_decision'; followUpId: string; decision: 'include' | 'exclude' | 'propose_reschedule'; proposedDate?: string }
  | { type: 'require_stop'; key: string }
  | { type: 'exclude_stop'; key: string }
  | { type: 'get_plan'; planId: string }
  | { type: 'reset' };
export interface OrchestratorRequest {
  contractVersion: string; sessionId: string; requestId: string; expectedRevision?: number;
  message?: string; action?: StructuredAction; targetAgentId?: string;
  departure?: GeoPoint; gps?: { lat: number; lng: number; accuracyM: number; capturedAt: string };
}
export type ResponseStatus = 'needs_clarification' | 'planning' | 'ready' | 'infeasible' | 'blocked' | 'failed';
export type QuestionKind = 'inactive_days' | 'area' | 'date' | 'non_working_day' | 'past_time' | 'day_over' | 'follow_ups' | 'stale_draft' | 'infeasible' | 'free_text';
export interface QuestionOption { id: string; label: string }
export interface Question { id: string; kind: QuestionKind; text: string; options: QuestionOption[] }
export interface CommercialGroups { version: 1; existing: boolean; newPoints: boolean; ownOnly: boolean; inactiveDays: number | null; needsDays: boolean }
export interface RequestedArea { comuni: string[]; provincia: string | null; exhaustive: boolean }
export interface NormalizedCriteria {
  groups: CommercialGroups | null; area: RequestedArea | null; date: string | null; dateAnchorTurn: number | null;
  startTime: string | null; endTime: string | null; wantAll: boolean; nonWorkingConfirmed: boolean; maxDays: number | null; extraDaysApproved: boolean;
  requiredKeys: string[]; requiredNames: string[]; excludedNames: string[]; excludedKeys: string[]; consents: string[];
}
export type StopRole = 'suggested' | 'required_by_agent' | 'appointment' | 'follow_up_confirmed';
export interface PlanStop {
  key: string; name: string; city: string; lat: number; lng: number; role: StopRole; group: 'existing' | 'new';
  arrivalMin: number; departureMin: number; travelMinFromPrev: number; travelKmFromPrev: number; waitMin: number; visitMin: number;
  lunchBeforeMin: number; reason: string; lastOrderDate: string | null; daysSinceOrder: number | null; outsideWindow: boolean;
}
export interface PlanTotals { driveMin: number; visitMin: number; waitMin: number; breakMin: number; returnMin: number; totalMin: number; availableMin: number; bufferMin: number; totalKm: number }
export interface DayPlan {
  day: number; date: string; startMin: number; finishMin: number; endMin: number; departure: GeoPoint; returnTo: GeoPoint | null;
  stops: PlanStop[]; totals: PlanTotals; geometry: [number, number][]; startsFrom: 'home' | 'previous_day_end';
  returnHomeAfterDay: boolean; nightKmHome: number | null; nightDecision: 'last_day' | 'threshold' | 'global' | 'routing_unknown'; warnings: string[]; conflicts: string[];
}
export interface Plan {
  planId: string; sessionId: string; sessionRevision: number; engineVersion: string; contractVersion: string; generatedAt: string;
  date: string; startMin: number; finishMin: number; endMin: number; departure: GeoPoint; returnTo: GeoPoint | null;
  stops: PlanStop[]; totals: PlanTotals; geometry: [number, number][];
  verification: 'verified_routing' | 'estimated_routing'; snapshotRef: string;
  selectionReasons: { selected: { key: string; reason: string }[]; excluded: { key: string; name: string; reason: string }[] };
  warnings: string[]; dependsOnPendingChanges: string[]; days?: DayPlan[];
}
export interface DataQuality { candidatesComplete: boolean; poolTruncated: boolean; purchasesVerified: boolean; registryVerified: boolean; routingSource: 'osrm' | 'estimate' | 'none'; notes: string[] }
export interface Metrics { durationMs: number; crmQueries: number; aiCalls: number; routingCalls: number; aiPromptTokens?: number; aiCompletionTokens?: number; aiMs?: number; aiFailures?: number }
export interface OrchestratorResponse {
  status: ResponseStatus; contractVersion: string; engineVersion: string; sessionId: string; sessionRevision: number; requestId: string; generatedAt: string;
  message: string; question: Question | null; criteria: NormalizedCriteria; pendingDecisions: string[]; plan: Plan | null; planId: string | null;
  conflicts: string[]; dataQuality: DataQuality; metrics: Metrics; errorCode?: string;
}