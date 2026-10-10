import { supabase } from '../supabase';
import type { TourCandidate } from './types';

/** Positive registry evidence, not an empty/RLS-filtered history interpreted as “never”.
 * Existing RPC excludes linked customer records; registry status must ALSO explicitly say non_visitato.
 * This describes recorded data, not unrecorded visits; absent/inaccessible rows remain unknown. */
export async function readNewPointEvidence(points: TourCandidate[]): Promise<Set<string>> {
  const verified = new Set<string>();
  const ids = [...new Set(points.flatMap(c => c.tabaccheriaId ? [c.tabaccheriaId] : []))];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await supabase.from('tabaccherie').select('id,customer_id,stato_visita,chiusa')
      .in('id', ids.slice(offset, offset + 200));
    if (error || !Array.isArray(data)) throw new Error('Classificazione dei nuovi punti non verificata. Riprova il caricamento.');
    for (const row of data) if (row.customer_id === null && row.stato_visita === 'non_visitato' && row.chiusa === false) verified.add(row.id);
  }
  return verified;
}