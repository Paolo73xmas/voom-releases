import { supabase } from '../supabase';

export interface Product {
  id: string;
  name: string;
  short_description?: string;
  sku: string;
  unit_price: number;
  supplier_id: string;
  unit_of_measure?: string;
  accisa?: number;
  iva_percentage?: number;
  image_url?: string | null;
  is_active: boolean;
  cashback_eligible?: boolean;
  estero?: boolean;
  rottamazione_no?: boolean;
  stock_quantity?: number;
  category_id?: string | null;
  /** ✅ Sconto Cartone (parità web): pezzi per cartone */
  pezzi_cartone?: number | null;
  /** ✅ Sconto Cartone (parità web): % sconto quando qty >= pezzi_cartone */
  sconto_cartone?: number | null;
}

export interface PaymentMethod {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface ShippingMethod {
  id: string;
  name: string;
  description?: string;
  cost: number;
  is_active: boolean;
  foreign_only?: boolean;
}

export async function fetchProducts(isForeign: boolean = false): Promise<Product[]> {
  try {
    let query = supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (isForeign) {
      query = query.eq('estero', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[fetchProducts] Error:', error);
    throw error;
  }
}

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  try {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[fetchPaymentMethods] Error:', error);
    throw error;
  }
}

export async function fetchShippingMethods(isForeign: boolean = false): Promise<ShippingMethod[]> {
  try {
    const { data, error } = await supabase
      .from('shipping_methods')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    
    // Filter based on foreign order
    return (data || []).filter(method => {
      const isRitiro = method.name.toLowerCase().includes('ritiro');
      if (isRitiro) return true;
      if (isForeign) return method.foreign_only === true;
      return method.foreign_only !== true;
    });
  } catch (error) {
    console.error('[fetchShippingMethods] Error:', error);
    throw error;
  }
}

export interface OrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
}

export interface CreateOrderData {
  customer_id: string;
  agent_id: string;
  payment_method_id: string;
  shipping_method_id: string;
  is_foreign: boolean;
  shipping_address?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  items: OrderItem[];
  // Pre-calculated totals (matching web app logic)
  total_amount: number;
  shipping_cost: number;
  // CashBack fields
  cashback_used?: number;
  generates_cashback?: boolean;
  // Rottamazione as proper field
  rottamazione_amount?: number;
}

function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = date.toISOString().slice(11, 19).replace(/:/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${dateStr}-${timeStr}-${randomSuffix}`;
}

export async function createOrder(data: CreateOrderData): Promise<{ orderId: string; orderNumber: string }> {
  try {
    // Get customer info
    const { data: customer } = await supabase
      .from('customers')
      .select('business_name, contact_name, contact_phone, contact_email, vat_number, fiscal_code, pec, sdi, customer_type')
      .eq('id', data.customer_id)
      .single();

    // Get agent info
    const { data: agent } = await supabase
      .from('profiles')
      .select('full_name, email, codice_agente_prestashop')
      .eq('id', data.agent_id)
      .single();

    const orderNumber = generateOrderNumber();

    // Create order - using pre-calculated values matching web app logic
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: data.customer_id,
        agent_id: data.agent_id,
        payment_method_id: data.payment_method_id,
        shipping_method_id: data.shipping_method_id,
        status: 'draft',
        order_date: new Date().toISOString(),
        total_amount: data.total_amount,
        shipping_cost: data.shipping_cost,
        is_foreign: data.is_foreign,
        notes: data.notes || null,
        shipping_address: data.shipping_address,
        latitude: data.latitude,
        longitude: data.longitude,
        contact_name: customer?.contact_name,
        contact_phone: customer?.contact_phone,
        contact_email: customer?.contact_email,
        vat_number: customer?.vat_number,
        fiscal_code: customer?.fiscal_code,
        pec: customer?.pec,
        sdi: customer?.sdi,
        customer_type: customer?.customer_type,
        agent_full_name: agent?.full_name,
        agent_email: agent?.email,
        codice_agente_prestashop: agent?.codice_agente_prestashop,
        cashback_used: data.cashback_used ?? 0,
        generates_cashback: data.generates_cashback ?? true,
        rottamazione_amount: data.rottamazione_amount ?? 0,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Insert order items
    const orderItems = data.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_percent: item.discount_percent,
    }));

    const { error: itemsError } = await supabase.rpc('insert_order_items_safe', {
      p_order_id: order.id,
      p_items: orderItems,
    });

    if (itemsError) {
      // Rollback order
      await supabase.from('orders').delete().eq('id', order.id);
      throw itemsError;
    }

    // Update customer category to 'client'
    await supabase
      .from('customers')
      .update({ category: 'client', last_visit_date: new Date().toISOString() })
      .eq('id', data.customer_id);

    return { orderId: order.id, orderNumber: order.order_number };
  } catch (error) {
    console.error('[createOrder] Error:', error);
    throw error;
  }
}
