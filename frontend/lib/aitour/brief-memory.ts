// Fase 4 "Dillo all'AI": memoria delle interpretazioni.
// Registra richiesta, brief interpretato dall'AI e correzioni fatte dall'agente sui chip,
// per costruire esempi mirati e test di regressione reali. Mai bloccante: se il log fallisce
// il giro si genera comunque.
import { supabase } from '../supabase';
import { conditionLabel, preferenceLabel, projectRuleLabel, fillerLabel, targetLabel, type TourBriefV4 } from './brief-v4';

const TABLE = 'ai_tour_brief_memory';

export interface BriefCorrection { field: string; label: string; removed: string[]; added: string[] }

export interface BriefMemoryCase {
  id: string;
  createdAt: string;
  sourceText: string;
  dictated: boolean;
  confidence: number | null;
  schemaErrors: string[];
  interpreted: TourBriefV4;
  final: TourBriefV4 | null;
  corrections: BriefCorrection[];
  generated: boolean;
}

const list = (items: string[]) => items.map((x) => x.trim()).filter(Boolean);

function diffList(field: string, label: string, before: string[], after: string[]): BriefCorrection | null {
  const b = list(before);
  const a = list(after);
  const removed = b.filter((x) => !a.includes(x));
  const added = a.filter((x) => !b.includes(x));
  if (!removed.length && !added.length) return null;
  return { field, label, removed, added };
}

const placeLabel = (p: TourBriefV4['route']['startPlace']) => (p ? `${p.kind}:${p.rawReference}` : '');
const stopLabels = (stops: TourBriefV4['mandatoryStops']) => stops.map((s) => `${s.rawReference}${s.selectedCustomerId ? ` → ${s.selectedCustomerId}` : ''}${s.appointment?.time ? ` @${s.appointment.time}` : ''}`);
const areaLabels = (areas: TourBriefV4['areas']) => areas.map((a) => `${a.mode === 'exclude' ? 'NO ' : a.mode === 'prefer' ? 'pref. ' : ''}${a.kind}:${a.value}`);
const journeyLabels = (b: TourBriefV4) => (b.journey?.stages || []).map((s) => `${s.name}${s.direction ? `/${s.direction}` : ''}`);

/** Differenze tra il brief interpretato dall'AI e quello confermato dall'agente. */
export function briefCorrections(before: TourBriefV4, after: TourBriefV4): BriefCorrection[] {
  const out: (BriefCorrection | null)[] = [
    diffList('selection', 'criteri di selezione', before.selection.conditions.map(conditionLabel), after.selection.conditions.map(conditionLabel)),
    diffList('exclusions', 'esclusioni', before.exclusions.map(conditionLabel), after.exclusions.map(conditionLabel)),
    diffList('areas', 'zone', areaLabels(before.areas), areaLabels(after.areas)),
    diffList('journey', 'percorso a tappe', journeyLabels(before), journeyLabels(after)),
    diffList('preferences', 'preferenze', before.preferences.map(preferenceLabel), after.preferences.map(preferenceLabel)),
    diffList('projectRules', 'quote tra progetti', before.projectRules.map(projectRuleLabel), after.projectRules.map(projectRuleLabel)),
    diffList('fillers', 'riempitivi', before.fillers.map(fillerLabel), after.fillers.map(fillerLabel)),
    diffList('mandatoryStops', 'clienti obbligatori', stopLabels(before.mandatoryStops), stopLabels(after.mandatoryStops)),
    diffList('preferredStops', 'clienti preferiti', stopLabels(before.preferredStops), stopLabels(after.preferredStops)),
    diffList('dayType', 'tipo di giornata', [before.dayType || ''], [after.dayType || '']),
    diffList('includeAutomatic', 'altri clienti oltre ai nominati', [String(before.includeAutomatic !== false)], [String(after.includeAutomatic !== false)]),
    diffList('requestedDate', 'data', [before.requestedDate.value || before.requestedDate.type], [after.requestedDate.value || after.requestedDate.type]),
    diffList('visitTarget', 'numero di visite', [targetLabel(before.visitTarget)], [targetLabel(after.visitTarget)]),
    diffList('route.startPlace', 'partenza', [placeLabel(before.route.startPlace)], [placeLabel(after.route.startPlace)]),
    diffList('route.endPlace', 'arrivo', [placeLabel(before.route.endPlace)], [placeLabel(after.route.endPlace)]),
    diffList('route.times', 'orari', [`${before.route.startTime || '—'}→${before.route.finishBy || before.route.endTime || '—'}`], [`${after.route.startTime || '—'}→${after.route.finishBy || after.route.endTime || '—'}`]),
    diffList('route.compact', 'compattezza', [before.route.compact], [after.route.compact]),
    diffList('route.return', 'rientro', [`casa:${before.route.returnHome} partenza:${before.route.returnToStart}`], [`casa:${after.route.returnHome} partenza:${after.route.returnToStart}`]),
  ];
  return out.filter((x): x is BriefCorrection => !!x);
}

