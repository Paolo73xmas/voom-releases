// Operazioni live sul giro (parità web src/lib/aitour/liveops.ts):
// inserimento tappa a giro avviato (ORA / fascia oraria / dopo tappa X), riordino manuale,
// "Più Visite" (estensione del giro) con rispetto dell'area originale.
import { supabase } from '../supabase';
import type { TourCandidate, GeoPoint, AiTourSettings, TourPlan, PlannedStop, DayType } from './types';
import { minToTime, haversineKm } from './types';
import type { SavedTour } from './tours';
import { addLiveStop, updateLiveSequence, logTourEvent } from './live';
import { planFixedOrder, planTour, candidatesForDayType } from './planner';
import { loadCandidates, loadFreeTabaccherie } from './data';
import { scoreCandidates, isRecentlyServed, RECENT_CONTACT_DAYS } from './scoring';
import { listAllZones, pointInZones, ringsToSyntheticZones } from './territories';
import type { VisitSlot } from '../visit-slots';
import { isoWeekday } from '../visit-slots';
import { inBriefArea } from './brief-area';
import { assignJourneyStages, nearestJourneyStage } from './brief-journey';
import { assertCompleteReplan, protectLivePlan, restoreBriefCandidate } from './brief-live';

export interface LiveStopRef {
  id: string;
  candidate: TourCandidate;
  mandatory: boolean;
}

export interface PlacementChoice {
  mode: 'now' | 'slot' | 'after';
  afterStopId?: string;
  slots?: VisitSlot[];
}

export interface ReplanContext {
  tour: SavedTour;
  startPos: { lat: number; lng: number };
  endPoint: GeoPoint | null;
  startMin: number;
  endMin: number;
  settings: AiTourSettings;
  /** Numero di tappe già gestite (non planned): le nuove sequenze partono da qui per evitare duplicati */
  seqBase?: number;
}

export interface LiveOpResult {
  warnings: string[];
  droppedNames: string[];
}

function baseFor(ctx: ReplanContext, ordered: LiveStopRef[], end: GeoPoint | null): TourPlan {
  const stops = ordered.map((s, i): PlannedStop => ({
    candidate: restoreBriefCandidate(s.candidate, ctx.tour), sequence: i + 1, arrivalMin: 0, departureMin: 0,
    travelMinFromPrev: 0, travelKmFromPrev: 0, mandatory: s.mandatory,
  }));
  return {
    stops,
    geometry: [],
    start: { lat: ctx.startPos.lat, lng: ctx.startPos.lng, label: 'Posizione attuale' },
    end,
    tourDate: ctx.tour.tour_date,
    startMin: ctx.startMin,
    endMin: ctx.endMin,
    dayType: ctx.tour.tour_type as DayType,
    resolvedDayType: (ctx.tour.resolved_tour_type || 'mista') as Exclude<DayType, 'ai'>,
    areaFilter: ctx.tour.area_filter ? { ...ctx.tour.area_filter, journeyStageCounts: [] } : null,
    requiredStops: (ctx.tour.area_filter?.briefRequirements || []).filter((r) => ordered.some((s) => r.customerId ? s.candidate.customerId === r.customerId : s.candidate.key === r.key)),
    returnFlexible: ctx.tour.area_filter?.returnFlexible,
  } as unknown as TourPlan;
}

async function persistSequence(
  ctx: ReplanContext,
  planned: PlannedStop[],
  byKey: Map<string, LiveStopRef>,
  geometry: [number, number][],
): Promise<void> {
  const plannedKeys = new Set(planned.map((p) => p.candidate.key));
  if (plannedKeys.size !== planned.length || [...byKey.keys()].some((k) => !plannedKeys.has(k))) throw new Error('Ricalcolo incompleto: nessuna tappa esistente può essere rimossa');
  const base = ctx.seqBase || 0;
  const updates = planned
    .filter((p) => byKey.has(p.candidate.key))
    .map((p, i) => {
      const ref = byKey.get(p.candidate.key) as LiveStopRef;
      return { stopId: ref.id, seq: base + i + 1, arrival: minToTime(p.arrivalMin), travelMin: p.travelMinFromPrev, travelKm: p.travelKmFromPrev };
    });
  await updateLiveSequence(ctx.tour.id, updates);
  await supabase.from('ai_tours').update({ route_geometry: geometry, updated_at: new Date().toISOString() }).eq('id', ctx.tour.id);
}

