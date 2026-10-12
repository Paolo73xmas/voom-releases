import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { routeMapData, routeMapDocument } from '../components/aitour/orchestrator/route-map-document';
import type { DayView } from '../lib/aitour/orchestrator/contract';

function day(overrides?: Partial<DayView>): DayView {
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
    ],
    geometry: [
      { latitude: 45.1, longitude: 9.1 },
      { latitude: 45.6, longitude: 9.9 }, // detour outside stops: must still be fitted
      { latitude: 45.2, longitude: 9.2 },
    ],
    metrics: [],
    breaks: [],
    commitments: [],
    warnings: [],
    geometryKind: 'server',
    ...overrides,
  };
}

describe('orchestrator route map presentation guards', () => {
  it('keeps exact server geometry order and includes every geometry point in fit set', () => {
    const d = day();
    const payload = routeMapData(d);
    expect(payload.geometry).toEqual([
      [45.1, 9.1],
      [45.6, 9.9],
      [45.2, 9.2],
    ]);

    const html = routeMapDocument(d);
    expect(html).toContain('var points=[data.start.point].concat(data.geometry,data.stops.map(function(s){return s.point;}),data.end?[data.end.point]:[])');
    expect(html).toContain("if(data.geometry.length>1)");
    expect(html).toContain('orchestrator-map-start');
    expect(html).toContain('orchestrator-map-return');
    expect(html).toContain('orchestrator-map-stop-');
  });

  it('never invents polyline geometry for missing/connections payloads', () => {
    expect(routeMapData(day({ geometryKind: 'missing', geometry: [] })).geometry).toEqual([]);
    // A single received vertex is preserved, but cannot produce a polyline (length > 1 guard).
    expect(routeMapData(day({ geometryKind: 'missing', geometry: [{ latitude: 45.1, longitude: 9.1 }] })).geometry).toEqual([[45.1, 9.1]]);
    expect(routeMapData(day({ geometryKind: 'connections', geometry: [{ latitude: 45.1, longitude: 9.1 }, { latitude: 45.2, longitude: 9.2 }] })).geometry).toEqual([]);
  });

  it('map/stoplist presentation files do not import legacy engine, OSRM or GPS readers', () => {
    const paths = [
      '/app/frontend/components/aitour/orchestrator/RouteMap.tsx',
      '/app/frontend/components/aitour/orchestrator/route-map-document.ts',
      '/app/frontend/components/aitour/orchestrator/ServerStopList.tsx',
      '/app/frontend/components/aitour/orchestrator/ServerPlan.tsx',
    ];
    for (const p of paths) {
      const src = readFileSync(p, 'utf8').toLowerCase();
      expect(/from\s+['"][^'"]*tourmapview/.test(src)).toBe(false);
      expect(/import\(['"][^'"]*tourmapview/.test(src)).toBe(false);
      expect(/fetch\([^)]*osrm/.test(src)).toBe(false);
      expect(src.includes('navigator.geolocation')).toBe(false);
      expect(src.includes('legacyengine')).toBe(false);
    }
  });
});
