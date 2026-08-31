// Anti-duplicati P.IVA (parità web commit b400c5e): il DB ha un trigger che rifiuta
// P.IVA duplicate ([VAT_DUPLICATE|id|nome|indirizzo]) o segnaposto ([VAT_PLACEHOLDER]).
// Qui: pre-check via RPC cross-agente + parsing degli errori del trigger.
import { supabase } from '../supabase';

export interface ExistingVatCustomer {
  id: string;
  business_name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  agent_id: string | null;
}

const PLACEHOLDER_VATS = new Set([
  '12345678901', '12345678900', '12345566677', '12345667778', '1234567890', '0123456789',
]);

export function normalizeVat(vat: string | null | undefined): string {
  return (vat || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function isPlaceholderVat(vat: string | null | undefined): boolean {
  const n = normalizeVat(vat);
  if (!n) return false;
  if (/^(.)\1+$/.test(n)) return true;
  return PLACEHOLDER_VATS.has(n);
}

export async function findCustomerByVat(vat: string): Promise<ExistingVatCustomer | null> {
  if (!vat?.trim() || isPlaceholderVat(vat)) return null;
  const { data, error } = await supabase.rpc('find_customer_by_vat', { p_vat: vat });
  if (error) {
    console.warn('[vat-guard] find_customer_by_vat error:', error.message);
    return null;
  }
  return Array.isArray(data) && data.length > 0 ? (data[0] as ExistingVatCustomer) : null;
}

export type VatGuardError =
  | { type: 'duplicate'; id: string; name: string; where: string }
  | { type: 'placeholder' };

export function parseVatGuardError(message?: string | null): VatGuardError | null {
  if (!message) return null;
  if (message.includes('[VAT_PLACEHOLDER]')) return { type: 'placeholder' };
  const m = message.match(/\[VAT_DUPLICATE\|([0-9a-fA-F-]+)\|([^|\]]*)\|([^\]]*)\]/);
  if (m) return { type: 'duplicate', id: m[1], name: m[2], where: m[3] };
  return null;
}
