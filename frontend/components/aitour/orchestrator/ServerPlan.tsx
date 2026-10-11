import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { Command, PlanView } from '../../../lib/aitour/orchestrator/contract';
import ServerRouteMap from './ServerRouteMap';
import { OButton, ServerOptions } from './controls';
import { styles as s } from './styles';
/** No local planner or inferred dates/durations. Array and sequence order are the server's. */
export function ServerPlan({ plan, disabled, act }: { plan: PlanView; disabled: boolean; act: (c: Command) => void }) {
  const [dayId, setDayId] = useState(plan.days[0]?.id);
  const day = plan.days.find(d => d.id === dayId) ?? plan.days[0];
  if (!day) return null;
  return <View testID="orchestrator-ready-plan" style={s.card}>
    <Text testID="orchestrator-plan-title" style={s.heading}>Itinerario del motore centrale</Text>
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
      {stop.mandatory && <Text testID={`orchestrator-mandatory-${stop.id}`} style={s.text}>Impegno obbligatorio</Text>}
      {!!stop.reason && <Text testID={`orchestrator-reason-${stop.id}`} style={s.muted}>{stop.reason}</Text>}
      {!!stop.options?.length && <ServerOptions id={`orchestrator-stop-action-${stop.id}`} options={stop.options} disabled={disabled} act={act} />}
    </View>)}
    {day.breaks.map((text, index) => <Text testID={`orchestrator-break-${index}`} key={`break-${index}`} style={s.text}>{text}</Text>)}
    {day.commitments.map((text, index) => <Text testID={`orchestrator-commitment-${index}`} key={`commitment-${index}`} style={s.text}>{text}</Text>)}
    {day.end && <Text testID="orchestrator-day-return" style={s.text}>Rientro · {day.end.label}</Text>}
    {!!day.overnight && <Text testID="orchestrator-overnight" style={s.text}>{day.overnight}</Text>}
    {[...plan.warnings, ...day.warnings].map((text, index) => <Text testID={`orchestrator-plan-warning-${index}`} key={`warning-${index}`} style={s.muted}>{text}</Text>)}
  </View>;
}