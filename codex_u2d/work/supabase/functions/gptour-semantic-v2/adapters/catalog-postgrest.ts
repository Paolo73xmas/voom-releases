// U2-d: catalog/settings adapters over PostgREST with the USER's JWT (RLS-limited to the authorized user; no backend key here).
// Lab tables only (lab_gptour_catalog_localities, lab_gptour_agent_settings): no commercial filters (U2-e excluded), caps.exact stays false.
import type { ReferenceCatalog } from '../../_shared/gptour-semantic/contract.ts';
import { DependencyError, type CatalogPort, type SettingsPort } from '../../_shared/gptour-semantic-runtime/ports.ts';
async function rows<T>(baseUrl: string, userJwt: string, path: string, dep: 'catalog' | 'settings'): Promise<T[]> {
  let res: Response;
  try { res = await fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${userJwt}`, accept: 'application/json' } }); } catch (e) { throw new DependencyError(dep, `network: ${(e as Error).message}`); }
  if (!res.ok) throw new DependencyError(dep, `http ${res.status}`);
  return await res.json() as T[];
}
export const makePostgrestCatalog = (baseUrl: string, userJwt: string): CatalogPort => ({
  async load(agentId) {
    const loc = await rows<{ name: string; provincia: string }>(baseUrl, userJwt, `/lab_gptour_catalog_localities?agent_id=eq.${agentId}&select=name,provincia&order=name`, 'catalog');
    const provinces = [...new Map(loc.map(l => [l.provincia, { sigla: l.provincia, nome: l.provincia }])).values()];
    const catalog: ReferenceCatalog = { localities: loc.map(l => ({ name: l.name, provincia: l.provincia })), provinces, events: [], stops: [], projects: [] };
    return catalog;
  },
});
export const makePostgrestSettings = (baseUrl: string, userJwt: string): SettingsPort => ({
  async workingDays(agentId) {
    const r = await rows<{ working_days: number[] }>(baseUrl, userJwt, `/lab_gptour_agent_settings?agent_id=eq.${agentId}&select=working_days`, 'settings');
    return r[0]?.working_days ?? null;
  },
});