function aiInput(ctx: ReplanContext, candidates: TourCandidate[], mandatoryKeys: Set<string>, start: GeoPoint, startMin: number) {
  return {
    candidates: assignJourneyStages(candidates.map((c) => restoreBriefCandidate(c, ctx.tour)), ctx.tour.area_filter?.briefJourney),
    mandatoryKeys,
    start,
    end: ctx.endPoint,
    tourDate: ctx.tour.tour_date,
    startMin,
    endMin: ctx.endMin,
    dayType: ctx.tour.tour_type as DayType,
    resolvedDayType: (ctx.tour.resolved_tour_type || 'mista') as Exclude<DayType, 'ai'>,
    bufferPct: 5,
    bufferMaxMin: ctx.settings.buffer_max_min,
    area: { mode: 'auto' as const },
    skipDayExclusion: true,
    enforceJourneyOrder: !!ctx.tour.area_filter?.briefJourney,
    returnFlexible: ctx.tour.area_filter?.returnFlexible,
  };
}

export interface InsertOpts {
  mandatory: boolean;
  byAdmin?: boolean;
  adminName?: string;
}

// Nei tour con vincoli il calcolo precede SEMPRE la prima scrittura.
async function insertProtectedStop(ctx: ReplanContext, pending: LiveStopRef[], candidate: TourCandidate, placement: PlacementChoice, opts: InsertOpts): Promise<LiveOpResult> {
  const inArea = await areaCheckForTour(ctx.tour, pending);
  if (!inArea(candidate)) throw new Error('La tappa è fuori dalla zona o da una fase rimanente del percorso confermato');
  if (pending.some((s) => s.candidate.key === candidate.key || (candidate.customerId && s.candidate.customerId === candidate.customerId) || (candidate.tabaccheriaId && s.candidate.tabaccheriaId === candidate.tabaccheriaId))) throw new Error('Questo punto vendita è già nel giro');
  const cand = restoreBriefCandidate({ ...candidate, ...(placement.mode === 'slot' ? { preferredSlots: placement.slots } : {}) }, ctx.tour);
  const provisional: LiveStopRef = { id: 'pending-calculation', candidate: cand, mandatory: opts.mandatory };
  const ordered = pending.map((s) => ({ ...s, candidate: restoreBriefCandidate(s.candidate, ctx.tour) }));
  const index = placement.mode === 'now' ? 0 : placement.mode === 'after' ? ordered.findIndex((s) => s.id === placement.afterStopId) + 1 : ordered.length;
  ordered.splice(index < 0 ? ordered.length : index, 0, provisional);
  const all = ordered.map((s) => s.candidate);
  const plan = placement.mode === 'slot' ? await planTour(aiInput(ctx, all, new Set(all.map((c) => c.key)), { ...ctx.startPos, label: 'Posizione attuale' }, ctx.startMin))
    : await planFixedOrder(all, baseFor(ctx, ordered, ctx.endPoint));
  assertCompleteReplan(plan, all);
  protectLivePlan(plan, ctx.tour, all);
  const id = await addLiveStop(ctx.tour, cand, (ctx.seqBase || 0) + ordered.length, { mandatory: opts.mandatory, byAdmin: opts.byAdmin, adminName: opts.adminName, placement: placement.mode });
  provisional.id = id;
  await persistSequence(ctx, plan.stops, new Map(ordered.map((s) => [s.candidate.key, s])), plan.geometry);
  return { warnings: plan.warnings, droppedNames: [] };
}

