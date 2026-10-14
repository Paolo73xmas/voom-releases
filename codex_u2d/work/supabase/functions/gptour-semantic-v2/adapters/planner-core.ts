// U2-d: PlannerPort over the SHARED planner core (D3(a), gptour-planner-core/planner.ts) — the same code v7 runs, without v7 interpretation/persistence.
// The CRM/routing ports are injected: in the lab they are simulated (FakeCrm / FakeRouting); real CRM/OSRM wiring is L3 (not authorized here).
// No new commercial filters (U2-e excluded): groups come from the U1 projection or the v7 default, exactly like v7.
import type { Projection } from '../../_shared/gptour-semantic/projection.ts';
import type { CrmPort, RoutingPort } from '../../_shared/gptour-orchestrator/ports.ts';
import { defaultGroups } from '../../_shared/gptour-orchestrator/commercial.ts';
import { romeNow, timeToMin } from '../../_shared/gptour-orchestrator/time.ts';
import { planTour, type PlannerInput, type PlannerOutcome } from '../../_shared/gptour-planner-core/planner.ts';
import { DependencyError, type InfeasibleCriterion, type PlannerPort, type PlannerResult } from '../../_shared/gptour-semantic-runtime/ports.ts';
export interface CorePlannerIo { crm: Pick<CrmPort, 'loadSettings' | 'loadTerritory' | 'loadCandidates' | 'loadPurchases' | 'loadAgenda'>; routing: RoutingPort; newId: () => string }
/** v7 outcome → U2 PlannerResult. Dependency faults become DependencyError (recoverable, same requestId); v7 clarifications become `infeasible` on the criterion the core actually names. */
export function mapOutcome(out: PlannerOutcome): PlannerResult {
  switch (out.kind) {
    case 'plan': return { kind: 'plan', plan: out.plan, dataQuality: out.dataQuality };
    case 'blocked': throw new DependencyError('catalog', out.message);
    case 'failed': throw new DependencyError('routing', out.message);
    case 'infeasible': {
      const criterion: InfeasibleCriterion = out.conflicts.includes('nessun candidato idoneo') ? 'area' : out.conflicts.some(c => c.startsWith('follow-up fuori dalle date')) ? 'dates' : 'other';
      return { kind: 'infeasible', reason: out.message, criterion };
    }
    case 'ask': {
      // 'infeasible' = the tour does not fit the time budget (time_window); 'follow_ups' = agenda decisions, not representable in U2-d (lab limit, declared as 'other').
      if (out.question.kind === 'infeasible') return { kind: 'infeasible', reason: out.question.text, criterion: 'time_window' };
      return { kind: 'infeasible', reason: `decisioni agenda richieste dal planner (${out.question.kind}) non supportate dall'adapter U2-d: ${out.question.text}`, criterion: 'other' };
    }
  }
}
export function makeCorePlanner(agentId: string, io: CorePlannerIo): PlannerPort {
  return {
    async plan(p: Projection, ctx) {
      const c = p.criteria;
      if (!c.area) return { kind: 'infeasible', reason: 'zona del giro non specificata', criterion: 'area' };
      if (!c.date) return { kind: 'infeasible', reason: 'data del giro non specificata', criterion: 'dates' };
      let settings; try { settings = await io.crm.loadSettings(agentId); } catch (e) { throw new DependencyError('settings', String((e as Error).message || e)); }
      const today = romeNow(ctx.acceptedAt).date;
      const criteria = { ...c, groups: c.groups ?? defaultGroups(), area: c.area, date: c.date } as PlannerInput['criteria'];
      if (criteria.startTime && criteria.endTime && timeToMin(criteria.endTime) <= timeToMin(criteria.startTime)) criteria.endTime = null; // same guard as v7
      const workEnd = timeToMin(criteria.endTime || settings.workEnd), startMin = criteria.startTime ? timeToMin(criteria.startTime) : timeToMin(settings.workStart);
      const metrics = { crmQueries: 0, routingCalls: 0 };
      const out = await planTour({ agentId, sessionId: ctx.sessionId, sessionRevision: ctx.sessionRevision, nowIso: ctx.acceptedAt, today, criteria, settings, followUpDecisions: [], departure: ctx.operational.departure, startMin, workEnd }, io, metrics);
      return mapOutcome(out);
    },
  };
}
