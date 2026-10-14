// U2-d/2: DETERMINISTIC revalidation (replaces the lab simulation "always ok"). No external service:
//  - engine_changed  : the interpretive context was built by a different engine version (e.g. takeover by a newer worker);
//  - context_changed : the agent's reference catalog, re-read NOW with the user's own RLS-limited port, hashes differently from the one the context was built on.
// Catalog read failure → DependencyError('revalidation') → dependency_unavailable (recoverable), never a silent "ok".
import { canonicalJson, sha256Hex } from '../../_shared/gptour-semantic-runtime/canonical.ts';
import { DependencyError, type CatalogPort, type RevalidationPort } from '../../_shared/gptour-semantic-runtime/ports.ts';
export function makeRevalidation(agentId: string, catalog: CatalogPort): RevalidationPort {
  return {
    async check(ctx) {
      if (ctx.engineVersion !== ctx.contextEngineVersion) return { ok: false, code: 'engine_changed' };
      if (ctx.catalogHash === undefined) return { ok: true }; // nothing to compare against (older context without hash)
      let current;
      try { current = await catalog.load(agentId); } catch (e) { throw new DependencyError('revalidation', e instanceof DependencyError ? e.message : String((e as Error).message || e)); }
      return (await sha256Hex(canonicalJson(current))) === ctx.catalogHash ? { ok: true } : { ok: false, code: 'context_changed' };
    },
  };
}
