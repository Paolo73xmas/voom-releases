// Client OSRM pubblico (router.project-osrm.org): matrice tempi/distanze e percorso.
// OSRM usa lon,lat; Leaflet usa lat,lng. Max ~30 punti per la matrice (demo server).
import { supabase } from '../supabase';
import { haversineKm } from './types';
import { normalizeLocality } from './brief-area';

// Restituisce alternative etichettate: una correzione non viene mai scelta in silenzio.
export async function geocodePlaceChoices(address: string, cityHint?: string, localityOnly = false): Promise<import('./types').GeoPoint[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address + ', Italia')}&limit=6&countrycode=IT${localityOnly ? '&layer=city' : ''}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: timeoutSignal(12000) });
  if (!res.ok) throw new Error('Ricerca luoghi non disponibile. Riprova.');
  const data = await res.json();
  if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Risposta geografica incompleta: riprova');
  const points: import('./types').GeoPoint[] = [];
  for (const f of data.features || []) {
    const p = f.properties || {}, xy = f.geometry?.coordinates;
    if (p.countrycode?.toUpperCase() !== 'IT' || !Array.isArray(xy) || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) continue;
    if (localityOnly && !(p.type === 'city' || ['city', 'town', 'village'].includes(p.osm_value))) continue;
    if (cityHint && ![p.city, p.town, p.village, p.name].some((v) => typeof v === 'string' && normalizeLocality(v) === normalizeLocality(cityHint))) continue;
    const label = [...new Set([p.name, [p.street, p.housenumber].filter(Boolean).join(' '), p.city, p.county, p.state, p.country].filter(Boolean))].join(', ');
    if (!points.some((x) => x.label === label && Math.abs(x.lat - xy[1]) < 0.0001 && Math.abs(x.lng - xy[0]) < 0.0001)) points.push({ lat: xy[1], lng: xy[0], label });
  }
  if (localityOnly) {
    const exact = points.filter((p) => normalizeLocality((p.label || '').split(',')[0]) === normalizeLocality(address));
    if (exact.length) return exact;
  }
  return points;
}

// AbortSignal.timeout non e' garantito su Hermes/React Native: fallback con AbortController
export function timeoutSignal(ms: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout === 'function') {
      return AbortSignal.timeout(ms);
    }
    const c = new AbortController();
    setTimeout(() => c.abort(), ms);
    return c.signal;
  } catch {
    return undefined;
  }
}

const OSRM_BASE = 'https://router.project-osrm.org';

export interface OsrmMatrix {
  durations: (number | null)[][]; // secondi
  distances: (number | null)[][]; // metri
  fallback: boolean;
}

export interface OsrmRoute {
  latlngs: [number, number][];
  legs: { durationMin: number; distanceKm: number }[];
  totalKm: number;
  totalMin: number;
  fallback: boolean;
  /** Ripartizione km per ciclo dalla velocita' dei segmenti OSRM (null se fallback) */
  kmUrban: number | null;
  kmExtra: number | null;
  kmHighway: number | null;
}

interface LatLng { lat: number; lng: number }

function coordStr(points: LatLng[]): string {
  return points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
}

function fallbackMatrix(points: LatLng[]): OsrmMatrix {
  // Stima: 38 km/h medi urbani/extraurbani, fattore strada 1.3 sulla distanza in linea d'aria
  const n = points.length;
  const durations: number[][] = [];
  const distances: number[][] = [];
  for (let i = 0; i < n; i++) {
    durations.push([]);
    distances.push([]);
    for (let j = 0; j < n; j++) {
      const km = i === j ? 0 : haversineKm(points[i].lat, points[i].lng, points[j].lat, points[j].lng) * 1.3;
      distances[i].push(km * 1000);
      durations[i].push((km / 38) * 3600);
    }
  }
  return { durations, distances, fallback: true };
}

export async function getMatrix(points: LatLng[], requireRoadDistances = false): Promise<OsrmMatrix> {
  if (points.length < 2) return { durations: [[0]], distances: [[0]], fallback: false };
  try {
    const url = `${OSRM_BASE}/table/v1/driving/${coordStr(points)}?annotations=duration,distance`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: timeoutSignal(15000) });
    const body = await res.json();
    if (!res.ok || body.code !== 'Ok' || !body.durations) throw new Error(body.message || `HTTP ${res.status}`);
    if (requireRoadDistances && (!body.distances || body.distances.some((row: unknown[]) => row.some((v) => typeof v !== 'number' || !Number.isFinite(v))))) throw new Error('Distanze stradali incomplete');
    return { durations: body.durations, distances: body.distances || fallbackMatrix(points).distances, fallback: false };
  } catch (err) {
    console.warn('[AITour][osrm] Matrice non disponibile, uso stima haversine:', err);
    return fallbackMatrix(points);
  }
}

