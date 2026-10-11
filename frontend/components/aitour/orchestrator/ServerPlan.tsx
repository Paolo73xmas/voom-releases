import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { Command, PlanView } from '../../../lib/aitour/orchestrator/contract';
import ServerRouteMap from './ServerRouteMap';
import { OButton, ServerOptions } from './controls';
import { styles as s } from './styles';
/** No local planner or inferred dates/durations. Array and sequence order are the server's. */
export function ServerPlan({ plan, disabled, act, confirmable = false }: { plan: PlanView; disabled: boolean; act: (c: Command) => void; confirmable?: boolean }) {
  const [dayId, setDayId] = useState(plan.days[0]?.id);
  const [excludedOpen, setExcludedOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const day = plan.days.find(d => d.id === dayId) ?? plan.days[0];
  if (!day) return null;
  return <View testID={confirmable ? 'orchestrator-ready-plan' : 'orchestrator-draft-plan'} style={s.card}>
    <Text testID="orchestrator-plan-title" style={s.heading}>Itinerario del motore centrale</Text>
    {!!plan.metadata && <Text testID="orchestrator-plan-metadata" style={s.muted}>{plan.metadata}</Text>}
    {plan.routing === 'verified' && <Text testID="orchestrator-routing-verified" style={s.text}>Percorso verificato (OSRM)</Text>}
    {plan.routing !== 'verified' && <View testID="orchestrator-routing-warning" style={[s.notice, s.warning]}>
      <Text style={s.text}>Routing {plan.routing === 'estimated' ? 'stimato' : 'non verificato'}: distanze e tempi non sono confermati come percorso stradale.</Text>
    </View>}
    <View style={s.row}>{plan.days.map(d => <OButton key={d.id} id={`orchestrator-day-${d.id}`} label={d.title}
      primary={day.id === d.id} onPress={() => setDayId(d.id)} />)}</View>
    <Text testID="orchestrator-day-date" style={s.heading}>{day.date}</Text>
    <Text testID="orchestrator-day-start" style={s.text}>Partenza · {day.start.label}</Text>
    <ServerRouteMap day={day} />
    <View style={s.row}>{day.metrics.map(m => <View key={m.id} testID={`orchestrator-metric-${m.id}`} style={s.metric}>
      <Text style={s.muted}>{m.label}</Text><Text style={s.text}>{m.value}</Text>
    </View>)}</View>
    {day.stops.map(stop => <View key={stop.id} testID={`orchestrator-stop-${stop.id}`} style={s.stop}>
      <View style={s.divider} /><View style={s.row}><View style={s.sequence}><Text style={s.text}>{stop.sequence}</Text></View>
        <Text testID={`orchestrator-stop-name-${stop.id}`} style={[s.heading, s.flex]}>{stop.name}</Text></View>
      <Text testID={`orchestrator-stop-time-${stop.id}`} style={s.text}>{stop.arrival} → {stop.departure} · visita {stop.visit}</Text>
      <Text testID={`orchestrator-stop-travel-${stop.id}`} style={s.muted}>Trasferimento {stop.travel}{stop.wait ? ` · attesa ${stop.wait}` : ''}</Text>
      <Text testID={`orchestrator-stop-details-${stop.id}`} style={s.muted}>{[stop.city, stop.group === 'new' ? 'Nuovo punto' : stop.group === 'existing' ? 'Cliente esistente' : '', stop.role].filter(Boolean).join(' · ')}</Text>
      {!!stop.lunch && <Text testID={`orchestrator-stop-lunch-${stop.id}`} style={s.text}>Pausa prima della visita: {stop.lunch}</Text>}
      {!!stop.lastOrder && <Text testID={`orchestrator-stop-last-order-${stop.id}`} style={s.text}>Ultimo ordine: {stop.lastOrder}</Text>}
      {stop.outsideWindow && <Text testID={`orchestrator-stop-outside-window-${stop.id}`} style={s.muted}>Fuori dalla finestra oraria: segnalato dal motore.</Text>}
      {stop.mandatory && <Text testID={`orchestrator-mandatory-${stop.id}`} style={s.text}>Impegno obbligatorio</Text>}
      {!!stop.reason && <Text testID={`orchestrator-reason-${stop.id}`} style={s.muted}>{stop.reason}</Text>}
      {!!stop.options?.length && <ServerOptions id={`orchestrator-stop-action-${stop.id}`} options={stop.options} disabled={disabled} act={act} />}
    </View>)}
    {day.breaks.map((text, index) => <Text testID={`orchestrator-break-${index}`} key={`break-${index}`} style={s.text}>{text}</Text>)}
    {day.commitments.map((text, index) => <Text testID={`orchestrator-commitment-${index}`} key={`commitment-${index}`} style={s.text}>{text}</Text>)}
    {day.end && <Text testID="orchestrator-day-return" style={s.text}>Rientro · {day.end.label}</Text>}
    {!!day.overnight && <Text testID="orchestrator-overnight" style={s.text}>{day.overnight}</Text>}
    {[...plan.warnings, ...day.warnings].map((text, index) => <Text testID={`orchestrator-plan-warning-${index}`} key={`warning-${index}`} style={s.muted}>{text}</Text>)}
    {!!plan.excluded?.length && <OButton id="orchestrator-toggle-excluded" label={`${excludedOpen ? 'Nascondi' : 'Mostra'} esclusi (${plan.excluded.length})`} onPress={() => setExcludedOpen(v => !v)} />}
    {excludedOpen && plan.excluded?.map((e, i) => <Text testID={`orchestrator-excluded-${i}`} key={`${e.key}-${i}`} style={s.muted}>{e.name} · {e.reason}</Text>)}
    {confirmable && <OButton id="orchestrator-confirm-plan" label={confirmed ? 'Piano confermato localmente' : 'Conferma piano (solo locale)'} disabled={disabled || confirmed} onPress={() => setConfirmed(true)} primary />}
    {confirmed && <Text testID="orchestrator-confirmation-notice" style={s.text}>Conferma su questa schermata: nessun tour salvato e nessun dato CRM modificato.</Text>}
  </View>;
}