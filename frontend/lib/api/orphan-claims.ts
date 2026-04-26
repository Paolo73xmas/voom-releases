/**
 * Orphan Claims API — Mobile
 * Mirrors web app's orphan-claims.ts + claim-customer.ts
 */
import { supabase } from '../supabase';

export interface OrphanClaimWithDetails {
  id: string;
  customer_id: string;
  tabaccheria_id: string;
  requesting_agent_id: string;
  current_agent_id: string | null;
  previous_agent_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  customer_business_name?: string;
  tabaccheria_denominazione?: string;
  tabaccheria_indirizzo?: string;
  tabaccheria_comune?: string;
  requesting_agent_name?: string;
  current_agent_name?: string;
}

export async function getAgentOrphanClaims(agentId: string): Promise<OrphanClaimWithDetails[]> {
  try {
    const { data: claimsData, error } = await supabase
      .from('orphan_claims')
      .select('*')
      .eq('requesting_agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error || !claimsData || claimsData.length === 0) return [];

    const customerIds = [...new Set(claimsData.map(c => c.customer_id))];
    const tabaccheriaIds = [...new Set(claimsData.map(c => c.tabaccheria_id))];
    const agentIds = [...new Set([...claimsData.map(c => c.requesting_agent_id), ...claimsData.map(c => c.current_agent_id).filter(Boolean)])];

    const [customersResult, tabaccherieResult, agentsResult] = await Promise.all([
      supabase.from('customers').select('id, business_name, agent_id').in('id', customerIds),
      supabase.from('tabaccherie').select('id, denominazione, indirizzo, comune').in('id', tabaccheriaIds),
      supabase.from('profiles').select('id, full_name').in('id', agentIds as string[]),
    ]);

    const customersMap = new Map(customersResult.data?.map(c => [c.id, c]) || []);
    const tabMap = new Map(tabaccherieResult.data?.map(t => [t.id, t]) || []);
    const agentsMap = new Map(agentsResult.data?.map(a => [a.id, a]) || []);

    return claimsData.map(claim => {
      const customer = customersMap.get(claim.customer_id);
      const tab = tabMap.get(claim.tabaccheria_id);
      return {
        ...claim,
        customer_business_name: customer?.business_name || 'N/A',
        tabaccheria_denominazione: tab?.denominazione || 'N/A',
        tabaccheria_indirizzo: tab?.indirizzo || '',
        tabaccheria_comune: tab?.comune || '',
        requesting_agent_name: agentsMap.get(claim.requesting_agent_id)?.full_name || 'N/A',
        current_agent_name: claim.current_agent_id ? (agentsMap.get(claim.current_agent_id)?.full_name || 'N/A') : 'Nessuno',
      };
    });
  } catch (e) {
    console.error('[orphan-claims] Error:', e);
    return [];
  }
}

export async function claimOrphanCustomer(
  customerId: string,
  tabaccheriaId: string,
  requestingAgentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: customer } = await supabase.from('customers').select('agent_id').eq('id', customerId).maybeSingle();
    const currentAgentId = customer?.agent_id || null;

    if (currentAgentId === requestingAgentId) {
      return { success: false, error: 'Non puoi reclamare un cliente già assegnato a te' };
    }

    const { data: existing } = await supabase.from('orphan_claims').select('id').eq('customer_id', customerId).eq('requesting_agent_id', requestingAgentId).eq('status', 'pending').maybeSingle();
    if (existing) {
      return { success: false, error: 'Hai già una richiesta pendente per questo cliente' };
    }

    const { error } = await supabase.from('orphan_claims').insert({
      customer_id: customerId,
      tabaccheria_id: tabaccheriaId,
      requesting_agent_id: requestingAgentId,
      current_agent_id: currentAgentId,
      status: 'pending',
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore imprevisto' };
  }
}

export async function getOrphanConfig(): Promise<{ orphan_a_days: number; orphan_b_days: number }> {
  try {
    const { data } = await supabase.from('orphan_config').select('orphan_a_days, orphan_b_days').single();
    return { orphan_a_days: data?.orphan_a_days ?? 90, orphan_b_days: data?.orphan_b_days ?? 180 };
  } catch {
    return { orphan_a_days: 90, orphan_b_days: 180 };
  }
}

export async function fetchOrphanMap(): Promise<Map<string, 'orphan_a' | 'orphan_b'>> {
  const map = new Map<string, 'orphan_a' | 'orphan_b'>();
  try {
    const { data, error } = await supabase.rpc('get_orphan_tabaccherie');
    if (!error && data) {
      for (const row of data) {
        map.set(row.tabaccheria_id, row.orphan_type);
      }
    }
  } catch (e) {
    console.warn('[orphan-map] RPC not available, falling back');
  }
  return map;
}
