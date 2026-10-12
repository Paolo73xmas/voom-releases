"""Iteration 81 orchestrator presentation harness (synthetic-only).

Goals:
- Fail-closed network guard BEFORE navigation.
- Top-frame-only bootstrap (avoid iframe localStorage sandbox errors).
- Real map rendering assertions (Leaflet + OSM tiles), not placeholder/frame-only checks.
- Updated for open Shadow DOM adapter (no iframe dependency).
"""

from __future__ import annotations

import json
from copy import deepcopy
from typing import Any, Dict, List
from urllib.parse import urlparse

from dotenv import dotenv_values
from playwright.async_api import expect

from tests.e2e.iter79_orchestrator_authenticated_synthetic import (
    AUTH_STORAGE_KEY,
    MIGRATION_FLAG_KEY,
    build_auth_payload,
)


CONFIG = dotenv_values("/app/frontend/.env")
PREVIEW_URL = CONFIG["EXPO_PACKAGER_PROXY_URL"].rstrip("/")
SUPABASE_URL = CONFIG["EXPO_PUBLIC_SUPABASE_URL"].rstrip("/")
PREVIEW_HOST = urlparse(PREVIEW_URL).netloc
SUPABASE_HOST = urlparse(SUPABASE_URL).netloc


def _day(
    day: int,
    date: str,
    start_min: int,
    finish_min: int,
    end_min: int,
    departure: Dict[str, Any],
    return_to: Dict[str, Any],
    stops: List[Dict[str, Any]],
    totals: Dict[str, Any],
    geometry: List[List[float]],
    starts_from: str,
    return_home_after_day: bool,
    night_decision: str,
    warnings: List[str] | None = None,
) -> Dict[str, Any]:
    return {
        "day": day,
        "date": date,
        "startMin": start_min,
        "finishMin": finish_min,
        "endMin": end_min,
        "departure": departure,
        "returnTo": return_to,
        "stops": stops,
        "totals": totals,
        "geometry": geometry,
        "startsFrom": starts_from,
        "returnHomeAfterDay": return_home_after_day,
        "nightKmHome": None,
        "nightDecision": night_decision,
        "warnings": warnings or [],
        "conflicts": [],
    }


