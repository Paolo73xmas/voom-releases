// Fasce orarie visite preferite dai clienti (usate dall'AI Tour).
// Le definizioni vivono in system_settings.visit_time_slots (modificabili da admin);
// in assenza della riga si usano i default qui sotto. (Parità web: src/lib/visit-slots.ts)
import { supabase } from './supabase';

export interface VisitSlot {
  id: string;
  label: string;
  /** Minuti dalla mezzanotte (es. 360 = 6:00) */
  start: number;
  end: number;
  /** true = nessuna tolleranza sull'arrivo (fascia pranzo) */
  strict?: boolean;
}

/** Tolleranza ±30 min sull'arrivo, tranne per le fasce strict */
export const VISIT_SLOT_TOLERANCE_MIN = 30;

export const DEFAULT_VISIT_SLOTS: VisitSlot[] = [
  { id: '06_08', label: '6 - 8', start: 360, end: 480 },
  { id: '08_09', label: '8 - 9', start: 480, end: 540 },
  { id: '09_1130', label: '9 - 11.30', start: 540, end: 690 },
  { id: '1130_1430', label: '11.30 - 14.30', start: 690, end: 870, strict: true },
  { id: '1430_16', label: '14.30 - 16', start: 870, end: 960 },
  { id: '16_18', label: '16 - 18', start: 960, end: 1080 },
];

let cache: VisitSlot[] | null = null;

export async function getVisitSlots(): Promise<VisitSlot[]> {
  if (cache) return cache;
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'visit_time_slots')
      .maybeSingle();
    const arr = data?.setting_value as VisitSlot[] | undefined;
    if (Array.isArray(arr) && arr.length > 0) {
      cache = arr;
      return cache;
    }
  } catch {
    // fallback ai default
  }
  cache = DEFAULT_VISIT_SLOTS;
  return cache;
}

/** Converte gli id salvati sul cliente nelle definizioni complete; null se nessuna */
export function resolveSlots(ids: unknown, defs: VisitSlot[]): VisitSlot[] | null {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const found = defs.filter((d) => (ids as string[]).includes(d.id));
  return found.length > 0 ? found : null;
}

export function slotsFromIds(ids: unknown, defs: VisitSlot[]): VisitSlot[] {
  return resolveSlots(ids, defs) || [];
}
