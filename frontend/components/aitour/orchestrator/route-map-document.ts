import type { DayView } from '../../../lib/aitour/orchestrator/contract';
import { DS } from '../../../lib/theme';
import { stopColor } from './stop-presentation';

/** Graphic-only port of TourMapView: no GPS, CRM dots, orders, routing or local geometry. */
export function routeMapData(day: DayView) {
  const tuple = (p: { latitude: number; longitude: number }) => [p.latitude, p.longitude];
  return {
    start: { point: tuple(day.start.coordinate), label: day.start.label },
    end: day.end ? { point: tuple(day.end.coordinate), label: day.end.label } : null,
    geometry: day.geometryKind === 'connections' ? [] : day.geometry.map(tuple),
    stops: day.stops.map(s => ({ id: s.id, point: tuple(s.coordinate), number: s.sequence, name: s.name, color: stopColor(s), mandatory: !!s.mandatory })),
    routeColor: DS.brand, endpointColor: DS.inkMuted,
  };
}

export function routeMapDocument(day: DayView): string {
  const payload = JSON.stringify(routeMapData(day)).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com; style-src 'unsafe-inline' https://unpkg.com; img-src https://*.tile.openstreetmap.org data:; base-uri 'none'; form-action 'none';"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
html,body,#map{width:100%;height:100%;margin:0}body{font-family:-apple-system,Helvetica,Arial,sans-serif}
.route-marker{background:none;border:none;display:flex;align-items:center;justify-content:center}
.route-marker span{box-sizing:border-box;width:30px;height:30px;border-radius:50%;color:#fff;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.4)}
.route-marker .mandatory{border:3px solid #dc2626}.route-marker.selected span{outline:3px solid #f59e0b;transform:scale(1.15)}
.route-marker .endpoint{border-radius:6px;background:#0f172a}
.leaflet-control-zoom a{width:44px;height:44px;line-height:44px}.leaflet-popup-content{font-size:13px}
.leaflet-control-attribution{font-size:10px}.leaflet-control-attribution a{padding:4px 0}
</style></head><body><div id="map" data-testid="orchestrator-map-canvas" aria-label="Mappa del giro"></div>
<script id="server-map-data" type="application/json">${payload}</script>
<script>
function send(m){var text=JSON.stringify(m);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(text);else if(window.parent!==window)window.parent.postMessage(text,'*');}
window.addEventListener('error',function(){send({type:'render-error'});});
</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="send({type:'render-error'})"></script>
<script>
(function(){
try {
  var data=JSON.parse(document.getElementById('server-map-data').textContent);
  var map=L.map('map',{zoomControl:true,attributionControl:true,zoomSnap:0.25,zoomDelta:0.5});
  map.setView(data.start.point,12);
  var tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'});
  tiles.on('tileerror',function(){send({type:'tile-error'});});tiles.addTo(map);
  function icon(text,color,mandatory,endpoint,anchor){
    var el=document.createElement('span');el.textContent=text;el.style.backgroundColor=color;
    el.className=endpoint?'endpoint':mandatory?'mandatory':'';
    return L.divIcon({className:'route-marker',html:el,iconSize:[44,44],iconAnchor:anchor||(endpoint?[22,0]:[22,22])});
  }
  function endpoint(point,text,title,id,anchor){
    var m=L.marker(point.point,{icon:icon(text,'#0f172a',false,true,anchor),title:title,zIndexOffset:100}).addTo(map);
    m.getElement().setAttribute('data-testid',id);
    var content=document.createElement('div');content.textContent=title+' · '+point.label;m.bindPopup(content);
  }
  var sameEnd=data.end&&data.start.point[0]===data.end.point[0]&&data.start.point[1]===data.end.point[1];
  // Pixel-only label offsets keep P/R readable near stop markers; geographic points are unchanged.
  endpoint(data.start,'P','Partenza','orchestrator-map-start',sameEnd?[40,0]:null);
  if(data.end)endpoint(data.end,'R','Rientro','orchestrator-map-return',sameEnd?[4,0]:null);
  // ONLY the exact geometry received from the server. Never connect/snap/reorder stops here.
  if(data.geometry.length>1){var line=L.polyline(data.geometry,{color:data.routeColor,weight:4,opacity:0.8}).addTo(map);line.getElement().setAttribute('data-testid','orchestrator-server-route');}
  var markers=Object.create(null);
  window.selectStop=function(id){Object.keys(markers).forEach(function(k){var m=markers[k];m.getElement().classList.toggle('selected',k===id);m.setZIndexOffset(k===id?300:200);});};
  data.stops.forEach(function(s){
    var m=L.marker(s.point,{icon:icon(s.number,s.color,s.mandatory,false),title:s.number+'. '+s.name,zIndexOffset:200}).addTo(map);markers[s.id]=m;
    m.getElement().setAttribute('data-testid','orchestrator-map-stop-'+s.id);m.getElement().setAttribute('aria-label',s.number+'. '+s.name);
    m.on('click',function(){window.selectStop(s.id);send({type:'stop-select',id:s.id});});
  });
  var points=[data.start.point].concat(data.geometry,data.stops.map(function(s){return s.point;}),data.end?[data.end.point]:[]);
  function fit(){map.invalidateSize({pan:false});map.fitBounds(L.latLngBounds(points),{padding:[42,42],maxZoom:15,animate:false});}
  window.addEventListener('message',function(e){if(e.source!==window.parent||typeof e.data!=='string')return;try{var m=JSON.parse(e.data);if(m.type==='select-stop')window.selectStop(m.id);}catch(_){}});
  if(window.ResizeObserver)new ResizeObserver(fit).observe(document.getElementById('map'));
  window.addEventListener('resize',fit);fit();
  requestAnimationFrame(function(){fit();send({type:'ready'});});
}catch(_){send({type:'render-error'});}
})();</script></body></html>`;
}