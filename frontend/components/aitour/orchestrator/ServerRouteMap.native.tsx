import React, { useRef } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { DayView } from '../../../lib/aitour/orchestrator/contract';
import { DS } from '../../../lib/theme';
import { styles as s } from './styles';
/** Presentation only: no CRM dots, GPS watcher, OSRM, routing, sorting or geometry reconstruction. */
export default function ServerRouteMap({ day }: { day: DayView }) {
  const ref = useRef<MapView>(null);
  const points = [day.start.coordinate, ...day.stops.map(stop => stop.coordinate), ...(day.end ? [day.end.coordinate] : []), ...day.geometry];
  return <MapView key={day.id} testID="orchestrator-native-map" ref={ref} style={s.map}
    initialRegion={{ ...day.start.coordinate, latitudeDelta: 0.1, longitudeDelta: 0.1 }}
    onMapReady={() => ref.current?.fitToCoordinates(points, { edgePadding: { top: 35, bottom: 35, left: 35, right: 35 }, animated: false })}>
    <Marker testID="orchestrator-map-start" coordinate={day.start.coordinate} title="Partenza" description={day.start.label} pinColor={DS.inkMuted} />
    {day.geometry.length > 1 && <Polyline testID="orchestrator-server-route" coordinates={day.geometry} strokeColor={DS.brand} strokeWidth={4} />}
    {day.stops.map(stop => <Marker testID={`orchestrator-map-stop-${stop.id}`} key={stop.id} coordinate={stop.coordinate}
      title={`${stop.sequence}. ${stop.name}`} description={`${stop.arrival} → ${stop.departure}`} pinColor={DS.brand}>
      <View style={s.sequence}><Text testID={`orchestrator-map-number-${stop.id}`} style={s.text}>{stop.sequence}</Text></View>
    </Marker>)}
    {day.end && <Marker testID="orchestrator-map-return" coordinate={day.end.coordinate} title="Rientro" description={day.end.label} pinColor={DS.inkMuted} />}
  </MapView>;
}