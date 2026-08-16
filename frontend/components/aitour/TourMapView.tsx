// Mappa del tour AI (parità web TourMap): marker numerati per tipo, percorso, partenza/rientro,
// popup con dettagli e Naviga. WebView su nativo, iframe su web.
import React, { useMemo, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { openNavigation } from './shared';

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
}

function buildHtml(stops: TourMapStop[], geometry: [number, number][], start: Props['start'], end: Props['end']): string {
  const payload = JSON.stringify({ stops, geometry, start, end: end || null });
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
  .pp-nav { display:inline-block; margin-top:7px; background:#2563EB; color:#fff; font-size:11px; font-weight:600; border-radius:7px; padding:5px 12px; text-decoration:none; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var DATA = ${payload};
  var map = L.map('map', { zoomControl: true, attributionControl: false });
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

  // Percorso pianificato
  if (DATA.geometry && DATA.geometry.length > 1) {
    L.polyline(DATA.geometry, { color: '#2563eb', weight: 4, opacity: 0.75 }).addTo(map);
  }

  // Partenza / rientro
  L.marker([DATA.start.lat, DATA.start.lng], { icon: pointIcon('P') }).addTo(map)
    .bindPopup('<div class="pp-name">Partenza</div><div class="pp-line">' + (DATA.start.label || '') + '</div>');
  if (DATA.end) {
    L.marker([DATA.end.lat, DATA.end.lng], { icon: pointIcon('A') }).addTo(map)
      .bindPopup('<div class="pp-name">Rientro</div><div class="pp-line">' + (DATA.end.label || '') + '</div>');
  }

  // Fermate
  DATA.stops.forEach(function(s) {
    var m = L.marker([s.lat, s.lng], { icon: numberedIcon(s.label, s.color, s.mandatory, s.status) }).addTo(map);
    var html = '<div class="pp-name">' + s.name + '</div>' +
      '<span class="pp-badge" style="border-color:' + s.color + ';color:' + s.color + '">' + s.entity + '</span>' +
      (s.mandatory ? '<span class="pp-badge" style="border-color:#dc2626;color:#fff;background:#dc2626">Obbligatoria</span>' : '') +
      '<div class="pp-line">' + s.line1 + '</div>' +
      (s.line2 ? '<div class="pp-line">' + s.line2 + '</div>' : '') +
      (s.reason ? '<div class="pp-reason">' + s.reason + '</div>' : '') +
      '<a class="pp-nav" href="#" onclick="sendMessage({type:\\'navigate\\',lat:' + s.lat + ',lng:' + s.lng + ',name:' + JSON.stringify(s.name) + '});return false;">\\u27A4 Naviga</a>';
    m.bindPopup(html, { maxWidth: 260 });
  });

  // Fit bounds
  var pts = [[DATA.start.lat, DATA.start.lng]];
  DATA.stops.forEach(function(s) { pts.push([s.lat, s.lng]); });
  if (DATA.end) pts.push([DATA.end.lat, DATA.end.lng]);
  if (pts.length > 1) { map.fitBounds(L.latLngBounds(pts), { padding: [36, 36] }); }
  else { map.setView(pts[0], 12); }
</script>
</body>
</html>`;
}

export function TourMapView({ stops, geometry, start, end, height = 420 }: Props) {
  const html = useMemo(() => buildHtml(stops, geometry, start, end), [stops, geometry, start, end]);

  const handleMessage = useCallback((raw: string) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'navigate') openNavigation(msg.lat, msg.lng, msg.name || '');
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

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.box, { height }]}>
        {React.createElement('iframe', {
          srcDoc: html,
          style: { width: '100%', height: '100%', border: 'none' },
          title: 'Mappa del tour',
        })}
      </View>
    );
  }

  if (!WebView) return null;
  return (
    <View style={[styles.box, { height }]}>
      <WebView
        source={{ html }}
        style={{ flex: 1 }}
        onMessage={(e: { nativeEvent: { data: string } }) => handleMessage(e.nativeEvent.data)}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginTop: 10,
    backgroundColor: '#F2F2F7',
  },
});
