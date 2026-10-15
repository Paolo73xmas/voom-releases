// Native Leaflet HTML bridge guards: versioning, timestamp freshness, deduped message listeners.
import { describe, expect, it } from 'vitest';
import vm from 'node:vm';
import { LEAFLET_HTML } from '../components/map/leafletHtml';

type Listener = (event: { data: string }) => void;

function extractScript(html: string): string {
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (!matches.length) throw new Error('missing inline script');
  return matches[matches.length - 1][1];
}

function createRuntime() {
  const documentListeners: Record<string, Listener[]> = { message: [] };
  const windowListeners: Record<string, Listener[]> = { message: [] };
  const posted: any[] = [];
  const calls = {
    setView: [] as { lat: number; lng: number; zoom: number; animate: boolean }[],
    userLatLng: [] as [number, number][],
    clusterAdds: 0,
    markerAdds: 0,
  };

  const mapObj = {
    setView: ([lat, lng]: [number, number], zoom: number, opts: { animate: boolean }) => {
      calls.setView.push({ lat, lng, zoom, animate: Boolean(opts?.animate) });
      return mapObj;
    },
    stop: () => undefined,
    addLayer: () => undefined,
    removeLayer: () => undefined,
    on: () => undefined,
    getCenter: () => ({ lat: 41.9, lng: 12.49 }),
    getZoom: () => 13,
    getBounds: () => ({ getNorth: () => 42.2, getSouth: () => 41.6, getEast: () => 12.7, getWest: () => 12.1 }),
  };

  const clusterGroup = {
    clearLayers: () => undefined,
    addLayer: () => {
      calls.clusterAdds += 1;
    },
  };

  const L = {
    map: () => mapObj,
    tileLayer: () => ({ addTo: () => undefined }),
    control: { zoom: () => ({ addTo: () => undefined }) },
    markerClusterGroup: () => clusterGroup,
    divIcon: (v: unknown) => v,
    point: (x: number, y: number) => ({ x, y }),
    marker: ([lat, lng]: [number, number]) => {
      calls.markerAdds += 1;
      let at: [number, number] = [lat, lng];
      return {
        addTo: () => ({
          setLatLng: ([nLat, nLng]: [number, number]) => {
            at = [nLat, nLng];
            calls.userLatLng.push(at);
          },
        }),
        setLatLng: ([nLat, nLng]: [number, number]) => {
          at = [nLat, nLng];
          calls.userLatLng.push(at);
        },
        on: () => undefined,
      };
    },
    layerGroup: () => ({ addTo: () => ({ clearLayers: () => undefined, eachLayer: () => undefined }) }),
    canvas: () => ({}),
    circleMarker: () => ({ addTo: () => undefined }),
  };

  const documentStub = {
    addEventListener: (name: string, cb: Listener) => {
      (documentListeners[name] ||= []).push(cb);
    },
  };

  const windowStub: any = {
    addEventListener: (name: string, cb: Listener) => {
      (windowListeners[name] ||= []).push(cb);
    },
    parent: {
      postMessage: (payload: string) => {
        posted.push(JSON.parse(payload));
      },
    },
    ReactNativeWebView: null,
  };

  return { L, documentStub, windowStub, posted, calls, documentListeners, windowListeners };
}

describe('map native HTML bridge', () => {
  it('dedups Android document+window bubbling and enforces recenter version/timestamp guards', () => {
    const html = LEAFLET_HTML(41.9, 12.49, true);
    const script = extractScript(html);
    const rt = createRuntime();
    const timers: (() => void)[] = [];

    const context = {
      L: rt.L,
      window: rt.windowStub,
      document: rt.documentStub,
      setTimeout: (cb: () => void) => {
        timers.push(cb);
        return timers.length;
      },
      clearTimeout: () => undefined,
      WeakSet,
      JSON,
      Number,
      Math,
    };

    vm.createContext(context);
    vm.runInContext(script, context);
    timers.forEach(cb => cb()); // emit mapReady/bounds

    const [docListener] = rt.documentListeners.message;
    const [winListener] = rt.windowListeners.message;
    expect(docListener).toBeTruthy();
    expect(winListener).toBeTruthy();

    const beforeRecenter = rt.calls.setView.length;
    const event = { data: JSON.stringify({ type: 'recenterUser', lat: 45.1, lng: 9.1, zoom: 13, version: 1, timestamp: 1_000 }) };
    docListener(event);
    winListener(event); // Same event object bubbling to window must be processed once.
    expect(rt.calls.setView).toHaveLength(beforeRecenter + 1);
    expect(rt.calls.userLatLng.at(-1)).toEqual([45.1, 9.1]);

    winListener({ data: JSON.stringify({ type: 'recenterUser', lat: 46.1, lng: 10.1, zoom: 13, version: 0, timestamp: 2_000 }) });
    expect(rt.calls.setView).toHaveLength(beforeRecenter + 1); // older version ignored

    winListener({ data: JSON.stringify({ type: 'recenterUser', lat: 47.1, lng: 11.1, zoom: 13, version: 2, timestamp: 500 }) });
    expect(rt.calls.setView).toHaveLength(beforeRecenter + 1); // old GPS timestamp ignored

    winListener({ data: JSON.stringify({ type: 'recenterUser', lat: 500, lng: 11.1, zoom: 13, version: 3, timestamp: 3_000 }) });
    expect(rt.calls.setView).toHaveLength(beforeRecenter + 1); // invalid coordinates ignored
  });

  it('syncPosition restores viewport/fix, rejects late older versions, and marker updates do not move camera', () => {
    const html = LEAFLET_HTML(41.9, 12.49, false);
    const script = extractScript(html);
    const rt = createRuntime();
    const timers: (() => void)[] = [];

    const context = {
      L: rt.L,
      window: rt.windowStub,
      document: rt.documentStub,
      setTimeout: (cb: () => void) => {
        timers.push(cb);
        return timers.length;
      },
      clearTimeout: () => undefined,
      WeakSet,
      JSON,
      Number,
      Math,
    };

    vm.createContext(context);
    vm.runInContext(script, context);

    const [winListener] = rt.windowListeners.message;
    winListener({ data: JSON.stringify({
      type: 'syncPosition',
      fix: { lat: 45.5, lng: 9.5, timestamp: 2_000 },
      viewport: { lat: 45.5, lng: 9.5, zoom: 12, version: 2 },
    }) });
    expect(rt.calls.setView.at(-1)).toMatchObject({ lat: 45.5, lng: 9.5, zoom: 12 });
    expect(rt.calls.markerAdds).toBeGreaterThanOrEqual(1);

    const before = rt.calls.setView.length;
    winListener({ data: JSON.stringify({ type: 'setCenter', lat: 41.0, lng: 12.0, zoom: 10, version: 1 }) });
    winListener({ data: JSON.stringify({ type: 'updateMarkers', data: [{ id: 'a', lat: 45.4, lng: 9.4, color: 'red' }] }) });
    winListener({ data: JSON.stringify({ type: 'updateDots', data: [{ lat: 45.41, lng: 9.41 }] }) });

    expect(rt.calls.setView).toHaveLength(before); // stale setCenter ignored and marker/dots updates don't recenter
    expect(rt.calls.clusterAdds).toBeGreaterThanOrEqual(1);
  });
});
