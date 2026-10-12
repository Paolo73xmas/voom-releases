import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { LEAFLET_ASSETS, OSM_TILE_URL, loadWebLeaflet } from '../components/aitour/orchestrator/web-leaflet';
import { createWebMap } from '../components/aitour/orchestrator/web-map-controller';
import { routeMapData } from '../components/aitour/orchestrator/route-map-document';
import type { DayView } from '../lib/aitour/orchestrator/contract';

type AnyObj = Record<string, any>;

function day(): DayView {
  return {
    id: '1',
    title: 'Giorno 1',
    date: '2026-10-12',
    start: { coordinate: { latitude: 45.1, longitude: 9.1 }, label: 'Partenza' },
    end: { coordinate: { latitude: 45.2, longitude: 9.2 }, label: 'Rientro' },
    stops: [
      {
        id: '1-1',
        sequence: '1',
        name: 'Cliente Uno',
        coordinate: { latitude: 45.11, longitude: 9.11 },
        arrival: '08:00',
        departure: '08:30',
        travel: '20 min · 10,0 km',
        visit: '30 min',
        group: 'existing',
      },
      {
        id: '1-2',
        sequence: '2',
        name: 'Cliente Due',
        coordinate: { latitude: 45.12, longitude: 9.12 },
        arrival: '08:40',
        departure: '09:00',
        travel: '10 min · 4,0 km',
        visit: '20 min',
        group: 'new',
      },
    ],
    geometry: [
      { latitude: 45.1, longitude: 9.1 },
      { latitude: 45.6, longitude: 9.9 },
      { latitude: 45.2, longitude: 9.2 },
    ],
    metrics: [],
    breaks: [],
    commitments: [],
    warnings: [],
    geometryKind: 'server',
  };
}

function fakeElement(tag: string): AnyObj {
  return {
    tagName: tag.toUpperCase(),
    id: '',
    href: '',
    src: '',
    rel: '',
    type: '',
    integrity: '',
    crossOrigin: '',
    textContent: '',
    dataset: {},
    style: {},
    className: '',
    tabIndex: 0,
    children: [] as AnyObj[],
    attributes: {} as AnyObj,
    classList: {
      toggle: vi.fn(),
    },
    append: function (...nodes: AnyObj[]) {
      this.children.push(...nodes);
    },
    setAttribute: function (k: string, v: string) {
      this.attributes[k] = v;
    },
    getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 100, width: 100, height: 100 }),
    onload: undefined as unknown,
    onerror: undefined as unknown,
    remove: vi.fn(),
  };
}

function installFakeDocument() {
  const headChildren: AnyObj[] = [];
  const fakeHead = {
    appendChild: vi.fn((node: AnyObj) => {
      headChildren.push(node);
      return node;
    }),
  };
  const doc = {
    createElement: vi.fn((tag: string) => fakeElement(tag)),
    head: fakeHead,
  };
  const previous = (globalThis as AnyObj).document;
  (globalThis as AnyObj).document = doc;
  return { doc, headChildren, restore: () => ((globalThis as AnyObj).document = previous) };
}

function makeLeaflet(log: string[]) {
  const tilesOn: Record<string, (e: { tile?: AnyObj }) => void> = {};
  const markers: AnyObj[] = [];
  const map = {
    fitBounds: vi.fn(() => log.push('fitBounds')),
    invalidateSize: vi.fn(() => log.push('invalidateSize')),
    remove: vi.fn(() => log.push('remove')),
  };
  const leaflet = {
    version: '1.9.4',
    noConflict: vi.fn(() => leaflet),
    map: vi.fn(() => map),
    tileLayer: vi.fn((_url: string, _opts: AnyObj) => ({
      on: vi.fn((event: string, cb: (e: { tile?: AnyObj }) => void) => {
        tilesOn[event] = cb;
      }),
      addTo: vi.fn(() => {
        log.push('tileAdd');
      }),
    })),
    divIcon: vi.fn((x: AnyObj) => x),
    marker: vi.fn(() => {
      const el = fakeElement('div');
      const marker = {
        addTo: vi.fn(() => marker),
        getElement: vi.fn(() => el),
        setZIndexOffset: vi.fn(),
        bindPopup: vi.fn(() => marker),
        on: vi.fn(() => marker),
      };
      markers.push(marker);
      return marker;
    }),
    polyline: vi.fn(() => ({
      addTo: vi.fn(() => ({ getElement: vi.fn(() => fakeElement('path')) })),
    })),
  };
  return { leaflet, tilesOn, markers, map };
}

