// Scoring commerciale AI Tour: punteggio 0-100 + classe + motivo ("Perche' te lo consiglio").
import type { TourCandidate, PriorityClass } from './types';

// Cadenza passaggi configurabile: cliente con storico 4-5 settimane, pochi ordini 7-8 (default 5/8)
export interface CadenceSettings {
  cadence_weeks_active?: number;
  cadence_weeks_low?: number;
}

export function cadenceWeeksFor(c: TourCandidate, settings?: CadenceSettings): number {
  const active = settings?.cadence_weeks_active || 5;
  const low = settings?.cadence_weeks_low || 8;
  return c.orderCount >= 5 ? active : low;
}

export const RECENT_CONTACT_DAYS = 15;
export function isRecentlyServed(c: TourCandidate, days = RECENT_CONTACT_DAYS): boolean {
  if (c.appointmentAt || c.followUpDate || c.isFollowUp) return false;
  return (c.daysSinceVisit != null && c.daysSinceVisit < days) || (c.daysSinceOrder != null && c.daysSinceOrder < days);
}
export function splitRecentlyServed(candidates: TourCandidate[], days = RECENT_CONTACT_DAYS) {
  const kept: TourCandidate[] = [], excluded: TourCandidate[] = [];
  for (const c of candidates) (isRecentlyServed(c, days) ? excluded : kept).push(c);
  return { kept, excluded };
}

function classify(score: number): PriorityClass {
  if (score >= 80) return 'Urgente';
  if (score >= 60) return 'Alta';
  if (score >= 40) return 'Media';
  return 'Bassa';
}

function revenueTier(revenue6m: number, all: number[]): 0 | 1 | 2 {
  const positives = all.filter((v) => v > 0).sort((a, b) => a - b);
  if (positives.length === 0 || revenue6m <= 0) return 0;
  const p33 = positives[Math.floor(positives.length * 0.33)];
  const p66 = positives[Math.floor(positives.length * 0.66)];
  if (revenue6m >= p66) return 2;
  if (revenue6m >= p33) return 1;
  return 0;
}

function daysToFollowUp(c: TourCandidate): number | null {
  const ref = c.appointmentAt || c.followUpDate;
  if (!ref) return null;
  return Math.ceil((new Date(ref).getTime() - Date.now()) / 86400000);
}

