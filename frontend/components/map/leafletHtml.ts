export 
const LEAFLET_HTML = (lat: number, lng: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; }
    .custom-marker {
      border: none !important;
      background: none !important;
    }
    .user-pulse {
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.5); }
      70% { box-shadow: 0 0 0 10px rgba(59,130,246,0); }
      100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([${lat}, ${lng}], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      maxNativeZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    var markers = [];
    var userMarker = null;

    // User location marker
    var userIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div class="user-pulse" style="background:#3b82f6;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    userMarker = L.marker([${lat}, ${lng}], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);

    var ICONS = {
      gray: L.divIcon({ className:'custom-marker', html:'<div style="background:#475569;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);opacity:0.6;"></div>', iconSize:[14,14], iconAnchor:[7,7] }),
      red: L.divIcon({ className:'custom-marker', html:'<div style="background:#dc2626;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>', iconSize:[14,14], iconAnchor:[7,7] }),
      orange: L.divIcon({ className:'custom-marker', html:'<div style="background:#f97316;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>', iconSize:[14,14], iconAnchor:[7,7] }),
      green: L.divIcon({ className:'custom-marker', html:'<div style="background:#15803d;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>', iconSize:[14,14], iconAnchor:[7,7] }),
    };

    var debounceTimer = null;

    function sendMessage(msg) {
      var str = JSON.stringify(msg);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(str);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(str, '*');
      }
    }

    map.on('moveend', function() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        var b = map.getBounds();
        sendMessage({
          type: 'boundsChanged',
          bounds: {
            north: b.getNorth(),
            south: b.getSouth(),
            east: b.getEast(),
            west: b.getWest()
          }
        });
      }, 500);
    });

    function updateMarkers(data) {
      markers.forEach(function(m) { map.removeLayer(m); });
      markers = [];
      data.forEach(function(p) {
        if (!p.lat || !p.lng) return;
        var icon = ICONS[p.color] || ICONS.red;
        var m = L.marker([p.lat, p.lng], { icon: icon });
        m.on('click', function() {
          sendMessage({
            type: 'markerClick',
            id: p.id
          });
        });
        m.addTo(map);
        markers.push(m);
      });
    }

    function setCenter(lat, lng, zoom) {
      map.setView([lat, lng], zoom || 16);
    }

    function updateUserLocation(lat, lng) {
      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
      }
    }

    // Fire initial bounds
    setTimeout(function() {
      var b = map.getBounds();
      sendMessage({
        type: 'boundsChanged',
        bounds: {
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest()
        }
      });
    }, 500);

    // Listen for messages from RN
    document.addEventListener('message', function(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'updateMarkers') updateMarkers(msg.data);
        if (msg.type === 'setCenter') setCenter(msg.lat, msg.lng, msg.zoom);
        if (msg.type === 'updateUserLocation') updateUserLocation(msg.lat, msg.lng);
      } catch(err) {}
    });
    window.addEventListener('message', function(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'updateMarkers') updateMarkers(msg.data);
        if (msg.type === 'setCenter') setCenter(msg.lat, msg.lng, msg.zoom);
        if (msg.type === 'updateUserLocation') updateUserLocation(msg.lat, msg.lng);
      } catch(err) {}
    });
  </script>
</body>
</html>
`;
