import React from 'react';
import { Text, View } from 'react-native';
import type { DayView } from '../../../lib/aitour/orchestrator/contract';
import { styles as s } from './styles';
/** Web preview is not proof of native maps. Expo resolves .native.tsx on Android and iOS. */
export default function ServerRouteMap({ day }: { day: DayView }) {
  return <View testID="orchestrator-map-preview-limitation" style={s.notice}>
    <Text style={s.text}>Mappa nativa Android / iPhone</Text>
    <Text testID="orchestrator-map-point-count" style={s.muted}>{day.stops.length} tappe · {day.geometry.length} punti della geometria ricevuta. Questa anteprima web non verifica la mappa nativa.</Text>
  </View>;
}