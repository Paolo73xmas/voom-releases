import { supabase } from '../supabase';
import { Visit } from '../../types';

export async function fetchVisits(userId: string, userRole: string, branchId?: string | null): Promise<Visit[]> {
  try {
    let query = supabase
      .from('visits')
      .select(`
        *,
        customer:customers (
          id,
          business_name,
          city,
          province,
          address,
          contact_phone
        )
      `)
      .order('visit_date', { ascending: false })
      .limit(100);

    if (userRole === 'branch_admin' && branchId) {
      // Branch admin: see visits from all agents in the branch
      const { data: branchAgents } = await supabase
        .from('profiles')
        .select('id')
        .eq('branch_id', branchId);
      if (branchAgents && branchAgents.length > 0) {
        query = query.in('agent_id', branchAgents.map(a => a.id));
      }
    } else if (userRole !== 'admin' && userRole !== 'supervisor' && userRole !== 'admincustom') {
      query = query.eq('agent_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[fetchVisits] Error:', error);
    throw error;
  }
}

export async function createVisit(visitData: {
  customer_id: string;
  agent_id: string;
  tabaccheria_id?: string;
  visit_type: string;
  latitude: number;
  longitude: number;
  gps_accuracy?: number;
  outcome?: string;
  notes?: string;
}): Promise<Visit> {
  try {
    const { data, error } = await supabase
      .from('visits')
      .insert({
        ...visitData,
        visit_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[createVisit] Error:', error);
    throw error;
  }
}
