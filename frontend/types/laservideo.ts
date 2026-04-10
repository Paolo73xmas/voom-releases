// LaserVideo Module Types

export type LaserVideoLeadStatus =
  | 'nuovo'
  | 'kit_consegnato'
  | 'contattato'
  | 'visitato'
  | 'convertito'
  | 'attivo'
  | 'dormiente'
  | 'perso';

export type LaserVideoVisitOutcome =
  | 'positivo'
  | 'neutro'
  | 'negativo'
  | 'non_trovato'
  | 'rimandato';

export type KitType = '500' | '1000';

export type LeadColorStatus = 'yellow' | 'orange' | 'green' | 'red' | 'purple' | 'gray' | 'none';

export interface LeadColorInfo {
  color: LeadColorStatus;
  label: string;
  description: string;
  ordersCount: number;
  totalValue: number;
  daysSinceLastOrder: number | null;
}

export interface LaserVideoLead {
  id: string;
  matricola: string;
  ragione_sociale: string;
  codice_fiscale: string | null;
  partita_iva: string | null;
  codice_sdi: string | null;
  email: string | null;
  telefono: string | null;
  indirizzo: string | null;
  comune: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  stato: LaserVideoLeadStatus;
  tipo_kit: KitType | null;
  costo_kit: number | null;
  data_consegna_kit: string | null;
  data_acquisto: string | null;
  data_installazione: string | null;
  data_appuntamento?: string | null;
  agente_id: string | null;
  agente?: { id: string; full_name: string; email?: string } | null;
  tabaccheria_id: string | null;
  tabaccheria?: { id: string; denominazione: string; comune: string | null } | null;
  note: string | null;
  data_ultimo_contatto: string | null;
  data_conversione: string | null;
  created_at: string;
  updated_at: string;
}

export interface LaserVideoVisit {
  id: string;
  lead_id: string;
  agente_id: string | null;
  agente?: { id: string; full_name: string } | null;
  data_visita: string;
  esito: LaserVideoVisitOutcome | null;
  note: string | null;
  prossimo_contatto: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface LaserVideoSellUp {
  id: string;
  lead_id: string;
  visit_id: string | null;
  data_vendita: string;
  importo: number | null;
  descrizione: string | null;
  order_id: string | null;
  numero_fattura: string | null;
  note: string | null;
  created_at: string;
}

export interface LaserVideoFollowUp {
  id: string;
  lead_id: string;
  data_scadenza: string;
  tipo: string;
  descrizione: string | null;
  completato: boolean;
  data_completamento: string | null;
  note: string | null;
  created_at: string;
  creator?: { id: string; full_name: string } | null;
}

export interface LaserVideoLeadFilters {
  provincia?: string;
  stato?: LaserVideoLeadStatus;
  tipo_kit?: KitType;
  agente_id?: string;
  search?: string;
}

export const LEAD_STATUS_CONFIG: Record<LaserVideoLeadStatus, { label: string; color: string; bg: string }> = {
  nuovo: { label: 'Nuovo', color: '#3B82F6', bg: '#DBEAFE' },
  kit_consegnato: { label: 'Kit Consegnato', color: '#8B5CF6', bg: '#EDE9FE' },
  contattato: { label: 'Contattato', color: '#F59E0B', bg: '#FEF3C7' },
  visitato: { label: 'Visitato', color: '#10B981', bg: '#D1FAE5' },
  convertito: { label: 'Convertito', color: '#059669', bg: '#A7F3D0' },
  attivo: { label: 'Attivo', color: '#047857', bg: '#6EE7B7' },
  dormiente: { label: 'Dormiente', color: '#6B7280', bg: '#E5E7EB' },
  perso: { label: 'Perso', color: '#EF4444', bg: '#FEE2E2' },
};

export const KIT_CONFIG: Record<KitType, { label: string; cost: number; color: string; bg: string }> = {
  '500': { label: 'KIT 500', cost: 100, color: '#2563EB', bg: '#DBEAFE' },
  '1000': { label: 'KIT 1000', cost: 200, color: '#7C3AED', bg: '#EDE9FE' },
};

export const VISIT_OUTCOME_CONFIG: Record<LaserVideoVisitOutcome, { label: string; color: string; bg: string }> = {
  positivo: { label: 'Positivo', color: '#059669', bg: '#D1FAE5' },
  neutro: { label: 'Neutro', color: '#F59E0B', bg: '#FEF3C7' },
  negativo: { label: 'Negativo', color: '#EF4444', bg: '#FEE2E2' },
  non_trovato: { label: 'Non trovato', color: '#6B7280', bg: '#E5E7EB' },
  rimandato: { label: 'Rimandato', color: '#8B5CF6', bg: '#EDE9FE' },
};

export const LEAD_COLOR_CONFIG: Record<LeadColorStatus, { bg: string; color: string; label: string }> = {
  yellow: { bg: '#FDE047', color: '#713F12', label: 'Giallo' },
  orange: { bg: '#FB923C', color: '#FFFFFF', label: 'Arancione' },
  green: { bg: '#22C55E', color: '#FFFFFF', label: 'Verde' },
  red: { bg: '#EF4444', color: '#FFFFFF', label: 'Rosso' },
  purple: { bg: '#A855F7', color: '#FFFFFF', label: 'Viola' },
  gray: { bg: '#6B7280', color: '#FFFFFF', label: 'Grigio' },
  none: { bg: '#E5E7EB', color: '#6B7280', label: 'N/D' },
};
