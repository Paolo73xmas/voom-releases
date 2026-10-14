// U2-d Edge entrypoint. NOT deployed. Startable LOCALLY with synthetic dependencies (tests/gptour-semantic/u2/u2d/lab_entrypoint.py); every real link is still excluded (L3).
// ┌ Dependencies wired HERE ───────────────────────────────────────────────────────────────────────────────────────────────┐
// │ store        : PostgREST + backend JWT (GPTOUR_SEMANTIC_V2_REST_URL / GPTOUR_SEMANTIC_BACKEND_KEY) — lab: local PostgREST │
// │ catalog      : lab tables via the USER's JWT (RLS) — real CRM catalog = L3                                                │
// │ revalidation : DETERMINISTIC (adapters/revalidation.ts): engine version + catalog hash re-read with the user's port      │
// │ llm          : NOT WIRED (null) → free-text turns end as llm_unavailable; provider = L3                                  │
// │ planner      : NOT WIRED → DependencyError('planner') → dependency_unavailable (recoverable). The shared core (D3(a),    │
// │                adapters/planner-core.ts) exists and is tested with simulated CRM/routing; real CRM/OSRM ports = L3       │
// └ REAL links EXCLUDED (L3): Supabase JWT secret, hosted PostgREST/backend key, CRM catalog+customers, OSRM, LLM, real apps ┘
import { configFromEnv } from './env.ts';
import { makeHttpHandler } from './handler.ts';
import { makePostgrestStore } from '../_shared/gptour-semantic-runtime/store-postgrest.ts';
import { makePostgrestCatalog, makePostgrestSettings } from './adapters/catalog-postgrest.ts';
import { makeRevalidation } from './adapters/revalidation.ts';
import { DependencyError, type PlannerPort } from '../_shared/gptour-semantic-runtime/ports.ts';
/** Planner not wired to real CRM/routing (L3): every planning turn is released as dependency_unavailable, never a fake result. */
export const PLANNER_NOT_WIRED: PlannerPort = { async plan() { throw new DependencyError('planner', 'planner not wired: real CRM/routing ports are L3 (not authorized)'); } };
const cfg = configFromEnv();
const baseUrl = Deno.env.get('GPTOUR_SEMANTIC_V2_REST_URL'); const backendJwt = Deno.env.get('GPTOUR_SEMANTIC_BACKEND_KEY');
if (!baseUrl || !backendJwt) throw new Error('GPTOUR_SEMANTIC_V2_REST_URL / GPTOUR_SEMANTIC_BACKEND_KEY missing');
const store = makePostgrestStore({ baseUrl, backendJwt });
const handler = makeHttpHandler(cfg, (caller, userJwt) => {
  const catalog = makePostgrestCatalog(baseUrl, userJwt);
  return { store, llm: null, catalog, settings: makePostgrestSettings(baseUrl, userJwt), planner: PLANNER_NOT_WIRED, revalidation: makeRevalidation(caller.uid, catalog),
    engineVersion: 'gptour-semantic-v2/u2-d', promptVersion: 'p1', model: 'none', executionBudgetMs: 60000, now: Date.now, newId: () => crypto.randomUUID() };
});
console.log(`gptour-semantic-v2 start: enabled=${cfg.enabled} pilotUids=${cfg.allowedUids.size} corsOrigins=${cfg.allowedOrigins.size} deps={store:postgrest, catalog:lab-tables, revalidation:DETERMINISTIC(engine+catalogHash), llm:NOT_WIRED, planner:NOT_WIRED}`);
const labPort = Deno.env.get('GPTOUR_SEMANTIC_V2_LAB_PORT'); // lab-only: local listener; absent on the Edge runtime
Deno.serve(labPort ? { port: Number(labPort), hostname: '127.0.0.1' } : {}, handler);
