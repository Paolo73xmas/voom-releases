import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { DayView, PlanView } from '../../../lib/aitour/orchestrator/contract';
import { GptButton, ui } from '../gptour/UI';
import { planStyles as p } from './plan-styles';

export function ServerPlanSummary({ day, plan }: { day: DayView; plan: PlanView }) {
  const [expanded, setExpanded] = useState(false);
  const metric = (id: string) => day.metrics.find(m => m.id === id)?.value;
  return <View testID="orchestrator-plan-summary" style={p.summary}>
    <Text testID="orchestrator-plan-metrics" style={ui.heading}>{day.stops.length} tappe{metric('distance') ? ` · ${metric('distance')}` : ''}</Text>
    <Text testID="orchestrator-day-start" style={ui.small}>Partenza · {day.start.label}</Text>
    {day.end && <Text testID="orchestrator-day-return" style={ui.small}>Rientro · {day.end.label}</Text>}
    <Text testID="orchestrator-plan-times" style={ui.muted}>{[['drive', 'Guida'], ['visit', 'Visite'], ['buffer', 'Margine']].filter(([id]) => metric(id)).map(([id, label]) => `${label} ${metric(id)}`).join(' · ')}</Text>
    {!!day.overnight && <Text testID="orchestrator-overnight" style={ui.muted}>{day.overnight}</Text>}
    <GptButton id="orchestrator-toggle-metrics" label={expanded ? 'Nascondi riepilogo completo' : 'Riepilogo completo'} icon={expanded ? 'chevron-up' : 'chevron-down'} onPress={() => setExpanded(v => !v)} />
    {expanded && <View testID="orchestrator-full-summary" style={p.root}>
      {day.metrics.map(m => <View key={m.id} testID={`orchestrator-metric-${m.id}`} style={p.metricRow}>
        <Text style={[ui.muted, ui.flex]}>{m.label}</Text><Text style={ui.small}>{m.value}</Text>
      </View>)}
      {!!plan.metadata && <Text testID="orchestrator-plan-metadata" style={ui.muted}>{plan.metadata}</Text>}
    </View>}
  </View>;
}