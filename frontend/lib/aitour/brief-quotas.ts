// Quote tra progetti ("almeno 6 FED", "massimo 4 DV", "prima FED poi DV") e riempitivi
// ("se avanza tempo 3 prospect"): da regole interpretate a vincoli reali del giro.
// Parità web src/lib/aitour/brief-quotas.ts
import type { TourBriefV4, BriefProjectRule } from './brief-v4';
import { matchProjectName, projectRuleLabel } from './brief-v4';
import type { TourCandidate } from './types';
import type { PlanQuota } from './planner';
export type { PlanQuota };

const members = (list: TourCandidate[], project: string) => list.filter((c) => matchProjectName(c, [project]));

// "Prima FED poi DV": bonus decrescente per priorità (1 = più alta); senza numero vale l'ordine delle regole.
export function applyProjectPriority(candidates: TourCandidate[], rules: BriefProjectRule[]): TourCandidate[] {
  const prio = rules.filter((r) => r.type === 'priority');
  if (!prio.length) return candidates;
  const rank = new Map<string, number>();
  prio.forEach((r, i) => rank.set(r.project, r.priority ?? i + 1));
  return candidates.map((c) => {
    const best = [...rank.entries()].filter(([p]) => matchProjectName(c, [p])).map(([, n]) => n).sort((a, b) => a - b)[0];
    if (best == null) return c;
    const bonus = Math.max(5, 30 - 10 * (best - 1));
    return { ...c, score: c.score + bonus, reason: `Priorità progetto ${best}. ${c.reason}` };
  });
}

export function buildProjectQuotas(candidates: TourCandidate[], rules: BriefProjectRule[], cap: number | null): { quotas: PlanQuota[]; warnings: string[] } {
  const quotas: PlanQuota[] = [];
  const warnings: string[] = [];
  for (const r of rules) {
    if (r.type === 'priority') continue;
    const m = members(candidates, r.project);
    let min: number | null = null, max: number | null = null;
    if (r.type === 'minimum_count') min = r.value;
    else if (r.type === 'maximum_count') max = r.value;
    else if (r.type === 'exact_count') { min = r.value; max = r.value; }
    else if (r.type === 'ratio') {
      if (!cap) { warnings.push(`${projectRuleLabel(r)}: senza un numero totale di visite la percentuale non è applicabile`); continue; }
      min = Math.round((r.value || 0) * cap); max = null;
    }
    if (!m.length) { warnings.push(`${projectRuleLabel(r)}: nessun soggetto idoneo di "${r.project}" tra i candidati (zona, filtri o 15 giorni)`); continue; }
    if (min != null && m.length < min) warnings.push(`${projectRuleLabel(r)}: idonei solo ${m.length}`);
    quotas.push({ label: projectRuleLabel(r), keys: new Set(m.map((c) => c.key)), min, max });
  }
  return { quotas, warnings };
}

// Riserva prima i minimi di ogni quota (nell'ordine della lista), poi riempie fino a cap rispettando i massimi.
export function pickWithQuotas(list: TourCandidate[], cap: number, quotas: PlanQuota[], protectedKeys: Set<string> = new Set()): TourCandidate[] {
  const chosen = new Set<string>(list.filter((c) => protectedKeys.has(c.key)).map((c) => c.key));
  const count = (q: PlanQuota) => [...chosen].filter((k) => q.keys.has(k)).length;
  const maxHit = (c: TourCandidate) => quotas.some((q) => q.max != null && q.keys.has(c.key) && count(q) >= q.max);
  for (const q of quotas) {
    if (q.min == null) continue;
    for (const c of list) {
      if (count(q) >= q.min || chosen.size >= cap) break;
      if (!q.keys.has(c.key) || chosen.has(c.key) || maxHit(c)) continue;
      chosen.add(c.key);
    }
  }
  for (const c of list) {
    if (chosen.size >= cap) break;
    if (chosen.has(c.key) || maxHit(c)) continue;
    chosen.add(c.key);
  }
  return list.filter((c) => chosen.has(c.key));
}

// Verifica finale sul giro pianificato: minimi non raggiunti -> avviso con il motivo.
export function quotaReport(stops: TourCandidate[], quotas: PlanQuota[]): { unmet: string[]; met: string[] } {
  const unmet: string[] = [], met: string[] = [];
  for (const q of quotas) {
    const n = stops.filter((c) => q.keys.has(c.key)).length;
    if (q.min != null && n < q.min) unmet.push(`${q.label}: nel giro ${n} (idonei ${q.keys.size}${q.keys.size >= q.min ? ', orario o percorso non permettono di più' : ''})`);
    else met.push(`${q.label}: ${n} nel giro`);
  }
  return { unmet, met };
}

export function briefHasQuotas(brief: TourBriefV4): boolean {
  return brief.projectRules.some((r) => r.type !== 'priority');
}
