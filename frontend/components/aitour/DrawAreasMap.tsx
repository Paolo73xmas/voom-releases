// Genera Tour "Disegna aree" (parità web DrawAreasMap): mappa Leaflet in WebView/iframe
// con le zone assegnate all'agente, puntini neri dei clienti dentro le zone (intensità
// regolabile), selettore "Solo clienti"/"Tutti i punti vendita" e disegno libero
// (poligono/rettangolo, leaflet-draw in italiano) delle aree del giro.
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Modal } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../lib/theme';
import { tabaccheriePointsInBounds } from '../../lib/api/tabaccherie';
import {
  agentCustomerPoints,
  pointInZones,
  zoneLabel,
  intersectDrawnWithZones,
  type TerritoryZone,
} from '../../lib/aitour/territories';

let WebView: any = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebView = require('react-native-webview').WebView;
}

type Pt = { lat: number; lng: number };

function buildHtml(zones: TerritoryZone[]): string {
  const payload = JSON.stringify(
    zones.map((z) => ({
      id: z.id,
      label: zoneLabel(z),
      color: z.color,
      // anello GeoJSON [lng,lat]
      ring: z.geometry.coordinates[0],
    })),
  );
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css"/>
<script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js"></script>
<style>
  * { margin:0; padding:0; }
  html, body, #map { width:100%; height:100%; }
  .leaflet-draw-toolbar a { background-color:#fff; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var ZONES = ${payload};

  // Localizzazione italiana di leaflet-draw
  L.drawLocal.draw.toolbar.buttons.polygon = "Disegna un'area (poligono)";
  L.drawLocal.draw.toolbar.buttons.rectangle = 'Disegna un rettangolo';
  L.drawLocal.draw.toolbar.actions = { title: 'Annulla il disegno', text: 'Annulla' };
  L.drawLocal.draw.toolbar.finish = { title: 'Concludi il disegno', text: 'Concludi' };
  L.drawLocal.draw.toolbar.undo = { title: 'Elimina ultimo punto', text: 'Elimina ultimo punto' };
  L.drawLocal.draw.handlers.polygon.tooltip = { start: "Tocca la mappa per iniziare l'area", cont: 'Tocca per aggiungere un punto', end: "Tocca il primo punto per chiudere l'area" };
  L.drawLocal.draw.handlers.rectangle.tooltip.start = 'Trascina sulla mappa per disegnare il rettangolo';
  L.drawLocal.draw.handlers.simpleshape.tooltip.end = 'Rilascia per terminare';
  L.drawLocal.edit.toolbar.buttons = { edit: 'Modifica le aree', editDisabled: 'Nessuna area da modificare', remove: 'Elimina aree', removeDisabled: 'Nessuna area da eliminare' };
  L.drawLocal.edit.toolbar.actions.save = { title: 'Salva le modifiche', text: 'Salva' };
  L.drawLocal.edit.toolbar.actions.cancel = { title: 'Annulla le modifiche', text: 'Annulla' };
  L.drawLocal.edit.toolbar.actions.clearAll = { title: 'Elimina tutte le aree', text: 'Elimina tutto' };
  L.drawLocal.edit.handlers.edit.tooltip = { text: 'Trascina i punti per modificare', subtext: 'Tocca Annulla per scartare le modifiche' };
  L.drawLocal.edit.handlers.remove.tooltip = { text: "Tocca un'area per eliminarla" };

  var map = L.map('map', { zoomControl: true, attributionControl: false, preferCanvas: true }).setView([42.5, 12.5], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  function sendMessage(msg) {
    var str = JSON.stringify(msg);
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(str); }
    else if (window.parent && window.parent !== window) { window.parent.postMessage(str, '*'); }
  }

  // Puntini su pane dedicato NON interattivo: i tap passano alle aree disegnate sotto
  var DOTS_PANE = 'customer-dots';
  var pane = map.createPane(DOTS_PANE);
  pane.style.pointerEvents = 'none';
  pane.style.zIndex = '450';
  var dotsRenderer = L.canvas({ padding: 0.2, pane: DOTS_PANE });
  var allGroup = L.layerGroup().addTo(map);
  var clientsGroup = L.layerGroup().addTo(map);
  var clientPts = [], allPts = [];
  var dotsMode = 'clients', dotsOpacity = 0.85;

  function renderGroup(group, pts, color, radius, opacity) {
    group.clearLayers();
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (!p.lat || !p.lng) continue;
      L.circleMarker([p.lat, p.lng], { renderer: dotsRenderer, pane: DOTS_PANE, radius: radius, color: color, fillColor: color, fillOpacity: opacity, opacity: opacity, weight: 0, interactive: false }).addTo(group);
    }
  }
  function renderDots() {
    try {
      renderGroup(clientsGroup, clientPts, '#111827', 3.5, dotsOpacity);
      renderGroup(allGroup, dotsMode === 'all' ? allPts : [], '#64748b', 3, dotsOpacity * 0.8);
    } catch (e) {}
  }
  function applyOpacity() {
    try {
      clientsGroup.eachLayer(function(l) { l.setStyle({ fillOpacity: dotsOpacity, opacity: dotsOpacity }); });
      var o = dotsOpacity * 0.8;
      allGroup.eachLayer(function(l) { l.setStyle({ fillOpacity: o, opacity: o }); });
    } catch (e) {}
  }

  // Zone assegnate (poligoni colorati con tooltip)
  var zonePts = [];
  for (var zi = 0; zi < ZONES.length; zi++) {
    var z = ZONES[zi];
    var latlngs = [];
    for (var pi = 0; pi < z.ring.length; pi++) latlngs.push([z.ring[pi][1], z.ring[pi][0]]);
    zonePts = zonePts.concat(latlngs);
    L.polygon(latlngs, { color: z.color, fillColor: z.color, fillOpacity: 0.12, weight: 2 })
      .bindTooltip(z.label, { sticky: true })
      .addTo(map);
  }

  // Disegno aree (poligono/rettangolo)
  var SHAPE = { color: '#7c3aed', weight: 2, fillOpacity: 0.2 };
  var drawnItems = new L.FeatureGroup().addTo(map);
  var drawControl = new L.Control.Draw({
    position: 'topright',
    draw: {
      circle: false, circlemarker: false, marker: false, polyline: false,
      polygon: { allowIntersection: false, shapeOptions: SHAPE },
      rectangle: { shapeOptions: SHAPE, showArea: false },
    },
    edit: { featureGroup: drawnItems },
  });
  map.addControl(drawControl);

  function collect() {
    var rings = [];
    drawnItems.eachLayer(function(layer) {
      var raw = layer.getLatLngs();
      var ring = Array.isArray(raw[0]) ? raw[0] : raw;
      if (ring.length >= 3) {
        var r = [];
        for (var i = 0; i < ring.length; i++) r.push([ring[i].lng, ring[i].lat]);
        var f = r[0], l = r[r.length - 1];
        if (f[0] !== l[0] || f[1] !== l[1]) r.push([f[0], f[1]]);
        rings.push(r);
      }
    });
    sendMessage({ type: 'ringsChanged', rings: rings });
  }
  map.on(L.Draw.Event.CREATED, function(e) { drawnItems.addLayer(e.layer); collect(); });
  map.on(L.Draw.Event.EDITED, collect);
  map.on(L.Draw.Event.DELETED, collect);

  // Fit sulle zone assegnate
  setTimeout(function() {
    map.invalidateSize();
    if (zonePts.length >= 2) map.fitBounds(L.latLngBounds(zonePts), { padding: [30, 30] });
    sendMessage({ type: 'mapReady' });
  }, 300);
  window.addEventListener('resize', function() { setTimeout(function() { map.invalidateSize(); }, 120); });

  function onMsg(raw) {
    try {
      var msg = JSON.parse(raw);
      if (msg.type === 'setPoints') {
        if (msg.kind === 'clients') clientPts = msg.points || [];
        else allPts = msg.points || [];
        renderDots();
      } else if (msg.type === 'setDotsMode') {
        dotsMode = msg.mode === 'all' ? 'all' : 'clients';
        renderDots();
      } else if (msg.type === 'setDotsOpacity') {
        dotsOpacity = Number(msg.value) || 0.85;
        applyOpacity();
      } else if (msg.type === 'setRings') {
        // Ripristino aree disegnate (es. dopo passaggio inline <-> schermo intero)
        drawnItems.clearLayers();
        var rr = msg.rings || [];
        for (var ri = 0; ri < rr.length; ri++) {
          var lls = [];
          for (var rj = 0; rj < rr[ri].length; rj++) lls.push([rr[ri][rj][1], rr[ri][rj][0]]);
          drawnItems.addLayer(L.polygon(lls, SHAPE));
        }
      }
    } catch (e) {}
  }
  document.addEventListener('message', function(e) { if (typeof e.data === 'string') onMsg(e.data); });
  window.addEventListener('message', function(e) { if (typeof e.data === 'string') onMsg(e.data); });
</script>
</body>
</html>`;
}

interface Props {
  agentId: string;
  zones: TerritoryZone[];
  onRingsChange: (rings: number[][][]) => void;
}

export function DrawAreasMap({ agentId, zones, onRingsChange }: Props) {
  const [points, setPoints] = useState<Pt[]>([]);
  const [allPoints, setAllPoints] = useState<Pt[] | null>(null);
  const [dotsMode, setDotsMode] = useState<'clients' | 'all'>('clients');
  const [loadingAll, setLoadingAll] = useState(false);
  const [dotsOpacity, setDotsOpacity] = useState(0.85);
  const [rings, setRings] = useState<number[][][]>([]);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);
  const ringsRef = useRef<number[][][]>([]);
  const onRingsChangeRef = useRef(onRingsChange);
  onRingsChangeRef.current = onRingsChange;

  const html = useMemo(() => buildHtml(zones), [zones]);

  // Al mount la mappa è vuota: azzera eventuali aree di una sessione di disegno precedente (parità web e26480b)
  useEffect(() => {
    onRingsChangeRef.current([]);
  }, []);

  // Zone cambiate: i punti "Tutti" vanno ricaricati
  useEffect(() => {
    setAllPoints(null);
  }, [zones]);

  const sendToMap = useCallback((msg: object) => {
    const str = JSON.stringify(msg);
    if (Platform.OS === 'web') iframeRef.current?.contentWindow?.postMessage(str, '*');
    else webViewRef.current?.postMessage(str);
  }, []);

  // Clienti dell'agente dentro le zone assegnate
  useEffect(() => {
    let cancelled = false;
    agentCustomerPoints(agentId)
      .then((pts) => {
        if (!cancelled) setPoints(pts.filter((p) => pointInZones(p.lat, p.lng, zones)));
      })
      .catch((err) => console.warn('[AITour][draw] clienti:', err));
    return () => {
      cancelled = true;
    };
  }, [agentId, zones]);

  // "Tutti": tutte le tabaccherie dentro le zone assegnate (caricate al primo utilizzo)
  useEffect(() => {
    if (dotsMode !== 'all' || allPoints !== null) return;
    let cancelled = false;
    setLoadingAll(true);
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const z of zones)
      for (const [lng, lat] of z.geometry.coordinates[0] as [number, number][]) {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      }
    tabaccheriePointsInBounds({ north: maxLat + 0.01, south: minLat - 0.01, east: maxLng + 0.01, west: minLng - 0.01 })
      .then((pts) => {
        if (!cancelled) setAllPoints(pts.filter((p) => pointInZones(p.lat, p.lng, zones)));
      })
      .catch((err) => console.warn('[AITour][draw] tutti i punti:', err))
      .finally(() => {
        if (!cancelled) setLoadingAll(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dotsMode, allPoints, zones]);

  // Push dati/preferenze alla mappa (ad ogni (ri)montaggio della mappa: mapEpoch)
  useEffect(() => {
    if (mapEpoch > 0) sendToMap({ type: 'setPoints', kind: 'clients', points });
  }, [mapEpoch, points, sendToMap]);
  useEffect(() => {
    if (mapEpoch > 0 && allPoints) sendToMap({ type: 'setPoints', kind: 'all', points: allPoints });
  }, [mapEpoch, allPoints, sendToMap]);
  useEffect(() => {
    if (mapEpoch > 0) sendToMap({ type: 'setDotsMode', mode: dotsMode });
  }, [mapEpoch, dotsMode, sendToMap]);
  useEffect(() => {
    if (mapEpoch > 0) sendToMap({ type: 'setDotsOpacity', value: dotsOpacity });
  }, [mapEpoch, dotsOpacity, sendToMap]);
  // Ripristina le aree già disegnate quando la mappa viene rimontata (inline <-> schermo intero)
  useEffect(() => {
    if (mapEpoch > 0 && ringsRef.current.length > 0) sendToMap({ type: 'setRings', rings: ringsRef.current });
  }, [mapEpoch, sendToMap]);

  const handleMessage = useCallback((raw: string) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'mapReady') setMapEpoch((e) => e + 1);
      else if (msg.type === 'ringsChanged') {
        const r: number[][][] = Array.isArray(msg.rings) ? msg.rings : [];
        ringsRef.current = r;
        setRings(r);
        onRingsChangeRef.current(r);
      }
    } catch {
      // ignora messaggi non validi
    }
  }, []);

  // Web: ascolta i postMessage dell'iframe
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (e: MessageEvent) => {
      if (typeof e.data === 'string') handleMessage(e.data);
    };
    (globalThis as unknown as Window).addEventListener?.('message', listener);
    return () => (globalThis as unknown as Window).removeEventListener?.('message', listener);
  }, [handleMessage]);

  // Feedback live: intersezione con le zone assegnate e clienti dentro le aree disegnate
  const inter = useMemo(() => {
    if (rings.length === 0) return null;
    const zonesIn = intersectDrawnWithZones(rings, zones);
    const count = zonesIn.length > 0 ? points.filter((p) => pointInZones(p.lat, p.lng, zonesIn)).length : 0;
    return { ok: zonesIn.length > 0, count };
  }, [rings, zones, points]);

  const statusText =
    rings.length === 0
      ? 'Disegna una o più aree (poligono o rettangolo, in alto a destra) dentro le tue zone: il giro userà solo i clienti al loro interno.'
      : inter && !inter.ok
        ? 'Le aree disegnate sono fuori dalle tue zone assegnate: ridisegnale dentro le zone colorate.'
        : `${rings.length} area/e disegnata/e — ${inter?.count ?? 0} clienti dentro le aree (vale solo la parte nelle tue zone).`;

  const renderMapCanvas = () =>
    Platform.OS === 'web'
      ? React.createElement('iframe', {
          ref: iframeRef,
          srcDoc: html,
          style: { width: '100%', height: '100%', border: 'none' },
          title: 'Disegna aree del giro',
        })
      : WebView && (
          <WebView
            ref={webViewRef}
            source={{ html }}
            style={{ flex: 1 }}
            onMessage={(e: { nativeEvent: { data: string } }) => handleMessage(e.nativeEvent.data)}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
          />
        );

  const renderStatusAndControls = () => (
    <>
      <Text style={[styles.status, !!inter && !inter.ok && styles.statusWarn]} testID="aitour-draw-areas-status">
        {statusText}
      </Text>
      <View style={styles.controlsRow}>
        <View style={styles.modePill} testID="aitour-draw-dots-mode">
          <TouchableOpacity
            style={[styles.modeBtn, dotsMode === 'clients' && styles.modeBtnActive]}
            onPress={() => setDotsMode('clients')}
            activeOpacity={0.7}
            testID="aitour-draw-dots-clients"
          >
            <Text style={[styles.modeText, dotsMode === 'clients' && styles.modeTextActive]}>Solo clienti</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, dotsMode === 'all' && styles.modeBtnActive]}
            onPress={() => setDotsMode('all')}
            activeOpacity={0.7}
            testID="aitour-draw-dots-all"
          >
            <Text style={[styles.modeText, dotsMode === 'all' && styles.modeTextActive]}>Tutti i punti vendita</Text>
          </TouchableOpacity>
        </View>
        {dotsMode === 'all' && (
          <Text style={styles.infoText} testID="aitour-draw-dots-all-info">
            {loadingAll
              ? 'Carico tutti i punti vendita nelle zone...'
              : `${allPoints?.length ?? 0} punti vendita nelle zone (grigio = non clienti, nero = tuoi clienti)`}
          </Text>
        )}
        <View style={styles.sliderRow}>
          <Text style={styles.infoText}>Intensità puntini</Text>
          <Slider
            style={styles.slider}
            value={dotsOpacity}
            minimumValue={0.1}
            maximumValue={0.9}
            step={0.05}
            onValueChange={setDotsOpacity}
            minimumTrackTintColor="#7C3AED"
            maximumTrackTintColor={COLORS.border}
            thumbTintColor="#7C3AED"
            testID="aitour-draw-dots-opacity"
          />
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.root} testID="aitour-draw-areas">
      <View style={styles.mapBox}>
        {!expanded ? (
          <>
            {renderMapCanvas()}
            <TouchableOpacity
              style={styles.expandBtn}
              onPress={() => setExpanded(true)}
              activeOpacity={0.8}
              accessibilityLabel="Mappa a schermo intero"
              testID="aitour-draw-expand"
            >
              <Ionicons name="expand" size={17} color={COLORS.text} />
              <Text style={styles.expandText}>Schermo intero</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="map-outline" size={22} color="#94A3B8" />
            <Text style={styles.placeholderText}>Mappa aperta a schermo intero</Text>
          </View>
        )}
      </View>
      {renderStatusAndControls()}
      <Modal visible={expanded} animationType="fade" onRequestClose={() => setExpanded(false)}>
        <View style={[styles.fullRoot, { paddingTop: insets.top }]}>
          <View style={styles.fullHeader}>
            <Text style={styles.fullTitle}>Disegna aree del giro</Text>
            <TouchableOpacity
              style={styles.reduceBtn}
              onPress={() => setExpanded(false)}
              activeOpacity={0.8}
              accessibilityLabel="Riduci la mappa"
              testID="aitour-draw-reduce"
            >
              <Ionicons name="contract" size={17} color="#FFF" />
              <Text style={styles.reduceText}>Riduci</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.fullMap}>{expanded && renderMapCanvas()}</View>
          <View style={[styles.fullControls, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {renderStatusAndControls()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 10, gap: 6 },
  mapBox: {
    height: 380,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  status: { fontSize: 10.5, color: '#64748B' },
  statusWarn: { color: '#B45309', fontWeight: '700' },
  controlsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  modePill: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'transparent' },
  modeBtnActive: { backgroundColor: '#1E293B' },
  modeText: { fontSize: 10.5, color: '#64748B' },
  modeTextActive: { color: '#FFFFFF', fontWeight: '700' },
  infoText: { fontSize: 10.5, color: '#64748B' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 220, flex: 1 },
  slider: { flex: 1, height: 32, minWidth: 120 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  placeholderText: { fontSize: 11, color: '#94A3B8' },
  expandBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  expandText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  fullRoot: { flex: 1, backgroundColor: COLORS.bg },
  fullHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  fullTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  reduceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 15,
    minHeight: 44,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  reduceText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  fullMap: { flex: 1, backgroundColor: COLORS.bg },
  fullControls: { paddingHorizontal: 14, paddingTop: 8, gap: 6 },
});
