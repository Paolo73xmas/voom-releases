import { Tabaccheria } from '../../types';

export function getMarkerColor(tab: Tabaccheria, userId?: string, userRole?: string, orphanMap?: Map<string, string>): string {
  const isAdmin = userRole === 'admin' || userRole === 'admincustom' || userRole === 'supervisor' || userRole === 'branch_admin';

  // Orphan check (purple/gold) — takes precedence over any other status
  // If the customer is owned by the current agent, use *_own variants (green border)
  if (orphanMap && orphanMap.has(tab.id)) {
    const type = orphanMap.get(tab.id);
    const isOwn = !!userId && tab.agente_id === userId;
    if (type === 'orphan_a') return isOwn ? 'purple_own' : 'purple';
    return isOwn ? 'gold_own' : 'gold';
  }

  // Gray: belongs to another agent (only for non-admin users)
  if (!isAdmin && tab.agente_id && tab.agente_id !== userId) {
    return 'gray';
  }
  if (!tab.stato_visita || tab.stato_visita === 'non_visitato') {
    return 'red';
  }
  if (tab.stato_visita === 'visitato') {
    return 'orange';
  }
  if (tab.stato_visita === 'ordinato') {
    return 'green';
  }
  return 'red';
}

export function getDisplayName(tab: Tabaccheria): string {
  if (tab.customer_business_name) return tab.customer_business_name;
  if (tab.customer_id) return 'Cliente Nuovo';
  return tab.denominazione;
}

export function getStatusLabel(color: string): string {
  switch (color) {
    case 'gray': return 'Altro agente';
    case 'red': return 'Non visitato';
    case 'orange': return 'Visitato';
    case 'green': return 'Ordinato';
    case 'purple': return 'Orfano A (no ordini recenti)';
    case 'purple_own': return 'Orfano A — Tuo cliente';
    case 'gold': return 'Orfano B (mai ordinato)';
    case 'gold_own': return 'Orfano B — Tuo cliente';
    default: return '';
  }
}

export function getStatusEmoji(color: string): string {
  switch (color) {
    case 'gray': return '\u26AB';
    case 'red': return '\uD83D\uDD34';
    case 'orange': return '\uD83D\uDFE0';
    case 'green': return '\uD83D\uDFE2';
    case 'purple':
    case 'purple_own': return '\uD83D\uDFE3';
    case 'gold':
    case 'gold_own': return '\uD83D\uDFE1';
    default: return '';
  }
}
