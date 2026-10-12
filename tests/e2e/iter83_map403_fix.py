"""Iteration 83: Map 403 post-fix regression (browser preview, synthetic auth/edge only).

Scope:
- Real app renderer (Shadow DOM + Leaflet) and real OSM tiles.
- Fail-closed mocked auth/edge/rest; no real credentials or business calls.
- Captures outbound tile headers + one PNG sample for evidence.
"""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List
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


CONFIG = dotenv_values("/app/frontend/.env")
PREVIEW_URL = CONFIG["EXPO_PACKAGER_PROXY_URL"].rstrip("/")
SUPABASE_URL = CONFIG["EXPO_PUBLIC_SUPABASE_URL"].rstrip("/")
PREVIEW_HOST = urlparse(PREVIEW_URL).netloc
SUPABASE_HOST = urlparse(SUPABASE_URL).netloc
PREVIEW_ORIGIN = f"{urlparse(PREVIEW_URL).scheme}://{PREVIEW_HOST}/"
ARTIFACT_DIR = Path("/app/test_reports/artifacts_iter83")


def _day(
    day: int,
    date: str,
    start_min: int,
    stops: List[Dict[str, Any]],
    geometry: List[List[float]],
    start_label: str,
):
    return {
        "day": day,
        "date": date,
        "startMin": start_min,
        "finishMin": 930,
        "endMin": 1020,
        "departure": {"lat": 45.3480, "lng": 9.1640, "label": start_label},
        "returnTo": {"lat": 45.3480, "lng": 9.1640, "label": "Casa"},
        "stops": stops,
        "totals": {
            "driveMin": 72,
            "visitMin": 60,
            "waitMin": 0,
            "breakMin": 0,
            "returnMin": 28,
            "totalMin": 160,
            "availableMin": 510,
            "bufferMin": 350,
            "totalKm": 44.8,
        },
        "geometry": geometry,
        "startsFrom": "home" if day == 1 else "previous_day_end",
        "returnHomeAfterDay": day == 2,
        "nightKmHome": None,
        "nightDecision": "last_day" if day == 2 else "threshold",
        "warnings": [],
        "conflicts": [],
    }


