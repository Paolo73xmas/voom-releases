// Chiamate all'edge function ai-tour (spiegazioni AI) con fallback deterministici.
import { supabase } from '../supabase';
import { timeoutSignal } from './osrm';
import type { TourPlan, DayType } from './types';
import { fmtDur, minToTime, ENTITY_LABELS } from './types';
import type { PortfolioStats } from './scoring';

const FN_URL = 'https://gorwxfzzyzxmxnizmebw.supabase.co/functions/v1/ai-tour';

async function callFn(action: 'strategy' | 'recommend', payload: unknown): Promise<Record<string, string> | null> {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token || '';
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, payload }),
      signal: timeoutSignal(25000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[AITour][ai] edge function non disponibile, uso fallback:', err);
    return null;
  }
}

function fallbackStrategy(plan: TourPlan): string {
  const byType = new Map<string, number>();
  for (const s of plan.stops) byType.set(s.candidate.entityType, (byType.get(s.candidate.entityType) || 0) + 1);
  const parts = [...byType.entries()].map(([t, n]) => `${n} ${ENTITY_LABELS[t as keyof typeof ENTITY_LABELS].toLowerCase()}${n > 1 ? (t === 'client' ? 'i' : '') : ''}`);
  const area = plan.areaLabel ? ` nell'area ${plan.areaLabel}` : '';
  const excl = plan.excluded.filter((e) => e.candidate.score >= 60).length;
  let text = `Ho pianificato ${plan.stops.length} visite${area} (${parts.join(', ')}), con priorita' media ${plan.avgScore}/100 e rientro previsto alle ${minToTime(plan.finishMin)}.`;
  text += ` Il giro prevede ${plan.totalKm.toFixed(0)} km e ${fmtDur(plan.driveMin)} di guida, mantenendo ${fmtDur(plan.bufferMin)} di buffer.`;
  if (excl > 0) text += ` ${excl} visite ad alta priorita' sono rimaste fuori per limiti di orario: valuta di inserirle nel prossimo giro.`;
  return text;
}

export async function getStrategySummary(plan: TourPlan): Promise<string> {
  const byType: Record<string, number> = {};
  for (const s of plan.stops) byType[s.candidate.entityType] = (byType[s.candidate.entityType] || 0) + 1;
  const payload = {
    conteggi: {
      visite_totali: plan.stops.length,
      clienti: byType.client || 0,
      prospect: byType.prospect || 0,
      orfani: byType.orphan || 0,
      da_acquisire: byType.free || 0,
    },
    data: plan.tourDate,
    orario: `${minToTime(plan.startMin)}-${minToTime(plan.endMin)}`,
    area: plan.areaLabel,
    tipo_giornata: plan.resolvedDayType,
    km: Math.round(plan.totalKm),
    minuti_guida: Math.round(plan.driveMin),
    minuti_visite: Math.round(plan.visitMin),
    minuti_buffer: Math.round(plan.bufferMin),
    fine_prevista: minToTime(plan.finishMin),
    visite: plan.stops.map((s) => ({
      nome: s.candidate.name,
      tipo: s.candidate.entityType,
      priorita: s.candidate.score,
      motivo: (s.candidate.reason || '').slice(0, 90),
      citta: s.candidate.city,
    })),
    escluse: plan.excluded.slice(0, 6).map((e) => ({ nome: e.candidate.name, priorita: e.candidate.score, perche: e.why })),
    avvisi: plan.warnings,
  };
  const res = await callFn('strategy', payload);
  return res?.summary || fallbackStrategy(plan);
}

function fallbackRecommend(stats: PortfolioStats): { dayType: Exclude<DayType, 'ai'>; motivation: string } {
  const top = stats.topAreas[0];
  if (stats.clientsOverdue30 >= stats.prospects + stats.orphans && stats.clientsOverdue30 > 5) {
    return {
      dayType: 'clienti',
      motivation: `Risultano ${stats.clientsOverdue30} clienti non visitati da oltre 30 giorni${top ? ` (zona piu' critica: ${top.area})` : ''}. Suggerisco una giornata dedicata ai clienti acquisiti.`,
    };
  }
  if (stats.prospects + stats.orphans > stats.clientsOverdue30 && stats.prospects + stats.orphans > 10) {
    return {
      dayType: 'sviluppo',
      motivation: `Pochi clienti con urgenza di visita ma ${stats.prospects} prospect e ${stats.orphans} orfani disponibili${top ? ` (concentrati su ${top.area})` : ''}. Suggerisco una giornata di sviluppo territorio.`,
    };
  }
  return {
    dayType: 'mista',
    motivation: `Il portafoglio presenta un mix equilibrato: ${stats.clientsOverdue30} clienti da rivisitare, ${stats.prospects} prospect e ${stats.orphans} orfani. Suggerisco una giornata mista.`,
  };
}

export async function recommendDayType(stats: PortfolioStats): Promise<{ dayType: Exclude<DayType, 'ai'>; motivation: string }> {
  const res = await callFn('recommend', stats);
  const dt = res?.day_type as Exclude<DayType, 'ai'> | undefined;
  if (dt && ['clienti', 'sviluppo', 'mista'].includes(dt) && res?.motivation) {
    return { dayType: dt, motivation: res.motivation };
  }
  return fallbackRecommend(stats);
}
