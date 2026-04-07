import { supabase } from '../supabase';
import { Inspection } from '../../types';

export async function fetchInspections(userId: string, userRole: string): Promise<Inspection[]> {
  try {
    let query = supabase
      .from('inspections')
      .select(`
        *,
        customer:customers (
          id,
          business_name,
          city,
          province,
          address
        )
      `)
      .order('inspection_date', { ascending: false })
      .limit(100);

    if (userRole !== 'admin' && userRole !== 'supervisor' && userRole !== 'admincustom') {
      query = query.eq('agent_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[fetchInspections] Error:', error);
    throw error;
  }
}

export async function createInspection(inspectionData: {
  customer_id: string;
  agent_id: string;
  latitude: number;
  longitude: number;
  gps_accuracy?: number;
  notes?: string;
  follow_up_date?: string;
}): Promise<Inspection> {
  try {
    const { data, error } = await supabase
      .from('inspections')
      .insert({
        ...inspectionData,
        inspection_date: new Date().toISOString(),
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[createInspection] Error:', error);
    throw error;
  }
}

export function getInspectionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'In Attesa',
    completed: 'Completata',
    cancelled: 'Annullata',
  };
  return labels[status] || status;
}

export function getInspectionStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: '#F59E0B',
    completed: '#10B981',
    cancelled: '#EF4444',
  };
  return colors[status] || '#9CA3AF';
}