// Inserisce una tappa a giro avviato e ripianifica secondo il posizionamento scelto.
// La nuova tappa non viene MAI scartata e il ricalcolo non rimuove MAI le tappe già
// previste (alleggerire il giro spetta all'agente: cestino/salta).
export async function insertLiveStop(
  ctx: ReplanContext,
  pending: LiveStopRef[],
  cand: TourCandidate,
  placement: PlacementChoice,
  opts: InsertOpts,
): Promise<LiveOpResult> {
  if (ctx.tour.area_filter?.briefJourney || ctx.tour.area_filter?.briefRequirements?.length) return insertProtectedStop(ctx, pending, cand, placement, opts);
  if (placement.mode === 'slot' && placement.slots && placement.slots.length > 0) {
    cand.preferredSlots = placement.slots;
  }
  const stopId = await addLiveStop(ctx.tour, cand, pending.length + 1, {
    mandatory: opts.mandatory, byAdmin: opts.byAdmin, adminName: opts.adminName, placement: placement.mode,
  });
  const newRef: LiveStopRef = { id: stopId, candidate: cand, mandatory: opts.mandatory };
  const warnings: string[] = [];
  const droppedNames: string[] = [];

  try {
    if (placement.mode === 'now') {
      // La nuova tappa diventa la prossima; le successive vengono riottimizzate dall'AI
      const first = await planFixedOrder([cand], baseFor(ctx, [newRef], null));
      const firstStop = first.stops[0];
      if (pending.length === 0) {
        const fin = await planFixedOrder([cand], baseFor(ctx, [newRef], ctx.endPoint));
        await persistSequence(ctx, fin.stops, new Map([[cand.key, newRef]]), fin.geometry);
        return { warnings: fin.warnings, droppedNames };
      }
      let restPlan: TourPlan | null = null;
      if (firstStop.departureMin < ctx.endMin) {
        restPlan = await planTour(aiInput(
          ctx,
          pending.map((s) => s.candidate),
          new Set(pending.map((s) => s.candidate.key)), // tutte: il ricalcolo non rimuove tappe
          { lat: cand.lat, lng: cand.lng, label: cand.name },
          firstStop.departureMin,
        ));
      }
      if (!restPlan || restPlan.stops.length < pending.length) {
        // Tempo insufficiente per riottimizzare: ordine fisso, nessuna tappa rimossa
        const ordered = [newRef, ...pending];
        const fb = await planFixedOrder(ordered.map((s) => s.candidate), baseFor(ctx, ordered, ctx.endPoint));
        await persistSequence(ctx, fb.stops, new Map(ordered.map((s) => [s.candidate.key, s] as [string, LiveStopRef])), fb.geometry);
        warnings.push(...fb.warnings);
        return { warnings, droppedNames };
      }
      const byKey = new Map<string, LiveStopRef>([
        [cand.key, newRef],
        ...pending.map((s) => [s.candidate.key, s] as [string, LiveStopRef]),
      ]);
      const merged: PlannedStop[] = [{ ...firstStop, sequence: 1 }, ...restPlan.stops];
      await persistSequence(ctx, merged, byKey, [...first.geometry, ...restPlan.geometry]);
      warnings.push(...restPlan.warnings);
      return { warnings, droppedNames };
    }

    if (placement.mode === 'after') {
      const idx = pending.findIndex((s) => s.id === placement.afterStopId);
      const ordered = [...pending];
      // Guardia: se la tappa di riferimento non c'è più, inserisci in coda
      ordered.splice(idx >= 0 ? idx + 1 : ordered.length, 0, newRef);
      const plan = await planFixedOrder(ordered.map((s) => s.candidate), baseFor(ctx, ordered, ctx.endPoint));
      await persistSequence(ctx, plan.stops, new Map(ordered.map((s) => [s.candidate.key, s] as [string, LiveStopRef])), plan.geometry);
      return { warnings: plan.warnings, droppedNames };
    }

    // 'slot': l'AI posiziona la tappa nel giro rispettando la fascia oraria scelta
    const mandatoryKeys = new Set([...pending.map((s) => s.candidate.key), cand.key]); // tutte: mai rimozioni
    const plan = await planTour(aiInput(
      ctx,
      [...pending.map((s) => s.candidate), cand],
      mandatoryKeys,
      { lat: ctx.startPos.lat, lng: ctx.startPos.lng, label: 'Posizione attuale' },
      ctx.startMin,
    ));
    if (plan.stops.length < pending.length + 1 || !plan.stops.some((p) => p.candidate.key === cand.key)) {
      // Guardia: non azzerare nulla — ordine fisso con la nuova tappa in coda
      const ordered = [...pending, newRef];
      const fb = await planFixedOrder(ordered.map((s) => s.candidate), baseFor(ctx, ordered, ctx.endPoint));
      await persistSequence(ctx, fb.stops, new Map(ordered.map((s) => [s.candidate.key, s] as [string, LiveStopRef])), fb.geometry);
      warnings.push('Tempo insufficiente per posizionare la tappa nella fascia scelta: aggiunta in coda al giro', ...fb.warnings);
      return { warnings, droppedNames };
    }
    const byKey = new Map<string, LiveStopRef>([
      [cand.key, newRef],
      ...pending.map((s) => [s.candidate.key, s] as [string, LiveStopRef]),
    ]);
    await persistSequence(ctx, plan.stops, byKey, plan.geometry);
    warnings.push(...plan.warnings);
    return { warnings, droppedNames };
  } catch (err) {
    console.error('[AITour][liveops] replan dopo inserimento:', err);
    warnings.push('Tappa aggiunta in coda al giro: ricalcolo del percorso non riuscito');
    return { warnings, droppedNames };
  }
}

