/**
 * Orphan Claims API — Mobile (aligned with Web App)
 * Mirrors web app's:
 *   - src/lib/supabase/orphan-claims.ts
 *   - src/lib/supabase/claim-customer.ts
 *   - src/lib/supabase/orphan-map.ts
 *   - src/lib/supabase/orphanConfig.ts
 *   - src/lib/utils/orphan-utils.ts
 */
import { supabase } from '../supabase';

// =============================================================================
// Types
// =============================================================================

export type OrphanMapStatus = 'orphan_a' | 'orphan_b';

export interface OrphanConfig {
  id: string;
  orphan_b_days: number;
  orphan_a_days: number;
  created_at: string;
  updated_at: string;
}

export interface OrphanClaim {
  id: string;
  customer_id: string;
  tabaccheria_id: string;
  requesting_agent_id: string;
  current_agent_id: string | null;
  previous_agent_id?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

export interface OrphanClaimWithDetails extends OrphanClaim {
  customer_business_name?: string;
  customer_agent_id?: string | null;
  customer_agent_name?: string;
  customer_last_order_date?: string | null;
  tabaccheria_denominazione?: string;
  tabaccheria_indirizzo?: string;
  tabaccheria_comune?: string;
  requesting_agent_name?: string;
  current_agent_name?: string;
  previous_agent_name?: string;
}

// =============================================================================
// Defaults — MATCH WEB APP (orphan_a_days=110, orphan_b_days=30)
// =============================================================================

const DEFAULT_CONFIG: Omit<OrphanConfig, 'id' | 'created_at' | 'updated_at'> = {
  orphan_b_days: 30,
  orphan_a_days: 110,
};

// =============================================================================
// Config
// =============================================================================

export async function getOrphanConfig(): Promise<OrphanConfig> {
  try {
    const { data, error } = await supabase
      .from('orphan_config')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('[getOrphanConfig] Error fetching config:', error);
      return { id: '', ...DEFAULT_CONFIG, created_at: '', updated_at: '' };
    }

    return {
      id: data.id,
      orphan_b_days: Number(data.orphan_b_days) || DEFAULT_CONFIG.orphan_b_days,
      orphan_a_days: Number(data.orphan_a_days) || DEFAULT_CONFIG.orphan_a_days,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  } catch (e) {
    console.error('[getOrphanConfig] Exception:', e);
    return { id: '', ...DEFAULT_CONFIG, created_at: '', updated_at: '' };
  }
}

// =============================================================================
// Orphan Map — uses RPC `get_orphan_tabaccherie_ids` (web parity)
// =============================================================================

/**
 * Fetch all orphan tabaccheria IDs from the database using the
 * SECURITY DEFINER RPC function. Bypasses RLS so agents can see
 * orphan markers for ALL customers, not just their own.
 *
 * @param config - Orphan configuration with threshold days (passed as RPC params)
 * @returns Map of tabaccheria_id -> orphan status
 */
export async function fetchOrphanMap(
  config?: { orphan_a_days: number; orphan_b_days: number }
): Promise<Map<string, OrphanMapStatus>> {
  const map = new Map<string, OrphanMapStatus>();
  const cfg = config || (await getOrphanConfig());

  try {
    console.log('[orphan-map] Fetching via RPC get_orphan_tabaccherie_ids...', {
      orphan_a_days: cfg.orphan_a_days,
      orphan_b_days: cfg.orphan_b_days,
    });
    // PostgREST tronca a 1000 righe: pagina con .range() finché arrivano pagine piene (parità web)
    const PAGE = 1000;
    let from = 0;
    let rpcError = false;
    for (;;) {
      const { data, error } = await supabase
        .rpc('get_orphan_tabaccherie_ids', {
          p_orphan_a_days: cfg.orphan_a_days,
          p_orphan_b_days: cfg.orphan_b_days,
        })
        .range(from, from + PAGE - 1);
      if (error) {
        console.warn('[orphan-map] RPC error, will use client-side fallback:', error.message);
        rpcError = true;
        break;
      }
      const rows = Array.isArray(data) ? data : [];
      for (const row of rows) {
        if (row.tabaccheria_id && row.orphan_status) {
          map.set(row.tabaccheria_id, row.orphan_status as OrphanMapStatus);
        }
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    if (!rpcError) {
      let a = 0, b = 0;
      map.forEach(v => v === 'orphan_a' ? a++ : b++);
      console.log(`[orphan-map] RPC returned ${map.size} orphans (A: ${a}, B: ${b})`);
      return map;
    }
  } catch (e) {
    console.warn('[orphan-map] RPC threw, using fallback:', e);
  }

  // Client-side fallback (web parity, less reliable due to RLS)
  // Orphan check requires stato_visita IN ('visitato','ordinato')
  try {
    console.log(`[orphan-map] Fallback config: A=${cfg.orphan_a_days}d, B=${cfg.orphan_b_days}d`);
    const now = new Date();

    const { data: tabs, error: tabsErr } = await supabase
      .from('tabaccherie')
      .select(`
        id, customer_id, stato_visita, agente_id,
        customers!tabaccherie_customer_id_fkey (
          id, last_order_date, last_visit_date, first_visit_date
        )
      `)
      .in('stato_visita', ['visitato', 'ordinato'])
      .not('customer_id', 'is', null);

    if (tabsErr) {
      console.error('[orphan-map] Fallback error:', tabsErr.message);
      return map;
    }
    if (!tabs) return map;

    for (const tab of tabs as any[]) {
      const c = tab.customers || null;
      if (!c) continue;
      const lastOrder = c.last_order_date as string | null;
      const lastVisit = (c.last_visit_date || c.first_visit_date) as string | null;

      if (lastOrder) {
        // Orfano A v2 (parità web): NESSUNA attività (ordine O visita) recente
        const lastActivityMs = Math.max(
          new Date(lastOrder).getTime(),
          c.last_visit_date ? new Date(c.last_visit_date as string).getTime() : 0
        );
        const days = Math.floor((now.getTime() - lastActivityMs) / 86400000);
        if (days >= cfg.orphan_a_days) map.set(tab.id, 'orphan_a');
      } else if (lastVisit) {
        const days = Math.floor((now.getTime() - new Date(lastVisit).getTime()) / 86400000);
        if (days >= cfg.orphan_b_days) map.set(tab.id, 'orphan_b');
      }
    }

    let a = 0, b = 0;
    map.forEach(v => v === 'orphan_a' ? a++ : b++);
    console.log(`[orphan-map] Fallback returned ${map.size} orphans (A: ${a}, B: ${b})`);
  } catch (e) {
    console.error('[orphan-map] Fallback exception:', e);
  }

  return map;
}

// =============================================================================
// Claim creation
// =============================================================================

export async function claimOrphanCustomer(
  customerId: string,
  tabaccheriaId: string,
  requestingAgentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('agent_id')
      .eq('id', customerId)
      .maybeSingle();

    if (customerError) {
      return { success: false, error: 'Errore nel recupero dati cliente' };
    }

    let currentAgentId: string | null = null;
    if (customer) {
      currentAgentId = customer.agent_id;
      if (currentAgentId === requestingAgentId) {
        return { success: false, error: 'Non puoi reclamare un cliente già assegnato a te' };
      }
    }

    const { data: existing, error: existingError } = await supabase
      .from('orphan_claims')
      .select('id, status')
      .eq('customer_id', customerId)
      .eq('requesting_agent_id', requestingAgentId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingError) {
      return { success: false, error: 'Errore nella verifica richieste esistenti' };
    }
    if (existing) {
      return { success: false, error: 'Hai già una richiesta pendente per questo cliente' };
    }

    const { error: insertError } = await supabase
      .from('orphan_claims')
      .insert({
        customer_id: customerId,
        tabaccheria_id: tabaccheriaId,
        requesting_agent_id: requestingAgentId,
        current_agent_id: currentAgentId,
        status: 'pending',
      });

    if (insertError) return { success: false, error: insertError.message };
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Errore imprevisto',
    };
  }
}

// =============================================================================
// Agent claims list (web parity)
// =============================================================================

export async function getAgentOrphanClaims(agentId: string): Promise<OrphanClaimWithDetails[]> {
  try {
    const { data: claimsData, error } = await supabase
      .from('orphan_claims')
      .select('*')
      .eq('requesting_agent_id', agentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!claimsData || claimsData.length === 0) return [];

    const customerIds = [...new Set(claimsData.map(c => c.customer_id))];
    const tabaccheriaIds = [...new Set(claimsData.map(c => c.tabaccheria_id))];
    const agentIds = [...new Set([
      ...claimsData.map(c => c.requesting_agent_id),
      ...claimsData.map(c => c.current_agent_id).filter(Boolean),
      ...claimsData.map(c => c.previous_agent_id).filter(Boolean),
    ])];

    const [customersResult, tabaccherieResult, agentsResult] = await Promise.all([
      supabase.from('customers').select('id, business_name, agent_id, last_order_date').in('id', customerIds),
      supabase.from('tabaccherie').select('id, denominazione, indirizzo, comune').in('id', tabaccheriaIds),
      supabase.from('profiles').select('id, full_name').in('id', agentIds as string[]),
    ]);

    const customersMap = new Map(customersResult.data?.map(c => [c.id, c]) || []);
    const tabMap = new Map(tabaccherieResult.data?.map(t => [t.id, t]) || []);
    const agentsMap = new Map(agentsResult.data?.map(a => [a.id, a]) || []);

    // Fetch any extra customer-agent profiles not in agentIds
    const customerAgentIds = [...new Set(
      customersResult.data?.map((c: any) => c.agent_id).filter(Boolean) || []
    )];
    if (customerAgentIds.length > 0) {
      const { data: customerAgents } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', customerAgentIds as string[]);
      customerAgents?.forEach((a: any) => agentsMap.set(a.id, a));
    }

    return claimsData.map((claim: any) => {
      const customer: any = customersMap.get(claim.customer_id);
      const tab: any = tabMap.get(claim.tabaccheria_id);
      const requestingAgent: any = agentsMap.get(claim.requesting_agent_id);
      const currentAgent: any = claim.current_agent_id ? agentsMap.get(claim.current_agent_id) : null;
      const previousAgent: any = claim.previous_agent_id ? agentsMap.get(claim.previous_agent_id) : null;
      const customerAgent: any = customer?.agent_id ? agentsMap.get(customer.agent_id) : null;

      return {
        ...claim,
        customer_business_name: customer?.business_name || 'N/A',
        customer_agent_id: customer?.agent_id || null,
        customer_agent_name: customerAgent?.full_name || 'Nessuno',
        customer_last_order_date: customer?.last_order_date || null,
        tabaccheria_denominazione: tab?.denominazione || 'N/A',
        tabaccheria_indirizzo: tab?.indirizzo || '',
        tabaccheria_comune: tab?.comune || '',
        requesting_agent_name: requestingAgent?.full_name || 'N/A',
        current_agent_name: currentAgent?.full_name || 'Nessuno',
        previous_agent_name: previousAgent?.full_name || 'Nessuno',
      };
    });
  } catch (e) {
    console.error('[getAgentOrphanClaims] Exception:', e);
    throw e;
  }
}
