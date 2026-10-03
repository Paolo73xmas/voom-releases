"""Iteration 60: deterministic AI Tour <-> GPTour back-navigation fixture (web preview).

Scope:
- No production auth changes.
- Injects standalone Supabase web session before app init.
- Intercepts Supabase auth/rest/functions + OSRM with fail-closed behavior.
- Covers 3 browser cases:
  1) Immediate GPTour back (3 cycles, with input focus)
  2) Back after needsInfo conversation + reopen draft conversation restore
  3) Back after generated plan/map + reopen draft availability/conversation restore
"""

from __future__ import annotations

import base64
import json
import time
from typing import Any, Dict, List


PREVIEW_URL = "https://voom-ios.preview.emergentagent.com"
SUPABASE_PROJECT_REF = "gorwxfzzyzxmxnizmebw"
SUPABASE_URL = f"https://{SUPABASE_PROJECT_REF}.supabase.co"
FIXTURE_AGENT_ID = "11111111-1111-4111-8111-111111111111"
FIXTURE_EMAIL = "gptour-fixture@example.test"
AUTH_STORAGE_KEY = f"sb-{SUPABASE_PROJECT_REF}-auth-token"
MIGRATION_FLAG_KEY = "supabase_publishable_key_migration_2026_07"


def _b64url(data: Dict[str, Any]) -> str:
    raw = json.dumps(data, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def build_fixture_jwt(exp_seconds: int) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "aud": "authenticated",
        "exp": exp_seconds,
        "iat": int(time.time()) - 30,
        "iss": "supabase",
        "sub": FIXTURE_AGENT_ID,
        "email": FIXTURE_EMAIL,
        "phone": "",
        "role": "authenticated",
        "app_metadata": {"provider": "email", "providers": ["email"]},
        "user_metadata": {"full_name": "Fixture Agent"},
        "session_id": "fixture-session-iter60",
    }
    return f"{_b64url(header)}.{_b64url(payload)}.fixture_signature"


def build_auth_payload() -> Dict[str, Any]:
    now = int(time.time())
    expires_in = 3600 * 24
    expires_at = now + expires_in
    access_token = build_fixture_jwt(expires_at)
    refresh_token = "fixture-refresh-token-iter60"
    user = {
        "id": FIXTURE_AGENT_ID,
        "aud": "authenticated",
        "role": "authenticated",
        "email": FIXTURE_EMAIL,
        "email_confirmed_at": "2026-01-01T00:00:00.000Z",
        "phone": "",
        "confirmed_at": "2026-01-01T00:00:00.000Z",
        "last_sign_in_at": "2026-01-01T00:00:00.000Z",
        "app_metadata": {"provider": "email", "providers": ["email"]},
        "user_metadata": {"full_name": "Fixture Agent"},
        "identities": [],
        "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": "2026-01-01T00:00:00.000Z",
        "is_anonymous": False,
    }
    session = {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "expires_at": expires_at,
        "refresh_token": refresh_token,
        "user": user,
    }
    # Include both modern (currentSession/expiresAt) and direct fields for compatibility
    return {
        "currentSession": session,
        "expiresAt": expires_at * 1000,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": expires_in,
        "expires_at": expires_at,
        "token_type": "bearer",
        "user": user,
        "session": session,
    }


def _profile_obj() -> Dict[str, Any]:
    now = "2026-01-01T00:00:00.000Z"
    return {
        "id": FIXTURE_AGENT_ID,
        "email": FIXTURE_EMAIL,
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
            "id": "fixture-customer-1",
            "business_name": "TEST GPTOUR Cliente 1",
            "category": "client",
            "address": "Via Roma 1",
            "city": "Milano",
            "province": "MI",
            "latitude": 45.4642,
            "longitude": 9.19,
            "last_visit_date": "2025-12-01",
            "last_order_date": "2025-12-15",
            "notes": "Fixture",
            "estimated_revenue": 900,
            "tabaccheria_id": None,
            "project_type": None,
            "preferred_visit_slots": None,
            "excluded_visit_days": None,
            "disabled": False,
        }
    ]


