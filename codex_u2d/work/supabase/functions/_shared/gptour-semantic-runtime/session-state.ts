// Persisted session state (opaque jsonb for the SQL) and its PUBLIC projection (semantic-1.1 StateSnapshot). Internal SQL rows never leave the runtime.
import { newSemanticState, type SemanticState } from '../gptour-semantic/contract.ts';
import type { Gate, OperationalContext, StateSnapshot } from '../gptour-semantic-transport/contract.ts';
import { emptyOperationalContext } from '../gptour-semantic-transport/context.ts';
import { projectState } from '../gptour-semantic-transport/public-projection.ts';
import type { DeclinedConsent } from './refused-consent.ts';
import type { LastInfeasible } from './infeasible-gate.ts';
import type { SessionView } from './store-port.ts';
export interface PersistedSessionState { semantic: SemanticState; gate: Gate | null; notices: string[]; declined: DeclinedConsent[]; lastInfeasible: LastInfeasible | null }
export interface SessionRead { semantic: SemanticState; gate: Gate | null; notices: string[]; declined: DeclinedConsent[]; lastInfeasible: LastInfeasible | null; operational: OperationalContext }
export const persistedState = (semantic: SemanticState, gate: Gate | null, notices: string[], declined: DeclinedConsent[], lastInfeasible: LastInfeasible | null): PersistedSessionState => ({ semantic, gate, notices: [...notices], declined: [...declined], lastInfeasible });
export function readSession(view: SessionView): SessionRead {
  const raw = view.state as Partial<PersistedSessionState>;
  const semantic = raw && typeof raw.semantic === 'object' && raw.semantic ? raw.semantic as SemanticState : newSemanticState(view.sessionId);
  const operational = Object.keys(view.operational).length ? view.operational as unknown as OperationalContext : emptyOperationalContext();
  return { semantic, gate: raw?.gate ?? null, notices: Array.isArray(raw?.notices) ? raw.notices.map(String) : [], declined: Array.isArray(raw?.declined) ? raw.declined : [], lastInfeasible: raw?.lastInfeasible ?? null, operational };
}
export function snapshotOf(view: SessionView, engineVersion: string): StateSnapshot {
  const r = readSession(view);
  return projectState(r.semantic, r.operational, { engineVersion, expiresAt: view.expiresAt, gate: r.gate, notices: r.notices });
}
