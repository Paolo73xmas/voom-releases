"""Iteration 63: GPTour development fixture (390x844, fail-closed, deterministic).

Purpose:
- Exercise mobile GPTour development fallback with >2000 free registry rows.
- Keep all Supabase/Edge/OSRM traffic mocked in-fixture (no CRM writes).
"""

from __future__ import annotations

import base64
import json
import time
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from urllib.parse import parse_qs, urlsplit
from playwright.async_api import expect
from typing import Any, Dict, List


PREVIEW_URL = "https://voom-ios.preview.emergentagent.com"
SUPABASE_PROJECT_REF = "gorwxfzzyzxmxnizmebw"
SUPABASE_URL = f"https://{SUPABASE_PROJECT_REF}.supabase.co"
ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
TARGET_AGENT_ID = "22222222-2222-4222-8222-222222222222"
AUTH_STORAGE_KEY = f"sb-{SUPABASE_PROJECT_REF}-auth-token"
MIGRATION_FLAG_KEY = "supabase_publishable_key_migration_2026_07"
TOMORROW = (datetime.now(ZoneInfo('Europe/Rome')).date() + timedelta(days=1)).isoformat()


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
        "sub": ADMIN_ID,
        "email": "iter63-admin@example.test",
        "phone": "",
        "role": "admin",
        "app_metadata": {"provider": "email", "providers": ["email"]},
        "user_metadata": {"full_name": "Iter63 Admin"},
        "session_id": "fixture-session-iter63",
    }
    return f"{_b64url(header)}.{_b64url(payload)}.fixture_signature"


def build_auth_payload() -> Dict[str, Any]:
    now = int(time.time())
    expires_in = 3600 * 24
    expires_at = now + expires_in
    access_token = build_fixture_jwt(expires_at)
    user = {
        "id": ADMIN_ID,
        "aud": "authenticated",
        "role": "admin",
        "email": "iter63-admin@example.test",
        "email_confirmed_at": "2026-01-01T00:00:00.000Z",
        "app_metadata": {"provider": "email", "providers": ["email"], "role": "admin"},
        "user_metadata": {"full_name": "Iter63 Admin"},
        "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": "2026-01-01T00:00:00.000Z",
        "is_anonymous": False,
    }
    session = {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "expires_at": expires_at,
        "refresh_token": "iter63-refresh-token",
        "user": user,
    }
    return {
        "currentSession": session,
        "expiresAt": expires_at * 1000,
        "access_token": access_token,
        "refresh_token": "iter63-refresh-token",
        "expires_in": expires_in,
        "expires_at": expires_at,
        "token_type": "bearer",
        "user": user,
        "session": session,
    }


def _profile_admin() -> Dict[str, Any]:
    now = "2026-01-01T00:00:00.000Z"
    return {
        "id": ADMIN_ID,
        "email": "iter63-admin@example.test",
        "full_name": "Iter63 Admin",
        "role": "admin",
        "agent_id": ADMIN_ID,
        "branch_id": None,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }


def _target_agent_profile() -> Dict[str, Any]:
    return {"id": TARGET_AGENT_ID, "full_name": "DELLA VOLPE VINCENZO"}


def _settings_obj() -> Dict[str, Any]:
    return {
        "agent_id": TARGET_AGENT_ID,
        "work_start": "08:00",
        "work_end": "21:00",
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
        "lunch_break_minutes": 60,
        "home_address": "Casa Bacoli",
        "home_lat": 40.796,
        "home_lng": 14.07,
        "office_address": None,
        "office_lat": None,
        "office_lng": None,
    }


def _customers_rows() -> List[Dict[str, Any]]:
    return [
        {
            "id": "own-1",
            "business_name": "Own Orphan 1",
            "category": "client",
            "address": "Via A",
            "city": "Bacoli",
            "province": "NA",
            "latitude": 40.797,
            "longitude": 14.078,
            "last_visit_date": "2025-10-01",
            "last_order_date": "2025-09-01",
            "notes": "",
            "estimated_revenue": 0,
            "tabaccheria_id": "tab-own-1",
            "project_type": None,
            "preferred_visit_slots": None,
            "excluded_visit_days": None,
            "disabled": False,
        },
        {
            "id": "own-2",
            "business_name": "Own Orphan 2",
            "category": "client",
            "address": "Via B",
            "city": "Bacoli",
            "province": "NA",
            "latitude": 40.799,
            "longitude": 14.081,
            "last_visit_date": "2025-10-01",
            "last_order_date": "2025-09-01",
            "notes": "",
            "estimated_revenue": 0,
            "tabaccheria_id": "tab-own-2",
            "project_type": None,
            "preferred_visit_slots": None,
            "excluded_visit_days": None,
            "disabled": False,
        },
    ]


