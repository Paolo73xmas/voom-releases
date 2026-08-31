// Ricerca nel registro tabaccherie delle rivendite censite ma SENZA scheda cliente
// (usata da Clienti, Prima Visita e Rivendite No Mappa per evitare doppie anagrafiche).
// Parità web: src/lib/supabase/registry-search.ts
import { supabase } from '../supabase';

export interface RegistryTabMatch {
  id: string;
  denominazione: string | null;
  indirizzo: string | null;
  comune: string | null;
  provincia: string | null;
  cap: string | null;
  cf_iva: string | null;
  gps_lat: string | number | null;
  gps_lng: string | number | null;
  Num_Ordinale: number | null;
  telefono_fisso: string | null;
  telefono_mobile: string | null;
  email: string | null;
  customer_id: string | null;
}

export async function searchUnlinkedTabaccherie(term: string, limit = 15): Promise<RegistryTabMatch[]> {
  const t = (term || '').trim();
  if (t.length < 3) return [];
  let q = supabase
    .from('tabaccherie')
    .select('id, denominazione, indirizzo, comune, provincia, cap, cf_iva, gps_lat, gps_lng, "Num_Ordinale", telefono_fisso, telefono_mobile, email, customer_id')
    .limit(limit);
  for (const w of t.split(/\s+/).filter(Boolean).slice(0, 4)) {
    const like = `%${w.replace(/[%,()]/g, '')}%`;
    q = q.or(`denominazione.ilike.${like},comune.ilike.${like},indirizzo.ilike.${like}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  let rows = ((data || []) as RegistryTabMatch[]).filter((r) => !r.customer_id);
  if (rows.length > 0) {
    // Escludi anche le tabaccherie agganciate da una scheda cliente via customers.tabaccheria_id
    const { data: linked } = await supabase
      .from('customers')
      .select('tabaccheria_id')
      .in('tabaccheria_id', rows.map((r) => r.id));
    const linkedSet = new Set((linked || []).map((l) => l.tabaccheria_id));
    rows = rows.filter((r) => !linkedSet.has(r.id));
  }
  return rows;
}
