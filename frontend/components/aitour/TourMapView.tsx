// Mappa del tour AI (parità web TourMap): marker numerati per tipo, percorso, partenza/rientro,
// popup con dettagli e Naviga. WebView su nativo, iframe su web. Tasto schermo intero.
// In più: puntini neri con le tabaccherie del registro intorno al percorso (opportunità).
import React, { useMemo, useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, Platform, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openNavigation } from './shared';
import { COLORS } from '../../lib/theme';
import { tabaccheriePointsInBounds, type TabPoint } from '../../lib/api/tabaccherie';
import AsyncStorage from '@react-native-async-storage/async-storage';

let WebView: any = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebView = require('react-native-webview').WebView;
}

export interface TourMapStop {
  key: string;
  lat: number;
  lng: number;
  color: string;
  label: string; // numero sequenza o simbolo
  mandatory: boolean;
  name: string;
  /** Nome commerciale della scheda CRM quando differisce dalla denominazione del registro */
  crmName?: string | null;
  entity: string;
  line1: string; // es. "Arrivo 10:30 · visita 25 min"
  line2?: string; // es. "Dal punto precedente: 12 min · 5.4 km"
  reason?: string;
  status?: string; // planned | arrived | completed | skipped | cancelled
}

interface Props {
  stops: TourMapStop[];
  geometry: [number, number][];
  start: { lat: number; lng: number; label?: string };
  end?: { lat: number; lng: number; label?: string } | null;
  height?: number;
  /** Tap sul segnaposto: apre il dettaglio tappa (usato dal Live Tour al posto del popup) */
  onStopSelect?: (key: string) => void;
}

