/**
 * Rimborsi (Reimbursements) API client — Mobile
 * Aligned with web app /src/lib/supabase/rimborsi.ts
 */
import { supabase } from '../supabase';

// ==================== TYPES ====================

export interface RimborsoCategoria {
  id: string;
  nome: string;
  attiva: boolean;
  created_at: string;
}

export type RimborsoStato = 'in_attesa' | 'approvato' | 'rifiutato' | 'pagato';

export interface Rimborso {
  id: string;
  agent_id: string;
  agent_name: string | null;
  categoria_id: string | null;
  categoria_nome: string;
  importo: number;
  descrizione: string | null;
  stato: RimborsoStato;
  data_richiesta: string;
  data_risposta: string | null;
  note_admin: string | null;
  allegati: string[];
  gps_lat: number | null;
  gps_lng: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRimborsoInput {
  agent_id: string;
  agent_name: string;
  categoria_id: string;
  categoria_nome: string;
  importo: number;
  descrizione?: string;
  allegati?: string[];
  gps_lat?: number;
  gps_lng?: number;
}

// ==================== CATEGORIE ====================

export async function fetchRimborsiCategorie(includeInactive = false): Promise<RimborsoCategoria[]> {
  let query = supabase
    .from('rimborsi_categorie')
    .select('*')
    .order('nome', { ascending: true });

  if (!includeInactive) {
    query = query.eq('attiva', true);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[rimborsi] Error fetching categorie:', error);
    throw error;
  }
  return data || [];
}

// ==================== RIMBORSI ====================

export async function fetchRimborsiByAgent(
  agentId: string,
  filters?: { stato?: string; categoria_id?: string }
): Promise<Rimborso[]> {
  let query = supabase
    .from('rimborsi')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (filters?.stato) query = query.eq('stato', filters.stato);
  if (filters?.categoria_id) query = query.eq('categoria_id', filters.categoria_id);

  const { data, error } = await query;
  if (error) {
    console.error('[rimborsi] Error fetching rimborsi:', error);
    throw error;
  }
  return data || [];
}

export async function createRimborso(input: CreateRimborsoInput): Promise<Rimborso | null> {
  const { data, error } = await supabase
    .from('rimborsi')
    .insert({
      agent_id: input.agent_id,
      agent_name: input.agent_name,
      categoria_id: input.categoria_id,
      categoria_nome: input.categoria_nome,
      importo: input.importo,
      descrizione: input.descrizione || null,
      allegati: input.allegati || [],
      gps_lat: input.gps_lat ?? null,
      gps_lng: input.gps_lng ?? null,
      stato: 'in_attesa',
      data_richiesta: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[rimborsi] Error creating rimborso:', error);
    throw error;
  }
  return data;
}

export async function deleteRimborso(id: string): Promise<void> {
  const { error } = await supabase
    .from('rimborsi')
    .delete()
    .eq('id', id)
    .eq('stato', 'in_attesa');
  if (error) {
    console.error('[rimborsi] Error deleting rimborso:', error);
    throw error;
  }
}

// ==================== ACCESSO AGENTE ====================

export async function checkRimborsiAccess(agentId: string, role: string): Promise<boolean> {
  // Admins always have access
  if (role === 'admin' || role === 'admincustom' || role === 'supervisor') return true;

  // For agents check rimborsi_agenti_abilitati
  try {
    const { data, error } = await supabase
      .from('rimborsi_agenti_abilitati')
      .select('abilitato')
      .eq('agent_id', agentId)
      .maybeSingle();
    if (error) {
      console.warn('[rimborsi] checkAccess error:', error.message);
      return false;
    }
    return data?.abilitato === true;
  } catch (e) {
    console.warn('[rimborsi] checkAccess exception:', e);
    return false;
  }
}

// ==================== HELPERS ====================

export function getRimborsoStatoLabel(stato: RimborsoStato): string {
  switch (stato) {
    case 'in_attesa': return 'In Attesa';
    case 'approvato': return 'Approvato';
    case 'rifiutato': return 'Rifiutato';
    case 'pagato': return 'Pagato';
    default: return stato;
  }
}

export function getRimborsoStatoColor(stato: RimborsoStato): string {
  switch (stato) {
    case 'in_attesa': return '#F59E0B';
    case 'approvato': return '#3B82F6';
    case 'pagato': return '#10B981';
    case 'rifiutato': return '#DC2626';
    default: return '#6B7280';
  }
}