describe('orchestrator web map adapter guards', () => {
  it('controller keeps server order, fits before tiles, and cleans up observers/map', () => {
    const { doc, restore } = installFakeDocument();
    const log: string[] = [];
    const emitted: AnyObj[] = [];
    const { leaflet, tilesOn } = makeLeaflet(log);
    const rootChildren: AnyObj[] = [];
    const root: AnyObj = {
      host: {},
      append: (...nodes: AnyObj[]) => rootChildren.push(...nodes),
      replaceChildren: vi.fn(() => {
        rootChildren.length = 0;
      }),
    };

    const observers: AnyObj[] = [];
    const previousRO = (globalThis as AnyObj).ResizeObserver;
    (globalThis as AnyObj).ResizeObserver = class {
      disconnect = vi.fn();
      observe = vi.fn();
      constructor() {
        observers.push(this);
      }
    };

    const data = routeMapData(day());
    const controller = createWebMap(leaflet as never, root as never, data, event => emitted.push(event));
    expect(leaflet.map).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      zoomAnimation: false, markerZoomAnimation: false,
    }));

    expect(leaflet.tileLayer).toHaveBeenCalledWith(OSM_TILE_URL, expect.objectContaining({
      referrerPolicy: 'strict-origin-when-cross-origin',
      updateWhenIdle: true,
      keepBuffer: 0,
      maxZoom: 19,
    }));
    expect(log.indexOf('fitBounds')).toBeGreaterThanOrEqual(0);
    expect(log.indexOf('tileAdd')).toBeGreaterThan(log.indexOf('fitBounds'));

    const payloadNode = rootChildren.find(n => n.id === 'server-map-data');
    expect(payloadNode).toBeTruthy();
    if (!payloadNode) throw new Error('missing server-map-data');
    const payload = JSON.parse(payloadNode.textContent ?? '{}');
    expect(payload.stops.map((s: { number: string }) => s.number)).toEqual(['1', '2']);
    expect(payload.geometry).toEqual([
      [45.1, 9.1],
      [45.6, 9.9],
      [45.2, 9.2],
    ]);

    tilesOn.tileload?.({});
    const tile = fakeElement('img');
    tilesOn.tileerror?.({ tile });
    expect(tile.style.visibility).toBe('hidden');
    expect(emitted).toContainEqual({ type: 'ready' });
    expect(emitted).toContainEqual({ type: 'tile-error' });

    controller.destroy();
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    expect(root.replaceChildren).toHaveBeenCalledTimes(1);
    expect(log.includes('remove')).toBe(true);

    (globalThis as AnyObj).ResizeObserver = previousRO;
    restore();
    expect(doc.createElement).toHaveBeenCalled();
  });

  it('loader is singleton, SRI pinned, noConflict used, and failure is retryable', async () => {
    const { headChildren, restore } = installFakeDocument();
    let first = true;
    const appendSpy = ((globalThis as AnyObj).document.head.appendChild as ReturnType<typeof vi.fn>);
    appendSpy.mockImplementation((node: AnyObj) => {
      headChildren.push(node);
      if (node.src?.includes('leaflet@1.9.4')) {
        setTimeout(() => {
          if (first) {
            first = false;
            node.onerror?.(new Error('boom'));
          } else {
            (globalThis as AnyObj).window = {
              ...(globalThis as AnyObj).window,
              L: {
                version: '1.9.4',
                noConflict: () => ({ version: '1.9.4' }),
              },
            };
            node.onload?.();
          }
        }, 0);
      }
      return node;
    });

    await expect(loadWebLeaflet()).rejects.toThrow('LEAFLET_LOAD_FAILED');
    const resolved = await loadWebLeaflet();
    expect(resolved.version).toBe('1.9.4');
    await expect(loadWebLeaflet()).resolves.toBe(resolved);
    expect(headChildren.filter(n => n.tagName === 'SCRIPT')).toHaveLength(2); // Failed first load, one successful retry, no third fetch.

    const script = headChildren.find(n => n.tagName === 'SCRIPT' && n.src?.includes('leaflet@1.9.4'));
    expect(script).toBeTruthy();
    if (!script) throw new Error('missing leaflet script');
    expect(script.integrity).toBe(LEAFLET_ASSETS.jsIntegrity);
    expect(script.crossOrigin).toBe('anonymous');
    restore();
  });

  it('static guards prevent iframe/srcDoc/eval/header spoof and keep native isolated', () => {
    const mapSurface = readFileSync('/app/frontend/components/aitour/orchestrator/MapSurface.tsx', 'utf8').toLowerCase();
    const mapController = readFileSync('/app/frontend/components/aitour/orchestrator/web-map-controller.ts', 'utf8').toLowerCase();
    const webLeaflet = readFileSync('/app/frontend/components/aitour/orchestrator/web-leaflet.ts', 'utf8');
    const nativeEntry = readFileSync('/app/frontend/components/aitour/orchestrator/MapSurface.native.tsx', 'utf8').toLowerCase();

    expect(mapSurface).not.toContain('iframe');
    expect(mapSurface).not.toContain('srcdoc');
    expect(mapSurface).toContain('attachshadow');

    expect(mapController).not.toContain('eval(');
    expect(mapController).not.toContain('innerhtml');
    expect(mapController).not.toContain('setrequestheader');
    expect(mapController).toContain("referrerpolicy: 'strict-origin-when-cross-origin'");
    expect(webLeaflet).toContain("OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'");

    expect(nativeEntry).not.toContain('createwebmap');
    expect(nativeEntry).not.toContain('loadwebleaflet');
  });
});
