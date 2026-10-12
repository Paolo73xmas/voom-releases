// Shadow DOM scopes Leaflet's styles; it is NOT a security sandbox.
// Marker colors are fixed legibility colors, matching the existing native map document.
export const WEB_MAP_STYLE = `
:host{display:block;width:100%;height:100%}
#map{width:100%;height:100%;font-family:-apple-system,Helvetica,Arial,sans-serif}
.route-marker{background:none;border:none;display:flex;align-items:center;justify-content:center}
.route-marker span{box-sizing:border-box;width:30px;height:30px;border-radius:50%;color:#fff;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.4)}
.route-marker .mandatory{border:3px solid #dc2626}.route-marker.selected span{outline:3px solid #f59e0b;transform:scale(1.15)}
.route-marker .endpoint{border-radius:6px;background:#0f172a}
.leaflet-control-zoom a{width:44px;height:44px;line-height:44px}.leaflet-popup-content{font-size:13px}
.leaflet-control-attribution{font-size:10px}.leaflet-control-attribution a{padding:4px 0}
`;