// Riordino manuale: percorso e orari ricalcolati mantenendo ESATTAMENTE l'ordine scelto
export async function reorderLiveStops(ctx: ReplanContext, ordered: LiveStopRef[]): Promise<LiveOpResult> {
  const candidates = ordered.map((s) => restoreBriefCandidate(s.candidate, ctx.tour));
  const plan = await planFixedOrder(candidates, baseFor(ctx, ordered, ctx.endPoint));
  assertCompleteReplan(plan, candidates);
  protectLivePlan(plan, ctx.tour, candidates);
  await persistSequence(ctx, plan.stops, new Map(ordered.map((s) => [s.candidate.key, s] as [string, LiveStopRef])), plan.geometry);
  await logTourEvent(ctx.tour.id, 'manual_reorder', null, { stops: ordered.length });
  return { warnings: plan.warnings, droppedNames: [] };
}

// Regole d'area del giro originale: le nuove visite di "Più Visite" restano
// nell'area scelta alla creazione (zone/provincia/comune/raggio). Per i giri
// salvati senza area_filter: fallback sulle zone disegnate dell'agente che
// contengono le tappe del giro.
type AreaCheck = (c: { lat: number; lng: number; province?: string; city?: string }) => boolean;

export async function areaCheckForTour(tour: SavedTour, pending: Pick<LiveStopRef, 'candidate'>[]): Promise<AreaCheck> {
  const af = tour.area_filter || null;
  if (af?.briefJourney || af?.briefAreas?.length) {
    const journey = af.briefJourney;
    const minStage = journey && pending.length ? Math.min(...pending.map((s) => nearestJourneyStage(s.candidate, journey))) : journey ? journey.stages.length - 1 : 0;
    return (c) => inBriefArea({ ...c, city: c.city || '', province: c.province || '' }, af.briefAreas || [], journey) && (!journey || nearestJourneyStage(c, journey) >= minStage);
  }
  try {
    if (af?.mode === 'draw' && (af.drawnRings || []).length > 0) {
      const zones = ringsToSyntheticZones(af.drawnRings!);
      if (zones.length > 0) return (c) => pointInZones(c.lat, c.lng, zones);
      return () => false;
    }
    if (af?.mode === 'territory' && (af.zoneIds || []).length > 0) {
      const zones = (await listAllZones()).filter((z) => af.zoneIds!.includes(z.id));
      if (zones.length > 0) return (c) => pointInZones(c.lat, c.lng, zones);
      return () => false;
    }
    if (af?.mode === 'province' && af.province) {
      const p = af.province.trim().toUpperCase();
      return (c) => (c.province || '').trim().toUpperCase() === p;
    }
    if (af?.mode === 'city' && af.city) {
      const cty = af.city.trim().toLowerCase();
      return (c) => (c.city || '').trim().toLowerCase() === cty;
    }
    if (af?.mode === 'radius' && af.radiusKm && tour.start_lat != null) {
      const slat = tour.start_lat;
      const slng = tour.start_lng as number;
      const r = af.radiusKm;
      return (c) => haversineKm(slat, slng, c.lat, c.lng) <= r;
    }
    if (!af) {
      const zones = (await listAllZones()).filter((z) => z.agent_id === tour.agent_id);
      if (zones.length > 0) {
        // Zone dedotte dalle tappe ORIGINALI del giro (non da quelle aggiunte live)
        const { data } = await supabase
          .from('ai_tour_stops')
          .select('latitude, longitude')
          .eq('tour_id', tour.id)
          .eq('added_live', false);
        const pts = (data || [])
          .map((r) => ({ lat: Number(r.latitude), lng: Number(r.longitude) }))
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
        const refPts = pts.length > 0 ? pts : pending.map((s) => ({ lat: s.candidate.lat, lng: s.candidate.lng }));
        const active = zones.filter((z) => refPts.some((p) => pointInZones(p.lat, p.lng, [z])));
        if (active.length > 0) return (c) => pointInZones(c.lat, c.lng, active);
      }
    }
  } catch (err) {
    console.warn('[AITour][liveops] filtro area estensione:', err);
    return () => false;
  }
  return () => true; // mode 'auto' o nessuna zona: comanda la vicinanza al percorso
}