def _gpt_needs_info() -> Dict[str, Any]:
    return {
        "reply": "Serve un dettaglio in più: preferisci solo clienti o anche prospect?",
        "needsInfo": True,
        "multiDay": False,
        "lodging": "home",
        "tourDate": "2026-10-05",
        "startTime": None,
        "endTime": None,
        "selection": [],
        "days": [],
        "notes": None,
        "effectiveAgentId": FIXTURE_AGENT_ID,
    }


def _gpt_plan() -> Dict[str, Any]:
    return {
        "reply": "Perfetto, ho preparato un giro base su Milano.",
        "needsInfo": False,
        "multiDay": False,
        "lodging": "home",
        "tourDate": "2026-10-05",
        "startTime": None,
        "endTime": None,
        "selection": [{"key": "client:fixture-customer-1", "reason": "Cliente prioritario"}],
        "days": [],
        "notes": None,
        "effectiveAgentId": FIXTURE_AGENT_ID,
    }


async def inject_bootstrap_storage(page) -> None:
    auth_payload = build_auth_payload()
    payload = {
        "auth_key": AUTH_STORAGE_KEY,
        "auth_value": auth_payload,
        "migration_key": MIGRATION_FLAG_KEY,
    }
    payload_json = json.dumps(payload)
    await page.add_init_script(
        f"""
        (() => {{
          const payload = {payload_json};
          try {{
            localStorage.setItem(payload.auth_key, JSON.stringify(payload.auth_value));
            localStorage.setItem(payload.migration_key, '1');
            localStorage.setItem('@privacy_terms_accepted', 'true');
            localStorage.setItem('@privacy_terms_accepted_date', new Date().toISOString());
          }} catch (e) {{
            console.error('fixture init script storage error', e);
          }}
        }})();
        """
    )


