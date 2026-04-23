/**
 * Substitutions API — Mobile (aligned with web app v2)
 * Supports separate retrieve/send product lists with nullable product_ids
 */
import { supabase } from '../supabase';

export interface SubstitutionItem {
  id: string;
  substitution_id: string;
  original_product_id: string | null;
  replacement_product_id: string | null;
  quantity: number;
  original_quantity: number | null;
  replacement_quantity: number | null;
  notes: string | null;
  original_product?: { id: string; name: string; sku: string | null; short_description?: string; unit_price?: number | null; stock_quantity?: number | null };
  replacement_product?: { id: string; name: string; sku: string | null; short_description?: string; unit_price?: number | null; stock_quantity?: number | null };
}

export interface SubstitutionWithDetails {
  id: string;
  substitution_number: string;
  customer_id: string;
  agent_id: string;
  substitution_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  reason: string | null;
  notes: string | null;
  admin_notes: string | null;
  is_approved: boolean;
  is_sent: boolean;
  is_returned: boolean;
  is_rejected: boolean;
  is_modified: boolean;
  sent_at: string | null;
  returned_at: string | null;
  created_at: string;
  customers?: { business_name: string; city?: string; province?: string };
  profiles?: { full_name: string };
  substitution_items?: SubstitutionItem[];
}

export async function fetchSubstitutions(agentId: string, statusFilter?: string): Promise<SubstitutionWithDetails[]> {
  let query = supabase
    .from('substitutions')
    .select(`
      *,
      customers (business_name, city, province),
      substitution_items (
        id, substitution_id, original_product_id, replacement_product_id,
        quantity, original_quantity, replacement_quantity, notes
      )
    `)
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const productIds = new Set<string>();
  for (const sub of data) {
    for (const item of (sub.substitution_items || [])) {
      if (item.original_product_id) productIds.add(item.original_product_id);
      if (item.replacement_product_id) productIds.add(item.replacement_product_id);
    }
  }

  let productMap = new Map<string, any>();
  if (productIds.size > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku, short_description, unit_price, stock_quantity')
      .in('id', Array.from(productIds));
    productMap = new Map((products || []).map(p => [p.id, p]));
  }

  for (const sub of data) {
    for (const item of (sub.substitution_items || [])) {
      (item as SubstitutionItem).original_product = item.original_product_id ? productMap.get(item.original_product_id) : undefined;
      (item as SubstitutionItem).replacement_product = item.replacement_product_id ? productMap.get(item.replacement_product_id) : undefined;
    }
  }

  return data as SubstitutionWithDetails[];
}

export interface CreateSubstitutionInput {
  customer_id: string;
  agent_id: string;
  reason: string;
  notes?: string;
  items: {
    original_product_id: string | null;
    replacement_product_id: string | null;
    quantity: number;
    original_quantity: number | null;
    replacement_quantity: number | null;
  }[];
}

export async function createSubstitution(input: CreateSubstitutionInput): Promise<void> {
  const year = new Date().getFullYear();
  const { count } = await supabase.from('substitutions').select('id', { count: 'exact', head: true });
  const num = (count || 0) + 1;
  const substitution_number = `SOST-${year}-${String(num).padStart(5, '0')}`;

  const { data: sub, error: subErr } = await supabase
    .from('substitutions')
    .insert({
      substitution_number,
      customer_id: input.customer_id,
      agent_id: input.agent_id,
      reason: input.reason,
      notes: input.notes || null,
      status: 'pending',
      is_approved: false, is_sent: false, is_returned: false, is_rejected: false, is_modified: false,
    })
    .select('id')
    .single();

  if (subErr) throw subErr;

  const itemsToInsert = input.items.map(i => ({
    substitution_id: sub.id,
    original_product_id: i.original_product_id || null,
    replacement_product_id: i.replacement_product_id || null,
    quantity: i.quantity || 0,
    original_quantity: i.original_product_id ? (i.original_quantity || 1) : null,
    replacement_quantity: i.replacement_product_id ? (i.replacement_quantity || 1) : null,
    notes: null,
  }));

  const { error: itemErr } = await supabase.from('substitution_items').insert(itemsToInsert);
  if (itemErr) {
    await supabase.from('substitutions').delete().eq('id', sub.id);
    throw itemErr;
  }
}

export async function deleteSubstitution(id: string): Promise<void> {
  const { error } = await supabase.from('substitutions').delete().eq('id', id).eq('status', 'pending');
  if (error) throw error;
}
