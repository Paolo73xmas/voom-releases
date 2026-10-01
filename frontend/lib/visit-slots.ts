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

export async function getVisitSlots(strict = false): Promise<VisitSlot[]> {
  if (cache && !strict) return cache;
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'visit_time_slots')
      .maybeSingle();
    if (strict && error) throw new Error('Fasce visita non disponibili. Riprova.');
    const arr = data?.setting_value as VisitSlot[] | undefined;
    if (Array.isArray(arr) && arr.length > 0) {
      cache = arr;
      return cache;
    }
  } catch (e) {
    if (strict) throw e;
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

// Giorni della settimana (ISO: 1=lunedì .. 6=sabato) per l'esclusione visite per cliente
export const WEEKDAYS: { id: number; label: string }[] = [
  { id: 1, label: 'Lun' }, { id: 2, label: 'Mar' }, { id: 3, label: 'Mer' },
  { id: 4, label: 'Gio' }, { id: 5, label: 'Ven' }, { id: 6, label: 'Sab' },
];

export const WEEKDAY_NAMES: Record<number, string> = {
  1: 'lunedì', 2: 'martedì', 3: 'mercoledì', 4: 'giovedì', 5: 'venerdì', 6: 'sabato', 7: 'domenica',
};

/** Giorno ISO (1=lun..7=dom) di una data YYYY-MM-DD */
export function isoWeekday(dateStr: string): number {
  const g = new Date(dateStr + 'T12:00:00').getDay();
  return g === 0 ? 7 : g;
}