function buildHtml(stops: TourMapStop[], geometry: [number, number][], start: Props['start'], end: Props['end'], dots: TabPoint[], selectable: boolean): string {
  const payload = JSON.stringify({
    stops,
    geometry,
    start,
    end: end || null,
    selectable,
    dots: dots.map((p) => ({ lat: Math.round(p.lat * 1e5) / 1e5, lng: Math.round(p.lng * 1e5) / 1e5 })),
  });
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin:0; padding:0; }
  html, body, #map { width:100%; height:100%; }
  .aitour-marker { border:none !important; background:none !important; }
  .leaflet-popup-content { margin: 10px 12px; font-family: -apple-system, Helvetica, Arial, sans-serif; }
  .pp-name { font-weight:700; font-size:13px; margin-bottom:4px; }
  .pp-badge { display:inline-block; font-size:10px; font-weight:600; border-radius:5px; padding:1px 6px; border:1px solid; margin-right:4px; }
  .pp-line { font-size:11px; color:#334155; margin-top:3px; }
  .pp-reason { font-size:11px; font-style:italic; color:#6D28D9; border-left:2px solid #C4B5FD; padding-left:6px; margin-top:5px; }
  .pp-nav { display:inline-block; margin-top:7px; background:#7C3AED; color:#fff; font-size:11px; font-weight:600; border-radius:7px; padding:5px 12px; text-decoration:none; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var DATA = ${payload};
  var map = L.map('map', { zoomControl: true, attributionControl: false, zoomSnap: 0.25, zoomDelta: 0.5 });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

  function sendMessage(msg) {
    var str = JSON.stringify(msg);
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(str); }
    else if (window.parent && window.parent !== window) { window.parent.postMessage(str, '*'); }
  }

  function numberedIcon(label, color, mandatory, status) {
    var done = status === 'completed';
    var off = status === 'skipped' || status === 'cancelled';
    var bg = done ? '#16a34a' : off ? '#94a3b8' : color;
    var txt = done ? '\\u2713' : off ? '\\u2715' : label;
    var border = (mandatory && !done && !off) ? '3px solid #dc2626' : '2px solid #fff';
    return L.divIcon({
      className: 'aitour-marker',
      html: '<div style="width:28px;height:28px;border-radius:50%;background:' + bg + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:' + border + ';box-shadow:0 1px 4px rgba(0,0,0,.4);opacity:' + (off ? 0.65 : 1) + '">' + txt + '</div>',
      iconSize: [28, 28], iconAnchor: [14, 14],
    });
  }

  function pointIcon(label) {
    return L.divIcon({
      className: 'aitour-marker',
      html: '<div style="width:30px;height:30px;border-radius:6px;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">' + label + '</div>',
      iconSize: [30, 30], iconAnchor: [15, 15],
    });
  }

  // Puntini neri: tabaccherie del registro intorno al percorso (canvas, non interattivi,
  // stanno sotto i marker numerati). Raggio adattivo allo zoom per non dominare la mappa.
  // Protetti da try/catch: mai rompere la mappa.
  function dotRadius(z) { return z >= 13 ? 3 : z >= 11 ? 2.2 : z >= 9 ? 1.6 : 1.1; }
  var dotMarkers = [];
  try {
    if (DATA.dots && DATA.dots.length) {
      var dotsRenderer = L.canvas({ padding: 0.2 });
      var r0 = dotRadius(map.getZoom() || 12);
      for (var di = 0; di < DATA.dots.length; di++) {
        var dp = DATA.dots[di];
        if (!dp.lat || !dp.lng) continue;
        dotMarkers.push(L.circleMarker([dp.lat, dp.lng], { renderer: dotsRenderer, radius: r0, color: '#111827', fillColor: '#111827', fillOpacity: 0.75, weight: 0, interactive: false }).addTo(map));
      }
      map.on('zoomend', function() {
        var r = dotRadius(map.getZoom());
        for (var zi = 0; zi < dotMarkers.length; zi++) dotMarkers[zi].setRadius(r);
      });
    }
  } catch (e) {}

  // Percorso pianificato
  if (DATA.geometry && DATA.geometry.length > 1) {
    L.polyline(DATA.geometry, { color: '#7C3AED', weight: 4, opacity: 0.75 }).addTo(map);
  }

  // Partenza / rientro
  L.marker([DATA.start.lat, DATA.start.lng], { icon: pointIcon('P') }).addTo(map)
    .bindPopup('<div class="pp-name">Partenza</div><div class="pp-line">' + (DATA.start.label || '') + '</div>');
  if (DATA.end) {
    L.marker([DATA.end.lat, DATA.end.lng], { icon: pointIcon('A') }).addTo(map)
      .bindPopup('<div class="pp-name">Rientro</div><div class="pp-line">' + (DATA.end.label || '') + '</div>');
  }

  // Fermate: con selectable il tap apre il dettaglio tappa nell'app (niente popup)
  DATA.stops.forEach(function(s) {
    var m = L.marker([s.lat, s.lng], { icon: numberedIcon(s.label, s.color, s.mandatory, s.status) }).addTo(map);
    if (DATA.selectable) {
      m.on('click', function() { sendMessage({ type: 'stopSelect', key: s.key }); });
      return;
    }
    var html = '<div class="pp-name">' + s.name + '</div>' +
      (s.crmName && s.crmName !== s.name ? '<div class="pp-line" style="color:#2563eb">Scheda CRM: <b>' + s.crmName + '</b></div>' : '') +
      '<span class="pp-badge" style="border-color:' + s.color + ';color:' + s.color + '">' + s.entity + '</span>' +
      (s.mandatory ? '<span class="pp-badge" style="border-color:#dc2626;color:#fff;background:#dc2626">Obbligatoria</span>' : '') +
      '<div class="pp-line">' + s.line1 + '</div>' +
      (s.line2 ? '<div class="pp-line">' + s.line2 + '</div>' : '') +
      (s.reason ? '<div class="pp-reason">' + s.reason + '</div>' : '') +
      '<a class="pp-nav" href="#" onclick="sendMessage({type:\\'navigate\\',lat:' + s.lat + ',lng:' + s.lng + ',name:' + JSON.stringify(s.name) + '});return false;">\\u27A4 Naviga</a>';
    m.bindPopup(html, { maxWidth: 260 });
  });

  // Fit bounds — robusto anche a schermo intero: il contenitore può cambiare
  // dimensione dopo il load (Modal/animazioni), quindi re-fit ritardato + su resize,
  // finché l'utente non interagisce con la mappa.
  var pts = [[DATA.start.lat, DATA.start.lng]];
  DATA.stops.forEach(function(s) { pts.push([s.lat, s.lng]); });
  if (DATA.end) pts.push([DATA.end.lat, DATA.end.lng]);
  var fitting = false, userTouched = false;
  function fitAll() {
    fitting = true;
    map.invalidateSize();
    if (pts.length > 1) { map.fitBounds(L.latLngBounds(pts), { padding: [36, 36] }); }
    else { map.setView(pts[0], 12); }
    setTimeout(function() { fitting = false; }, 400);
  }
  map.on('dragstart zoomstart', function() { if (!fitting) userTouched = true; });
  fitAll();
  setTimeout(function() { if (!userTouched) fitAll(); }, 300);
  setTimeout(function() { if (!userTouched) fitAll(); }, 900);
  window.addEventListener('resize', function() {
    if (!userTouched) setTimeout(function() { if (!userTouched) fitAll(); }, 120);
  });
</script>
</body>
</html>`;
}

export function TourMapView({ stops, geometry, start, end, height = 420, onStopSelect }: Props) {
  // Puntini neri: tabaccherie del registro nel riquadro del percorso + ~10 km di margine.
  // Caricati una volta per composizione del giro ed embedded nell'HTML della mappa.
  const [dots, setDots] = useState<TabPoint[]>([]);
  // Interruttore puntini (preferenza persistita, condivisa col tab Mappa)
  const [dotsVisible, setDotsVisible] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem('voom_dots_visible')
      .then((v) => {
        if (v === '0') setDotsVisible(false);
      })
      .catch(() => {});
  }, []);
  const toggleDots = useCallback(() => {
    setDotsVisible((prev) => {
      AsyncStorage.setItem('voom_dots_visible', prev ? '0' : '1').catch(() => {});
      return !prev;
    });
  }, []);
  useEffect(() => {
    let alive = true;
    const lats = [start.lat, ...stops.map((s) => s.lat)];
    const lngs = [start.lng, ...stops.map((s) => s.lng)];
    if (end) {
      lats.push(end.lat);
      lngs.push(end.lng);
    }
    const latMargin = 10 / 111; // ~10 km
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const lngMargin = 10 / (111 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)));
    tabaccheriePointsInBounds({
      north: Math.max(...lats) + latMargin,
      south: Math.min(...lats) - latMargin,
      east: Math.max(...lngs) + lngMargin,
      west: Math.min(...lngs) - lngMargin,
    })
      .then((pts) => {
        if (alive) setDots(pts);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [stops, start, end]);

  const html = useMemo(
    () => buildHtml(stops, geometry, start, end, dotsVisible ? dots : [], !!onStopSelect),
    [stops, geometry, start, end, dots, dotsVisible, onStopSelect],
  );
  const [fullscreen, setFullscreen] = useState(false);
  const insets = useSafeAreaInsets();

  const onStopSelectRef = React.useRef(onStopSelect);
  onStopSelectRef.current = onStopSelect;
  const handleMessage = useCallback((raw: string) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'navigate') openNavigation(msg.lat, msg.lng, msg.name || '');
      else if (msg.type === 'stopSelect' && msg.key && onStopSelectRef.current) onStopSelectRef.current(String(msg.key));
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

  const renderMap = () => {
    if (Platform.OS === 'web') {
      return React.createElement('iframe', {
        srcDoc: html,
        style: { width: '100%', height: '100%', border: 'none' },
        title: 'Mappa del tour',
      });
    }
    if (!WebView) return null;
    return (
      <WebView
        source={{ html }}
        style={{ flex: 1 }}
        onMessage={(e: { nativeEvent: { data: string } }) => handleMessage(e.nativeEvent.data)}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
      />
    );
  };

  return (
    <>
      <View style={[styles.box, { height }]}>
        {renderMap()}
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={() => setFullscreen(true)}
          activeOpacity={0.8}
          accessibilityLabel="Mappa a schermo intero"
        >
          <Ionicons name="expand" size={17} color={COLORS.text} />
          <Text style={styles.expandText}>Schermo intero</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dotsBtn, !dotsVisible && { opacity: 0.55 }]}
          onPress={toggleDots}
          activeOpacity={0.8}
          accessibilityLabel={dotsVisible ? 'Nascondi puntini tabaccherie' : 'Mostra puntini tabaccherie'}
          testID="tourmap-dots-toggle"
        >
          <Ionicons name={dotsVisible ? 'ellipse' : 'ellipse-outline'} size={16} color={COLORS.text} />
        </TouchableOpacity>
      </View>
      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)}>
        <View style={styles.fullRoot}>
          {fullscreen && renderMap()}
          <TouchableOpacity
            style={[styles.reduceBtn, { top: insets.top + 10 }]}
            onPress={() => setFullscreen(false)}
            activeOpacity={0.8}
            accessibilityLabel="Riduci la mappa"
          >
            <Ionicons name="contract" size={18} color="#FFF" />
            <Text style={styles.reduceText}>Riduci</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dotsBtn, { top: insets.top + 66, right: 12 }, !dotsVisible && { opacity: 0.55 }]}
            onPress={toggleDots}
            activeOpacity={0.8}
            accessibilityLabel={dotsVisible ? 'Nascondi puntini tabaccherie' : 'Mostra puntini tabaccherie'}
          >
            <Ionicons name={dotsVisible ? 'ellipse' : 'ellipse-outline'} size={16} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 10,
    backgroundColor: COLORS.bg,
  },
  expandBtn: {
    position: 'absolute',
    top: 10,
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
  dotsBtn: {
    position: 'absolute',
    top: 62,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 10,
  },
  fullRoot: { flex: 1, backgroundColor: COLORS.bg },
  reduceBtn: {
    position: 'absolute',
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 15,
    minHeight: 46,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 10,
  },
  reduceText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
});
