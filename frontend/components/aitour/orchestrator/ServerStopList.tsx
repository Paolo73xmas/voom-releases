import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StopView } from '../../../lib/aitour/orchestrator/contract';
import { DS } from '../../../lib/theme';
import { ui } from '../gptour/UI';
import { planStyles as p } from './plan-styles';
import { stopColor, stopKind } from './stop-presentation';

export function ServerStopList({ stops, selectedId, onSelect }: { stops: StopView[]; selectedId?: string; onSelect: (stop: StopView) => void }) {
  return <View testID="orchestrator-stop-list" style={[ui.card, p.list]}>
    {stops.map((stop, i) => <Pressable key={stop.id} testID={`orchestrator-stop-${stop.id}`} accessibilityRole="button"
      accessibilityLabel={`${stop.sequence}. ${stop.name}, ${stop.city || ''}, ${stop.arrival}–${stop.departure}. Apri dettagli`}
      accessibilityState={{ selected: selectedId === stop.id }} onPress={() => onSelect(stop)}
      style={({ pressed }) => [p.row, i > 0 && p.separator, selectedId === stop.id && p.selected, pressed && p.pressed]}>
      <View style={[p.sequence, { backgroundColor: stopColor(stop) }]}><Text testID={`orchestrator-stop-number-${stop.id}`} style={p.number}>{stop.sequence}</Text></View>
      <View style={p.stopContent}>
        <Text testID={`orchestrator-stop-name-${stop.id}`} numberOfLines={1} style={p.name}>{stop.name}</Text>
        <Text testID={`orchestrator-stop-city-${stop.id}`} style={ui.muted} numberOfLines={1}>{stop.city || 'Località non fornita'}</Text>
        <Text testID={`orchestrator-stop-time-${stop.id}`} style={ui.muted} numberOfLines={2}>{stop.arrival}–{stop.departure} · {stopKind(stop)}</Text>
        {!!stop.lastOrder && <Text testID={`orchestrator-stop-last-order-${stop.id}`} style={ui.muted} numberOfLines={1}>Ultimo ordine: {stop.lastOrder}</Text>}
      </View>
      {stop.mandatory && <Ionicons testID={`orchestrator-mandatory-${stop.id}`} accessibilityLabel="Tappa obbligatoria" name="lock-closed" size={14} color={DS.warning} />}
      <Ionicons name="chevron-forward" size={16} color={DS.inkMuted} />
    </Pressable>)}
  </View>;
}