"""Iteration 84/85 durable map recenter browser proof (synthetic auth/Supabase/GPS only)."""

from __future__ import annotations

import json
import time
from pathlib import Path
from urllib.parse import urlparse

from dotenv import dotenv_values
from playwright.async_api import expect

try:
    from tests.e2e.iter79_orchestrator_authenticated_synthetic import (
        AUTH_STORAGE_KEY,
        MIGRATION_FLAG_KEY,
        build_auth_payload,
    )
except ModuleNotFoundError:
    from iter79_orchestrator_authenticated_synthetic import (  # type: ignore
        AUTH_STORAGE_KEY,
        MIGRATION_FLAG_KEY,
        build_auth_payload,
    )


CONFIG = dotenv_values('/app/frontend/.env')
PREVIEW_URL = CONFIG['EXPO_PACKAGER_PROXY_URL'].rstrip('/')
SUPABASE_URL = CONFIG['EXPO_PUBLIC_SUPABASE_URL'].rstrip('/')
PREVIEW_HOST = urlparse(PREVIEW_URL).netloc
SUPABASE_HOST = urlparse(SUPABASE_URL).netloc
PREVIEW_ORIGIN = f"{urlparse(PREVIEW_URL).scheme}://{PREVIEW_HOST}"
ARTIFACT_DIR = Path('/app/test_reports/artifacts_iter85')


def _point(id_: str, lat: float, lng: float):
    return {
        'id': id_,
        'denominazione': f'TEST_{id_}',
        'indirizzo': 'Via Test 1',
        'comune': 'Milano',
        'provincia': 'MI',
        'cap': '20100',
        'gps_lat': str(lat),
        'gps_lng': str(lng),
        'customer_id': None,
        'agente_id': '11111111-1111-4111-8111-111111111111',
        'stato_visita': 'non_visitato',
        'telefono_mobile': None,
        'telefono_fisso': None,
        'email': None,
        'customers': None,
    }


