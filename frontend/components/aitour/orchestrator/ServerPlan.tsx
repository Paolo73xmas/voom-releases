import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Command, PlanView } from '../../../lib/aitour/orchestrator/contract';
import { GptButton, GptIcon, GptNotice, ui } from '../gptour/UI';
import ServerRouteMap from './ServerRouteMap';
import { ServerStopList } from './ServerStopList';
import { ServerStopDetail } from './ServerStopDetail';
import { ServerPlanSummary } from './ServerPlanSummary';
import { planStyles as p } from './plan-styles';

/** Presentation only. Day order, stop order, metrics, times and actions remain server authoritative. */
export function ServerPlan({ plan, disabled, act, confirmable = false, selectedDayId, onDayChange }: {
  plan: PlanView; disabled: boolean; act: (c: Command) => void; confirmable?: boolean;
  selectedDayId?: string; onDayChange?: (id: string) => void;
}) {
  const [dayId, setDayId] = useState(plan.days[0]?.id), [map, setMap] = useState(true);
  const [selectedId, setSelectedId] = useState<string>(), [detailId, setDetailId] = useState<string>();
  const [excludedOpen, setExcludedOpen] = useState(false), [confirmed, setConfirmed] = useState(false);
  const day = plan.days.find(d => d.id === (selectedDayId ?? dayId)) ?? plan.days[0];
  if (!day) return null;
  const selected = day.stops.find(stop => stop.id === selectedId);
  return <View testID={confirmable ? 'orchestrator-ready-plan' : 'orchestrator-draft-plan'} style={p.root}>
    <View style={ui.row}><Text testID="orchestrator-plan-title" style={[ui.heading, ui.flex]}>Giro proposto{plan.days.length > 1 ? ` · ${plan.days.length} giornate` : ''}</Text>
      <GptIcon id="orchestrator-toggle-map" icon={map ? 'map' : 'map-outline'} label={map ? 'Nascondi mappa' : 'Mostra mappa'} onPress={() => setMap(v => !v)} /></View>
    {plan.routing === 'verified' ? <Text testID="orchestrator-routing-verified" style={ui.muted}>Percorso verificato dal server (OSRM)</Text>
      : <GptNotice id="orchestrator-routing-warning" text={`Routing ${plan.routing === 'estimated' ? 'stimato' : 'non verificato'}: distanze e tempi non sono confermati come percorso stradale.`} />}
    {plan.days.length > 1 && <View style={ui.wrap}>{plan.days.map(d => <Pressable key={d.id} testID={`orchestrator-day-${d.id}`} accessibilityRole="button"
      accessibilityState={{ selected: day.id === d.id }} onPress={() => { setDayId(d.id); onDayChange?.(d.id); setSelectedId(undefined); setDetailId(undefined); }}
      style={({ pressed }) => [ui.chip, p.day, day.id === d.id && p.selectedDay, pressed && p.pressed]}>
      <Text style={[ui.chipText, day.id === d.id && p.selectedDayText]}>{d.title} · {d.date.slice(8, 10)}/{d.date.slice(5, 7)}</Text>
    </Pressable>)}</View>}
    <Text testID="orchestrator-day-date" style={ui.muted}>{day.date}</Text>
    <View style={[ui.card, p.flushCard]}>
      {map && <ServerRouteMap key={`map-${day.id}`} day={day} selectedId={selected?.id} onStopSelect={setSelectedId} />}
      {selected && <View testID="orchestrator-selected-stop" style={p.selection}>
        <Text testID="orchestrator-selected-stop-name" style={[ui.small, ui.flex]} numberOfLines={2}>Tappa {selected.sequence} · {selected.name}</Text>
        <GptIcon id="orchestrator-selected-stop-detail" icon="information-circle-outline" label="Apri dettaglio tappa selezionata" onPress={() => setDetailId(selected.id)} />
      </View>}
      <ServerPlanSummary key={`summary-${day.id}`} day={day} plan={plan} />
    </View>
    <ServerStopList stops={day.stops} selectedId={selected?.id} onSelect={stop => { setSelectedId(stop.id); setDetailId(stop.id); }} />
    <ServerStopDetail stop={day.stops.find(stop => stop.id === detailId) ?? null} disabled={disabled} close={() => setDetailId(undefined)} act={act} />
    {day.breaks.map((text, i) => <Text testID={`orchestrator-break-${i}`} key={`break-${i}`} style={ui.small}>{text}</Text>)}
    {day.commitments.map((text, i) => <Text testID={`orchestrator-commitment-${i}`} key={`commitment-${i}`} style={ui.small}>{text}</Text>)}
    {[...plan.warnings, ...day.warnings].map((text, i) => <GptNotice key={i} id={`orchestrator-plan-warning-${i}`} text={text} />)}
    {!!plan.excluded?.length && <GptButton id="orchestrator-toggle-excluded" label={`${excludedOpen ? 'Nascondi' : 'Mostra'} esclusi (${plan.excluded.length})`} onPress={() => setExcludedOpen(v => !v)} />}
    {excludedOpen && plan.excluded?.map((e, i) => <Text testID={`orchestrator-excluded-${i}`} key={`${e.key}-${i}`} style={ui.muted}>{e.name} · {e.reason}</Text>)}
    {confirmable && <GptButton id="orchestrator-confirm-plan" label={confirmed ? 'Piano confermato localmente' : 'Conferma piano (solo locale)'} disabled={disabled || confirmed} onPress={() => setConfirmed(true)} primary />}
    {confirmed && <Text testID="orchestrator-confirmation-notice" style={ui.small}>Conferma su questa schermata: nessun tour salvato e nessun dato CRM modificato.</Text>}
  </View>;
}