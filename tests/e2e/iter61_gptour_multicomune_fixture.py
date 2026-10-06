"""Iteration 61: GPTour multi-comune accumulation fixture on web preview.

Scope:
- Reuse iter60 bootstrap/back-navigation helpers.
- Fully isolated Supabase/Auth/Edge/OSRM fixture (fail-closed).
- Validate real hook merge behavior across chat turns:
  1) "tabaccherie di Magenta"
  2) "aggiungi Sedriano e Bareggio"
- Verify chips include 3 comuni, plan keys limited to requested comuni,
  and outgoing 2nd/3rd Edge requests carry merged intent state.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

from iter60_gptour_back_navigation_fixture import (
    SUPABASE_URL,
    FIXTURE_AGENT_ID,
    inject_bootstrap_storage,
    wait_ai_tour_ready,
    build_auth_payload,
)


FIXTURE_DATE = "2099-11-15"


def _profile_obj() -> Dict[str, Any]:
    now = "2026-01-01T00:00:00.000Z"
    return {
        "id": FIXTURE_AGENT_ID,
        "email": "gptour-fixture@example.test",
        "full_name": "Fixture Agent",
        "role": "agent",
        "agent_id": FIXTURE_AGENT_ID,
        "supervisor_id": None,
        "branch_id": None,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }


def _settings_obj() -> Dict[str, Any]:
    return {
        "agent_id": FIXTURE_AGENT_ID,
        "work_start": "08:00",
        "work_end": "18:00",
        "visit_minutes_client": 20,
        "visit_minutes_prospect": 25,
        "visit_minutes_orphan": 25,
        "buffer_pct_clienti": 18,
        "buffer_pct_sviluppo": 35,
        "buffer_pct_mista": 25,
        "buffer_max_min": 60,
        "max_daily_buffer_minutes": 120,
        "cadence_weeks_active": 5,
        "cadence_weeks_low": 8,
        "lunch_break_minutes": 30,
        "home_address": "Casa Fixture",
        "home_lat": 45.4642,
        "home_lng": 9.19,
        "office_address": None,
        "office_lat": None,
        "office_lng": None,
    }


def _customers_rows() -> List[Dict[str, Any]]:
    return [
        {
            "id": "fixture-mag-1",
            "business_name": "TEST MAGENTA 1",
            "category": "client",
            "address": "Via Magenta 1",
            "city": "Magenta",
            "province": "MI",
            "latitude": 45.4650,
            "longitude": 8.8850,
            "last_visit_date": "2025-10-01",
            "last_order_date": "2025-10-15",
            "notes": "Fixture",
            "estimated_revenue": 700,
            "tabaccheria_id": None,
            "project_type": None,
            "preferred_visit_slots": None,
            "excluded_visit_days": None,
            "disabled": False,
        },
        {
            "id": "fixture-mag-2",
            "business_name": "TEST MAGENTA 2",
            "category": "client",
            "address": "Via Magenta 2",
            "city": "Magenta",
            "province": "MI",
            "latitude": 45.4670,
            "longitude": 8.8870,
            "last_visit_date": "2025-10-03",
            "last_order_date": "2025-10-16",
            "notes": "Fixture",
            "estimated_revenue": 710,
            "tabaccheria_id": None,
            "project_type": None,
            "preferred_visit_slots": None,
            "excluded_visit_days": None,
            "disabled": False,
        },
        {
            "id": "fixture-sed-1",
            "business_name": "TEST SEDRIANO 1",
            "category": "client",
            "address": "Via Sedriano 1",
            "city": "Sedriano",
            "province": "MI",
            "latitude": 45.4930,
            "longitude": 8.9750,
            "last_visit_date": "2025-10-05",
            "last_order_date": "2025-10-17",
            "notes": "Fixture",
            "estimated_revenue": 720,
            "tabaccheria_id": None,
            "project_type": None,
            "preferred_visit_slots": None,
            "excluded_visit_days": None,
            "disabled": False,
        },
        {
            "id": "fixture-sed-2",
            "business_name": "TEST SEDRIANO 2",
            "category": "client",
            "address": "Via Sedriano 2",
            "city": "Sedriano",
            "province": "MI",
            "latitude": 45.4950,
            "longitude": 8.9780,
            "last_visit_date": "2025-10-07",
            "last_order_date": "2025-10-18",
            "notes": "Fixture",
            "estimated_revenue": 730,
            "tabaccheria_id": None,
            "project_type": None,
            "preferred_visit_slots": None,
            "excluded_visit_days": None,
            "disabled": False,
        },
        {
            "id": "fixture-bar-1",
            "business_name": "TEST BAREGGIO 1",
            "category": "client",
            "address": "Via Bareggio 1",
            "city": "Bareggio",
            "province": "MI",
            "latitude": 45.4860,
            "longitude": 8.9970,
            "last_visit_date": "2025-10-09",
            "last_order_date": "2025-10-19",
            "notes": "Fixture",
            "estimated_revenue": 740,
            "tabaccheria_id": None,
            "project_type": None,
            "preferred_visit_slots": None,
            "excluded_visit_days": None,
            "disabled": False,
        },
        {
            "id": "fixture-mil-1",
            "business_name": "TEST MILANO OUTSIDE",
            "category": "client",
            "address": "Via Milano 1",
            "city": "Milano",
            "province": "MI",
            "latitude": 45.4642,
            "longitude": 9.19,
            "last_visit_date": "2025-10-10",
            "last_order_date": "2025-10-20",
            "notes": "Fixture",
            "estimated_revenue": 750,
            "tabaccheria_id": None,
            "project_type": None,
            "preferred_visit_slots": None,
            "excluded_visit_days": None,
            "disabled": False,
        },
        {
            "id": "fixture-rho-1",
            "business_name": "TEST RHO OUTSIDE",
            "category": "client",
            "address": "Via Rho 1",
            "city": "Rho",
            "province": "MI",
            "latitude": 45.5290,
            "longitude": 9.0400,
            "last_visit_date": "2025-10-11",
            "last_order_date": "2025-10-21",
            "notes": "Fixture",
            "estimated_revenue": 760,
            "tabaccheria_id": None,
            "project_type": None,
            "preferred_visit_slots": None,
            "excluded_visit_days": None,
            "disabled": False,
        },
    ]


def _order_rows() -> List[Dict[str, Any]]:
    return [
        {
            "customer_id": row["id"],
            "order_count": 3,
            "last_order_date": row["last_order_date"],
            "total_revenue": 1500,
            "revenue_6m": row["estimated_revenue"],
            "avg_order_value": 300,
            "avg_reorder_days": 25,
        }
        for row in _customers_rows()
    ]


def _contact_rows() -> List[Dict[str, Any]]:
    return [
        {
            "customer_id": row["id"],
            "last_visit_date": row["last_visit_date"],
            "last_inspection_date": row["last_visit_date"],
        }
        for row in _customers_rows()
    ]


def _edge_response_turn1() -> Dict[str, Any]:
    return {
        "reply": "Ok, preparo il giro di Magenta.",
        "needsInfo": False,
        "multiDay": False,
        "lodging": "home",
        "tourDate": FIXTURE_DATE,
        "startTime": None,
        "endTime": None,
        "selection": [{"key": "client:fixture-mag-1", "reason": "Primo punto Magenta"}],
        "days": [],
        "notes": None,
        "intent": {
            "wantAll": True,
            "requestedEntityTypes": ["client"],
            "requestedArea": {"comune": "Magenta", "comuni": ["Magenta"]},
        },
        "effectiveAgentId": FIXTURE_AGENT_ID,
    }


def _edge_response_turn2_patch_only() -> Dict[str, Any]:
    return {
        "reply": "Aggiungo Sedriano e Bareggio.",
        "needsInfo": False,
        "multiDay": False,
        "lodging": "home",
        "tourDate": FIXTURE_DATE,
        "startTime": None,
        "endTime": None,
        "selection": [{"key": "client:fixture-sed-1", "reason": "Espansione area"}],
        "days": [],
        "notes": None,
        "intent": {
            "requestedArea": {"comuni": ["Sedriano", "Bareggio"]}
        },
        "effectiveAgentId": FIXTURE_AGENT_ID,
    }


def _edge_response_turn3_neutral() -> Dict[str, Any]:
    return {
        "reply": "Confermo i criteri correnti.",
        "needsInfo": True,
        "multiDay": False,
        "lodging": "home",
        "tourDate": FIXTURE_DATE,
        "startTime": None,
        "endTime": None,
        "selection": [],
        "days": [],
        "notes": None,
        "effectiveAgentId": FIXTURE_AGENT_ID,
    }


async def install_network_fixture(page):
    state = {
        "blocked_unknown_api": [],
        "edge_calls": [],
    }

    async def fulfill_json(route, payload, status: int = 200, extra_headers: Dict[str, str] | None = None):
        headers = {"content-type": "application/json"}
        if extra_headers:
            headers.update(extra_headers)
        await route.fulfill(status=status, headers=headers, body=json.dumps(payload))

    async def handle_supabase(route):
        req = route.request
        method = req.method.upper()
        url = req.url

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

        if "/functions/v1/ai-tour-gptour" in url:
            try:
                body = json.loads(req.post_data or "{}")
            except Exception:
                body = {}
            state["edge_calls"].append(body)
            call_index = len(state["edge_calls"])

            if call_index == 1:
                msg = (((body.get("messages") or [{}])[-1]).get("content") or "").strip()
                if msg != "tabaccherie di Magenta":
                    await fulfill_json(route, {"error": f"UNEXPECTED_FIRST_MESSAGE:{msg}"}, status=503)
                    return
                await fulfill_json(route, _edge_response_turn1())
                return

            if call_index == 2:
                msg = (((body.get("messages") or [{}])[-1]).get("content") or "").strip()
                intent = body.get("intent") or {}
                comuni = (((intent.get("requestedArea") or {}).get("comuni")) or [])
                if msg != "aggiungi Sedriano e Bareggio":
                    await fulfill_json(route, {"error": f"UNEXPECTED_SECOND_MESSAGE:{msg}"}, status=503)
                    return
                if "Magenta" not in comuni:
                    await fulfill_json(route, {"error": f"SECOND_TURN_MISSING_MAGENTA:{comuni}"}, status=503)
                    return
                await fulfill_json(route, _edge_response_turn2_patch_only())
                return

            if call_index == 3:
                intent = body.get("intent") or {}
                comuni = (((intent.get("requestedArea") or {}).get("comuni")) or [])
                if comuni != ["Magenta", "Sedriano", "Bareggio"]:
                    await fulfill_json(route, {"error": f"THIRD_TURN_BAD_COMUNI:{comuni}"}, status=503)
                    return
                await fulfill_json(route, _edge_response_turn3_neutral())
                return

            await fulfill_json(route, {"error": "FIXTURE_UNEXPECTED_EDGE_CALL"}, status=503)
            return

        if "/functions/v1/" in url:
            await fulfill_json(route, {"error": "FIXTURE_MISSING_EDGE_ROUTE", "url": url}, status=503)
            return

        if "/rest/v1/rpc/" in url:
            if "/rpc/ai_tour_order_stats" in url:
                await fulfill_json(route, _order_rows())
                return
            if "/rpc/ai_tour_contact_stats" in url:
                await fulfill_json(route, _contact_rows())
                return
            if "/rpc/ai_tour_learned_durations" in url:
                await fulfill_json(route, [])
                return
            if "/rpc/ai_tour_no_interest_ids" in url:
                await fulfill_json(route, [])
                return
            if "/rpc/ai_tour_free_tabaccherie" in url:
                await fulfill_json(route, [])
                return
            if "/rpc/get_orphan_tabaccherie_ids" in url:
                await fulfill_json(route, [])
                return
            if "/rpc/ai_tour_comune_centroid" in url:
                await fulfill_json(route, [])
                return
            if "/rpc/tabaccherie_points_in_bbox" in url:
                await fulfill_json(route, [])
                return
            await fulfill_json(route, {"error": "FIXTURE_MISSING_RPC_ROUTE", "url": url}, status=503)
            return

        if "/rest/v1/profiles" in url:
            accept = (req.headers or {}).get("accept", "")
            if "vnd.pgrst.object+json" in accept:
                await fulfill_json(route, _profile_obj())
            else:
                await fulfill_json(route, [_profile_obj()])
            return

        if "/rest/v1/ai_tour_settings" in url:
            accept = (req.headers or {}).get("accept", "")
            if "vnd.pgrst.object+json" in accept:
                await fulfill_json(route, _settings_obj())
            else:
                await fulfill_json(route, [_settings_obj()])
            return

        if "/rest/v1/customers" in url:
            await fulfill_json(route, _customers_rows())
            return

        if "/rest/v1/projects" in url:
            await fulfill_json(route, [])
            return

        if "/rest/v1/orders" in url:
            await fulfill_json(route, [])
            return

        if "/rest/v1/appointments" in url:
            await fulfill_json(route, [])
            return

        if "/rest/v1/ai_tours" in url:
            await fulfill_json(route, [])
            return

        if "/rest/v1/ai_tour_events" in url:
            await fulfill_json(route, [])
            return

        if "/rest/v1/agent_zones" in url:
            await fulfill_json(route, [])
            return

        if "/rest/v1/orphan_config" in url:
            cfg = {
                "id": "fixture-orphan-config",
                "orphan_b_days": 30,
                "orphan_a_days": 110,
                "created_at": "2026-01-01T00:00:00.000Z",
                "updated_at": "2026-01-01T00:00:00.000Z",
            }
            accept = (req.headers or {}).get("accept", "")
            if "vnd.pgrst.object+json" in accept:
                await fulfill_json(route, cfg)
            else:
                await fulfill_json(route, [cfg])
            return

        if "/rest/v1/system_settings" in url:
            row = {
                "setting_value": [
                    {"id": "06_08", "label": "6 - 8", "start": 360, "end": 480},
                    {"id": "08_09", "label": "8 - 9", "start": 480, "end": 540},
                    {"id": "09_1130", "label": "9 - 11.30", "start": 540, "end": 690},
                    {"id": "1130_1430", "label": "11.30 - 14.30", "start": 690, "end": 870, "strict": True},
                    {"id": "1430_16", "label": "14.30 - 16", "start": 870, "end": 960},
                    {"id": "16_18", "label": "16 - 18", "start": 960, "end": 1080},
                ]
            }
            accept = (req.headers or {}).get("accept", "")
            if "vnd.pgrst.object+json" in accept:
                await fulfill_json(route, row)
            else:
                await fulfill_json(route, [row])
            return

        if "/rest/v1/tabaccherie" in url:
            await fulfill_json(route, [])
            return

        await fulfill_json(route, {"error": "FIXTURE_MISSING_REST_ROUTE", "url": url}, status=503)

    async def handle_osrm(route):
        url = route.request.url
        if "/table/v1/driving/" in url:
            coords_part = url.split('/table/v1/driving/', 1)[1].split('?', 1)[0]
            points = [c for c in coords_part.split(';') if c]
            n = max(1, len(points))
            durations = []
            distances = []
            for i in range(n):
                d_row = []
                km_row = []
                for j in range(n):
                    if i == j:
                        d_row.append(0)
                        km_row.append(0)
                    else:
                        base = 420 + (abs(i - j) * 120)
                        d_row.append(base)
                        km_row.append(int(base * 8.5))
                durations.append(d_row)
                distances.append(km_row)
            await fulfill_json(route, {"code": "Ok", "durations": durations, "distances": distances})
            return
        if "/route/v1/driving/" in url:
            coords_part = url.split('/route/v1/driving/', 1)[1].split('?', 1)[0]
            points = []
            for p in [c for c in coords_part.split(';') if c]:
                lng_str, lat_str = p.split(',')
                points.append((float(lng_str), float(lat_str)))
            legs = []
            total_distance = 0
            total_duration = 0
            for _ in range(max(0, len(points) - 1)):
                leg_distance = 5000
                leg_duration = 600
                total_distance += leg_distance
                total_duration += leg_duration
                legs.append({
                    "distance": leg_distance,
                    "duration": leg_duration,
                    "annotation": {
                        "distance": [leg_distance // 2, leg_distance // 2],
                        "duration": [leg_duration // 2, leg_duration // 2],
                    },
                })
            await fulfill_json(route, {
                "code": "Ok",
                "routes": [{
                    "distance": total_distance,
                    "duration": total_duration,
                    "geometry": {"coordinates": [[lng, lat] for (lng, lat) in points], "type": "LineString"},
                    "legs": legs,
                }],
            })
            return
        await fulfill_json(route, {"error": "FIXTURE_MISSING_OSRM_ROUTE", "url": url}, status=503)

    async def block_unknown_api(route):
        req = route.request
        if req.resource_type not in ("xhr", "fetch"):
            await route.continue_()
            return
        url = req.url

        if "voom-ios.preview.emergentagent.com/api/" in url:
            state["blocked_unknown_api"].append(url)
            await fulfill_json(route, {"error": "FIXTURE_BLOCKED_PREVIEW_API", "url": url}, status=503)
            return

        allowed_hosts = [
            "voom-ios.preview.emergentagent.com",
            "gorwxfzzyzxmxnizmebw.supabase.co",
            "router.project-osrm.org",
            "photon.komoot.io",
            "nominatim.openstreetmap.org",
        ]
        if any(host in url for host in allowed_hosts):
            await route.continue_()
            return
        state["blocked_unknown_api"].append(url)
        await route.abort()

    await page.route("**/*", block_unknown_api)
    await page.route("https://router.project-osrm.org/**", handle_osrm)
    await page.route(f"{SUPABASE_URL}/**", handle_supabase)
    return state


def _extract_current_tour_keys(edge_body: Dict[str, Any]) -> List[str]:
    current_tour = edge_body.get("currentTour") or []
    keys: List[str] = []
    for day in current_tour:
        for stop in (day.get("stops") or []):
            key = stop.get("key")
            if isinstance(key, str):
                keys.append(key)
    return keys


async def run(page):
    page.on("console", lambda msg: print(f"CONSOLE[{msg.type}]: {msg.text}"))
    page_errors = []
    page.on("pageerror", lambda err: page_errors.append(str(err)))
    await page.set_viewport_size({"width": 390, "height": 844})

    await inject_bootstrap_storage(page)
    state = await install_network_fixture(page)

    # Enter AI Tour -> GPTour
    await wait_ai_tour_ready(page)
    await page.get_by_test_id('aitour-open-gptour').click()
    await page.get_by_test_id('gptour-message-input').wait_for(state='visible')
    await page.screenshot(path="/app/test_reports/artifacts_iter61/iter61_before_chat.jpeg", quality=20, full_page=False)

    # Turn 1
    await page.fill('[data-testid="gptour-message-input"]', "tabaccherie di Magenta")
    await page.click('[data-testid="gptour-send"]')
    await page.wait_for_selector('[data-testid="gptour-plan"]', timeout=20000)
    await page.get_by_text('TEST MAGENTA 2', exact=True).wait_for(state='visible')

    # Turn 2
    await page.fill('[data-testid="gptour-message-input"]', "aggiungi Sedriano e Bareggio")
    await page.click('[data-testid="gptour-send"]')
    await page.get_by_text('TEST BAREGGIO 1', exact=True).wait_for(state='visible', timeout=20000)

    # Chips must include all three comuni in order
    chips = await page.evaluate("""() => {
      const nodes = Array.from(document.querySelectorAll('[data-testid^="gptour-criterion-"]'));
      return nodes.map(n => (n.textContent || '').trim()).filter(Boolean);
    }""")
    print(f"Rendered chips: {chips}")
    joined = "|".join(chips)
    if not ("Magenta" in joined and "Sedriano" in joined and "Bareggio" in joined):
        raise AssertionError(f"Missing comuni chips: {chips}")
    m_i, s_i, b_i = joined.find("Magenta"), joined.find("Sedriano"), joined.find("Bareggio")
    if not (m_i <= s_i <= b_i):
        raise AssertionError(f"Comuni chip order incorrect: {chips}")

    await page.screenshot(path="/app/test_reports/artifacts_iter61/iter61_after_second_turn.jpeg", quality=20, full_page=False)

    # Turn 3 neutral: capture outgoing payload with merged 3-comuni intent + currentTour keys from turn2
    await page.fill('[data-testid="gptour-message-input"]', "ok")
    await page.click('[data-testid="gptour-send"]')
    await page.get_by_text('Confermo i criteri correnti.', exact=True).wait_for(state='visible', timeout=20000)

    edge_calls = state["edge_calls"]
    if len(edge_calls) < 3:
        raise AssertionError(f"Expected >=3 edge calls, got {len(edge_calls)}")

    # 2nd outgoing request should still contain Magenta in intent before receiving patch turn2
    second_intent_comuni = (((edge_calls[1].get("intent") or {}).get("requestedArea") or {}).get("comuni") or [])
    if "Magenta" not in second_intent_comuni:
        raise AssertionError(f"Second outgoing intent missing Magenta: {second_intent_comuni}")

    # First turn plan (observed in 2nd outgoing currentTour) must be exactly Magenta keys
    first_plan_keys = _extract_current_tour_keys(edge_calls[1])
    if first_plan_keys != ["client:fixture-mag-1", "client:fixture-mag-2"]:
        raise AssertionError(f"First turn keys mismatch: {first_plan_keys}")

    # Second turn merged plan (observed in 3rd outgoing currentTour) must be exactly 3-comuni keys only
    second_plan_keys = _extract_current_tour_keys(edge_calls[2])
    expected_second_keys = {
        "client:fixture-mag-1",
        "client:fixture-mag-2",
        "client:fixture-sed-1",
        "client:fixture-sed-2",
        "client:fixture-bar-1",
    }
    if set(second_plan_keys) != expected_second_keys:
        raise AssertionError(f"Second turn keys mismatch: {second_plan_keys}")
    if "client:fixture-mil-1" in second_plan_keys or "client:fixture-rho-1" in second_plan_keys:
        raise AssertionError(f"Outsider keys leaked into merged plan: {second_plan_keys}")

    # No horizontal overflow
    overflow = await page.evaluate("""() => {
      const nodes = Array.from(document.querySelectorAll('body *'));
      return nodes.some(el => el.scrollWidth > (window.innerWidth + 1));
    }""")
    if overflow:
        raise AssertionError("Horizontal overflow detected")

    # Back + reopen draft retention checks
    await page.get_by_test_id('gptour-back').click()
    await page.get_by_test_id('aitour-session-ready').wait_for(state='visible')
    await page.get_by_test_id('aitour-open-gptour').click()
    await page.get_by_text("tabaccherie di Magenta", exact=True).first.wait_for(timeout=15000)
    await page.get_by_text("aggiungi Sedriano e Bareggio", exact=True).first.wait_for(timeout=15000)
    chips_after = await page.evaluate("""() => {
      const nodes = Array.from(document.querySelectorAll('[data-testid^="gptour-criterion-"]'));
      return nodes.map(n => (n.textContent || '').trim()).filter(Boolean);
    }""")
    after_joined = "|".join(chips_after)
    if not ("Magenta" in after_joined and "Sedriano" in after_joined and "Bareggio" in after_joined):
        raise AssertionError(f"Draft criteria not retained after reopen: {chips_after}")
    await page.screenshot(path="/app/test_reports/artifacts_iter61/iter61_reopen_retained.jpeg", quality=20, full_page=False)

    # Required error scan selector block
    error_text = await page.evaluate("""() => {
    const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
    return errorElements.map(el => el.textContent).join(", ");
    }""")
    if error_text:
        print(f"Found error message: {error_text}")
    else:
        print("No error messages found on the page")

    print(f"Blocked unknown API calls: {len(state['blocked_unknown_api'])}")
    if state["blocked_unknown_api"]:
        raise AssertionError(f"Blocked URLs: {state['blocked_unknown_api']}")
    if page_errors:
        raise AssertionError(f"Browser exceptions: {page_errors}")
    print('PASS: 2 tappe a Magenta -> 5 tappe in 3 comuni, chip e bozza verificati; nessuna eccezione JS.')
