"""Iteration 79: GPTour Orchestrator authenticated synthetic browser flow.

Scope:
- Uses synthetic auth/session only (no real CRM/Auth login).
- Installs HTTP mocks before navigation (fail-closed for unknown APIs).
- Verifies Altro card gating behavior and orchestrator route interactions.
"""

from __future__ import annotations

import base64
import json
import time
from copy import deepcopy
from urllib.parse import urlparse
from dotenv import dotenv_values
from playwright.async_api import expect
from typing import Any, Dict


CONFIG = dotenv_values('/app/frontend/.env')
PREVIEW_URL = CONFIG['EXPO_PACKAGER_PROXY_URL'].rstrip('/')
SUPABASE_URL = CONFIG['EXPO_PUBLIC_SUPABASE_URL'].rstrip('/')
SUPABASE_PROJECT_REF = urlparse(SUPABASE_URL).hostname.split('.')[0]
AUTH_STORAGE_KEY = f"sb-{SUPABASE_PROJECT_REF}-auth-token"
MIGRATION_FLAG_KEY = "supabase_publishable_key_migration_2026_07"
OWNER_ID = "11111111-1111-4111-8111-111111111111"


def _b64url(payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def build_auth_payload() -> Dict[str, Any]:
    now = int(time.time())
    exp = now + 3600 * 24
    token = (
        f"{_b64url({'alg': 'HS256', 'typ': 'JWT'})}."
        f"{_b64url({'aud': 'authenticated', 'exp': exp, 'iat': now - 60, 'iss': 'supabase', 'sub': OWNER_ID, 'email': 'gptour-fixture@example.test', 'role': 'authenticated', 'app_metadata': {'provider': 'email', 'providers': ['email']}, 'user_metadata': {'full_name': 'Synthetic User'}, 'session_id': 'synthetic-session-iter79'})}."
        "sig"
    )
    user = {
        "id": OWNER_ID,
        "aud": "authenticated",
        "role": "authenticated",
        "email": "gptour-fixture@example.test",
        "email_confirmed_at": "2026-01-01T00:00:00.000Z",
        "app_metadata": {"provider": "email", "providers": ["email"]},
        "user_metadata": {"full_name": "Synthetic User"},
        "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": "2026-01-01T00:00:00.000Z",
        "is_anonymous": False,
    }
    session = {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": 86400,
        "expires_at": exp,
        "refresh_token": "synthetic-refresh-iter79",
        "user": user,
    }
    return {
        "currentSession": session,
        "expiresAt": exp * 1000,
        "access_token": token,
        "refresh_token": "synthetic-refresh-iter79",
        "expires_in": 86400,
        "expires_at": exp,
        "token_type": "bearer",
        "user": user,
        "session": session,
    }


def base_criteria() -> Dict[str, Any]:
    return {
        "groups": {"version": 1, "existing": True, "newPoints": True, "ownOnly": False, "inactiveDays": 20, "needsDays": False},
        "area": {"comuni": ["MILANO"], "provincia": None, "exhaustive": False},
        "date": "2026-10-13",
        "dateAnchorTurn": 1,
        "startTime": "07:00",
        "endTime": "16:30",
        "wantAll": False,
        "nonWorkingConfirmed": False,
        "maxDays": 1,
        "extraDaysApproved": False,
        "requiredKeys": ["cust:111"],
        "requiredNames": ["Cliente Storico"],
        "excludedNames": [],
        "excludedKeys": [],
        "consents": [],
    }


def orchestrator_response(req: Dict[str, Any], status: str = "ready", revision: int = 1, plan_id: str = "plan-synthetic-79", include_question: bool = False, start_min: int = 420) -> Dict[str, Any]:
    question = {
        "id": "followups:fu-1,fu-2",
        "kind": "follow_ups",
        "text": "Per lunedì risultano impegni da decidere",
        "options": [{"id": "include_all", "label": "Includili tutti"}, {"id": "exclude_all", "label": "Lasciali fuori dal giro"}],
    } if include_question else None
    plan = {
        "planId": plan_id,
        "sessionId": req.get("sessionId"),
        "sessionRevision": revision,
        "engineVersion": "gptour-orchestrator/0.2.0",
        "contractVersion": "1.0",
        "generatedAt": "2026-10-12T10:00:00.000Z",
        "date": "2026-10-13",
        "startMin": start_min,
        "finishMin": 930,
        "endMin": 1020,
        "departure": {"lat": 45.348, "lng": 9.164, "label": "Casa"},
        "returnTo": {"lat": 45.348, "lng": 9.164, "label": "Casa"},
        "stops": [{"key": "cust:111", "name": "Cliente Storico", "city": "MILANO", "lat": 45.42, "lng": 9.18, "role": "required_by_agent", "group": "existing", "arrivalMin": 500, "departureMin": 530, "travelMinFromPrev": 20, "travelKmFromPrev": 11, "waitMin": 0, "visitMin": 30, "lunchBeforeMin": 0, "reason": "cliente con relazione commerciale", "lastOrderDate": "2026-09-18", "daysSinceOrder": 24, "outsideWindow": False}],
        "totals": {"driveMin": 72, "visitMin": 30, "waitMin": 0, "breakMin": 0, "returnMin": 28, "totalMin": 130, "availableMin": 510, "bufferMin": 380, "totalKm": 44.8},
        "geometry": [[45.348, 9.164], [45.42, 9.18], [45.348, 9.164]],
        "warnings": [],
        "conflicts": [],
        "verification": "estimated_routing" if status == "planning" else "verified_routing",
        "snapshotRef": "snapshot-iter79",
        "selectionReasons": {"selected": [{"key": "cust:111", "reason": "cliente con relazione commerciale"}], "excluded": []},
        "dependsOnPendingChanges": ["pending-routing-confirmation"] if status == "planning" else [],
        "days": [{"day": 1, "date": "2026-10-13", "startMin": start_min, "finishMin": 930, "endMin": 1020, "departure": {"lat": 45.348, "lng": 9.164, "label": "Casa"}, "returnTo": {"lat": 45.348, "lng": 9.164, "label": "Casa"}, "stops": [{"key": "cust:111", "name": "Cliente Storico", "city": "MILANO", "lat": 45.42, "lng": 9.18, "role": "required_by_agent", "group": "existing", "arrivalMin": 500, "departureMin": 530, "travelMinFromPrev": 20, "travelKmFromPrev": 11, "waitMin": 0, "visitMin": 30, "lunchBeforeMin": 0, "reason": "cliente con relazione commerciale", "lastOrderDate": "2026-09-18", "daysSinceOrder": 24, "outsideWindow": False}], "totals": {"driveMin": 72, "visitMin": 30, "waitMin": 0, "breakMin": 0, "returnMin": 28, "totalMin": 130, "availableMin": 510, "bufferMin": 380, "totalKm": 44.8}, "geometry": [[45.348, 9.164], [45.42, 9.18], [45.348, 9.164]], "startsFrom": "home", "returnHomeAfterDay": True, "nightKmHome": None, "nightDecision": "last_day", "warnings": [], "conflicts": []}],
    }
    return {
        "status": status,
        "contractVersion": "1.0",
        "engineVersion": "gptour-orchestrator/0.2.0",
        "sessionId": req.get("sessionId"),
        "sessionRevision": revision,
        "requestId": req.get("requestId"),
        "generatedAt": "2026-10-12T10:00:00.000Z",
        "message": "Piano pronto e verificato." if status == "ready" else "Bozza pronta: verifico routing per conferma.",
        "question": question,
        "criteria": base_criteria(),
        "pendingDecisions": ["follow_up:fu-1"] if include_question else [],
        "plan": None if status == 'needs_clarification' else plan,
        "planId": None if status == 'needs_clarification' else plan_id,
        "conflicts": [],
        "dataQuality": {"candidatesComplete": True, "poolTruncated": False, "purchasesVerified": True, "registryVerified": True, "routingSource": "estimate" if status == "planning" else "osrm", "notes": []},
        "metrics": {"durationMs": 1200, "crmQueries": 4, "aiCalls": 0, "routingCalls": 1 if status == "planning" else 2},
    }


async def run(page):
    """Run synthetic authenticated orchestrator browser flow."""
    state: Dict[str, Any] = {
        "probe_status": 400,
        "revoked": False,
        "revision": 0,
        "plan_id": "plan-synthetic-79",
        "retry503_seen": False,
        "bodies": [],
        "unknown": [],
        "start_min": 420,
        "last_snapshot": None,
        "page_errors": [],
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

        if urlparse(url).netloc == urlparse(PREVIEW_URL).netloc and not urlparse(url).path.startswith('/api/') and method in ('GET', 'HEAD'):
            await route.continue_()
            return

        if urlparse(url).netloc == urlparse(SUPABASE_URL).netloc:
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
                profile = {"id": OWNER_ID, "email": "gptour-fixture@example.test", "full_name": "Synthetic User", "role": "agent", "agent_id": OWNER_ID, "supervisor_id": None, "branch_id": None, "is_active": True, "created_at": "2026-01-01T00:00:00.000Z", "updated_at": "2026-01-01T00:00:00.000Z"}
                accept = (req.headers or {}).get("accept", "")
                headers = {"content-range": "0-0/1", "access-control-expose-headers": "content-range"}
                if "application/vnd.pgrst.object+json" in accept:
                    await fulfill_json(route, profile, status=200, headers=headers)
                else:
                    await fulfill_json(route, [profile], status=200, headers=headers)
                return
            if "/functions/v1/gptour-orchestrator" in url:
                body = req.post_data_json or {}
                state["bodies"].append(body)
                if body.get("contractVersion") == "1.0" and len(body.keys()) == 1:
                    await fulfill_json(route, {"error": "probe"}, status=state["probe_status"])
                    return
                if state["revoked"]:
                    blocked = orchestrator_response(body, status="ready", revision=max(state["revision"], 1))
                    blocked["status"] = "blocked"
                    blocked["message"] = "La sessione è legata a un altro agente"
                    blocked["errorCode"] = "agent_mismatch"
                    blocked["conflicts"] = ["agent_mismatch"]
                    await fulfill_json(route, blocked, status=403)
                    return

                action = (body.get("action") or {}).get("type")
                message = (body.get("message") or "").lower().strip()

                if message == "retry503" and not state["retry503_seen"]:
                    state["retry503_seen"] = True
                    await fulfill_json(route, {"error": "temporary"}, status=503)
                    return
                if message == "conflitto":
                    state["revision"] += 1
                    conflict = orchestrator_response(body, status="ready", revision=state["revision"])
                    conflict["status"] = "failed"
                    conflict["plan"] = None
                    conflict["planId"] = None
                    conflict["errorCode"] = "revision_conflict"
                    conflict["message"] = "Revisione cambiata"
                    conflict["conflicts"] = ["revision_conflict"]
                    conflict["dataQuality"]["routingSource"] = "none"
                    await fulfill_json(route, conflict, status=409)
                    return
                if action == "get_plan":
                    assert state['last_snapshot'] is not None
                    response = deepcopy(state['last_snapshot'])
                    assert body['action']['planId'] == response['planId']
                    assert body['sessionId'] == response['sessionId']
                    response['requestId'] = body['requestId']
                    await fulfill_json(route, response, status=200)
                    return
                if action == "follow_up_decision":
                    state["revision"] += 1
                    await fulfill_json(route, orchestrator_response(body, status="ready", revision=state["revision"], plan_id=state["plan_id"]), status=200)
                    return

                state["revision"] += 1
                status = "needs_clarification" if message == "domanda" else "ready"
                if "parto alle8" in message or "parto alle 8" in message:
                    state['start_min'] = 480
                response = orchestrator_response(body, status=status, revision=state["revision"], plan_id=state["plan_id"], include_question=(status == "needs_clarification"), start_min=state['start_min'])
                response['criteria']['startTime'] = '08:00' if state['start_min'] == 480 else '07:00'
                state['last_snapshot'] = deepcopy(response)
                await fulfill_json(route, response, status=200)
                return

            if "/rest/v1/" in url:
                await fulfill_json(route, [], status=200, headers={"content-range": "0-0/0", "access-control-expose-headers": "content-range"})
                return

        state["unknown"].append({"url": url, "method": method})
        await fulfill_json(route, {"error": "blocked"}, status=503)

    page.on('pageerror', lambda error: state['page_errors'].append(str(error)))

    await page.set_viewport_size({"width": 390, "height": 844})
    await page.route("**/*", handler)

    auth = build_auth_payload()
    await page.add_init_script(
        f"""
        (() => {{
          const payload = {json.dumps({'k': AUTH_STORAGE_KEY, 'v': auth, 'm': MIGRATION_FLAG_KEY})};
          localStorage.setItem(payload.k, JSON.stringify(payload.v));
          localStorage.setItem(payload.m, '1');
          localStorage.setItem('@privacy_terms_accepted', 'true');
          localStorage.setItem('@privacy_terms_accepted_date', new Date().toISOString());
        }})();
        """
    )

    card = page.get_by_test_id('menu-gptour-orchestrator')
    composer = page.get_by_test_id('orchestrator-message-input')
    send = page.get_by_test_id('orchestrator-send')
    ready = page.get_by_test_id('orchestrator-ready-plan')

    def is_probe(response):
        return '/functions/v1/gptour-orchestrator' in response.url and response.request.post_data_json == {'contractVersion': '1.0'}

    await page.goto(PREVIEW_URL, wait_until='domcontentloaded')
    await page.get_by_test_id('tab-more').click()
    await expect(card).to_be_visible()
    results = {'menu_probe400': True}
    for code in (403, 503, 500):
        await page.get_by_test_id('tab-dashboard').click()
        state['probe_status'] = code
        async with page.expect_response(is_probe) as pending:
            await page.get_by_test_id('tab-more').click()
        response = await pending.value
        assert response.status == code
        await expect(card).to_have_count(0)
        await expect(page.get_by_test_id('menu-ai-tour')).to_be_visible()
        results[f'menu_probe{code}_hidden'] = True

    await page.get_by_test_id('tab-dashboard').click()
    state['probe_status'] = 400
    await page.get_by_test_id('tab-more').click()
    await expect(card).to_be_visible()
    state['probe_status'] = 403
    await card.click()
    await expect(page.get_by_test_id('orchestrator-access-message')).to_contain_text('Il server non ha autorizzato')
    await expect(send).to_be_disabled()
    assert all('sessionId' not in b for b in state['bodies'])
    results['revoked_between_menu_route'] = True
    state['probe_status'] = 400
    await page.get_by_test_id('orchestrator-back').click()
    await expect(card).to_be_visible()
    await card.click()
    await expect(composer).to_be_editable()
    await composer.fill('domanda')
    await send.click()
    await page.get_by_test_id('orchestrator-answer-followups:fu-1,fu-2-include_all').click()
    await expect(ready).to_be_visible()
    assert state['bodies'][-1]['action']['optionId'] == 'include_all'
    await composer.fill('Parto alle8')
    await send.click()
    await expect(page.get_by_test_id('orchestrator-day-start')).to_contain_text('08:00')
    await expect(composer).to_be_editable()
    # Check the actual plan presentation, not just the existence of the plan card.
    await expect(ready).to_contain_text('44,8 km')
    await expect(ready).to_contain_text('Cliente Storico')
    await expect(ready).to_contain_text('08:20')
    await expect(ready).to_contain_text('08:50')
    before_confirm = len(state['bodies'])
    await page.get_by_test_id('orchestrator-confirm-plan').click()
    await expect(page.get_by_test_id('orchestrator-confirm-plan')).to_be_disabled()
    assert len(state['bodies']) == before_confirm
    results['followups_timechange_tappe_confirm'] = True
    await page.screenshot(path='/tmp/orchestrator-main-ready390.jpeg', quality=20, full_page=False)

    # Recovery immediately after changing time: fixture must return the SAME cached plan.
    snapshot = deepcopy(state['last_snapshot'])
    before_reload = len(state['bodies'])
    await page.reload(wait_until='domcontentloaded')
    await expect(composer).to_be_editable()
    await expect(ready).to_be_visible()
    await expect(page.get_by_test_id('orchestrator-day-start')).to_contain_text('08:00')
    calls = state['bodies'][before_reload:]
    assert len(calls) == 2 and calls[0] == {'contractVersion': '1.0'}
    assert calls[1]['action'] == {'type': 'get_plan', 'planId': snapshot['planId']}
    assert calls[1]['sessionId'] == snapshot['sessionId']
    assert state['last_snapshot'] == snapshot
    results['recovery_same_plan_and_time_no_replan'] = True
    results['reload_calls'] = ['probe', 'get_plan']

    await composer.fill('retry503')
    await send.click()
    await page.get_by_test_id('orchestrator-retry').click()
    await expect(composer).to_be_editable()
    await expect(ready).to_be_visible()
    assert state['bodies'][-2] == state['bodies'][-1]
    results['retry503_same_id_body'] = True
    await composer.fill('conflitto')
    await send.click()
    await expect(page.get_by_test_id('orchestrator-conflict-revision')).to_be_visible()
    await expect(ready).to_have_count(0)
    conflict_req = state['bodies'][-1]
    server_revision = state['revision']
    await composer.fill('nuovo turno dopo conflitto')
    await send.click()
    await expect(ready).to_be_visible()
    await expect(composer).to_be_editable()
    assert state['bodies'][-1]['requestId'] != conflict_req['requestId']
    assert state['bodies'][-1]['expectedRevision'] == server_revision
    results['conflict_explicit_new_request'] = True
    for width, height in ((390, 844), (320, 568)):
        await page.set_viewport_size({'width': width, 'height': height})
        await composer.click()
        await expect(composer).to_be_visible()
        box = await composer.bounding_box()
        assert box and box['y'] >= 0 and box['y'] + box['height'] <= height
        assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        await page.screenshot(path=f'/tmp/orchestrator-main-{width}.jpeg', quality=20, full_page=False)
    results['layout390_320'] = True
    await page.get_by_test_id('orchestrator-back').click()
    await expect(card).to_be_visible()
    results['back_to_altro'] = True
    assert not state['page_errors'], state['page_errors']
    business_unknown = [r for r in state['unknown'] if '/api/' in r['url'] or 'supabase' in r['url']]
    assert not business_unknown, business_unknown
    results['page_errors'] = 0
    results['unknown_business_requests'] = 0
    results['mocked_only_in_tests'] = True
    print('RESULT_JSON:' + json.dumps(results))
    return results