export async function getRoute(points: LatLng[]): Promise<OsrmRoute> {
  const fb = (): OsrmRoute => {
    const legs = [] as { durationMin: number; distanceKm: number }[];
    let totalKm = 0;
    for (let i = 1; i < points.length; i++) {
      const km = haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng) * 1.3;
      legs.push({ durationMin: (km / 38) * 60, distanceKm: km });
      totalKm += km;
    }
    return {
      latlngs: points.map((p) => [p.lat, p.lng] as [number, number]),
      legs,
      totalKm,
      totalMin: legs.reduce((s, l) => s + l.durationMin, 0),
      fallback: true,
      kmUrban: null,
      kmExtra: null,
      kmHighway: null,
    };
  };
  if (points.length < 2) return { latlngs: [], legs: [], totalKm: 0, totalMin: 0, fallback: false, kmUrban: null, kmExtra: null, kmHighway: null };
  try {
    const url = `${OSRM_BASE}/route/v1/driving/${coordStr(points)}?overview=full&geometries=geojson&steps=false&annotations=duration,distance`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: timeoutSignal(15000) });
    const body = await res.json();
    if (!res.ok || body.code !== 'Ok' || !body.routes?.length) throw new Error(body.message || `HTTP ${res.status}`);
    const route = body.routes[0];
    // Ripartizione km per ciclo: velocita' stimata di ogni segmento OSRM
    // (>=95 km/h autostrada, 48-95 extraurbano, <48 urbano)
    let kmU = 0, kmE = 0, kmH = 0, annotated = false;
    for (const leg of route.legs as { annotation?: { distance?: number[]; duration?: number[] } }[]) {
      const dist = leg.annotation?.distance;
      const dur = leg.annotation?.duration;
      if (!dist || !dur || dist.length !== dur.length) continue;
      annotated = true;
      for (let i = 0; i < dist.length; i++) {
        const km = dist[i] / 1000;
        const speed = dur[i] > 0 ? km / (dur[i] / 3600) : 0;
        if (speed >= 95) kmH += km;
        else if (speed >= 48) kmE += km;
        else kmU += km;
      }
    }
    return {
      latlngs: (route.geometry.coordinates as [number, number][]).map((c) => [c[1], c[0]] as [number, number]),
      legs: (route.legs as { duration: number; distance: number }[]).map((l) => ({
        durationMin: l.duration / 60,
        distanceKm: l.distance / 1000,
      })),
      totalKm: route.distance / 1000,
      totalMin: route.duration / 60,
      fallback: false,
      kmUrban: annotated ? Math.round(kmU * 10) / 10 : null,
      kmExtra: annotated ? Math.round(kmE * 10) / 10 : null,
      kmHighway: annotated ? Math.round(kmH * 10) / 10 : null,
    };
  } catch (err) {
    console.warn('[AITour][osrm] Percorso non disponibile, uso stima haversine:', err);
    return fb();
  }
}

// Geocoding indirizzo manuale: Nominatim (OpenStreetMap) con retry + fallback Photon
async function nominatimSearch(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', Italia')}&format=json&limit=1`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: timeoutSignal(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function photonSearch(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address + ', Italia')}&limit=1`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: timeoutSignal(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const coords = data?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  return { lat: coords[1], lng: coords[0] };
}

// Fallback finale: centroide GPS delle tabaccherie del comune (dal nostro DB)
async function dbComuneSearch(address: string): Promise<{ lat: number; lng: number } | null> {
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  const attempts = [...new Set([address.trim(), parts[parts.length - 1] || '', parts[0] || ''])].filter(Boolean);
  for (const comune of attempts) {
    const { data, error } = await supabase.rpc('ai_tour_comune_centroid', { p_comune: comune });
    if (!error && Array.isArray(data) && data.length > 0 && data[0].lat != null) {
      return { lat: Number(data[0].lat), lng: Number(data[0].lng) };
    }
  }
  return null;
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; label: string } | null> {
  for (const attempt of [0, 1]) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1200));
      const p = await nominatimSearch(address);
      if (p) return { ...p, label: address };
    } catch (err) {
      console.warn('[AITour][geocode] Nominatim tentativo fallito:', err);
    }
  }
  try {
    const p = await photonSearch(address);
    if (p) return { ...p, label: address };
  } catch (err) {
    console.warn('[AITour][geocode] Photon fallito:', err);
  }
  try {
    const p = await dbComuneSearch(address);
    if (p) return { ...p, label: address };
  } catch (err) {
    console.warn('[AITour][geocode] Fallback DB comune fallito:', err);
  }
  return null;
}
