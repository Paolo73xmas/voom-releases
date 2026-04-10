// LaserVideo Module - Supabase API Functions
import { supabase } from '../supabase';
import type {
  LaserVideoLead,
  LaserVideoVisit,
  LaserVideoSellUp,
  LaserVideoFollowUp,
  LaserVideoLeadFilters,
  LaserVideoLeadStatus,
  LaserVideoVisitOutcome,
  LeadColorInfo,
  LeadColorStatus,
} from '../../types/laservideo';

// ============================================
// ACCESS CHECK
// ============================================

export async function checkUserAccess(userId: string): Promise<boolean> {
  // Check if user is admin
  const { data: user } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (user && (user.role === 'admin' || user.role === 'admincustom')) {
    return true;
  }

  // Check agent access table
  const { data } = await supabase
    .from('laservideo_agent_access')
    .select('can_view')
    .eq('agent_id', userId)
    .single();

  return data?.can_view ?? false;
}

// ============================================
// LEADS
// ============================================

export async function getLeads(filters?: LaserVideoLeadFilters): Promise<LaserVideoLead[]> {
  let query = supabase
    .from('laservideo_leads')
    .select(`
      *,
      agente:profiles!laservideo_leads_agente_id_fkey(id, full_name, email)
    `)
    .order('created_at', { ascending: false });

  if (filters) {
    if (filters.provincia) query = query.eq('provincia', filters.provincia);
    if (filters.stato) query = query.eq('stato', filters.stato);
    if (filters.tipo_kit) query = query.eq('tipo_kit', filters.tipo_kit);
    if (filters.agente_id) query = query.eq('agente_id', filters.agente_id);
    if (filters.search) {
      query = query.or(
        `ragione_sociale.ilike.%${filters.search}%,matricola.ilike.%${filters.search}%,comune.ilike.%${filters.search}%`
      );
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  const leads = data || [];

  // Fetch tabaccheria data separately
  const tabaccheriaIds = leads
    .map((l: any) => l.tabaccheria_id)
    .filter((id: string | null): id is string => id !== null && id !== undefined);

  if (tabaccheriaIds.length > 0) {
    const uniqueIds = [...new Set(tabaccheriaIds)];
    const { data: tabData } = await supabase
      .from('tabaccherie')
      .select('id, denominazione, comune')
      .in('id', uniqueIds);

    const tabMap = new Map((tabData || []).map((t: any) => [t.id, t]));

    return leads.map((lead: any) => {
      if (!lead.tabaccheria_id) return lead;
      const tab = tabMap.get(lead.tabaccheria_id);
      if (tab) {
        return {
          ...lead,
          tabaccheria: {
            id: (tab as any).id,
            denominazione: (tab as any).denominazione || 'N/D',
            comune: (tab as any).comune,
          },
        };
      }
      return lead;
    });
  }

  return leads;
}

export async function getLeadById(id: string): Promise<LaserVideoLead | null> {
  const { data, error } = await supabase
    .from('laservideo_leads')
    .select(`
      *,
      agente:profiles!laservideo_leads_agente_id_fkey(id, full_name, email)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  // Fetch tabaccheria info
  if (data.tabaccheria_id) {
    const { data: tab } = await supabase
      .from('tabaccherie')
      .select('id, denominazione, comune')
      .eq('id', data.tabaccheria_id)
      .single();

    if (tab) {
      return {
        ...data,
        tabaccheria: {
          id: tab.id,
          denominazione: tab.denominazione || 'N/D',
          comune: tab.comune,
        },
      };
    }
  }

  return data;
}

export async function updateLead(
  id: string,
  updates: Partial<Pick<LaserVideoLead, 'ragione_sociale' | 'telefono' | 'email' | 'tipo_kit' | 'data_installazione' | 'data_appuntamento' | 'note'>>
): Promise<void> {
  const { error } = await supabase
    .from('laservideo_leads')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function updateLeadStatus(id: string, stato: LaserVideoLeadStatus): Promise<void> {
  const { error } = await supabase
    .from('laservideo_leads')
    .update({ stato })
    .eq('id', id);
  if (error) throw error;
}

// ============================================
// PROVINCES
// ============================================

export async function getProvinces(): Promise<string[]> {
  const { data, error } = await supabase
    .from('laservideo_leads')
    .select('provincia')
    .not('provincia', 'is', null);
  if (error) throw error;
  const provinces = [...new Set((data || []).map((d: any) => d.provincia).filter(Boolean))];
  return (provinces as string[]).sort();
}

// ============================================
// VISITS
// ============================================

export async function getVisits(leadId: string): Promise<LaserVideoVisit[]> {
  const { data, error } = await supabase
    .from('laservideo_visits')
    .select(`
      *,
      agente:profiles!laservideo_visits_agente_id_fkey(id, full_name)
    `)
    .eq('lead_id', leadId)
    .order('data_visita', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createVisit(dto: {
  lead_id: string;
  data_visita: string;
  esito: LaserVideoVisitOutcome;
  note?: string;
}, agenteId: string): Promise<LaserVideoVisit> {
  const { data, error } = await supabase
    .from('laservideo_visits')
    .insert({ ...dto, agente_id: agenteId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================
// SELL-UPS
// ============================================

export async function getSellUps(leadId: string): Promise<LaserVideoSellUp[]> {
  const { data, error } = await supabase
    .from('laservideo_sellups')
    .select('*')
    .eq('lead_id', leadId)
    .order('data_vendita', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createSellUp(dto: {
  lead_id: string;
  data_vendita: string;
  importo?: number;
  descrizione?: string;
  note?: string;
}): Promise<LaserVideoSellUp> {
  const { data, error } = await supabase
    .from('laservideo_sellups')
    .insert(dto)
    .select()
    .single();
  if (error) throw error;

  // Update lead status to convertito
  await supabase
    .from('laservideo_leads')
    .update({ stato: 'convertito' })
    .eq('id', dto.lead_id)
    .in('stato', ['nuovo', 'kit_consegnato', 'contattato', 'visitato']);

  return data;
}

// ============================================
// FOLLOW-UPS
// ============================================

export async function getFollowUps(leadId: string): Promise<LaserVideoFollowUp[]> {
  const { data, error } = await supabase
    .from('laservideo_followups')
    .select('*')
    .eq('lead_id', leadId)
    .order('data_scadenza', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function completeFollowUp(id: string): Promise<void> {
  const { error } = await supabase
    .from('laservideo_followups')
    .update({ completato: true, data_completamento: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// ============================================
// COLOR CALCULATION
// ============================================

interface CRMOrder {
  id: string;
  order_date: string;
  total_amount: number;
  status: string;
}

export function calculateLeadColor(orders: CRMOrder[]): LeadColorInfo {
  if (!orders || orders.length === 0) {
    return {
      color: 'none',
      label: 'Nessun ordine',
      description: 'Nessun ordine CRM trovato',
      ordersCount: 0,
      totalValue: 0,
      daysSinceLastOrder: null,
    };
  }

  const totalValue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const ordersCount = orders.length;

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
  );
  const latestOrder = sortedOrders[0];
  const latestOrderDate = new Date(latestOrder.order_date);
  const today = new Date();
  const daysSinceLastOrder = Math.floor(
    (today.getTime() - latestOrderDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  let color: LeadColorStatus;
  let label: string;
  let description: string;

  if (ordersCount === 1 && totalValue === 0) {
    if (daysSinceLastOrder < 30) {
      color = 'yellow';
      label = 'Nuovo (0\u20ac)';
      description = `1 ordine a \u20ac0, ${daysSinceLastOrder} giorni fa`;
    } else if (daysSinceLastOrder < 60) {
      color = 'orange';
      label = 'In attesa (0\u20ac)';
      description = `1 ordine a \u20ac0, ${daysSinceLastOrder} giorni fa`;
    } else {
      color = 'purple';
      label = 'Inattivo (0\u20ac)';
      description = `1 ordine a \u20ac0, ${daysSinceLastOrder} giorni fa`;
    }
  } else if (ordersCount >= 1 && totalValue > 0) {
    if (daysSinceLastOrder < 30) {
      color = 'green';
      label = 'Attivo';
      description = `${ordersCount} ordini, \u20ac${totalValue.toFixed(2)}, ultimo ${daysSinceLastOrder}gg fa`;
    } else if (daysSinceLastOrder < 60) {
      color = 'red';
      label = 'Da ricontattare';
      description = `${ordersCount} ordini, \u20ac${totalValue.toFixed(2)}, ultimo ${daysSinceLastOrder}gg fa`;
    } else if (daysSinceLastOrder < 90) {
      color = 'purple';
      label = 'A rischio';
      description = `${ordersCount} ordini, \u20ac${totalValue.toFixed(2)}, ultimo ${daysSinceLastOrder}gg fa`;
    } else {
      color = 'gray';
      label = 'Dormiente';
      description = `${ordersCount} ordini, \u20ac${totalValue.toFixed(2)}, ultimo ${daysSinceLastOrder}gg fa`;
    }
  } else {
    color = 'none';
    label = 'N/D';
    description = 'Stato non determinabile';
  }

  return { color, label, description, ordersCount, totalValue, daysSinceLastOrder };
}

export async function getLeadsColorInfoBatch(
  tabaccheriaIds: string[]
): Promise<Map<string, LeadColorInfo>> {
  const colorMap = new Map<string, LeadColorInfo>();
  if (tabaccheriaIds.length === 0) return colorMap;

  try {
    const uniqueIds = [...new Set(tabaccheriaIds)];

    // Resolve tabaccheria_id -> customer_id
    const { data: tabWithCust } = await supabase
      .from('tabaccherie')
      .select('id, customer_id')
      .in('id', uniqueIds);

    const tabToCustomerMap = new Map<string, string>();
    (tabWithCust || []).forEach((t: any) => {
      if (t.customer_id) tabToCustomerMap.set(t.id, t.customer_id);
    });

    // Also search customers by tabaccheria_id
    const { data: customersByTab } = await supabase
      .from('customers')
      .select('id, tabaccheria_id')
      .in('tabaccheria_id', uniqueIds);

    (customersByTab || []).forEach((c: any) => {
      if (c.tabaccheria_id && !tabToCustomerMap.has(c.tabaccheria_id)) {
        tabToCustomerMap.set(c.tabaccheria_id, c.id);
      }
    });

    const customerIds = [...new Set(tabToCustomerMap.values())];
    if (customerIds.length === 0) {
      tabaccheriaIds.forEach((id) => {
        colorMap.set(id, {
          color: 'none',
          label: 'Non associato',
          description: 'Nessun cliente CRM trovato',
          ordersCount: 0,
          totalValue: 0,
          daysSinceLastOrder: null,
        });
      });
      return colorMap;
    }

    // Reverse map: customer_id -> tabaccheria_id
    const customerToTab = new Map<string, string>();
    tabToCustomerMap.forEach((custId, tabId) => {
      customerToTab.set(custId, tabId);
    });

    // Get orders
    const { data: orders } = await supabase
      .from('orders')
      .select('id, customer_id, order_date, total_amount, status')
      .in('customer_id', customerIds)
      .neq('status', 'draft');

    // Group orders by tabaccheria
    const ordersByTab = new Map<string, CRMOrder[]>();
    (orders || []).forEach((order: any) => {
      const tabId = customerToTab.get(order.customer_id);
      if (tabId) {
        if (!ordersByTab.has(tabId)) ordersByTab.set(tabId, []);
        ordersByTab.get(tabId)!.push({
          id: order.id,
          order_date: order.order_date,
          total_amount: order.total_amount,
          status: order.status,
        });
      }
    });

    tabaccheriaIds.forEach((tabId) => {
      const tabOrders = ordersByTab.get(tabId) || [];
      colorMap.set(tabId, calculateLeadColor(tabOrders));
    });
  } catch (err) {
    console.error('[getLeadsColorInfoBatch] Error:', err);
    tabaccheriaIds.forEach((id) => {
      colorMap.set(id, {
        color: 'none',
        label: 'Errore',
        description: 'Errore nel recupero dati',
        ordersCount: 0,
        totalValue: 0,
        daysSinceLastOrder: null,
      });
    });
  }

  return colorMap;
}