interface LogInput { agentId: string; sourceText: string; dictated: boolean; brief: TourBriefV4 }

/** Registra l'interpretazione appena ricevuta. Restituisce l'id della riga o null se non salvata. */
export async function logBriefInterpretation({ agentId, sourceText, dictated, brief }: LogInput): Promise<string | null> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const createdBy = session.session?.user.id;
    if (!createdBy) return null;
    const { data, error } = await supabase.from(TABLE).insert({
      agent_id: agentId,
      created_by: createdBy,
      source_text: sourceText.slice(0, 4000),
      dictated,
      confidence: brief.interpretation.confidence,
      schema_errors: brief.schemaIssues || [],
      brief_interpreted: brief,
    }).select('id').single();
    if (error) return null;
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

/** Completa la riga con il brief confermato dall'agente e le sue correzioni. */
export async function logBriefGenerated(id: string, finalBrief: TourBriefV4, corrections: BriefCorrection[]): Promise<void> {
  try {
    await supabase.from(TABLE).update({
      brief_final: finalBrief,
      corrections,
      generated: true,
      generated_at: new Date().toISOString(),
    }).eq('id', id);
  } catch {
    // memoria non bloccante
  }
}

/** Casi reali per esempi mirati e regressioni. Con RLS: l'agente vede i suoi, l'admin tutti. */
export async function exportBriefMemoryCases(opts: { agentId?: string; limit?: number; onlyCorrected?: boolean } = {}): Promise<BriefMemoryCase[]> {
  let q = supabase.from(TABLE).select('id,created_at,source_text,dictated,confidence,schema_errors,brief_interpreted,brief_final,corrections,generated')
    .order('created_at', { ascending: false }).limit(Math.min(opts.limit ?? 200, 1000));
  if (opts.agentId) q = q.eq('agent_id', opts.agentId);
  const { data, error } = await q;
  if (error) throw new Error('Memoria interpretazioni non disponibile');
  const rows = (data || []) as Record<string, unknown>[];
  const cases = rows.map((r) => ({
    id: String(r.id),
    createdAt: String(r.created_at),
    sourceText: String(r.source_text || ''),
    dictated: r.dictated === true,
    confidence: typeof r.confidence === 'number' ? r.confidence : r.confidence == null ? null : Number(r.confidence),
    schemaErrors: Array.isArray(r.schema_errors) ? (r.schema_errors as string[]) : [],
    interpreted: r.brief_interpreted as TourBriefV4,
    final: (r.brief_final as TourBriefV4 | null) ?? null,
    corrections: Array.isArray(r.corrections) ? (r.corrections as BriefCorrection[]) : [],
    generated: r.generated === true,
  }));
  return opts.onlyCorrected ? cases.filter((c) => c.corrections.length > 0) : cases;
}
