export type CustomerCategory = 'prospect' | 'client';
export type CustomerType = 'retail' | 'horeca' | 'industry' | 'other';
export type VisitType = 'first_visit' | 'follow_up' | 'delivery' | 'other';
export type VisitOutcome = 'positive' | 'neutral' | 'negative';
export type OrderStatus = 'draft' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type InspectionStatus = 'pending' | 'completed' | 'cancelled';

export interface Customer {
  id: string;
  business_name: string;
  vat_number: string;
  fiscal_code: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  contact_name: string;
  contact_surname: string;
  contact_phone: string;
  contact_email: string;
  website: string | null;
  customer_type: CustomerType;
  category: CustomerCategory;
  agent_id: string;
  notes: string;
  pec: string;
  sdi: string;
  first_visit_date: string;
  last_visit_date: string;
  conversion_date: string | null;
  tabaccheria_id: string | null;
  source: 'registry' | 'off_map';
  created_at: string;
  updated_at: string;
  agent?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface Tabaccheria {
  id: string;
  denominazione: string;
  indirizzo: string;
  comune: string;
  provincia: string;
  cap: string;
  gps_lat: string;
  gps_lng: string;
  latitude: number | null;
  longitude: number | null;
  customer_id?: string | null;
  agente_id?: string | null;
  stato_visita?: string | null;
  customer_business_name?: string | null;
  customer_last_order_date?: string | null;
  customer_last_visit_date?: string | null;
}

export interface Visit {
  id: string;
  customer_id: string;
  agent_id: string;
  tabaccheria_id?: string | null;
  visit_type: VisitType;
  visit_date: string;
  latitude: number;
  longitude: number;
  gps_accuracy?: number;
  outcome?: VisitOutcome;
  notes?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  agent_id: string;
  visit_id?: string | null;
  order_date: string;
  status: OrderStatus;
  total_amount: number;
  shipping_cost: number;
  is_foreign: boolean;
  notes?: string;
  internal_notes?: string;
  shipping_address?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  line_total: number;
  notes?: string;
  product?: Product;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id: string;
  supplier_id?: string;
  short_description?: string;
  unit_price: number;
  unit_of_measure: string;
  accisa: number;
  iva_percentage: number;
  image_url?: string;
  is_active: boolean;
  cashback_eligible?: boolean;
  estero?: boolean;
}

export interface Inspection {
  id: string;
  customer_id: string;
  agent_id: string;
  inspection_date: string;
  status: InspectionStatus;
  latitude: number;
  longitude: number;
  gps_accuracy?: number;
  notes?: string;
  follow_up_date?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  photos?: InspectionPhoto[];
}

export interface InspectionPhoto {
  id: string;
  inspection_id: string;
  photo_url: string;
  latitude?: number;
  longitude?: number;
  taken_at: string;
  created_at: string;
}
