// Operazioni live sul giro (parità web src/lib/aitour/liveops.ts):
// inserimento tappa a giro avviato (ORA / fascia oraria / dopo tappa X) e riordino manuale.
import { supabase } from '../supabase';
import type { TourCandidate, GeoPoint, AiTourSettings, TourPlan, PlannedStop, DayType } from './types';
import { minToTime } from './types';
import type { SavedTour } from './tours';
import { addLiveStop, updateLiveSequence, cancelStopByRecalc, logTourEvent, isRevisitCandidate } from './live';
import { planFixedOrder, planTour } from './planner';
import type { VisitSlot } from '../visit-slots';

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
    candidate: s.candidate, sequence: i + 1, arrivalMin: 0, departureMin: 0,
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
  } as unknown as TourPlan;
}

async function persistSequence(
  ctx: ReplanContext,
  planned: PlannedStop[],
  byKey: Map<string, LiveStopRef>,
  geometry: [number, number][],
): Promise<void> {
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
    candidates,
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
  };
}

export interface InsertOpts {
  mandatory: boolean;
  byAdmin?: boolean;
  adminName?: string;
}

// Inserisce una tappa a giro avviato e ripianifica secondo il posizionamento scelto.
// La nuova tappa non viene MAI scartata; in caso di errore di ricalcolo resta in coda.
export async function insertLiveStop(
  ctx: ReplanContext,
  pending: LiveStopRef[],
  cand: TourCandidate,
  placement: PlacementChoice,
  opts: InsertOpts,
): Promise<LiveOpResult> {
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
          new Set(pending.filter((s) => s.mandatory).map((s) => s.candidate.key)),
          { lat: cand.lat, lng: cand.lng, label: cand.name },
          firstStop.departureMin,
        ));
      }
      if (!restPlan || restPlan.stops.length === 0) {
        // Tempo insufficiente per riottimizzare: ordine fisso, nessuna tappa rimossa
        const ordered = [newRef, ...pending];
        const fb = await planFixedOrder(ordered.map((s) => s.candidate), baseFor(ctx, ordered, ctx.endPoint));
        await persistSequence(ctx, fb.stops, new Map(ordered.map((s) => [s.candidate.key, s] as [string, LiveStopRef])), fb.geometry);
        warnings.push(...fb.warnings);
        return { warnings, droppedNames };
      }
      const keptKeys = new Set(restPlan.stops.map((p) => p.candidate.key));
      for (const d of pending.filter((s) => !keptKeys.has(s.candidate.key) && !isRevisitCandidate(s.candidate))) {
        await cancelStopByRecalc(ctx.tour.id, d.id);
        droppedNames.push(d.candidate.name);
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
    const mandatoryKeys = new Set([...pending.filter((s) => s.mandatory).map((s) => s.candidate.key), cand.key]);
    const plan = await planTour(aiInput(
      ctx,
      [...pending.map((s) => s.candidate), cand],
      mandatoryKeys,
      { lat: ctx.startPos.lat, lng: ctx.startPos.lng, label: 'Posizione attuale' },
      ctx.startMin,
    ));
    if (plan.stops.length === 0 || !plan.stops.some((p) => p.candidate.key === cand.key)) {
      // Guardia: non azzerare nulla — ordine fisso con la nuova tappa in coda
      const ordered = [...pending, newRef];
      const fb = await planFixedOrder(ordered.map((s) => s.candidate), baseFor(ctx, ordered, ctx.endPoint));
      await persistSequence(ctx, fb.stops, new Map(ordered.map((s) => [s.candidate.key, s] as [string, LiveStopRef])), fb.geometry);
      warnings.push('Tempo insufficiente per posizionare la tappa nella fascia scelta: aggiunta in coda al giro', ...fb.warnings);
      return { warnings, droppedNames };
    }
    const keptKeys = new Set(plan.stops.map((p) => p.candidate.key));
    for (const d of pending.filter((s) => !keptKeys.has(s.candidate.key) && !isRevisitCandidate(s.candidate))) {
      await cancelStopByRecalc(ctx.tour.id, d.id);
      droppedNames.push(d.candidate.name);
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
  const plan = await planFixedOrder(ordered.map((s) => s.candidate), baseFor(ctx, ordered, ctx.endPoint));
  await persistSequence(ctx, plan.stops, new Map(ordered.map((s) => [s.candidate.key, s] as [string, LiveStopRef])), plan.geometry);
  await logTourEvent(ctx.tour.id, 'manual_reorder', null, { stops: ordered.length });
  return { warnings: plan.warnings, droppedNames: [] };
}