export interface ExtendVisitsResult extends LiveOpResult {
  addedNames: string[];
  /** Fine stimata del giro dopo l'estensione (min dalla mezzanotte) */
  finishMin?: number;
}

// Raggio massimo dei nuovi candidati dal percorso rimanente (posizione attuale + tappe da fare)
const EXTEND_NEAR_KM = 10;

// "Più Visite": l'AI aggiunge visite fino all'orario di fine giro (ctx.endMin, eventualmente
// posticipato) mantenendo TUTTE le tappe esistenti (trattate come obbligatorie nel replan).
// Le finestre orarie (ripassi con ora, tappe con fascia) restano rispettate dal planner.
// Candidati: stessi criteri del planner originale, ma solo vicini al percorso rimanente e in area.
export async function extendTourVisits(
  ctx: ReplanContext,
  pending: LiveStopRef[],
  excludeCustomerIds: Set<string>,
  excludeTabIds: Set<string>,
): Promise<ExtendVisitsResult> {
  const agentId = ctx.tour.agent_id;
  const resolved = (ctx.tour.resolved_tour_type || 'mista') as Exclude<DayType, 'ai'>;

  const pool = await loadCandidates(agentId, ctx.settings);
  scoreCandidates([...pool.clients, ...pool.prospects, ...pool.orphans], ctx.settings);
  let candidates = candidatesForDayType(pool, resolved);

  const refs = [{ lat: ctx.startPos.lat, lng: ctx.startPos.lng }, ...pending.map((s) => ({ lat: s.candidate.lat, lng: s.candidate.lng }))];
  const nearRoute = (lat: number, lng: number) => refs.some((r) => haversineKm(r.lat, r.lng, lat, lng) <= EXTEND_NEAR_KM);
  const inArea = await areaCheckForTour(ctx.tour, pending);
  const tourDow = isoWeekday(ctx.tour.tour_date);
  candidates = candidates.filter((c) =>
    !isRecentlyServed(c, RECENT_CONTACT_DAYS, ctx.tour.tour_date) &&
    !(c.customerId && excludeCustomerIds.has(c.customerId)) &&
    !(c.tabaccheriaId && excludeTabIds.has(c.tabaccheriaId)) &&
    !(Array.isArray(c.excludedDays) && c.excludedDays.includes(tourDow)) &&
    inArea(c) &&
    nearRoute(c.lat, c.lng)
  );

  // Sviluppo/mista: anche tabaccherie libere / mai visitate vicine al percorso
  if (resolved === 'sviluppo' || resolved === 'mista') {
    let minLat = refs[0].lat, maxLat = refs[0].lat, minLng = refs[0].lng, maxLng = refs[0].lng;
    for (const r of refs) {
      minLat = Math.min(minLat, r.lat); maxLat = Math.max(maxLat, r.lat);
      minLng = Math.min(minLng, r.lng); maxLng = Math.max(maxLng, r.lng);
    }
    const pad = 0.1; // ~10 km
    const exclude = new Set([...excludeTabIds, ...candidates.map((c) => c.tabaccheriaId).filter((x): x is string => !!x)]);
    try {
      const free = await loadFreeTabaccherie(
        { minLat: minLat - pad, maxLat: maxLat + pad, minLng: minLng - pad, maxLng: maxLng + pad },
        exclude,
        ctx.settings,
        { refLat: ctx.startPos.lat, refLng: ctx.startPos.lng, agentId },
        30,
      );
      const freeNear = free.filter((c) => inArea(c) && nearRoute(c.lat, c.lng));
      scoreCandidates(freeNear, ctx.settings);
      candidates = [...candidates, ...freeNear];
    } catch (err) {
      console.warn('[AITour][liveops] tabaccherie libere per estensione:', err);
    }
  }

  if (candidates.length === 0) {
    return { warnings: ['Nessun cliente disponibile vicino al percorso rimanente'], droppedNames: [], addedNames: [] };
  }

  const pendingKeys = new Set(pending.map((s) => s.candidate.key));
  const plan = await planTour(aiInput(
    ctx,
    [...pending.map((s) => s.candidate), ...candidates],
    pendingKeys, // tutte le tappe esistenti sono impegni: mai scartate
    { lat: ctx.startPos.lat, lng: ctx.startPos.lng, label: 'Posizione attuale' },
    ctx.startMin,
  ));
  const newStops = plan.stops.filter((p) => !pendingKeys.has(p.candidate.key));
  assertCompleteReplan(plan, pending.map((s) => s.candidate));
  protectLivePlan(plan, ctx.tour, pending.map((s) => s.candidate));
  if (newStops.length === 0) {
    return { warnings: [`Non c'è spazio per altre visite entro le ${minToTime(ctx.endMin)}: il giro resta invariato`], droppedNames: [], addedNames: [] };
  }

  const byKey = new Map<string, LiveStopRef>(pending.map((s) => [s.candidate.key, s]));
  let seq = (ctx.seqBase || 0) + pending.length;
  for (const p of newStops) {
    const id = await addLiveStop(ctx.tour, p.candidate, ++seq, { placement: 'extend' });
    byKey.set(p.candidate.key, { id, candidate: p.candidate, mandatory: false });
  }
  await persistSequence(ctx, plan.stops, byKey, plan.geometry);
  const addedNames = newStops.map((p) => p.candidate.name);
  await logTourEvent(ctx.tour.id, 'visits_extended', null, {
    added: newStops.length, names: addedNames, end_time: minToTime(ctx.endMin),
  });
  return { warnings: plan.warnings, droppedNames: [], addedNames, finishMin: plan.finishMin };
}