def _response(req: Dict[str, Any], state: Dict[str, Any], *, status: str = "ready") -> Dict[str, Any]:
    start_min = state["start_min"]
    day1_stops = [
        {
            "key": "cust:day1-1",
            "name": "Cliente Alfa",
            "city": "MILANO",
            "lat": 45.4200,
            "lng": 9.1800,
            "role": "required_by_agent",
            "group": "existing",
            "arrivalMin": start_min + 20,
            "departureMin": start_min + 50,
            "travelMinFromPrev": 20,
            "travelKmFromPrev": 11,
            "waitMin": 0,
            "visitMin": 30,
            "lunchBeforeMin": 0,
            "reason": "prima tappa consigliata dal server",
            "lastOrderDate": "2026-09-18",
            "daysSinceOrder": 24,
            "outsideWindow": False,
        },
        {
            "key": "cust:day1-2",
            "name": "Cliente Beta",
            "city": "ROZZANO",
            "lat": 45.3750,
            "lng": 9.1300,
            "role": "suggested",
            "group": "new",
            "arrivalMin": start_min + 65,
            "departureMin": start_min + 95,
            "travelMinFromPrev": 15,
            "travelKmFromPrev": 7,
            "waitMin": 0,
            "visitMin": 30,
            "lunchBeforeMin": 0,
            "reason": "nuovo punto con priorità commerciale",
            "lastOrderDate": "2026-08-15",
            "daysSinceOrder": 58,
            "outsideWindow": False,
        },
    ]
    day1_geometry = [
        [45.3480, 9.1640],
        [45.5700, 9.5100],
        [45.4200, 9.1800],
        [45.3750, 9.1300],
        [45.3480, 9.1640],
    ]

    if state["day2_mode"] == "missing":
        day2_geometry = []
    elif state["day2_mode"] == "single":
        day2_geometry = [[45.3650, 9.2150]]
    else:
        day2_geometry = [[45.4500, 9.2100], [45.3650, 9.2150], [45.3480, 9.1640]]

    day2_stops = [
        {
            "key": "cust:day2-1",
            "name": "Cliente Gamma",
            "city": "OPERA",
            "lat": 45.3650,
            "lng": 9.2150,
            "role": "follow_up_confirmed",
            "group": "existing",
            "arrivalMin": start_min + 35,
            "departureMin": start_min + 60,
            "travelMinFromPrev": 16,
            "travelKmFromPrev": 8,
            "waitMin": 0,
            "visitMin": 25,
            "lunchBeforeMin": 0,
            "reason": "follow-up confermato",
            "lastOrderDate": "2026-08-22",
            "daysSinceOrder": 51,
            "outsideWindow": False,
        }
    ]

    days = [
        _day(1, "2026-10-13", start_min, day1_stops, day1_geometry, "Casa"),
        _day(2, "2026-10-14", start_min + 30, day2_stops, day2_geometry, "Fine giorno precedente"),
    ]

    plan = {
        "planId": state["plan_id"],
        "sessionId": req.get("sessionId"),
        "sessionRevision": state["revision"],
        "engineVersion": "gptour-orchestrator/0.2.0",
        "contractVersion": "1.0",
        "generatedAt": "2026-10-12T15:00:00.000Z",
        "date": "2026-10-13",
        "startMin": start_min,
        "finishMin": 930,
        "endMin": 1020,
        "departure": {"lat": 45.3480, "lng": 9.1640, "label": "Casa"},
        "returnTo": {"lat": 45.3480, "lng": 9.1640, "label": "Casa"},
        "stops": day1_stops,
        "totals": {
            "driveMin": 72,
            "visitMin": 60,
            "waitMin": 0,
            "breakMin": 0,
            "returnMin": 28,
            "totalMin": 160,
            "availableMin": 510,
            "bufferMin": 350,
            "totalKm": 44.8,
        },
        "geometry": day1_geometry,
        "warnings": [],
        "conflicts": [],
        "verification": "verified_routing",
        "snapshotRef": "snapshot-iter83",
        "selectionReasons": {"selected": [], "excluded": []},
        "dependsOnPendingChanges": [],
        "days": days,
    }
    return {
        "status": status,
        "contractVersion": "1.0",
        "engineVersion": "gptour-orchestrator/0.2.0",
        "sessionId": req.get("sessionId"),
        "sessionRevision": state["revision"],
        "requestId": req.get("requestId"),
        "generatedAt": "2026-10-12T15:00:00.000Z",
        "message": "Piano pronto e verificato.",
        "question": None,
        "criteria": {
            "groups": {"version": 1, "existing": True, "newPoints": True, "ownOnly": False, "inactiveDays": 20, "needsDays": False},
            "area": {"comuni": ["MILANO", "OPERA"], "provincia": None, "exhaustive": False},
            "date": "2026-10-13",
            "dateAnchorTurn": 1,
            "startTime": "08:00" if start_min == 480 else "07:00",
            "endTime": "16:30",
            "wantAll": False,
            "nonWorkingConfirmed": False,
            "maxDays": 2,
            "extraDaysApproved": False,
            "requiredKeys": ["cust:day1-1"],
            "requiredNames": ["Cliente Alfa"],
            "excludedNames": [],
            "excludedKeys": [],
            "consents": [],
        },
        "pendingDecisions": [],
        "plan": None if status == "needs_clarification" else plan,
        "planId": None if status == "needs_clarification" else state["plan_id"],
        "conflicts": [],
        "dataQuality": {
            "candidatesComplete": True,
            "poolTruncated": False,
            "purchasesVerified": True,
            "registryVerified": True,
            "routingSource": "osrm",
            "notes": [],
        },
        "metrics": {"durationMs": 1200, "crmQueries": 4, "aiCalls": 0, "routingCalls": 2},
    }


