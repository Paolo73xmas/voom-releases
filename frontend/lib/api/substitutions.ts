/**
 * Substitutions API — Mobile
 * Mirrors the web app's substitutions.ts
 */
import { supabase } from '../supabase';

export interface SubstitutionItem {
  id: string;
  original_product_id: string;
  replacement_product_id: string;
  quantity: number;
  original_quantity: number;
  replacement_quantity: number;
  notes: string | null;
  original_product?: { id: string; name: string; sku: string | null; short_description?: string; unit_price?: number | null };
  replacement_product?: { id: string; name: string; sku: string | null; short_description?: string; unit_price?: number | null };
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
  created_at: string;
  customers?: { business_name: string; city?: string; province?: string };
  profiles?: { full_name: string };
  substitution_items?: SubstitutionItem[];
}

export async function fetchSubstitutions(agentId: string): Promise<SubstitutionWithDetails[]> {
  const { data, error } = await supabase
    .from('substitutions')
    .select(`
      *,
      customers (business_name, city, province),
      substitution_items (
        id, original_product_id, replacement_product_id,
        quantity, original_quantity, replacement_quantity, notes
      )
    `)
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Fetch product details
  const productIds = new Set<string>();
  for (const sub of data) {
    for (const item of (sub.substitution_items || [])) {
      productIds.add(item.original_product_id);
      productIds.add(item.replacement_product_id);
    }
  }

  let productMap = new Map<string, any>();
  if (productIds.size > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku, short_description, unit_price')
      .in('id', Array.from(productIds));
    productMap = new Map((products || []).map(p => [p.id, p]));
  }

  // Attach products to items
  for (const sub of data) {
    for (const item of (sub.substitution_items || [])) {
      (item as SubstitutionItem).original_product = productMap.get(item.original_product_id);
      (item as SubstitutionItem).replacement_product = productMap.get(item.replacement_product_id);
    }
  }

  return data as SubstitutionWithDetails[];
}

export async function createSubstitution(input: {
  customer_id: string;
  agent_id: string;
  reason: string;
  notes?: string;
  items: { original_product_id: string; replacement_product_id: string; original_quantity: number; replacement_quantity: number; notes?: string }[];
}): Promise<void> {
  // Generate number
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
      is_approved: false,
      is_sent: false,
      is_returned: false,
      is_rejected: false,
      is_modified: false,
    })
    .select('id')
    .single();

  if (subErr) throw subErr;

  const itemsToInsert = input.items.map(i => ({
    substitution_id: sub.id,
    original_product_id: i.original_product_id,
    replacement_product_id: i.replacement_product_id,
    quantity: i.original_quantity,
    original_quantity: i.original_quantity,
    replacement_quantity: i.replacement_quantity,
    notes: i.notes || null,
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
