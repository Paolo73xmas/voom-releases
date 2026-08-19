import { supabase } from '../supabase';
import { Customer } from '../../types';
import { getCache, setCache } from '../memory-cache';

export async function fetchCustomers(userId: string, userRole: string, branchId?: string | null, opts?: { force?: boolean }): Promise<Customer[]> {
  const cacheKey = `customers:${userRole}:${userId}:${branchId || ''}`;
  if (!opts?.force) {
    const cached = getCache<Customer[]>(cacheKey);
    if (cached) return cached;
  }
  try {
    const allCustomers: Customer[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('customers')
        .select('*')
        .order('business_name', { ascending: true })
        .range(from, to);

      // Role-based filtering
      if (userRole === 'branch_admin' && branchId) {
        // Branch admin: see customers of all agents in the branch
        const { data: branchAgents } = await supabase
          .from('profiles')
          .select('id')
          .eq('branch_id', branchId);
        if (branchAgents && branchAgents.length > 0) {
          const agentIds = branchAgents.map(a => a.id);
          query = query.in('agent_id', agentIds);
        }
      } else if (userRole !== 'admin' && userRole !== 'supervisor' && userRole !== 'admincustom') {
        // Agents: own customers + unassigned ones (aligned with production RLS policy)
        query = query.or(`agent_id.eq.${userId},agent_id.is.null`);
      }

      const { data: customers, error } = await query;

      if (error) throw error;

      if (!customers || customers.length === 0) {
        hasMore = false;
        break;
      }

      allCustomers.push(...customers);

      if (customers.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }

    setCache(cacheKey, allCustomers, 60_000);
    return allCustomers;
  } catch (error) {
    console.error('[fetchCustomers] Error:', error);
    throw error;
  }
}

export async function fetchCustomerById(id: string): Promise<Customer | null> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[fetchCustomerById] Error:', error);
    throw error;
  }
}

export async function searchCustomers(
  userId: string,
  userRole: string,
  searchTerm: string,
  branchId?: string | null
): Promise<Customer[]> {
  try {
    let query = supabase
      .from('customers')
      .select('*')
      .order('business_name', { ascending: true })
      .limit(50);

    if (userRole === 'branch_admin' && branchId) {
      const { data: branchAgents } = await supabase
        .from('profiles')
        .select('id')
        .eq('branch_id', branchId);
      if (branchAgents && branchAgents.length > 0) {
        query = query.in('agent_id', branchAgents.map(a => a.id));
      }
    } else if (userRole !== 'admin' && userRole !== 'supervisor' && userRole !== 'admincustom') {
      // Agents: own customers + unassigned ones (aligned with production RLS policy)
      query = query.or(`agent_id.eq.${userId},agent_id.is.null`);
    }

    if (searchTerm && searchTerm.trim().length > 0) {
      const term = searchTerm.trim();
      // Match anche sulla denominazione ufficiale del registro tabaccherie collegato
      // (es. cercando "Fossati" si trova la scheda CRM "Tabacchi Rozzano iper")
      let tabIdsClause = '';
      try {
        const { data: tabMatches } = await supabase
          .from('tabaccherie')
          .select('id')
          .ilike('denominazione', `%${term}%`)
          .not('customer_id', 'is', null)
          .limit(150);
        const tabIds = (tabMatches || []).map((t) => t.id).join(',');
        if (tabIds) tabIdsClause = `,tabaccheria_id.in.(${tabIds})`;
      } catch { /* la ricerca base resta valida */ }
      query = query.or(
        `business_name.ilike.%${term}%,` +
        `city.ilike.%${term}%,` +
        `contact_name.ilike.%${term}%,` +
        `contact_phone.ilike.%${term}%` +
        tabIdsClause
      );
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[searchCustomers] Error:', error);
    throw error;
  }
}