async def run(page):
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    state = {'unknown_business': [], 'page_errors': []}

    async def fulfill_json(route, payload, status=200, headers=None):
        h = {'content-type': 'application/json'}
        if headers:
            h.update(headers)
        await route.fulfill(status=status, headers=h, body=json.dumps(payload))

    async def handler(route):
        req = route.request
        url = req.url
        method = req.method.upper()
        parsed = urlparse(url)

        if parsed.netloc == PREVIEW_HOST and method in ('GET', 'HEAD') and not parsed.path.startswith('/api/'):
            await route.continue_()
            return

        if parsed.netloc == 'unpkg.com' and method in ('GET', 'HEAD'):
            if parsed.path.startswith('/leaflet@1.9.4/') or parsed.path.startswith('/leaflet.markercluster@1.5.3/'):
                await route.continue_()
                return
            state['unknown_business'].append({'url': url, 'method': method, 'reason': 'blocked-unpkg-path'})
            await fulfill_json(route, {'error': 'blocked'}, status=503)
            return

        if parsed.netloc in ('tile.openstreetmap.org', 'a.tile.openstreetmap.org', 'b.tile.openstreetmap.org', 'c.tile.openstreetmap.org') and method in ('GET', 'HEAD'):
            await route.continue_()
            return

        if parsed.netloc == SUPABASE_HOST:
            if method == 'OPTIONS':
                await fulfill_json(route, {})
                return
            if '/auth/v1/user' in url:
                await fulfill_json(route, build_auth_payload()['user'])
                return
            if '/auth/v1/token' in url:
                await fulfill_json(route, build_auth_payload())
                return
            if '/auth/v1/logout' in url:
                await fulfill_json(route, {})
                return
            if '/rest/v1/profiles' in url:
                profile = {
                    'id': '11111111-1111-4111-8111-111111111111',
                    'email': 'gptour-fixture@example.test',
                    'full_name': 'Synthetic User',
                    'role': 'agent',
                    'agent_id': '11111111-1111-4111-8111-111111111111',
                    'supervisor_id': None,
                    'branch_id': None,
                    'is_active': True,
                    'created_at': '2026-01-01T00:00:00.000Z',
                    'updated_at': '2026-01-01T00:00:00.000Z',
                }
                accept = (req.headers or {}).get('accept', '')
                headers = {'content-range': '0-0/1', 'access-control-expose-headers': 'content-range'}
                if 'application/vnd.pgrst.object+json' in accept:
                    await fulfill_json(route, profile, status=200, headers=headers)
                else:
                    await fulfill_json(route, [profile], status=200, headers=headers)
                return
            if '/rest/v1/rpc/get_orphan_tabaccherie_ids' in url:
                await fulfill_json(route, [], status=200)
                return
            if '/rest/v1/rpc/tabaccherie_points_in_bbox' in url:
                await fulfill_json(route, [], status=200)
                return
            if '/rest/v1/tabaccherie' in url:
                rows = [_point('tab-1', 45.4702, 9.1901), _point('tab-2', 45.4610, 9.1885)]
                await fulfill_json(route, rows, status=200, headers={'content-range': '0-1/2', 'access-control-expose-headers': 'content-range'})
                return
            if '/rest/v1/' in url:
                await fulfill_json(route, [], status=200, headers={'content-range': '0-0/0', 'access-control-expose-headers': 'content-range'})
                return

        if '/api/' in url or 'supabase' in parsed.netloc:
            state['unknown_business'].append({'url': url, 'method': method})
        await fulfill_json(route, {'error': 'blocked'}, status=503)

    await page.context.route('**/*', handler)
    page.on('pageerror', lambda error: state['page_errors'].append(str(error)))
    await page.context.grant_permissions(['geolocation'], origin=PREVIEW_ORIGIN)

    auth = build_auth_payload()
    await page.add_init_script(
        f"""
        (() => {{
          if (window !== window.top) return;
          if (window === window.top) {{
            const payload = {json.dumps({'k': AUTH_STORAGE_KEY, 'v': auth, 'm': MIGRATION_FLAG_KEY})};
            localStorage.setItem(payload.k, JSON.stringify(payload.v));
            localStorage.setItem(payload.m, '1');
            localStorage.setItem('@privacy_terms_accepted', 'true');
            localStorage.setItem('@privacy_terms_accepted_date', new Date().toISOString());
          }}

          const state = {{
            watchCount: 0,
            clearWatchCount: 0,
            nextId: 1,
            listeners: new Map(),
            archived: new Map(),
            mapCreations: 0,
            mapInstance: null,
            blueMarker: null,
            leafletHooked: false,
          }};
          window.__MAP_TEST__ = state;

          const originalPermissionsQuery = navigator.permissions?.query?.bind(navigator.permissions);
          if (navigator.permissions) {{
            navigator.permissions.query = (descriptor) => {{
              if (descriptor && descriptor.name === 'geolocation') return Promise.resolve({{ state: 'granted', onchange: null }});
              return originalPermissionsQuery
                ? originalPermissionsQuery(descriptor)
                : Promise.resolve({{ state: 'prompt', onchange: null }});
            }};
          }}

          const toBrowserSample = (sample) => ({{
            coords: {{
              latitude: sample.coords.latitude,
              longitude: sample.coords.longitude,
              accuracy: sample.coords.accuracy,
              altitude: sample.coords.altitude ?? null,
              altitudeAccuracy: sample.coords.altitudeAccuracy ?? null,
              heading: sample.coords.heading ?? null,
              speed: sample.coords.speed ?? null,
            }},
            timestamp: sample.timestamp,
          }});

          Object.defineProperty(navigator, 'geolocation', {{
            configurable: true,
            value: {{
              watchPosition(success, error) {{
                const id = state.nextId++;
                state.watchCount += 1;
                state.listeners.set(id, {{ success, error }});
                return id;
              }},
              clearWatch(id) {{
                state.clearWatchCount += 1;
                const listener = state.listeners.get(id);
                if (listener) state.archived.set(id, listener);
                state.listeners.delete(id);
              }},
              getCurrentPosition(success) {{
                success({{
                  coords: {{ latitude: 45.45, longitude: 9.18, accuracy: 15, altitude: null, altitudeAccuracy: null, heading: null, speed: null }},
                  timestamp: Date.now(),
                }});
              }}
            }}
          }});

          window.__emitGeoToActive = (id, sample) => {{
            const listener = state.listeners.get(id);
            if (!listener) return false;
            listener.success(toBrowserSample(sample));
            return true;
          }};
          window.__emitGeoToArchived = (id, sample) => {{
            const listener = state.archived.get(id);
            if (!listener) return false;
            listener.success(toBrowserSample(sample));
            return true;
          }};
          window.__emitGeoLatest = (sample) => {{
            const ids = Array.from(state.listeners.keys());
            const id = ids[ids.length - 1];
            if (!id) return false;
            return window.__emitGeoToActive(id, sample);
          }};
          window.__failGeoActive = (id, message = 'position unavailable') => {{
            const listener = state.listeners.get(id);
            if (!listener) return false;
            listener.error({{ code: 2, message }});
            return true;
          }};

          const installLeafletHooks = (L) => {{
            if (!L || state.leafletHooked) return;
            state.leafletHooked = true;
            if (L.Map?.addInitHook) {{
              L.Map.addInitHook(function() {{
                state.mapCreations += 1;
                if (!state.mapInstance) state.mapInstance = this;
              }});
            }}
            if (L.Marker?.prototype?.initialize) {{
              const originalInit = L.Marker.prototype.initialize;
              L.Marker.prototype.initialize = function(latlng, options) {{
                const result = originalInit.apply(this, arguments);
                if (options?.zIndexOffset === -1000 && !state.blueMarker) state.blueMarker = this;
                return result;
              }};
            }}
          }};

          if (window.L) installLeafletHooks(window.L);
          try {{
            let currentL = window.L;
            Object.defineProperty(window, 'L', {{
              configurable: true,
              get() {{ return currentL; }},
              set(value) {{ currentL = value; installLeafletHooks(value); }},
            }});
          }} catch (_err) {{}}

          window.__mapMetrics = () => {{
            const center = state.mapInstance?.getCenter?.();
            const marker = state.blueMarker?.getLatLng?.();
            return {{
              watchCount: state.watchCount,
              clearWatchCount: state.clearWatchCount,
              activeListeners: state.listeners.size,
              archivedListeners: state.archived.size,
              activeIds: Array.from(state.listeners.keys()),
              archivedIds: Array.from(state.archived.keys()),
              mapCreations: state.mapCreations,
              center: center ? {{ lat: center.lat, lng: center.lng }} : null,
              marker: marker ? {{ lat: marker.lat, lng: marker.lng }} : null,
            }};
          }};
          window.__mapReadCenter = () => window.__mapMetrics().center;
          window.__mapReadMarker = () => window.__mapMetrics().marker;
        }})();
        """
    )

    await page.set_viewport_size({'width': 390, 'height': 844})
    await page.goto(PREVIEW_URL, wait_until='domcontentloaded')

    await page.get_by_test_id('tab-map').click()
    await page.wait_for_function('window.__mapMetrics().activeListeners === 1', timeout=40000)
    await page.evaluate(
        """() => {
        const now = Date.now();
        window.__emitGeoLatest({
          coords: { latitude: 45.45001, longitude: 9.18001, accuracy: 12, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
          timestamp: now,
        });
      }"""
    )

    await expect(page.get_by_test_id('map-screen')).to_be_visible(timeout=20000)
    await expect(page.get_by_test_id('map-recenter-button')).to_be_visible(timeout=20000)
    await expect(page.get_by_test_id('map-web-surface')).to_be_visible(timeout=20000)
    await page.wait_for_function('window.__mapMetrics().mapCreations === 1', timeout=20000)

    first_center = await page.evaluate('window.__mapReadCenter()')
    assert first_center and abs(first_center['lat'] - 45.45001) < 0.00025 and abs(first_center['lng'] - 9.18001) < 0.00025

    before = await page.evaluate('window.__mapMetrics()')
    await page.evaluate('window.__MAP_TEST__.mapInstance.zoomIn()')
    await page.get_by_test_id('map-recenter-button').click()
    await page.wait_for_function(f'window.__mapMetrics().watchCount === {before["watchCount"] + 1} && window.__mapMetrics().activeListeners === 1', timeout=15000)
    watch_b = await page.evaluate('window.__mapMetrics().activeIds.at(-1)')

    await page.evaluate(
        """(id) => {
        const now = Date.now();
        window.__emitGeoToActive(id, {
          coords: { latitude: 45.45001, longitude: 9.18001, accuracy: 15, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
          timestamp: now - 60000,
        });
      }""",
        watch_b,
    )
    center_after_stale = await page.evaluate('window.__mapReadCenter()')
    assert center_after_stale and abs(center_after_stale['lat'] - 45.45001) < 0.00025 and abs(center_after_stale['lng'] - 9.18001) < 0.00025
    assert await page.get_by_test_id('map-recenter-loading').is_visible()

    await page.evaluate(
        """(id) => {
        const now = Date.now();
        window.__emitGeoToActive(id, {
          coords: { latitude: 45.47001, longitude: 9.21001, accuracy: 9, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
          timestamp: now,
        });
      }""",
        watch_b,
    )
    await page.wait_for_function('window.__mapMetrics().activeListeners === 0 && Math.abs(window.__mapReadCenter().lat - 45.47001) < 0.00025 && Math.abs(window.__mapReadMarker().lat - 45.47001) < 0.00025', timeout=20000)
    center_b = await page.evaluate('window.__mapReadCenter()')
    marker_b = await page.evaluate('window.__mapReadMarker()')
    assert center_b and abs(center_b['lat'] - 45.47001) < 0.00025 and abs(center_b['lng'] - 9.21001) < 0.00025
    assert marker_b and abs(marker_b['lat'] - 45.47001) < 0.00025 and abs(marker_b['lng'] - 9.21001) < 0.00025
    await expect(page.get_by_test_id('map-recenter-button')).to_be_enabled()
    await page.wait_for_function("""() => {
      const images = Array.from(document.querySelectorAll('#leaflet-map-container img.leaflet-tile-loaded'));
      const layers = Object.values(window.__MAP_TEST__.mapInstance._layers);
      return images.some(img => img.naturalWidth > 0) && layers.filter(l => l.isLoading).every(l => !l.isLoading());
    }""", timeout=20000)
    await page.screenshot(path=str(ARTIFACT_DIR / 'iter85_point_b.jpeg'), quality=20, full_page=False)

    metrics_after_b = await page.evaluate('window.__mapMetrics()')
    target_watch = metrics_after_b['watchCount'] + 1
    recenter_btn = page.get_by_test_id('map-recenter-button')
    await expect(recenter_btn).to_be_enabled()
    # One real double-click action: don't wait for a deliberately disabled second click
    # before delivering the very GPS sample that enables it again.
    await recenter_btn.click(click_count=2, delay=40)
    await page.wait_for_function(f'window.__mapMetrics().watchCount === {target_watch} && window.__mapMetrics().activeListeners === 1', timeout=10000)
    await expect(recenter_btn).to_be_disabled()
    guard_metrics = await page.evaluate('window.__mapMetrics()')
    assert guard_metrics['watchCount'] == target_watch
    watch_guard = guard_metrics['activeIds'][-1]
    await page.evaluate(
        """(id) => {
        const now = Date.now();
        window.__emitGeoToActive(id, {
          coords: { latitude: 45.47001, longitude: 9.21001, accuracy: 7, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
          timestamp: now,
        });
      }""",
        watch_guard,
    )
    await page.wait_for_function('window.__mapMetrics().activeListeners === 0', timeout=20000)
    await expect(recenter_btn).to_be_enabled()

    await page.evaluate(
        """(id) => {
        const now = Date.now();
        window.__emitGeoToArchived(id, {
          coords: { latitude: 45.45001, longitude: 9.18001, accuracy: 6, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
          timestamp: now,
        });
      }""",
        watch_guard,
    )
    await page.get_by_text('Attivi', exact=True).first.click()
    center_after_filter = await page.evaluate('window.__mapReadCenter()')
    assert center_after_filter and abs(center_after_filter['lat'] - 45.47001) < 0.00025 and abs(center_after_filter['lng'] - 9.21001) < 0.00025
    assert (await page.evaluate('window.__mapMetrics().mapCreations')) == 1

    before_error = await page.evaluate('window.__mapMetrics()')
    await page.get_by_test_id('map-recenter-button').click()
    await page.wait_for_function(f'window.__mapMetrics().watchCount === {before_error["watchCount"] + 1} && window.__mapMetrics().activeListeners === 1', timeout=12000)
    watch_error = await page.evaluate('window.__mapMetrics().activeIds.at(-1)')
    await page.evaluate('id => window.__failGeoActive(id)', watch_error)
    await expect(page.get_by_test_id('map-location-notice')).to_be_visible(timeout=8000)
    await expect(recenter_btn).to_be_enabled()
    await page.screenshot(path=str(ARTIFACT_DIR / 'iter85_notice.jpeg'), quality=20, full_page=False)

    center_after_error = await page.evaluate('window.__mapReadCenter()')
    assert center_after_error and abs(center_after_error['lat'] - 45.47001) < 0.00025 and abs(center_after_error['lng'] - 9.21001) < 0.00025

    before_retry = await page.evaluate('window.__mapMetrics()')
    await page.get_by_test_id('map-recenter-button').click()
    await page.wait_for_function(f'window.__mapMetrics().watchCount === {before_retry["watchCount"] + 1} && window.__mapMetrics().activeListeners === 1', timeout=12000)
    watch_c = await page.evaluate('window.__mapMetrics().activeIds.at(-1)')
    await page.evaluate(
        """(id) => {
        const now = Date.now();
        window.__emitGeoToActive(id, {
          coords: { latitude: 45.50001, longitude: 9.23001, accuracy: 7, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
          timestamp: now,
        });
      }""",
        watch_c,
    )
    await page.wait_for_function('window.__mapMetrics().activeListeners === 0 && Math.abs(window.__mapReadCenter().lat - 45.50001) < 0.00025 && Math.abs(window.__mapReadMarker().lat - 45.50001) < 0.00025', timeout=20000)
    center_c = await page.evaluate('window.__mapReadCenter()')
    marker_c = await page.evaluate('window.__mapReadMarker()')
    assert center_c and abs(center_c['lat'] - 45.50001) < 0.00025 and abs(center_c['lng'] - 9.23001) < 0.00025
    assert marker_c and abs(marker_c['lat'] - 45.50001) < 0.00025 and abs(marker_c['lng'] - 9.23001) < 0.00025
    await expect(recenter_btn).to_be_enabled()
    await page.wait_for_function("""() => {
      const layers = Object.values(window.__MAP_TEST__.mapInstance._layers);
      return layers.filter(l => l.isLoading).every(l => !l.isLoading()) && Array.from(document.querySelectorAll('#leaflet-map-container img.leaflet-tile-loaded')).some(img => img.naturalWidth > 0);
    }""", timeout=20000)
    await page.screenshot(path=str(ARTIFACT_DIR / 'iter85_point_c.jpeg'), quality=20, full_page=False)

    final_metrics = await page.evaluate('window.__mapMetrics()')
    assert final_metrics['clearWatchCount'] == final_metrics['archivedListeners']
    assert final_metrics['activeListeners'] == 0
    assert final_metrics['watchCount'] == final_metrics['clearWatchCount'] == 5
    assert final_metrics['mapCreations'] == 1
    assert not state['unknown_business'], state['unknown_business']
    assert not state['page_errors'], state['page_errors']

    await page.set_viewport_size({'width': 320, 'height': 568})
    assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')

    return {
        'ok': True,
        'watchCount': final_metrics['watchCount'],
        'clearWatchCount': final_metrics['clearWatchCount'],
        'mapCreations': final_metrics['mapCreations'],
        'activeListeners': final_metrics['activeListeners'],
        'unknown_business': len(state['unknown_business']),
        'page_errors': len(state['page_errors']),
        'ts': int(time.time()),
    }