async def install_network_fixture(page):
    state = {
        "edge_mode": "needs_info",  # needs_info | plan
        "blocked_unknown_api": [],
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

        # --- Auth ---
        if "/auth/v1/user" in url:
            await fulfill_json(route, build_auth_payload()["user"])
            return
        if "/auth/v1/token" in url:
            await fulfill_json(route, build_auth_payload())
            return
        if "/auth/v1/logout" in url:
            await fulfill_json(route, {})
            return

        # --- Edge function ---
        if "/functions/v1/ai-tour-gptour" in url:
            if state["edge_mode"] == "needs_info":
                await fulfill_json(route, _gpt_needs_info())
            else:
                await fulfill_json(route, _gpt_plan())
            return

        # Block all other edge calls (fail-closed)
        if "/functions/v1/" in url:
            await fulfill_json(route, {"error": "FIXTURE_MISSING_EDGE_ROUTE", "url": url}, status=503)
            return

        # --- RPC ---
        if "/rest/v1/rpc/" in url:
            if "/rpc/ai_tour_order_stats" in url:
                await fulfill_json(route, [{
                    "customer_id": "fixture-customer-1",
                    "order_count": 3,
                    "last_order_date": "2025-12-15",
                    "total_revenue": 1200,
                    "revenue_6m": 900,
                    "avg_order_value": 300,
                    "avg_reorder_days": 25,
                }])
                return
            if "/rpc/ai_tour_contact_stats" in url:
                await fulfill_json(route, [{
                    "customer_id": "fixture-customer-1",
                    "last_visit_date": "2025-12-01",
                    "last_inspection_date": "2025-12-02",
                }])
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

        # --- REST tables ---
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
                        # deterministic, non-zero, symmetric enough for planner
                        base = 420 + (abs(i - j) * 120)
                        d_row.append(base)
                        km_row.append(int(base * 8.5))
                durations.append(d_row)
                distances.append(km_row)
            payload = {
                "code": "Ok",
                "durations": durations,
                "distances": distances,
            }
            await fulfill_json(route, payload)
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
            for idx in range(max(0, len(points) - 1)):
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
            payload = {
                "code": "Ok",
                "routes": [
                    {
                        "distance": total_distance,
                        "duration": total_duration,
                        "geometry": {
                            "coordinates": [[lng, lat] for (lng, lat) in points],
                            "type": "LineString",
                        },
                        "legs": legs,
                    }
                ],
            }
            await fulfill_json(route, payload)
            return
        await fulfill_json(route, {"error": "FIXTURE_MISSING_OSRM_ROUTE", "url": url}, status=503)

    async def block_unknown_api(route):
        req = route.request
        if req.resource_type not in ("xhr", "fetch"):
            await route.continue_()
            return
        url = req.url

        # Fail-closed for preview CRM/backend requests: this fixture covers only
        # Supabase + OSRM deterministic flows and must avoid live CRM writes/reads.
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

    # Register catch-all first, then specific routes (Playwright matches newest first).
    await page.route("**/*", block_unknown_api)
    await page.route("https://router.project-osrm.org/**", handle_osrm)
    await page.route(f"{SUPABASE_URL}/**", handle_supabase)
    return state


async def wait_ai_tour_ready(page):
    await page.goto(f"{PREVIEW_URL}/ai-tour", wait_until="domcontentloaded")
    await page.wait_for_selector('[data-testid="aitour-session-ready"]', timeout=20000)
    await page.wait_for_selector('[data-testid="aitour-open-gptour"]', timeout=15000)
    await page.wait_for_timeout(800)


async def open_gptour(page):
    await page.click('[data-testid="aitour-open-gptour"]', force=True)
    await page.wait_for_selector('[data-testid="gptour-screen"]', timeout=20000)
    await page.wait_for_selector('[data-testid="gptour-message-input"]', timeout=15000)


async def back_from_gptour(page):
    await page.click('[data-testid="gptour-back"]', force=True)
    await page.wait_for_selector('[data-testid="aitour-session-ready"]', timeout=15000)
    await page.get_by_text("AI Tour", exact=True).first.wait_for(timeout=15000)
    await page.get_by_text("Genera", exact=True).first.wait_for(timeout=15000)


async def run(page):
    page.on("console", lambda msg: print(f"CONSOLE[{msg.type}]: {msg.text}"))
    await page.set_viewport_size({"width": 390, "height": 844})
    await inject_bootstrap_storage(page)
    net_state = await install_network_fixture(page)

    # Quick load proof
    await wait_ai_tour_ready(page)

    # Case 1: immediate back x3 (with input focus)
    for i in range(3):
        await open_gptour(page)
        await page.click('[data-testid="gptour-message-input"]', force=True)
        await page.wait_for_timeout(150)
        await back_from_gptour(page)
        print(f"CASE1 immediate back cycle {i + 1}/3 passed")

    # Case 2: needsInfo chat-only, then back, reopen and verify conversation restored
    net_state["edge_mode"] = "needs_info"
    await open_gptour(page)
    await page.fill('[data-testid="gptour-message-input"]', "solo clienti domani")
    await page.click('[data-testid="gptour-send"]', force=True)
    await page.wait_for_timeout(2500)
    await page.get_by_text("Serve un dettaglio in più", exact=False).first.wait_for(timeout=15000)
    await back_from_gptour(page)
    await open_gptour(page)
    await page.get_by_text("solo clienti domani", exact=False).first.wait_for(timeout=15000)
    print("CASE2 conversation restore after back passed")
    await back_from_gptour(page)

    # Case 3: generated plan/map, then back, reopen and verify draft availability + conversation
    net_state["edge_mode"] = "plan"
    await open_gptour(page)
    await page.fill('[data-testid="gptour-message-input"]', "crea un piano valido con una tappa")
    await page.click('[data-testid="gptour-send"]', force=True)
    await page.wait_for_timeout(3500)
    await page.wait_for_selector('[data-testid="gptour-plan"]', timeout=20000)
    await page.wait_for_selector('[data-testid="gptour-map"]', timeout=20000)
    await back_from_gptour(page)
    await open_gptour(page)
    await page.wait_for_selector('[data-testid="gptour-rebuild"]', timeout=15000)
    await page.get_by_text("crea un piano valido con una tappa", exact=False).first.wait_for(timeout=15000)
    print("CASE3 generated plan back + reopen draft checks passed")

    # Required error scan selector block
    error_text = await page.evaluate("""() => {
    const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
    return errorElements.map(el => el.textContent).join(", ");
    }""")
    if error_text:
        print(f"Found error message: {error_text}")
    else:
        print("No error messages found on the page")

    print(f"Blocked unknown API calls: {len(net_state['blocked_unknown_api'])}")
