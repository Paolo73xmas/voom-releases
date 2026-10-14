// Injectable ports for U2-c. In this phase every implementation is a lab simulation (LLM, planner/routing, catalog, settings, revalidation).
import type { ReferenceCatalog, SemanticState } from '../gptour-semantic/contract.ts';
import type { Projection } from '../gptour-semantic/projection.ts';
import type { DataQuality, Plan } from '../gptour-orchestrator/contract.ts';
import type { LlmPort } from '../gptour-semantic/interpreter.ts';
import type { OperationalContext } from '../gptour-semantic-transport/contract.ts';
import type { SemanticStore } from './store-port.ts';
export interface CatalogPort { load(agentId: string): Promise<ReferenceCatalog> }
/** Agent settings needed by the deterministic gate (ISO working days 1..7); null = unknown → no non-working-day consent is asked. */
export interface SettingsPort { workingDays(agentId: string): Promise<number[] | null> }
/** Criterion the planner can IDENTIFY as the cause of infeasibility; 'other' when it cannot (never attributed arbitrarily by the runtime). */
export type InfeasibleCriterion = 'area' | 'dates' | 'time_window' | 'visit_filter' | 'lodging' | 'other';
export const INFEASIBLE_CRITERIA: readonly InfeasibleCriterion[] = ['area', 'dates', 'time_window', 'visit_filter', 'lodging', 'other'];
export type PlannerResult = { kind: 'plan'; plan: Plan; dataQuality: DataQuality | null } | { kind: 'infeasible'; reason: string; criterion: InfeasibleCriterion };
export interface PlannerPort { plan(p: Projection, ctx: { sessionId: string; sessionRevision: number; acceptedAt: string; operational: OperationalContext }): Promise<PlannerResult> }
export type RevalidationResult = { ok: true } | { ok: false; code: 'context_changed' | 'engine_changed' };
export interface RevalidationPort { check(ctx: { state: SemanticState; acceptedAt: string; engineVersion: string; contextEngineVersion: string; /** sha256 of the canonical catalog the interpretive context was built on (U2-d/2, additive) */ catalogHash?: string }): Promise<RevalidationResult> }
export interface InterpretiveContext { acceptedAt: string; catalog: ReferenceCatalog; catalogHash: string; workingDays: number[] | null; engineVersion: string; promptVersion: string; model: string }
/** Structured provider failure: adapters MUST throw this so the turn can tell permanent faults (401/403/400…) from transient ones (timeout/429/5xx/network). */
export class LlmProviderError extends Error {
  constructor(readonly status: number | null, readonly retryable: boolean, message: string) { super(message); this.name = 'LlmProviderError'; }
}
/** Failure of a deterministic dependency (catalog/settings/planner/routing/revalidation): the turn is released as dependency_unavailable (recoverable, same requestId). Never a fake 'no candidates'. */
export class DependencyError extends Error {
  constructor(readonly dependency: 'catalog' | 'settings' | 'planner' | 'routing' | 'revalidation', message: string) { super(message); this.name = 'DependencyError'; }
}
export const isRetryableHttpStatus = (status: number): boolean => status === 408 || status === 429 || status >= 500;
export interface TurnDeps {
  store: SemanticStore; llm: LlmPort | null; catalog: CatalogPort; settings: SettingsPort; planner: PlannerPort; revalidation: RevalidationPort;
  engineVersion: string; promptVersion: string; model: string; llmTimeoutMs?: number; leaseIntervalMs?: number; executionBudgetMs: number;
  now: () => number; newId: () => string;
  /** Test-only crash hook: throwing here simulates the worker dying at a checkpoint (C1..C8). */
  crash?: (point: string) => void;
}
