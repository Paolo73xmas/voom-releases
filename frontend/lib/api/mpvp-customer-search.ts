/**
 * MPVP — Ricerca fuzzy dei clienti / punti vendita.
 *
 * ✅ Web parity (src/lib/supabase/mpvp-customer-search.ts): stessa logica, stessa
 * sorgente dati (tabella `tabaccherie`) e stesso ranking client-side.
 *
 * STRATEGIA RICERCA (tollerante SOLO ad accenti / maiuscole, NON ai typo):
 *  1) Recupero candidati dal DB con `ilike` (case-insensitive, substring) su
 *     tutti i campi rilevanti tramite un singolo `.or(...)`. Oltre al termine
 *     intero interroghiamo anche i singoli token significativi (es. "rossi
 *     milano" → "rossi", "milano") per gestire l'ordine diverso delle parole.
 *  2) Ranking client-side: ogni candidato riceve uno score normalizzando SOLO
 *     accenti/maiuscole (NFD + strip diacritici) e considerando ESCLUSIVAMENTE
 *     match ESATTI: uguaglianza, prefisso e substring. NESSUNA tolleranza agli
 *     errori di battitura (niente distanza di Levenshtein / similarità fuzzy).
 */
import { supabase } from '../supabase';

export interface MpvpCustomerResult {
  id: string;
  denominazione: string | null;
  indirizzo: string | null;
  comune: string | null;
  provincia: string | null;
  cap: string | null;
  partita_iva: string | null;
  codice_fiscale: string | null;
  cf_iva: string | null;
  customer_id: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Punteggio fuzzy [0..1+] usato per l'ordinamento (più alto = più rilevante). */
  score: number;
  /** Campo che ha prodotto il match migliore (per badge/etichetta nel dropdown). */
  matchedField: 'nome' | 'indirizzo' | 'comune' | 'p.iva' | 'cod.fiscale' | '';
}

interface TabaccheriaSearchRow {
  id: string;
  denominazione: string | null;
  indirizzo: string | null;
  comune: string | null;
  provincia: string | null;
  cap: string | null;
  partita_iva: string | null;
  codice_fiscale: string | null;
  cf_iva: string | null;
  gps_lat: string | number | null;
  gps_lng: string | number | null;
  customer_id: string | null;
}

/**
 * Normalizza una stringa per il confronto fuzzy: minuscole, rimozione accenti
 * (diacritici), collasso degli spazi multipli e trim.
 */
function normalize(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // rimuove i diacritici (à→a, é→e, ...)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Score di un singolo campo rispetto alla query normalizzata.
 * SOLO match ESATTI (dopo normalizzazione accenti+maiuscole): uguaglianza,
 * prefisso, substring. NESSUNA tolleranza ai typo. Score in [0..1.2].
 */
function fieldScore(queryNorm: string, queryTokens: string[], fieldRaw: string | null | undefined): number {
  const field = normalize(fieldRaw);
  if (!field || !queryNorm) return 0;

  if (field === queryNorm) return 1.2;
  if (field.startsWith(queryNorm)) return 1.0;
  if (field.includes(queryNorm)) return 0.9;

  const fieldTokens = field.split(' ').filter(Boolean);
  if (queryTokens.length === 0) return 0;

  let matchedTokens = 0;
  for (const qt of queryTokens) {
    const hit = fieldTokens.some((ft) => ft === qt || ft.startsWith(qt) || ft.includes(qt));
    if (hit) matchedTokens++;
  }

  if (matchedTokens === queryTokens.length) return 0.85;
  return 0;
}

function parseCoord(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(n) && n !== 0 ? n : null;
}

/**
 * Esegue la ricerca fuzzy dei clienti/punti vendita.
 *
 * @param query  testo digitato dall'utente
 * @param limit  numero massimo di risultati restituiti (default 8)
 */
export async function searchMpvpCustomers(query: string, limit = 8): Promise<MpvpCustomerResult[]> {
  const raw = (query || '').trim();
  if (raw.length < 2) return [];

  const queryNorm = normalize(raw);
  const queryTokens = queryNorm.split(' ').filter((t) => t.length >= 2);

  const patterns = new Set<string>();
  patterns.add(`%${raw}%`);
  for (const t of raw.split(/\s+/).filter((t) => t.length >= 2)) {
    patterns.add(`%${t}%`);
  }

  const fields = ['denominazione', 'indirizzo', 'comune', 'partita_iva', 'codice_fiscale', 'cf_iva'];

  const orParts: string[] = [];
  for (const p of patterns) {
    for (const f of fields) {
      orParts.push(`${f}.ilike.${p}`);
    }
  }

  const { data, error } = await supabase
    .from('tabaccherie')
    .select(
      'id, denominazione, indirizzo, comune, provincia, cap, partita_iva, codice_fiscale, cf_iva, gps_lat, gps_lng, customer_id',
    )
    .or(orParts.join(','))
    .limit(120);

  if (error) {
    console.error('[MPVP] Errore ricerca clienti:', error);
    throw error;
  }

  const rows = (data as TabaccheriaSearchRow[] | null) || [];

  const scored: MpvpCustomerResult[] = rows.map((row) => {
    const scores: { field: MpvpCustomerResult['matchedField']; score: number }[] = [
      { field: 'nome', score: fieldScore(queryNorm, queryTokens, row.denominazione) },
      { field: 'indirizzo', score: fieldScore(queryNorm, queryTokens, row.indirizzo) },
      { field: 'comune', score: fieldScore(queryNorm, queryTokens, row.comune) },
      { field: 'p.iva', score: fieldScore(queryNorm, queryTokens, row.partita_iva) },
      { field: 'cod.fiscale', score: fieldScore(queryNorm, queryTokens, row.codice_fiscale) },
      { field: 'cod.fiscale', score: fieldScore(queryNorm, queryTokens, row.cf_iva) },
    ];

    // Il nome/ragione sociale ha priorità leggermente maggiore.
    const nameIdx = scores.findIndex((s) => s.field === 'nome');
    if (nameIdx >= 0) scores[nameIdx].score *= 1.05;

    let best = scores[0];
    for (const s of scores) {
      if (s.score > best.score) best = s;
    }

    return {
      id: row.id,
      denominazione: row.denominazione,
      indirizzo: row.indirizzo,
      comune: row.comune,
      provincia: row.provincia,
      cap: row.cap,
      partita_iva: row.partita_iva,
      codice_fiscale: row.codice_fiscale,
      cf_iva: row.cf_iva,
      customer_id: row.customer_id,
      latitude: parseCoord(row.gps_lat),
      longitude: parseCoord(row.gps_lng),
      score: best.score,
      matchedField: best.score > 0 ? best.field : '',
    };
  });

  return scored
    .filter((r) => r.score >= 0.8)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Geocoding LUOGHI via Nominatim (OpenStreetMap). Tollerante, IT-only, max 5 risultati.
 */
export interface PlaceSuggestion {
  lat: number;
  lon: number;
  label: string;
}

export async function fetchPlaces(term: string, limit = 5): Promise<PlaceSuggestion[]> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(term)}&countrycodes=it&limit=${limit}&addressdetails=0`,
      { headers: { 'User-Agent': 'VoomApp/1.0' } },
    );
    if (!response.ok) return [];
    const results: { lat: string; lon: string; display_name: string }[] = await response.json();
    return results.map((r) => ({
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      label: r.display_name,
    }));
  } catch (e) {
    console.error('[MPVP] Geocoding error:', e);
    return [];
  }
}