export function scoreCandidates(candidates: TourCandidate[], settings?: CadenceSettings): TourCandidate[] {
  const revenues = candidates.filter((c) => c.entityType === 'client').map((c) => c.revenue6m);
  for (const c of candidates) {
    let score = 0;
    const why: string[] = [];

    if (c.entityType === 'client') {
      score = 30;
      const freq = c.avgReorderDays && c.avgReorderDays >= 5 ? c.avgReorderDays : null;
      if (c.daysSinceOrder != null && freq) {
        const ratio = c.daysSinceOrder / freq;
        if (ratio >= 1.3) { score += 30; why.push(`Ultimo ordine ${c.daysSinceOrder} gg fa, oltre la frequenza abituale di ${Math.round(freq)} gg`); }
        else if (ratio >= 1.0) { score += 22; why.push(`Ultimo ordine ${c.daysSinceOrder} gg fa, vicino alla frequenza abituale di ${Math.round(freq)} gg`); }
        else if (ratio >= 0.8) { score += 10; why.push(`Riordino previsto a breve (frequenza media ${Math.round(freq)} gg)`); }
        c.nextSuggestedVisit = new Date(new Date(c.lastOrderDate as string).getTime() + freq * 86400000).toISOString().slice(0, 10);
      } else if (c.daysSinceOrder != null) {
        if (c.daysSinceOrder >= 60) { score += 25; why.push(`Ultimo ordine ${c.daysSinceOrder} gg fa`); }
        else if (c.daysSinceOrder >= 35) { score += 15; why.push(`Ultimo ordine ${c.daysSinceOrder} gg fa`); }
      } else if (c.orderCount === 0) {
        score += 8;
      }
      const cadWeeks = cadenceWeeksFor(c, settings);
      if (c.daysSinceVisit == null) { score += 10; why.push('Mai visitato'); }
      else {
        const cadRatio = c.daysSinceVisit / (cadWeeks * 7);
        if (cadRatio >= 1.25) { score += 20; why.push(`Passaggio molto in ritardo: ultima visita ${c.daysSinceVisit} gg fa (cadenza ${cadWeeks} settimane)`); }
        else if (cadRatio >= 1) { score += 15; why.push(`Passaggio in scadenza: ultima visita ${c.daysSinceVisit} gg fa (cadenza ${cadWeeks} settimane)`); }
        else if (cadRatio >= 0.8) { score += 8; why.push(`Prossimo passaggio previsto a breve (cadenza ${cadWeeks} settimane)`); }
      }
      // Ordine telefonico/remoto dopo l'ultima visita: il contatto di persona resta dovuto
      if (c.lastRemoteOrderDate && (!c.lastVisitDate || c.lastRemoteOrderDate > c.lastVisitDate)) {
        const fmt = new Date(c.lastRemoteOrderDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
        score += 15;
        why.push(`Ordine telefonico del ${fmt} senza visita successiva: passaggio per mantenere il contatto`);
        if (c.avgOrderValue > 0 && c.lastRemoteOrderAmount != null && c.lastRemoteOrderAmount < c.avgOrderValue * 0.6) {
          score += 8;
          why.push(`Ordine telefonico piccolo (${Math.round(c.lastRemoteOrderAmount)} EUR vs media ${Math.round(c.avgOrderValue)} EUR): probabile riordino imminente`);
        }
      }
      const tier = revenueTier(c.revenue6m, revenues);
      if (tier === 2) { score += 15; why.push(`Fatturato 6 mesi ${Math.round(c.revenue6m)} EUR (fascia alta)`); }
      else if (tier === 1) { score += 8; }
      c.potentialValue = c.avgOrderValue || 0;
    } else if (c.entityType === 'prospect') {
      score = 25;
      const notes = (c.notes || '').toLowerCase();
      if (notes.includes('molto interessat')) { score += 30; why.push('Molto interessato nelle visite precedenti'); }
      else if (notes.includes('interessat') && !notes.includes('non interessat')) { score += 20; why.push('Ha manifestato interesse'); }
      if (c.daysSinceVisit == null) { score += 12; why.push('Prospect mai visitato'); }
      else if (c.daysSinceVisit > 60) { score += 10; why.push(`Ultimo contatto ${c.daysSinceVisit} gg fa`); }
      else if (c.daysSinceVisit > 30) { score += 6; }
      if (c.estimatedRevenue && c.estimatedRevenue > 0) { score += 10; why.push('Potenziale commerciale stimato alto'); }
      c.potentialValue = 120;
    } else if (c.entityType === 'orphan') {
      // Orfano: algoritmo di recupero dedicato
      score = c.orphanStatus === 'orphan_a' ? 55 : 45;
      if (c.orphanStatus === 'orphan_a') why.push('Cliente orfano: ordinava e ha smesso');
      else why.push('Orfano: visitato in passato senza ordini recenti');
      if (c.totalRevenue > 2000) { score += 22; why.push(`Fatturato storico ${Math.round(c.totalRevenue)} EUR: potenziale di recupero alto`); }
      else if (c.totalRevenue > 500) { score += 12; why.push(`Fatturato storico ${Math.round(c.totalRevenue)} EUR`); }
      if (c.daysSinceOrder != null && c.daysSinceOrder < 240) { score += 8; why.push(`Ultimo ordine ${c.daysSinceOrder} gg fa: recupero ancora caldo`); }
      c.potentialValue = c.avgOrderValue > 0 ? c.avgOrderValue : 100;
    } else if (c.entityType === 'never') {
      // Tabaccheria del territorio dell'agente mai visitata: priorita' alta nello sviluppo
      score = 58;
      why.push('Tabaccheria del tuo territorio mai visitata: da includere nello sviluppo');
      c.potentialValue = 110;
    } else {
      // Tabaccheria libera (non assegnata): riempie la giornata di sviluppo se limitrofa al giro
      score = 30;
      why.push('Tabaccheria non assegnata ad alcun agente: opportunita\' di sviluppo del territorio');
      c.potentialValue = 100;
    }

    // Progetti Speciali: cliente seguito anche fuori territorio, leggera priorita' in piu'
    if (c.projectName) {
      score += 8;
      why.unshift(`Cliente progetto ${c.projectName}`);
    }

    // Appuntamenti / follow-up imminenti valgono per tutti
    const dtf = daysToFollowUp(c);
    if (dtf != null && dtf <= 7) {
      score += dtf <= 1 ? 25 : 15;
      why.push(c.appointmentAt ? 'Appuntamento in agenda' : 'Follow-up previsto a breve');
    }

    c.score = Math.min(100, Math.round(score));
    c.priorityClass = classify(c.score);
    c.reason = why.slice(0, 3).join('. ') || 'Presente nella zona del giro';
  }
  return candidates;
}

export interface PortfolioStats {
  clientsUrgent: number;
  clientsOverdue30: number;
  prospects: number;
  prospectsInterested: number;
  orphans: number;
  orphansHighValue: number;
  topAreas: { area: string; clientsOverdue: number; prospects: number; orphans: number }[];
}

export function computePortfolioStats(pool: { clients: TourCandidate[]; prospects: TourCandidate[]; orphans: TourCandidate[] }): PortfolioStats {
  const byArea = new Map<string, { clientsOverdue: number; prospects: number; orphans: number }>();
  const bump = (city: string, k: 'clientsOverdue' | 'prospects' | 'orphans') => {
    const key = city || 'Sconosciuta';
    const e = byArea.get(key) || { clientsOverdue: 0, prospects: 0, orphans: 0 };
    e[k]++;
    byArea.set(key, e);
  };
  for (const c of pool.clients) if ((c.daysSinceVisit ?? 999) > 30 || c.priorityClass === 'Urgente' || c.priorityClass === 'Alta') bump(c.city, 'clientsOverdue');
  for (const p of pool.prospects) bump(p.city, 'prospects');
  for (const o of pool.orphans) bump(o.city, 'orphans');
  return {
    clientsUrgent: pool.clients.filter((c) => c.priorityClass === 'Urgente').length,
    clientsOverdue30: pool.clients.filter((c) => (c.daysSinceVisit ?? 999) > 30).length,
    prospects: pool.prospects.length,
    prospectsInterested: pool.prospects.filter((p) => (p.notes || '').toLowerCase().includes('interessat')).length,
    orphans: pool.orphans.length,
    orphansHighValue: pool.orphans.filter((o) => o.totalRevenue > 2000).length,
    topAreas: [...byArea.entries()]
      .map(([area, v]) => ({ area, ...v }))
      .sort((a, b) => (b.clientsOverdue + b.prospects + b.orphans) - (a.clientsOverdue + a.prospects + a.orphans))
      .slice(0, 6),
  };
}