def _free_pool_rows() -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for i in range(2483):
        rows.append(
            {
                "id": f"far-{i}",
                "denominazione": f"Far {i}",
                "codice_rivendita": str(i),
                "indirizzo": "Via Lontana",
                "comune": "Caserta",
                "provincia": "CE",
                "lat": 41.07 + (i % 10) * 0.001,
                "lng": 14.33 + (i % 10) * 0.001,
                "assigned": bool(i % 2),
            }
        )
    for i in range(13):
        rows.append(
            {
                "id": f"bacoli-{i}",
                "denominazione": f"Bacoli {i}",
                "codice_rivendita": f"B{i}",
                "indirizzo": "Via Bacoli",
                "comune": "Bacoli",
                "provincia": "NA",
                "lat": 40.79 + (i % 4) * 0.003,
                "lng": 14.07 + (i // 4) * 0.004,
                "assigned": bool(i % 2),
            }
        )
    for i in range(4):
        rows.append({"id": f"monte-{i}", "denominazione": f"Monte {i}", "codice_rivendita": f"M{i}",
                     "indirizzo": "Via Monte", "comune": "Monte di Procida", "provincia": "NA",
                     "lat": 40.795 + i * .003, "lng": 14.05 + i * .002, "assigned": False})
    return rows


async def inject_bootstrap_storage(page) -> None:
    payload = {
        "auth_key": AUTH_STORAGE_KEY,
        "auth_value": build_auth_payload(),
        "migration_key": MIGRATION_FLAG_KEY,
    }
    await page.add_init_script(
        f"""
        (() => {{
          const payload = {json.dumps(payload)};
          localStorage.setItem(payload.auth_key, JSON.stringify(payload.auth_value));
          localStorage.setItem(payload.migration_key, '1');
          localStorage.setItem('@privacy_terms_accepted', 'true');
          localStorage.setItem('@privacy_terms_accepted_date', new Date().toISOString());
        }})();
        """
    )


async def install_network_fixture(page):
    state = {
        "blocked_unknown_api": [],
        "free_ranges": [],
        "last_mode": "",
        "pool_rows": _free_pool_rows(),
        "mode": "normal",
        "writes": [],
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
        headers = req.headers or {}

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
            body = req.post_data_json or {}
            actual_agent = (body.get('agentInfo') or {}).get('agentId')
            if actual_agent != TARGET_AGENT_ID:
                state['agent_mismatch'] = {'expected': TARGET_AGENT_ID, 'actual': actual_agent}
                await fulfill_json(route, {"error": "AGENT_MISMATCH", "expected": TARGET_AGENT_ID, "actual": actual_agent}, status=403)
                return
            msg = ""
            try:
                messages = body.get("messages") or []
                msg = (messages[-1].get("content") or "").lower() if messages else ""
            except Exception:
                msg = ""
            if "followup-action" in msg:
                state["last_mode"] = "followup-action"
                await fulfill_json(route, {
                    "reply": "Devo prima gestire un follow-up.",
                    "needsInfo": True,
                    "multiDay": False,
                    "lodging": "home",
                    "tourDate": TOMORROW,
                    "startTime": None,
                    "endTime": None,
                    "selection": [],
                    "days": [],
                    "notes": None,
                    "intent": {"requestedEntityTypes": ["orphan"], "requestedArea": {"comuni": ["Bacoli"], "comune": "Bacoli"}},
                    "followUpActions": [{"action": "keep", "followUpId": "fu-1", "key": "orphan:own-1", "currentDate": TOMORROW}],
                    "effectiveAgentId": TARGET_AGENT_ID,
                })
                return

            if "pending-followup" in msg:
                state["last_mode"] = "pending-followup"
                await fulfill_json(route, {
                    "reply": "Creo il giro.",
                    "needsInfo": False,
                    "multiDay": False,
                    "lodging": "home",
                    "tourDate": TOMORROW,
                    "startTime": None,
                    "endTime": None,
                    "selection": [{"key": "orphan:own-1", "reason": None}],
                    "days": [],
                    "notes": None,
                    "intent": {"requestedEntityTypes": ["orphan"], "requestedArea": {"comuni": ["Bacoli"], "comune": "Bacoli"}},
                    "effectiveAgentId": TARGET_AGENT_ID,
                })
                return

            if 'i miei orfani' in msg or state['mode'] == 'normal':
                state['last_mode'] = 'orphan' if 'i miei orfani' in msg else 'development-plan'
                await fulfill_json(route, {
                    'reply': 'Propongo i due orfani di Bacoli.', 'needsInfo': False, 'multiDay': False,
                    'lodging': 'home', 'tourDate': TOMORROW, 'startTime': None, 'endTime': None,
                    'selection': [{'key': 'orphan:own-1', 'reason': None}, {'key': 'orphan:own-2', 'reason': None}],
                    'days': [], 'notes': None,
                    'intent': {'requestedEntityTypes': ['orphan'], 'ownOrphansOnly': 'i miei orfani' in msg,
                               'requestedArea': {'comuni': ['Bacoli'], 'comune': 'Bacoli'}},
                    'effectiveAgentId': TARGET_AGENT_ID,
                })
                return
            state["last_mode"] = "development"
            await fulfill_json(route, {
                "reply": "Non trovo nuovi punti, vuoi estendere?",
                "needsInfo": True,
                "multiDay": False,
                "lodging": "home",
                "tourDate": None,
                "startTime": None,
                "endTime": None,
                "selection": [],
                "days": [],
                "notes": None,
                "intent": {"requestedEntityTypes": ["orphan"], "requestedArea": {"comuni": ["Bacoli"], "comune": "Bacoli"}},
                "effectiveAgentId": TARGET_AGENT_ID,
            })
            return

        if "/functions/v1/" in url:
            await fulfill_json(route, {"error": "FIXTURE_MISSING_EDGE_ROUTE", "url": url}, status=503)
            return

        if "/rest/v1/rpc/" in url:
            if "/rpc/tabaccherie_points_in_bbox" in url:
                await fulfill_json(route, [])
                return
            if "/rpc/ai_tour_order_stats" in url:
                await fulfill_json(route, [
                    {"customer_id": "own-1", "order_count": 1, "last_order_date": "2025-09-01", "total_revenue": 0, "revenue_6m": 0, "avg_order_value": 0, "avg_reorder_days": None},
                    {"customer_id": "own-2", "order_count": 1, "last_order_date": "2025-09-01", "total_revenue": 0, "revenue_6m": 0, "avg_order_value": 0, "avg_reorder_days": None},
                ])
                return
            if "/rpc/ai_tour_contact_stats" in url:
                await fulfill_json(route, [
                    {"customer_id": "own-1", "last_visit_date": "2025-10-01", "last_inspection_date": "2025-10-01"},
                    {"customer_id": "own-2", "last_visit_date": "2025-10-01", "last_inspection_date": "2025-10-01"},
                ])
                return
            if "/rpc/ai_tour_learned_durations" in url:
                await fulfill_json(route, [])
                return
            if "/rpc/ai_tour_no_interest_ids" in url:
                await fulfill_json(route, [])
                return
            if "/rpc/get_orphan_tabaccherie_ids" in url:
                await fulfill_json(route, [
                    {"tabaccheria_id": "tab-own-1", "orphan_status": "orphan_b", "stato_visita": "visitato"},
                    {"tabaccheria_id": "tab-own-2", "orphan_status": "orphan_b", "stato_visita": "visitato"},
                ])
                return
            if "/rpc/ai_tour_free_tabaccherie" in url:
                query = parse_qs(urlsplit(url).query)
                from_idx = int(query.get('offset', ['0'])[0])
                to_idx = from_idx + int(query.get('limit', ['1000'])[0]) - 1
                assert (req.post_data_json or {}).get('p_limit') == 2500
                state["free_ranges"].append([from_idx, to_idx])
                rows = state["pool_rows"][from_idx: to_idx + 1]
                await fulfill_json(route, rows)
                return
            if "/rpc/ai_tour_comune_centroid" in url:
                await fulfill_json(route, [{"lat": 40.79, "lng": 14.07}])
                return
            state['blocked_unknown_api'].append(url)
            await fulfill_json(route, {"error": "FIXTURE_MISSING_RPC_ROUTE", "url": url}, status=503)
            return

        if '/rest/v1/' in url and method not in ('GET', 'HEAD'):
            state['writes'].append(url)
            await route.abort()
            return

        if "/rest/v1/profiles" in url:
            accept = headers.get("accept", "")
            if f"id=eq.{ADMIN_ID}" in url:
                if "vnd.pgrst.object+json" in accept:
                    await fulfill_json(route, _profile_admin())
                else:
                    await fulfill_json(route, [_profile_admin()])
                return
            if "vnd.pgrst.object+json" in accept:
                await fulfill_json(route, _profile_admin())
            else:
                await fulfill_json(route, [_target_agent_profile(), {"id": ADMIN_ID, "full_name": "Iter63 Admin"}])
            return

        if "/rest/v1/ai_tour_settings" in url:
            accept = headers.get("accept", "")
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
            if state['last_mode'] in ('followup-action', 'pending-followup'):
                await fulfill_json(route, [{'id': 'fu-1', 'agent_id': TARGET_AGENT_ID, 'customer_id': 'own-1',
                    'appointment_type': 'follow_up', 'status': 'scheduled', 'completed_at': None,
                    'appointment_date': TOMORROW + 'T07:00:00Z', 'quick_customer_name': None, 'notes': None}])
            else:
                await fulfill_json(route, [])
            return
        if "/rest/v1/agent_zones" in url:
            await fulfill_json(route, [])
            return
        if "/rest/v1/ai_tours" in url:
            await fulfill_json(route, [])
            return
        if "/rest/v1/ai_tour_events" in url:
            if state["last_mode"] == "pending-followup":
                await fulfill_json(route, [{"id": "fu-1", "agent_id": TARGET_AGENT_ID, "customer_id": "own-1", "entity_type": "follow_up", "title": "Follow-up Own 1", "scheduled_at": "2026-10-05T09:00:00.000Z", "duration_minutes": 20, "status": "scheduled"}])
            else:
                await fulfill_json(route, [])
            return
        if "/rest/v1/orphan_config" in url:
            cfg = {"id": "cfg", "orphan_b_days": 30, "orphan_a_days": 110, "created_at": "2026-01-01T00:00:00.000Z", "updated_at": "2026-01-01T00:00:00.000Z"}
            accept = headers.get("accept", "")
            if "vnd.pgrst.object+json" in accept:
                await fulfill_json(route, cfg)
            else:
                await fulfill_json(route, [cfg])
            return
        if "/rest/v1/tabaccherie" in url:
            await fulfill_json(route, [])
            return
        if "/rest/v1/system_settings" in url:
            await fulfill_json(route, [{"setting_value": []}])
            return

        state['blocked_unknown_api'].append(url)
        await fulfill_json(route, {"error": "FIXTURE_MISSING_REST_ROUTE", "url": url}, status=503)

    async def handle_osrm(route):
        url = route.request.url
        if "/table/v1/driving/" in url:
            coords_part = url.split('/table/v1/driving/', 1)[1].split('?', 1)[0]
            points = [c for c in coords_part.split(';') if c]
            n = max(1, len(points))
            durations = [[0 if i == j else 420 for j in range(n)] for i in range(n)]
            distances = [[0 if i == j else 2500 for j in range(n)] for i in range(n)]
            await fulfill_json(route, {"code": "Ok", "durations": durations, "distances": distances})
            return
        if "/route/v1/driving/" in url:
            coords_part = url.split('/route/v1/driving/', 1)[1].split('?', 1)[0]
            points = [[float(v) for v in point.split(',')] for point in coords_part.split(';')]
            legs = [{"distance": 2500, "duration": 420} for _ in range(len(points) - 1)]
            await fulfill_json(route, {"code": "Ok", "routes": [{
                "distance": 2500 * len(legs), "duration": 420 * len(legs),
                "geometry": {"coordinates": points, "type": "LineString"}, "legs": legs,
            }]})
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


async def run(page):
    page.on("console", lambda msg: print(f"CONSOLE[{msg.type}]: {msg.text}"))
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    await page.set_viewport_size({"width": 390, "height": 844})
    await inject_bootstrap_storage(page)
    state = await install_network_fixture(page)

    await page.goto(f"{PREVIEW_URL}/gptour")
    await page.wait_for_selector('[data-testid="gptour-screen"]', timeout=20000)
    # Aspetta fine caricamento iniziale prima di aprire impostazioni (il bottone è disabilitato durante il load).
    await expect(page.get_by_test_id('gptour-pool-count')).not_to_contain_text('Carico portafoglio e territorio…', timeout=30000)
    header_now = (await page.get_by_test_id('gptour-pool-count').inner_text()).strip()
    if 'DELLA VOLPE VINCENZO · 2502' not in header_now:
        await page.get_by_test_id('gptour-settings').click()
        await page.get_by_test_id('gptour-agent-search').wait_for(state='visible', timeout=10000)
        await page.get_by_test_id('gptour-agent-search').fill('DELLA VOLPE')
        await page.get_by_test_id(f'gptour-agent-{TARGET_AGENT_ID}').click()
        await page.get_by_test_id('gptour-settings-close').click()
    await expect(page.get_by_test_id('gptour-pool-count')).to_contain_text('DELLA VOLPE VINCENZO · 2502', timeout=20000)
    assert [1000, 1999] in state['free_ranges'] and [2000, 2499] in state['free_ranges']

    async def send(message):
        await page.get_by_test_id('gptour-message-input').fill(message)
        await page.get_by_test_id('gptour-send').click()

    async def reset():
        await page.get_by_test_id('gptour-reset').click()
        await expect(page.get_by_test_id('gptour-plan')).to_have_count(0)

    await send('Domani voglio fare una giornata di sviluppo a Bacoli e comuni limitrofi')
    try:
        await expect(page.get_by_test_id('gptour-plan-metrics')).to_contain_text('19 tappe', timeout=30000)
    except Exception as e:
        toast_text = await page.evaluate("""() => {
          const cands = Array.from(document.querySelectorAll('[data-testid*="toast"], .toast, [class*="toast"]'));
          return cands.map(x => (x.textContent || '').trim()).filter(Boolean).join(' | ');
        }""")
        chat_text = await page.evaluate("""() => {
          const nodes = Array.from(document.querySelectorAll('[data-testid^="gptour-message-"]'));
          return nodes.map(n => (n.textContent || '').trim()).filter(Boolean).join(' | ');
        }""")
        raise AssertionError(f"gptour-plan-metrics timeout. toast='{toast_text}' chat='{chat_text[:500]}' error={e}") from e
    criteria = page.get_by_test_id('gptour-criteria')
    await expect(criteria).to_contain_text('Da acquisire')
    await expect(criteria).to_contain_text('Mai visitata')
    stops = page.get_by_test_id(re.compile(r'^gptour-stop-\d+$'))
    rows = await stops.all_inner_texts()
    assert sum('Monte di Procida' in row for row in rows) == 4
    assert sum('Bacoli' in row for row in rows) == 15
    assert not any('Caserta' in row for row in rows)
    await criteria.scroll_into_view_if_needed()
    await page.screenshot(path='/tmp/iter63_development_normal.jpeg', quality=20, full_page=False)
    print('PASS normal: 2 AI + 13 registro Bacoli + 4 Monte; 2500 righe lette in3pagine')

    await page.get_by_test_id('gptour-stop-2').click()
    await page.get_by_test_id('gptour-action-remove').click()
    await expect(page.get_by_test_id('gptour-plan-metrics')).to_contain_text('18 tappe')
    print('PASS manual removal: no automatic refill')

    await reset()
    state['mode'] = 'fallback'
    await send('Domani voglio fare una giornata di sviluppo a Bacoli e comuni limitrofi')
    await expect(page.get_by_test_id('gptour-plan-metrics')).to_contain_text('17 tappe', timeout=30000)
    expected_date = await page.evaluate("d => new Intl.DateTimeFormat('it-IT', {weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Rome'}).format(new Date(d+'T12:00:00Z'))", TOMORROW)
    await expect(page.get_by_test_id('gptour-plan')).to_contain_text('Giro proposto · ' + expected_date)
    await page.get_by_text(re.compile(r'Giornata di sviluppo: nel registro')).first.wait_for(state='visible')
    print('PASS needsInfo fallback: 17free/never, domani')

    await reset()
    await send('i miei orfani di Bacoli')
    await expect(page.get_by_test_id('gptour-plan-metrics')).to_contain_text('2 tappe', timeout=30000)
    await expect(criteria).not_to_contain_text('Da acquisire')
    await expect(criteria).not_to_contain_text('Mai visitata')
    print('PASS orphan-only: no development forced')

    await reset()
    await send('followup-action sviluppo bacoli')
    await page.get_by_text('Devo prima gestire un follow-up.', exact=True).wait_for(state='visible')
    await expect(page.get_by_test_id('gptour-plan')).to_have_count(0)
    print('PASS followUpActions: no deterministic fallback')

    await reset()
    await send('pending-followup sviluppo bacoli')
    await page.get_by_test_id('gptour-followups').wait_for(state='visible')
    await expect(page.get_by_test_id('gptour-plan')).to_have_count(0)
    print('PASS pending followup: decision required before plan')
    assert not state['blocked_unknown_api'], state['blocked_unknown_api']
    assert not state['writes'], state['writes']
    assert not errors, errors
    print('PASS: no unknown APIs, writes or page errors')
