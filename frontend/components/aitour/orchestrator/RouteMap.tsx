import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DayView } from '../../../lib/aitour/orchestrator/contract';
import { DS } from '../../../lib/theme';
import { GptButton, GptIcon, GptNotice, ui } from '../gptour/UI';
import MapSurface from './MapSurface';
import { routeMapDocument } from './route-map-document';

export interface RouteMapProps { day: DayView; selectedId?: string; onStopSelect?: (id: string) => void }

function MapCanvas({ day, selectedId, onStopSelect, full = false }: RouteMapProps & { full?: boolean }) {
  const html = useMemo(() => routeMapDocument(day), [day]);
  const [attempt, setAttempt] = useState(0), [ready, setReady] = useState(false);
  const [error, setError] = useState<'render' | 'tiles' | null>(null);
  const prefix = full ? 'orchestrator-full-map' : 'orchestrator-map';
  const fail = useCallback(() => setError('render'), []);
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(fail, 15000);
    return () => clearTimeout(timer);
  }, [ready, attempt, fail]);
  const receive = (raw: string) => {
    try {
      const m = JSON.parse(raw);
      if (m.type === 'ready') { setReady(true); setError(value => value === 'render' ? null : value); }
      else if (m.type === 'tile-error') setError('tiles');
      else if (m.type === 'render-error') fail();
      else if (m.type === 'stop-select' && day.stops.some(s => s.id === m.id)) onStopSelect?.(m.id);
    } catch { /* Ignore unrelated/malformed bridge messages; never execute a command. */ }
  };
  return <View testID={`${prefix}-canvas-container`} style={mapStyles.canvas}>
    <MapSurface key={attempt} id={`${prefix}-surface`} html={html} selectedId={selectedId} onMessage={receive} onFailure={fail} />
    {!ready && !error && <View testID={`${prefix}-loading`} style={mapStyles.status} pointerEvents="none">
      <ActivityIndicator color={DS.brand} /><Text style={ui.muted}>Caricamento mappa…</Text>
    </View>}
    {!!error && <View testID={`${prefix}-error`} accessibilityRole="alert" style={mapStyles.status}>
      <Text testID={`${prefix}-error-text`} style={ui.small}>{error === 'tiles' ? 'Sfondo cartografico non disponibile. Verifica la connessione; tappe e geometria restano quelle del server.' : 'La mappa non si è caricata. Verifica la connessione e riprova.'}</Text>
      <GptButton id={`${prefix}-retry`} label="Ricarica mappa" onPress={() => { setReady(false); setError(null); setAttempt(n => n + 1); }} />
    </View>}
    {ready && !error && <Text testID={`${prefix}-ready`} style={mapStyles.ready}>Mappa del giro</Text>}
  </View>;
}

export default function RouteMap(props: RouteMapProps) {
  const [full, setFull] = useState(false);
  const missing = props.day.geometry.length < 2 || props.day.geometryKind === 'connections' || props.day.geometryKind === 'missing';
  const select = (id: string) => { setFull(false); props.onStopSelect?.(id); };
  return <View testID="orchestrator-route-map" style={mapStyles.root}>
    <View testID="orchestrator-map-frame" style={mapStyles.frame}>
      {!full && <MapCanvas {...props} onStopSelect={select} />}
      <View style={mapStyles.expand}><GptButton id="orchestrator-map-expand" label="Schermo intero" icon="expand" onPress={() => setFull(true)} /></View>
    </View>
    {missing && <GptNotice id="orchestrator-map-no-geometry" text="Geometria stradale non fornita dal server: mostro solo le tappe, la partenza e il rientro, senza inventare un percorso." />}
    <Modal testID="orchestrator-map-fullscreen" visible={full} animationType="fade" onRequestClose={() => setFull(false)}>
      <SafeAreaView style={mapStyles.full}>
        <View style={mapStyles.toolbar}><Text testID="orchestrator-full-map-title" style={[ui.heading, ui.flex]}>{props.day.title} · {props.day.date}</Text>
          <GptIcon id="orchestrator-map-reduce" label="Riduci la mappa" icon="contract" onPress={() => setFull(false)} /></View>
        {full && <MapCanvas {...props} full onStopSelect={select} />}
        {missing && <Text testID="orchestrator-full-map-no-geometry" style={mapStyles.caption}>Geometria stradale assente: solo posizioni delle tappe.</Text>}
      </SafeAreaView>
    </Modal>
  </View>;
}
const mapStyles = StyleSheet.create({
  root: { gap: 8 }, frame: { height: 220, width: '100%', overflow: 'hidden', backgroundColor: DS.surface2 },
  canvas: { flex: 1, position: 'relative', minHeight: 180, width: '100%' },
  full: { flex: 1, backgroundColor: DS.surface }, toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, gap: 10 },
  expand: { position: 'absolute', right: 10, top: 10 },
  status: { position: 'absolute', bottom: 26, left: 10, right: 10, borderRadius: 12, padding: 10, gap: 8, backgroundColor: DS.surface, borderWidth: 1, borderColor: DS.border },
  ready: { position: 'absolute', bottom: 25, left: 8, color: DS.ink, backgroundColor: DS.surface, padding: 4, borderRadius: 4, fontSize: 10 },
  caption: { color: DS.inkMuted, padding: 12, fontSize: 13 },
});