async def run(page):
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    state: Dict[str, Any] = {
        "probe_status": 400,
        "revision": 0,
        "plan_id": "plan-synthetic-83",
        "start_min": 420,
        "day2_mode": "server",
        "last_snapshot": None,
        "request_log": [],
        "unknown_business": [],
        "page_errors": [],
        "tile_requests": [],
        "tile_responses": [],
        "tile_png_saved": False,
        "tile_fail_once": False,
        "script_fail_once": False,
        "leaflet_requests": 0,
        "tile_failure_overlay_seen": False,
        "script_failure_overlay_seen": False,
    }

    async def fulfill_json(route, payload, status=200, headers=None):
        h = {"content-type": "application/json"}
        if headers:
            h.update(headers)
        await route.fulfill(status=status, headers=h, body=json.dumps(payload))

    async def handler(route):
        req = route.request
        url = req.url
        method = req.method.upper()
        parsed = urlparse(url)
        host = parsed.netloc
        path = parsed.path

        if host == PREVIEW_HOST and method in ("GET", "HEAD") and not path.startswith("/api/"):
            await route.continue_()
            return

        if host == "unpkg.com" and method in ("GET", "HEAD"):
            if path.endswith("leaflet.js"):
                state["leaflet_requests"] += 1
            if state["script_fail_once"] and path.endswith("leaflet.js"):
                await route.abort("failed")
                return
            await route.continue_()
            return

        if host == "tile.openstreetmap.org" and method in ("GET", "HEAD"):
            req_headers = await req.all_headers()
            state["tile_requests"].append(
                {
                    "url": url,
                    "method": method,
                    "headers": req_headers,
                }
            )
            if state["tile_fail_once"]:
                await route.fulfill(status=403, content_type="text/plain", body="Controlled test: tile access denied")
                return
            await route.continue_()
            return

        if host == SUPABASE_HOST:
            if method == "OPTIONS":
                await fulfill_json(route, {})
                return
            if "/auth/v1/user" in url:
                await fulfill_json(route, build_auth_payload()["user"])
                return
            if "/auth/v1/token" in url:
                await fulfill_json(route, build_auth_payload())
                return
            if "/auth/v1/logout" in url:
                await fulfill_json(route, {})
                return
            if "/rest/v1/profiles" in url:
                profile = {
                    "id": "11111111-1111-4111-8111-111111111111",
                    "email": "gptour-fixture@example.test",
                    "full_name": "Synthetic User",
                    "role": "agent",
                    "agent_id": "11111111-1111-4111-8111-111111111111",
                    "supervisor_id": None,
                    "branch_id": None,
                    "is_active": True,
                    "created_at": "2026-01-01T00:00:00.000Z",
                    "updated_at": "2026-01-01T00:00:00.000Z",
                }
                accept = (req.headers or {}).get("accept", "")
                headers = {"content-range": "0-0/1", "access-control-expose-headers": "content-range"}
                if "application/vnd.pgrst.object+json" in accept:
                    await fulfill_json(route, profile, status=200, headers=headers)
                else:
                    await fulfill_json(route, [profile], status=200, headers=headers)
                return
            if "/rest/v1/" in url:
                await fulfill_json(route, [], status=200, headers={"content-range": "0-0/0", "access-control-expose-headers": "content-range"})
                return
            if "/functions/v1/gptour-orchestrator" in url:
                body = req.post_data_json or {}
                state["request_log"].append({"url": url, "method": method, "body": deepcopy(body)})
                if body.get("contractVersion") == "1.0" and len(body.keys()) == 1:
                    await fulfill_json(route, {"error": "probe"}, status=state["probe_status"])
                    return
                if (body.get("action") or {}).get("type") == "get_plan":
                    snap = deepcopy(state["last_snapshot"])
                    snap["requestId"] = body["requestId"]
                    await fulfill_json(route, snap, status=200)
                    return
                message = (body.get("message") or "").lower().strip()
                if "parto alle8" in message or "parto alle 8" in message:
                    state["start_min"] = 480
                if "empty geometry" in message:
                    state["day2_mode"] = "missing"
                elif "single point" in message:
                    state["day2_mode"] = "single"
                elif "restore day2" in message:
                    state["day2_mode"] = "server"
                state["revision"] += 1
                response = _response(body, state, status="ready")
                state["last_snapshot"] = deepcopy(response)
                await fulfill_json(route, response, status=200)
                return

        if "/api/" in url or "supabase" in host:
            state["unknown_business"].append({"url": url, "method": method})
        await fulfill_json(route, {"error": "blocked"}, status=503)

    async def response_handler(response):
        url = response.url
        parsed = urlparse(url)
        if parsed.netloc == "tile.openstreetmap.org":
            headers = await response.all_headers()
            state["tile_responses"].append(
                {
                    "url": url,
                    "status": response.status,
                    "headers": headers,
                }
            )
            if (not state["tile_png_saved"]) and response.status == 200 and "image/png" in headers.get("content-type", ""):
                data = await response.body()
                (ARTIFACT_DIR / "iter83_tile_sample.png").write_bytes(data)
                state["tile_png_saved"] = True

    context = page.context
    page.on("pageerror", lambda error: state["page_errors"].append(str(error)))
    page.on("response", response_handler)
    await context.route("**/*", handler)

    auth = build_auth_payload()
    await page.add_init_script(
        f"""
        (() => {{
          if (window !== window.top) return;
          const payload = {json.dumps({'k': AUTH_STORAGE_KEY, 'v': auth, 'm': MIGRATION_FLAG_KEY})};
          localStorage.setItem(payload.k, JSON.stringify(payload.v));
          localStorage.setItem(payload.m, '1');
          localStorage.setItem('@privacy_terms_accepted', 'true');
          localStorage.setItem('@privacy_terms_accepted_date', new Date().toISOString());
        }})();
        """
    )

    async def open_orchestrator(target_page):
        await target_page.get_by_test_id("tab-more").click()
        card = target_page.get_by_test_id("menu-gptour-orchestrator")
        await expect(card).to_be_visible()
        await card.click()
        composer = target_page.get_by_test_id("orchestrator-message-input")
        await expect(composer).to_be_editable()
        return composer, target_page.get_by_test_id("orchestrator-send")

    await page.set_viewport_size({"width": 390, "height": 844})
    await page.goto(PREVIEW_URL, wait_until="domcontentloaded")
    composer, send = await open_orchestrator(page)

    await composer.fill("ready plan")
    await send.click()
    await expect(page.get_by_test_id("orchestrator-map-ready")).to_be_visible(timeout=20000)
    map_surface = page.get_by_test_id("orchestrator-map-surface")
    assert await map_surface.evaluate("el => !!el.shadowRoot") is True
    assert await page.locator('[data-testid="orchestrator-map-surface"] iframe').count() == 0

    route = page.locator('path[data-testid="orchestrator-server-route"]')
    await expect(route).to_be_visible()
    d_attr = await route.get_attribute("d")
    assert d_attr and d_attr.strip()

    payload = await map_surface.evaluate(
        """el => JSON.parse((el.shadowRoot && el.shadowRoot.querySelector('#server-map-data')?.textContent) || '{}')"""
    )
    assert payload["geometry"] == [[45.348, 9.164], [45.57, 9.51], [45.42, 9.18], [45.375, 9.13], [45.348, 9.164]]
    assert [s["number"] for s in payload["stops"]] == ["1", "2"]
    await expect(page.locator('[data-testid="orchestrator-map-start"]')).to_be_visible()
    await expect(page.locator('[data-testid="orchestrator-map-return"]')).to_be_visible()
    await expect(page.locator('[data-testid="orchestrator-map-stop-1-1"]')).to_be_visible()
    await expect(page.locator('[data-testid="orchestrator-map-stop-1-2"]')).to_be_visible()

    await page.get_by_test_id("orchestrator-map-frame").scroll_into_view_if_needed()
    await expect(page.locator("img.leaflet-tile-loaded").first).to_have_js_property("naturalWidth", 256)
    await page.screenshot(path=str(ARTIFACT_DIR / "iter83_map_embed_390.jpeg"), quality=20, full_page=False)
    assert await page.get_by_text("Access blocked", exact=False).count() == 0
    await expect(page.get_by_test_id("orchestrator-map-error")).to_have_count(0)

    await page.locator('[data-testid="orchestrator-map-stop-1-2"]').click()
    await expect(page.get_by_test_id("orchestrator-selected-stop-name")).to_contain_text("Cliente Beta")
    await page.get_by_test_id("orchestrator-selected-stop-detail").click()
    await expect(page.get_by_test_id("orchestrator-stop-detail")).to_be_visible()
    await page.get_by_test_id("orchestrator-stop-detail-done").click()

    await page.get_by_test_id("orchestrator-map-expand").click()
    await expect(page.get_by_test_id("orchestrator-full-map-ready")).to_be_visible(timeout=20000)
    await page.locator('.leaflet-control-zoom-in').first.click()
    await page.wait_for_function("() => document.getAnimations().every(a => a.playState !== 'running')")
    await page.screenshot(path=str(ARTIFACT_DIR / "iter83_map_full_390.jpeg"), quality=20, full_page=False)
    await page.get_by_test_id("orchestrator-map-reduce").click()

    await page.get_by_test_id("orchestrator-day-2").click()
    await expect(page.locator('[data-testid="orchestrator-map-stop-2-1"]')).to_be_visible()
    day2_payload = await map_surface.evaluate(
        """el => JSON.parse((el.shadowRoot && el.shadowRoot.querySelector('#server-map-data')?.textContent) || '{}')"""
    )
    assert day2_payload["geometry"] == [[45.45, 9.21], [45.365, 9.215], [45.348, 9.164]]

    # Missing geometry is already covered by the full suite: avoid redundant live tile remounts.
    local_before = len(state["request_log"])
    state["tile_fail_once"] = True
    await page.get_by_test_id("orchestrator-toggle-map").click()
    await page.get_by_test_id("orchestrator-toggle-map").click()
    await expect(page.get_by_test_id("orchestrator-map-error")).to_be_visible(timeout=6000)
    state["tile_failure_overlay_seen"] = True
    state["tile_fail_once"] = False
    await page.get_by_test_id("orchestrator-map-retry").click()
    await expect(page.get_by_test_id("orchestrator-map-ready")).to_be_visible(timeout=20000)
    assert len(state["request_log"]) == local_before

    # Fresh page context for JS load failure (singleton on warm remount should not force refetch).
    page2 = await context.new_page()
    page2.on("pageerror", lambda error: state["page_errors"].append(str(error)))
    page2.on("response", response_handler)
    try:
        await page2.set_viewport_size({"width": 390, "height": 844})
        await page2.add_init_script(
            f"""
            (() => {{
              if (window !== window.top) return;
              const payload = {json.dumps({'k': AUTH_STORAGE_KEY, 'v': auth, 'm': MIGRATION_FLAG_KEY})};
              localStorage.setItem(payload.k, JSON.stringify(payload.v));
              localStorage.setItem(payload.m, '1');
              localStorage.setItem('@privacy_terms_accepted', 'true');
              localStorage.setItem('@privacy_terms_accepted_date', new Date().toISOString());
            }})();
            """
        )
        state["script_fail_once"] = True
        before_leaflet = state["leaflet_requests"]
        await page2.goto(PREVIEW_URL, wait_until="domcontentloaded")
        await open_orchestrator(page2)
        # Opening recovers the persisted plan. Sending another turn would erase that error state.
        await expect(page2.get_by_test_id("orchestrator-map-error-text")).to_contain_text("non si è caricata", timeout=20000)
        assert state["leaflet_requests"] > before_leaflet
        state["script_failure_overlay_seen"] = True
        state["script_fail_once"] = False
        before_script_retry = len(state["request_log"])
        await page2.get_by_test_id("orchestrator-map-retry").click()
        await expect(page2.get_by_test_id("orchestrator-map-ready")).to_be_visible(timeout=20000)
        assert len(state["request_log"]) == before_script_retry
    finally:
        await page2.close()

    for width, height in ((390, 844), (320, 568)):
        await page.set_viewport_size({"width": width, "height": height})
        await expect(page.get_by_test_id("orchestrator-message-input")).to_be_visible()
        await page.get_by_test_id("orchestrator-map-frame").scroll_into_view_if_needed()
        await expect(page.get_by_test_id("orchestrator-map-ready")).to_be_visible(timeout=20000)
        assert await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        await page.screenshot(path=str(ARTIFACT_DIR / f"iter83_map_{width}.jpeg"), quality=20, full_page=False)

    assert not state["unknown_business"], state["unknown_business"]
    assert not state["page_errors"], state["page_errors"]

    assert state["tile_requests"], "No OSM tile requests captured"
    tile_budget_ok = len(state["tile_requests"]) <= 60
    assert tile_budget_ok, f"Tile request budget exceeded: {len(state['tile_requests'])}"

    # Validate one real outbound tile request with browser-generated Referer.
    req_sample = next((r for r in state["tile_requests"] if urlparse(r["url"]).netloc == "tile.openstreetmap.org"), None)
    assert req_sample is not None
    assert req_sample["headers"].get("referer", "") == PREVIEW_ORIGIN
    assert urlparse(req_sample["url"]).query == ""
    assert all(r["headers"].get("referer") == PREVIEW_ORIGIN and not urlparse(r["url"]).query for r in state["tile_requests"])

    resp_sample = next((r for r in state["tile_responses"] if r["status"] == 200 and "image/png" in r["headers"].get("content-type", "")), None)
    assert resp_sample is not None
    assert state["tile_png_saved"] is True

    proof = {
        "preview_url": PREVIEW_URL,
        "preview_origin": PREVIEW_ORIGIN,
        "tile_request_count": len(state["tile_requests"]),
        "tile_budget_ok_le_60": tile_budget_ok,
        "tile_response_count": len(state["tile_responses"]),
        "leaflet_requests": state["leaflet_requests"],
        "tile_failure_overlay_seen": state["tile_failure_overlay_seen"],
        "script_failure_overlay_seen": state["script_failure_overlay_seen"],
        "unknown_business": len(state["unknown_business"]),
        "page_errors": state["page_errors"],
        "tile_request_sample": req_sample,
        "tile_response_sample": resp_sample,
        "screenshots": [
            str(ARTIFACT_DIR / "iter83_map_embed_390.jpeg"),
            str(ARTIFACT_DIR / "iter83_map_full_390.jpeg"),
            str(ARTIFACT_DIR / "iter83_map_390.jpeg"),
            str(ARTIFACT_DIR / "iter83_map_320.jpeg"),
        ],
        "tile_png": str(ARTIFACT_DIR / "iter83_tile_sample.png"),
    }
    (ARTIFACT_DIR / "iter83_tile_proof.json").write_text(json.dumps(proof, indent=2), encoding="utf-8")

    return {
        "ok": True,
        "tile_requests": len(state["tile_requests"]),
        "tile_responses": len(state["tile_responses"]),
        "proof": str(ARTIFACT_DIR / "iter83_tile_proof.json"),
    }