def _base_response(
    req: Dict[str, Any],
    state: Dict[str, Any],
    *,
    status: str,
    revision: int,
    question: Dict[str, Any] | None,
    day2_geometry_mode: str = "server",
) -> Dict[str, Any]:
    start_min = state["start_min"]
    common_totals = {
        "driveMin": 72,
        "visitMin": 60,
        "waitMin": 0,
        "breakMin": 0,
        "returnMin": 28,
        "totalMin": 160,
        "availableMin": 510,
        "bufferMin": 350,
        "totalKm": 44.8,
    }
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
            "name": "Cliente Beta Nome Molto Molto Lungo Per Verifica Compatta e Dettaglio Completo",
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
    # Includes a detour outside stop bounds: must still be fitted.
    day1_geometry = [
        [45.3480, 9.1640],
        [45.5700, 9.5100],
        [45.4200, 9.1800],
        [45.3750, 9.1300],
        [45.3480, 9.1640],
    ]

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
    if day2_geometry_mode == "missing":
        day2_geometry = []
        day2_warning = ["Geometria server assente per il giorno 2"]
    elif day2_geometry_mode == "single":
        day2_geometry = [[45.3650, 9.2150]]
        day2_warning = ["Geometria server con punto singolo: nessuna polyline"]
    else:
        day2_geometry = [[45.4500, 9.2100], [45.3650, 9.2150], [45.3480, 9.1640]]
        day2_warning = []

    days = [
        _day(
            1,
            "2026-10-13",
            start_min,
            930,
            1020,
            {"lat": 45.3480, "lng": 9.1640, "label": "Casa"},
            {"lat": 45.3480, "lng": 9.1640, "label": "Casa"},
            day1_stops,
            common_totals,
            day1_geometry,
            "home",
            False,
            "threshold",
        ),
        _day(
            2,
            "2026-10-14",
            start_min + 30,
            910,
            1020,
            {"lat": 45.4500, "lng": 9.2100, "label": "Fine giorno precedente"},
            {"lat": 45.3480, "lng": 9.1640, "label": "Casa"},
            day2_stops,
            {
                "driveMin": 58,
                "visitMin": 25,
                "waitMin": 0,
                "breakMin": 0,
                "returnMin": 36,
                "totalMin": 119,
                "availableMin": 570,
                "bufferMin": 451,
                "totalKm": 33.2,
            },
            day2_geometry,
            "previous_day_end",
            True,
            "last_day",
            day2_warning,
        ),
    ]

    plan = {
        "planId": state["plan_id"],
        "sessionId": req.get("sessionId"),
        "sessionRevision": revision,
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
        "totals": common_totals,
        "geometry": day1_geometry,
        "warnings": [],
        "conflicts": [],
        "verification": "verified_routing" if status == "ready" else "estimated_routing",
        "snapshotRef": "snapshot-iter81",
        "selectionReasons": {
            "selected": [{"key": "cust:day1-1", "reason": "cliente con relazione commerciale"}],
            "excluded": [{"key": "tab:999", "name": "Tabaccheria Esclusa", "reason": "fuori territorio"}],
        },
        "dependsOnPendingChanges": [] if status == "ready" else ["pending-routing-confirmation"],
        "days": days,
    }

    criteria_start = "08:00" if start_min == 480 else "07:00"
    message = "Piano pronto e verificato."
    if question:
        message = question["text"]
    elif status == "planning":
        message = "Bozza pronta: verifico routing per conferma."

    return {
        "status": status,
        "contractVersion": "1.0",
        "engineVersion": "gptour-orchestrator/0.2.0",
        "sessionId": req.get("sessionId"),
        "sessionRevision": revision,
        "requestId": req.get("requestId"),
        "generatedAt": "2026-10-12T15:00:00.000Z",
        "message": message,
        "question": question,
        "criteria": {
            "groups": {"version": 1, "existing": True, "newPoints": True, "ownOnly": False, "inactiveDays": 20, "needsDays": False},
            "area": {"comuni": ["MILANO", "OPERA"], "provincia": None, "exhaustive": False},
            "date": "2026-10-13",
            "dateAnchorTurn": 1,
            "startTime": criteria_start,
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
        "pendingDecisions": ["follow_up:fu-1", "follow_up:fu-2"] if question else [],
        "plan": None if status == "needs_clarification" else plan,
        "planId": None if status == "needs_clarification" else state["plan_id"],
        "conflicts": [],
        "dataQuality": {
            "candidatesComplete": True,
            "poolTruncated": False,
            "purchasesVerified": True,
            "registryVerified": True,
            "routingSource": "osrm" if status == "ready" else "estimate",
            "notes": [],
        },
        "metrics": {"durationMs": 1450, "crmQueries": 6, "aiCalls": 0, "routingCalls": 2},
    }


async def run(page):
    state: Dict[str, Any] = {
        "probe_status": 400,
        "revision": 0,
        "plan_id": "plan-synthetic-81",
        "start_min": 420,
        "last_snapshot": None,
        "raw_bodies": [],
        "unknown_business": [],
        "console_errors": [],
        "react_key_warnings": [],
        "page_errors": [],
        "request_log": [],
        "fail_script_once": False,
        "fail_tile_once": False,
        "retry_503_seen": False,
        "last_conflict_revision": None,
        "day2_mode": "server",
    }

    def q_followups() -> Dict[str, Any]:
        return {
            "id": "followups:fu-1,fu-2",
            "kind": "follow_ups",
            "text": "Decidi follow-up:\n• Cliente A\n• Cliente B",
            "options": [
                {"id": "include_all", "label": "Includili tutti"},
                {"id": "exclude_all", "label": "Lasciali fuori dal giro"},
            ],
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

        # Allow static app assets on preview host.
        if host == PREVIEW_HOST and method in ("GET", "HEAD") and not path.startswith("/api/"):
            await route.continue_()
            return

        # Allow real Leaflet + real OSM tiles for healthy path.
        if host == "unpkg.com" and method in ("GET", "HEAD"):
            if state["fail_script_once"] and path.endswith("leaflet.css"):
                state["fail_script_once"] = False
                await route.abort("failed")
                return
            await route.continue_()
            return
        if host.endswith("tile.openstreetmap.org") and method in ("GET", "HEAD"):
            if state["fail_tile_once"]:
                state["fail_tile_once"] = False
                await route.abort("failed")
                return
            await route.continue_()
            return

        # Supabase + edge function IO mocked.
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
                state["raw_bodies"].append(json.dumps(body, sort_keys=True))

                if body.get("contractVersion") == "1.0" and len(body.keys()) == 1:
                    await fulfill_json(route, {"error": "probe"}, status=state["probe_status"])
                    return

                action = (body.get("action") or {}).get("type")
                message = (body.get("message") or "").lower().strip()

                if action == "get_plan":
                    assert state["last_snapshot"] is not None
                    snap = deepcopy(state["last_snapshot"])
                    snap["requestId"] = body["requestId"]
                    if "action" in body and isinstance(body["action"], dict):
                        assert body["action"].get("planId") == snap.get("planId")
                    await fulfill_json(route, snap, status=200)
                    return

                if message == "retry503" and not state["retry_503_seen"]:
                    state["retry_503_seen"] = True
                    await fulfill_json(route, {"error": "temporary"}, status=503)
                    return

                if message == "conflitto":
                    state["revision"] += 1
                    state["last_conflict_revision"] = state["revision"]
                    conflict = _base_response(body, state, status="ready", revision=state["revision"], question=None)
                    conflict["status"] = "failed"
                    conflict["plan"] = None
                    conflict["planId"] = None
                    conflict["errorCode"] = "revision_conflict"
                    conflict["message"] = "Revisione cambiata"
                    conflict["conflicts"] = ["revision_conflict"]
                    await fulfill_json(route, conflict, status=409)
                    return

                if "parto alle8" in message or "parto alle 8" in message:
                    state["start_min"] = 480
                if "empty geometry" in message:
                    state["day2_mode"] = "missing"
                elif "single point" in message:
                    state["day2_mode"] = "single"
                elif "restore day2" in message:
                    state["day2_mode"] = "server"

                state["revision"] += 1
                if message == "domanda":
                    response = _base_response(
                        body,
                        state,
                        status="needs_clarification",
                        revision=state["revision"],
                        question=q_followups(),
                        day2_geometry_mode=state["day2_mode"],
                    )
                elif message == "domanda distinta":
                    response = _base_response(body, state, status="needs_clarification", revision=state["revision"], question={
                        "id": "distinct-q", "kind": "date", "text": "Quale giornata preferisci?",
                        "options": [{"id": "tomorrow", "label": "Domani"}],
                    })
                    response["message"] = "Conservo anche questo messaggio introduttivo."
                elif action == "follow_up_decision":
                    response = _base_response(
                        body,
                        state,
                        status="ready",
                        revision=state["revision"],
                        question=None,
                        day2_geometry_mode=state["day2_mode"],
                    )
                else:
                    response = _base_response(
                        body,
                        state,
                        status="ready",
                        revision=state["revision"],
                        question=None,
                        day2_geometry_mode=state["day2_mode"],
                    )
                state["last_snapshot"] = deepcopy(response)
                await fulfill_json(route, response, status=200)
                return

        # Fail-closed for all non-whitelisted routes.
        if "/api/" in url or "supabase" in host:
            state["unknown_business"].append({"url": url, "method": method})
        await fulfill_json(route, {"error": "blocked"}, status=503)

    page.on("pageerror", lambda error: state["page_errors"].append(str(error)))

    def _console_listener(msg):
        text = msg.text or ""
        if "Encountered two children with the same key" in text:
            state["react_key_warnings"].append(text)
        if "Failed to read the 'localStorage'" in text:
            state["console_errors"].append(text)

    page.on("console", _console_listener)

    await page.set_viewport_size({"width": 390, "height": 844})
    await page.route("**/*", handler)

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

    await page.goto(PREVIEW_URL, wait_until="domcontentloaded")

    # Access path.
    await page.get_by_test_id("tab-more").click()
    card = page.get_by_test_id("menu-gptour-orchestrator")
    await expect(card).to_be_visible()
    await card.click()
    composer = page.get_by_test_id("orchestrator-message-input")
    send = page.get_by_test_id("orchestrator-send")
    await expect(composer).to_be_editable()

    # (1) message==question.text + options + no duplicate DOM text.
    await composer.fill("domanda")
    await send.click()
    q_node = page.get_by_test_id("orchestrator-question-text-followups:fu-1,fu-2")
    await expect(q_node).to_contain_text("Cliente A")
    await expect(q_node).to_contain_text("Cliente B")
    visible_question_count = await page.locator("text=Decidi follow-up:").count()
    assert visible_question_count == 1, f"Expected 1 visible question, got {visible_question_count}"
    for opt in ("include_all", "exclude_all"):
        await expect(page.get_by_test_id(f"orchestrator-answer-followups:fu-1,fu-2-{opt}")).to_be_visible()
    for name in ("Cliente A", "Cliente B"):
        await expect(page.get_by_text(name, exact=True)).to_have_count(1)

    before_follow = len(state["request_log"])
    await page.get_by_test_id("orchestrator-follow-up-fu-1-include").click()
    await expect(page.get_by_test_id("orchestrator-ready-plan")).to_be_visible()
    assert len(state["request_log"]) == before_follow + 1
    assert state["request_log"][-1]["body"].get("action", {}).get("type") == "follow_up_decision"

    # same assistant text across turns must remain two messages.
    await composer.fill("stessa risposta")
    await send.click()
    await expect(composer).to_be_editable()
    await composer.fill("stessa risposta")
    await send.click()
    await expect(composer).to_be_editable()
    await expect(page.get_by_text("Piano pronto e verificato.", exact=True)).to_have_count(3)
    await composer.fill("domanda distinta")
    await send.click()
    await expect(page.get_by_text("Quale giornata preferisci?", exact=True)).to_have_count(1)
    await expect(page.get_by_text("Conservo anche questo messaggio introduttivo.", exact=True)).to_have_count(1)
    before_answer = len(state["request_log"])
    await page.get_by_test_id("orchestrator-answer-distinct-q-tomorrow").click()
    await expect(composer).to_be_editable()
    assert len(state["request_log"]) == before_answer + 1
    assert state["request_log"][-1]["body"]["action"] == {"type": "answer", "questionId": "distinct-q", "optionId": "tomorrow"}
    await expect(page.get_by_text("Quale giornata preferisci?", exact=True)).to_have_count(1)
    msg_ids = await page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-testid^="orchestrator-message-"]'))
            .map(el => el.getAttribute('data-testid') || '')"""
    )
    assert len(set(msg_ids)) == len(msg_ids)

    # (2) Day1 map frame, real Leaflet route/markers/payload/tile.
    before_map_actions = len(state["request_log"])
    map_frame = page.get_by_test_id("orchestrator-map-frame")
    await map_frame.scroll_into_view_if_needed()
    await expect(page.get_by_test_id("orchestrator-map-ready")).to_be_visible(timeout=20000)
    map_surface = page.get_by_test_id("orchestrator-map-surface")
    await expect(page.locator('[data-testid="orchestrator-map-canvas"]')).to_be_visible(timeout=10000)
    route_path = page.locator('path[data-testid="orchestrator-server-route"]')
    await expect(route_path).to_be_visible()
    d_attr = await route_path.get_attribute("d")
    assert d_attr and d_attr.strip(), "Expected non-empty SVG path d"
    await expect(page.locator('[data-testid="orchestrator-map-start"]')).to_be_visible()
    await expect(page.locator('[data-testid="orchestrator-map-return"]')).to_be_visible()
    await expect(page.locator('[data-testid="orchestrator-map-stop-1-1"]')).to_be_visible()
    await expect(page.locator('[data-testid="orchestrator-map-stop-1-2"]')).to_be_visible()

    is_shadow = await map_surface.evaluate("el => !!el.shadowRoot")
    assert is_shadow is True

    payload = await map_surface.evaluate(
        """el => JSON.parse((el.shadowRoot && el.shadowRoot.querySelector('#server-map-data')?.textContent) || '{}')"""
    )
    assert payload["geometry"] == [[45.348, 9.164], [45.57, 9.51], [45.42, 9.18], [45.375, 9.13], [45.348, 9.164]]
    assert [s["number"] for s in payload["stops"]] == ["1", "2"]

    fit_check = await map_surface.evaluate(
        """() => {
          const root = document.querySelector('[data-testid="orchestrator-map-surface"]')?.shadowRoot;
          const map = root?.querySelector('#map');
          const route = root?.querySelector('[data-testid="orchestrator-server-route"]');
          const markers = Array.from(root?.querySelectorAll('[data-testid^="orchestrator-map-stop-"]') || []);
          if (!map || !route || markers.length < 2) return {ok:false};
          const mr = map.getBoundingClientRect();
          const rr = route.getBoundingClientRect();
          const mins = markers.map(m => m.getBoundingClientRect());
          const minLeft = Math.min(...mins.map(r => r.left));
          const maxRight = Math.max(...mins.map(r => r.right));
          const minTop = Math.min(...mins.map(r => r.top));
          const maxBottom = Math.max(...mins.map(r => r.bottom));
          const routeExtends = rr.left < minLeft || rr.right > maxRight || rr.top < minTop || rr.bottom > maxBottom;
          const inViewport = rr.left >= mr.left - 2 && rr.right <= mr.right + 2 && rr.top >= mr.top - 2 && rr.bottom <= mr.bottom + 2;
          return {ok:true, routeExtends, inViewport};
        }"""
    )
    assert fit_check.get("ok") and fit_check.get("inViewport")
    assert fit_check.get("routeExtends"), "Detour not reflected beyond marker envelope"

    await expect(page.locator("img.leaflet-tile-loaded").first).to_have_js_property("naturalWidth", 256)
    await page.screenshot(path="/tmp/iter81_embedded_map_rows.jpeg", quality=20, full_page=False)

    # (3) Marker click in shadow map selects parent row + detail.
    await page.locator('[data-testid="orchestrator-map-stop-1-2"]').click()
    await expect(page.get_by_test_id("orchestrator-selected-stop")).to_be_visible()
    await expect(page.get_by_test_id("orchestrator-selected-stop-name")).to_contain_text("Cliente Beta")
    selected_row = page.get_by_test_id("orchestrator-stop-1-2")
    await expect(selected_row).to_be_visible()
    aria_selected = await selected_row.get_attribute("aria-selected")
    if aria_selected is not None:
        assert aria_selected == "true"
    selected_color = await selected_row.evaluate("el => getComputedStyle(el).backgroundColor")
    other_color = await page.get_by_test_id("orchestrator-stop-1-1").evaluate("el => getComputedStyle(el).backgroundColor")
    assert selected_color != other_color

    await page.get_by_test_id("orchestrator-selected-stop-detail").click()
    await expect(page.get_by_test_id("orchestrator-stop-detail")).to_be_visible()
    await expect(page.get_by_test_id("orchestrator-stop-detail-name")).to_contain_text(
        "Cliente Beta Nome Molto Molto Lungo"
    )
    await page.get_by_test_id("orchestrator-stop-detail-close").click()

    # List-row tap opens detail with summary fields.
    row_box = await page.get_by_test_id("orchestrator-stop-1-2").bounding_box()
    assert row_box and row_box["height"] <= 90 and row_box["height"] >= 44
    await page.get_by_test_id("orchestrator-stop-1-2").click()
    await expect(page.get_by_test_id("orchestrator-stop-detail-last-order")).to_be_visible()
    await expect(page.get_by_test_id("orchestrator-stop-detail-reason")).to_be_visible()
    await expect(page.get_by_test_id("orchestrator-stop-detail-server-actions")).to_be_visible()
    await page.wait_for_function("""() => {
        let el = document.querySelector('[data-testid="orchestrator-stop-detail"]');
        if (!el) return false;
        for (; el; el=el.parentElement) if (Number(getComputedStyle(el).opacity) < 1) return false;
        return true;
    }""")
    await page.screenshot(path="/tmp/iter81_detail_sheet.jpeg", quality=20, full_page=False)
    await page.get_by_test_id("orchestrator-stop-detail-done").click()

    # Fullscreen map with real svg/markers; click marker2 closes + highlights.
    embed_height = (await map_frame.bounding_box())["height"]
    await page.get_by_test_id("orchestrator-map-expand").click()
    full_surface = page.get_by_test_id("orchestrator-full-map-surface")
    await expect(page.locator('[data-testid="orchestrator-full-map-surface"] [data-testid="orchestrator-map-canvas"]')).to_be_visible(timeout=10000)
    await expect(page.locator('[data-testid="orchestrator-server-route"]')).to_be_visible()
    await page.locator('[data-testid="orchestrator-map-stop-1-2"]').click()
    await expect(page.get_by_test_id("orchestrator-map-fullscreen")).to_be_hidden(timeout=5000)
    await expect(page.get_by_test_id("orchestrator-selected-stop-name")).to_contain_text("Cliente Beta")

    await page.get_by_test_id("orchestrator-map-expand").click()
    await expect(page.get_by_test_id("orchestrator-map-fullscreen")).to_be_visible()
    full_modal = page.get_by_test_id("orchestrator-map-fullscreen")
    full_box = await full_modal.bounding_box()
    assert full_box and full_box["height"] > embed_height
    await expect(page.get_by_test_id("orchestrator-full-map-ready")).to_be_visible()
    await expect(page.locator("img.leaflet-tile-loaded").first).to_have_js_property("naturalWidth", 256)
    await page.wait_for_function("() => document.getAnimations().every(a => a.playState !== 'running')")
    await page.screenshot(path="/tmp/iter81_full_map.jpeg", quality=20, full_page=False)
    await page.get_by_test_id("orchestrator-map-reduce").click()

    # 320 checks: compact taps + detail scroll + close controls.
    await page.set_viewport_size({"width": 320, "height": 568})
    await page.get_by_test_id("orchestrator-stop-1-2").scroll_into_view_if_needed()
    await page.get_by_test_id("orchestrator-stop-1-2").click()
    await page.get_by_test_id("orchestrator-stop-detail-scroll").evaluate("el => el.scrollTop = el.scrollHeight")
    await expect(page.get_by_test_id("orchestrator-stop-detail-done")).to_be_visible()
    await page.get_by_test_id("orchestrator-stop-detail-done").click()
    assert await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    assert len(state["request_log"]) == before_map_actions

    # Exact server action from detail, not a local modification/reorder.
    await page.get_by_test_id("orchestrator-stop-1-2").click()
    await page.get_by_test_id("orchestrator-stop-action-1-2-require").click()
    await expect(composer).to_be_editable()
    assert len(state["request_log"]) == before_map_actions + 1
    assert state["request_log"][-1]["body"]["action"] == {"type": "require_stop", "key": "cust:day1-2"}

    # (4) Day2 switch, no stale selection, day persists after time update.
    await page.set_viewport_size({"width": 390, "height": 844})
    await page.get_by_test_id("orchestrator-day-2").click()
    await expect(page.get_by_test_id("orchestrator-selected-stop")).to_have_count(0)
    await expect(page.locator('[data-testid="orchestrator-map-stop-2-1"]')).to_be_visible()
    day2_payload = await map_surface.evaluate(
        """el => JSON.parse((el.shadowRoot && el.shadowRoot.querySelector('#server-map-data')?.textContent) || '{}')"""
    )
    assert day2_payload["geometry"] == [[45.45, 9.21], [45.365, 9.215], [45.348, 9.164]]

    await composer.fill("Parto alle8")
    await send.click()
    await expect(page.get_by_test_id("orchestrator-day-start")).to_contain_text("08:30")
    await expect(page.get_by_test_id("orchestrator-day-date")).to_contain_text("2026-10-14")

    await composer.fill("empty geometry")
    await send.click()
    await expect(page.get_by_test_id("orchestrator-map-no-geometry")).to_be_visible()
    assert await page.locator('[data-testid="orchestrator-server-route"]').count() == 0
    await expect(page.locator('[data-testid="orchestrator-map-stop-2-1"]')).to_be_visible()
    assert (
        await map_surface.evaluate(
            """el => JSON.parse((el.shadowRoot && el.shadowRoot.querySelector('#server-map-data')?.textContent) || '{}')"""
        )
    ).get("geometry") == []

    await composer.fill("single point")
    await send.click()
    await expect(page.get_by_test_id("orchestrator-map-no-geometry")).to_be_visible()
    await expect(page.locator('[data-testid="orchestrator-map-stop-2-1"]')).to_be_visible()
    assert await page.locator('[data-testid="orchestrator-server-route"]').count() == 0
    assert (
        await map_surface.evaluate(
            """el => JSON.parse((el.shadowRoot && el.shadowRoot.querySelector('#server-map-data')?.textContent) || '{}')"""
        )
    ).get("geometry") == [[45.365, 9.215]]

    # Map show/hide should not call edge.
    before_local = len(state["request_log"])
    await page.get_by_test_id("orchestrator-toggle-map").click()
    await page.get_by_test_id("orchestrator-toggle-map").click()
    assert len(state["request_log"]) == before_local

    # (5) controlled tile/script failure -> local retry only, no extra edge calls.
    state["fail_tile_once"] = True
    before_fail_local = len(state["request_log"])
    await page.get_by_test_id("orchestrator-toggle-map").click()
    await page.get_by_test_id("orchestrator-toggle-map").click()
    await expect(page.get_by_test_id("orchestrator-map-error")).to_be_visible(timeout=15000)
    await page.get_by_test_id("orchestrator-map-retry").click()
    await expect(page.get_by_test_id("orchestrator-map-ready")).to_be_visible(timeout=20000)
    assert len(state["request_log"]) == before_fail_local

    state["fail_script_once"] = True
    await page.get_by_test_id("orchestrator-toggle-map").click()
    await page.get_by_test_id("orchestrator-toggle-map").click()
    await expect(page.get_by_test_id("orchestrator-map-error-text")).to_contain_text("non si è caricata")
    await page.get_by_test_id("orchestrator-map-retry").click()
    await expect(page.get_by_test_id("orchestrator-map-ready")).to_be_visible(timeout=20000)
    assert len(state["request_log"]) == before_fail_local

    # Rapid duplicate send click -> one business call.
    before_dupe = len(state["request_log"])
    await composer.fill("rapid duplicate click")
    await send.click()
    await send.dispatch_event("click")
    await expect(page.get_by_test_id("orchestrator-ready-plan")).to_be_visible()
    after_dupe = len(state["request_log"])
    assert after_dupe == before_dupe + 1

    # 503 retry exact body.
    await composer.fill("retry503")
    await send.click()
    await expect(page.get_by_test_id("orchestrator-error")).to_be_visible()
    first_retry_body = deepcopy(state["request_log"][-1]["body"])
    await page.get_by_test_id("orchestrator-retry").click()
    await expect(page.get_by_test_id("orchestrator-ready-plan")).to_be_visible()
    second_retry_body = deepcopy(state["request_log"][-1]["body"])
    assert first_retry_body == second_retry_body

    # 409 conflict then explicit new ID with expectedRevision.
    await composer.fill("conflitto")
    await send.click()
    await expect(page.get_by_test_id("orchestrator-conflict-revision")).to_be_visible()
    conflict_body = deepcopy(state["request_log"][-1]["body"])
    await composer.fill("nuovo turno dopo conflitto")
    await send.click()
    fresh = deepcopy(state["request_log"][-1]["body"])
    assert fresh["requestId"] != conflict_body["requestId"]
    assert fresh["expectedRevision"] == state["last_conflict_revision"]

    # Recovery after reload: only probe + get_plan, and transcript unchanged.
    state["day2_mode"] = "server"
    await composer.fill("restore day2")
    await send.click()
    before_reload_calls = len(state["request_log"])
    messages_before = await page.locator('[data-testid^="orchestrator-message-"]').count()
    await page.reload(wait_until="domcontentloaded")
    await expect(page.get_by_test_id("orchestrator-message-input")).to_be_editable()
    calls = state["request_log"][before_reload_calls:]
    assert len(calls) == 2
    assert calls[0]["body"] == {"contractVersion": "1.0"}
    assert calls[1]["body"].get("action") == {"type": "get_plan", "planId": state["last_snapshot"]["planId"]}
    messages_after = await page.locator('[data-testid^="orchestrator-message-"]').count()
    assert messages_after == messages_before
    await expect(page.get_by_text("Quale giornata preferisci?", exact=True)).to_have_count(1)
    await expect(page.get_by_text("Conservo anche questo messaggio introduttivo.", exact=True)).to_have_count(1)
    await page.get_by_test_id("orchestrator-map-frame").scroll_into_view_if_needed()
    await expect(page.get_by_test_id("orchestrator-map-ready")).to_be_visible(timeout=20000)
    assert await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    # (6) explicit no duplicate-key warnings / no pageerrors / no iframe-bootstrap localStorage error.
    assert not state["page_errors"], state["page_errors"]
    assert not state["react_key_warnings"], state["react_key_warnings"]
    assert not state["console_errors"], state["console_errors"]
    assert not state["unknown_business"], state["unknown_business"]

    return {
        "ok": True,
        "requests": len(state["request_log"]),
        "unknown_business": len(state["unknown_business"]),
        "react_duplicate_keys": len(state["react_key_warnings"]),
        "page_errors": len(state["page_errors"]),
        "screenshots": [
            "/tmp/iter81_embedded_map_rows.jpeg",
            "/tmp/iter81_full_map.jpeg",
            "/tmp/iter81_detail_sheet.jpeg",
        ],
    }
