import { Tabaccheria } from '../../types';

/**
 * getMarkerColor — aligned with web app MPV2.tsx
 *
 * Web behavior:
 *  - Orphan check is GATED by stato_visita IN ('visitato', 'ordinato')
 *  - Orphan markers are visible to ALL agents (RPC bypasses RLS)
 *  - Gray for customers owned by other agents (non-admin only)
 *  - Mobile addition: own-orphan variants (purple_own / yellow_own) with green border
 */
export function getMarkerColor(tab: Tabaccheria, userId?: string, userRole?: string, orphanMap?: Map<string, string>): string {
  const isAdmin = userRole === 'admin' || userRole === 'admincustom' || userRole === 'supervisor' || userRole === 'branch_admin';

  // Orphan check ONLY for visitato/ordinato (web parity)
  if (tab.stato_visita === 'visitato' || tab.stato_visita === 'ordinato') {
    const orphanStatus = orphanMap?.get(tab.id);
    if (orphanStatus === 'orphan_a' || orphanStatus === 'orphan_b') {
      const isOwn = !!userId && tab.agente_id === userId;
      if (orphanStatus === 'orphan_a') return isOwn ? 'purple_own' : 'purple';
      return isOwn ? 'yellow_own' : 'yellow';
    }
  }

  // Gray: belongs to another agent (non-admin only)
  if (!isAdmin && tab.agente_id && tab.agente_id !== userId) {
    return 'gray';
  }

  if (!tab.stato_visita || tab.stato_visita === 'non_visitato') {
    return 'red';
  }
  if (tab.stato_visita === 'visitato') return 'orange';
  if (tab.stato_visita === 'ordinato') return 'green';
  return 'red';
}

export function getDisplayName(tab: Tabaccheria): string {
  if (tab.customer_business_name) return tab.customer_business_name;
  // Cliente registrato ma business_name non leggibile (RLS di altro agente,
  // caso tipico dei marker Orfani): mostra la denominazione reale della
  // tabaccheria invece di "Cliente Nuovo" (parità web fix 21d9df7c).
  return tab.denominazione || 'Cliente Nuovo';
}

export function getStatusLabel(color: string): string {
  switch (color) {
    case 'gray': return 'Altro agente';
    case 'red': return 'Non visitato';
    case 'orange': return 'Visitato';
    case 'green': return 'Ordinato';
    case 'purple': return 'Orfano A (no ordini recenti)';
    case 'purple_own': return 'Orfano A — Tuo cliente';
    case 'yellow': return 'Orfano B (mai ordinato)';
    case 'yellow_own': return 'Orfano B — Tuo cliente';
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
    case 'yellow':
    case 'yellow_own': return '\uD83D\uDFE1';
    default: return '';
  }
}
