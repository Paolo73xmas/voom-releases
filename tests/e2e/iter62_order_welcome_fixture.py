"""Iteration 62: Order Welcome 25% fixture (fully isolated, no remote writes).

Coverage:
- New customer (count=0): checkbox visible, totals update immediately (known fixture values)
- Existing customer (count>=1): ineligible info and no checkbox
- HEAD error (500): error status + retry, fail-closed; retry then count=0 shows checkbox
- Null count: fail-closed (error, no checkbox)
- Customer switch from eligible+checked to existing clears welcome selection
- Domestic -> foreign toggle clears/hides welcome discount

All Supabase/API writes are blocked fail-closed.
"""

from __future__ import annotations

import base64
import asyncio
import json
import time
from typing import Any, Dict
from playwright.async_api import expect
from urllib.parse import parse_qs, urlsplit


PREVIEW_URL = "https://voom-ios.preview.emergentagent.com"
SUPABASE_PROJECT_REF = "gorwxfzzyzxmxnizmebw"
SUPABASE_URL = f"https://{SUPABASE_PROJECT_REF}.supabase.co"
AUTH_STORAGE_KEY = f"sb-{SUPABASE_PROJECT_REF}-auth-token"
MIGRATION_FLAG_KEY = "supabase_publishable_key_migration_2026_07"

FIXTURE_AGENT_ID = "11111111-1111-4111-8111-111111111111"
FIXTURE_EMAIL = "gptour-fixture@example.test"

CUSTOMER_NEW = "11111111-1111-4111-8111-111111111101"
CUSTOMER_EXISTING = "11111111-1111-4111-8111-111111111102"
CUSTOMER_ERROR = "11111111-1111-4111-8111-111111111103"
CUSTOMER_NULL = "11111111-1111-4111-8111-111111111104"

PRODUCT_ELIGIBLE = "11111111-1111-4111-8111-111111112001"
PRODUCT_EXCLUDED = "11111111-1111-4111-8111-111111112002"
PAYMENT_ID = "11111111-1111-4111-8111-111111113001"
SHIPPING_ID = "11111111-1111-4111-8111-111111114001"


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
        "session_id": "fixture-session-iter62-order-welcome",
    }
    return f"{_b64url(header)}.{_b64url(payload)}.fixture_signature"


def build_auth_payload() -> Dict[str, Any]:
    now = int(time.time())
    expires_in = 3600 * 24
    expires_at = now + expires_in
    access_token = build_fixture_jwt(expires_at)
    refresh_token = "fixture-refresh-token-iter62"
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


async def inject_bootstrap_storage(page) -> None:
    payload = {
        "auth_key": AUTH_STORAGE_KEY,
        "auth_value": build_auth_payload(),
        "migration_key": MIGRATION_FLAG_KEY,
    }
    payload_json = json.dumps(payload)
    await page.add_init_script(
        f"""
        (() => {{
          const payload = {payload_json};
          localStorage.setItem(payload.auth_key, JSON.stringify(payload.auth_value));
          localStorage.setItem(payload.migration_key, '1');
          localStorage.setItem('@privacy_terms_accepted', 'true');
          localStorage.setItem('@privacy_terms_accepted_date', new Date().toISOString());
        }})();
        """
    )


def _customers_rows():
    return [
        {"id": CUSTOMER_NEW, "business_name": "TEST FIRST ORDER NEW", "city": "Milano", "province": "MI", "agent_id": FIXTURE_AGENT_ID},
        {"id": CUSTOMER_EXISTING, "business_name": "TEST EXISTING CUSTOMER", "city": "Milano", "province": "MI", "agent_id": FIXTURE_AGENT_ID},
        {"id": CUSTOMER_ERROR, "business_name": "TEST HEAD ERROR", "city": "Milano", "province": "MI", "agent_id": FIXTURE_AGENT_ID},
        {"id": CUSTOMER_NULL, "business_name": "TEST NULL COUNT", "city": "Milano", "province": "MI", "agent_id": FIXTURE_AGENT_ID},
    ]


def _products_rows(is_foreign: bool):
    rows = [
        {
            "id": PRODUCT_ELIGIBLE,
            "name": "Fixture Eligible Product",
            "short_description": "STD-ELIGIBLE",
            "sku": "ELIG-100",
            "unit_price": 100,
            "supplier_id": "fixture-supplier",
            "unit_of_measure": "pz",
            "accisa": 2,
            "iva_percentage": 22,
            "image_url": None,
            "is_active": True,
            "cashback_eligible": True,
            "estero": False,
            "rottamazione_no": False,
            "stock_quantity": 10,
            "category_id": None,
            "pezzi_cartone": None,
            "sconto_cartone": None,
        },
        {
            "id": PRODUCT_EXCLUDED,
            "name": "Fixture Excluded Product",
            "short_description": "STD-EXCLUDED",
            "sku": "EXCL-50",
            "unit_price": 50,
            "supplier_id": "fixture-supplier",
            "unit_of_measure": "pz",
            "accisa": 1,
            "iva_percentage": 22,
            "image_url": None,
            "is_active": True,
            "cashback_eligible": True,
            "estero": False,
            "rottamazione_no": True,
            "stock_quantity": 10,
            "category_id": None,
            "pezzi_cartone": None,
            "sconto_cartone": None,
        },
    ]
    if is_foreign:
        return []
    return rows


async def install_network_fixture(page):
    state = {
        "orders_head_error_attempts": 0,
        "blocked": [],
        "writes_blocked": [],
        "hold_new": None,
    }

    async def fulfill_json(route, payload, status=200, extra_headers=None):
        headers = {"content-type": "application/json", "access-control-allow-origin": PREVIEW_URL,
                   "access-control-expose-headers": "content-range", "access-control-allow-headers": "*"}
        if extra_headers:
            headers.update(extra_headers)
        await route.fulfill(status=status, headers=headers, body=json.dumps(payload))

    async def fulfill_head(route, count=None, status=200):
        headers = {"access-control-allow-origin": PREVIEW_URL, "access-control-expose-headers": "content-range"}
        if count is not None:
            headers["content-range"] = f"*/{count}"
        await route.fulfill(status=status, headers=headers, body="")

    async def block_write(route, reason: str):
        state["writes_blocked"].append(route.request.url)
        await fulfill_json(route, {"error": reason, "url": route.request.url}, status=503)

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

        if "/functions/v1/" in url:
            await fulfill_json(route, {"error": "FIXTURE_BLOCKED_EDGE", "url": url}, status=503)
            return

        # Read-only RPCs (Supabase uses POST also for read RPC calls)
        if "/rest/v1/rpc/get_available_stock" in url:
            await fulfill_json(route, [
                {"product_id": PRODUCT_ELIGIBLE, "stock_quantity": 10, "reserved_quantity": 0, "available_quantity": 10},
                {"product_id": PRODUCT_EXCLUDED, "stock_quantity": 10, "reserved_quantity": 0, "available_quantity": 10},
            ])
            return
        if "/rest/v1/rpc/get_branch_available_stock" in url:
            await fulfill_json(route, [])
            return

        # Fail-closed: block all other Supabase writes in this fixture.
        if method in ("POST", "PUT", "PATCH", "DELETE"):
            await block_write(route, "FIXTURE_BLOCKED_SUPABASE_WRITE")
            return

        if "/rest/v1/profiles" in url:
            profile = {
                "id": FIXTURE_AGENT_ID,
                "email": FIXTURE_EMAIL,
                "full_name": "Fixture Agent",
                "role": "agent",
                "agent_id": FIXTURE_AGENT_ID,
                "branch_id": None,
                "is_active": True,
            }
            accept = (req.headers or {}).get("accept", "")
            await fulfill_json(route, profile if "vnd.pgrst.object+json" in accept else [profile])
            return

        if "/rest/v1/branches" in url:
            await fulfill_json(route, [])
            return

        if "/rest/v1/customers" in url:
            rows = _customers_rows()
            wanted = parse_qs(urlsplit(url).query).get('id', [''])[0]
            if wanted.startswith('eq.'):
                rows = [row for row in rows if row['id'] == wanted[3:]]
            single = 'vnd.pgrst.object+json' in req.headers.get('accept', '')
            await fulfill_json(route, rows[0] if single and rows else rows)
            return

        if "/rest/v1/products" in url:
            await fulfill_json(route, _products_rows(is_foreign="estero=eq.true" in url))
            return

        if "/rest/v1/payment_methods" in url:
            await fulfill_json(route, [
                {"id": PAYMENT_ID, "name": "Contanti", "description": "Fixture", "is_active": True, "display_order": 1},
            ])
            return

        if "/rest/v1/shipping_methods" in url:
            await fulfill_json(route, [
                {
                    "id": SHIPPING_ID,
                    "name": "Fixture Shipping",
                    "description": "Fixture",
                    "cost": 10,
                    "is_active": True,
                    "display_order": 1,
                    "foreign_only": False,
                    "cost_type": "fixed",
                    "cost_percentage": None,
                    "min_cost": None,
                    "threshold_min": None,
                    "threshold_max": None,
                }
            ])
            return

        if "/rest/v1/user_category_permissions" in url:
            await fulfill_json(route, [])
            return

        if "/rest/v1/cashback_transactions" in url:
            await fulfill_json(route, {"balance_after": 0})
            return

        if "/rest/v1/cashback_config" in url:
            await fulfill_json(route, [])
            return

        if "/rest/v1/packages" in url or "/rest/v1/package_items" in url:
            await fulfill_json(route, [])
            return

        if "/rest/v1/rottamazione_config" in url:
            row = {"lots": [0, 100, 200], "multiplier": 2.5, "iva_rate": 1.22}
            accept = (req.headers or {}).get("accept", "")
            await fulfill_json(route, row if "vnd.pgrst.object+json" in accept else [row])
            return

        if "/rest/v1/orders" in url:
            # first-order HEAD checks
            if method == "HEAD":
                if f"customer_id=eq.{CUSTOMER_NEW}" in url:
                    if state['hold_new'] is not None:
                        await state['hold_new'].wait()
                    await fulfill_head(route, 0)
                    return
                if f"customer_id=eq.{CUSTOMER_EXISTING}" in url:
                    await fulfill_head(route, 2)
                    return
                if f"customer_id=eq.{CUSTOMER_ERROR}" in url:
                    state["orders_head_error_attempts"] += 1
                    if state["orders_head_error_attempts"] == 1:
                        await fulfill_head(route, status=500)
                        return
                    await fulfill_head(route, 0)
                    return
                if f"customer_id=eq.{CUSTOMER_NULL}" in url:
                    await fulfill_head(route)
                    return
            await fulfill_json(route, [])
            return

        if "/rest/v1/appointments" in url:
            await fulfill_json(route, [])
            return

        if "/rest/v1/ai_tours" in url or "/rest/v1/ai_tour_events" in url:
            await fulfill_json(route, [])
            return

        if "/rest/v1/rpc/" in url:
            await fulfill_json(route, {"error": "FIXTURE_MISSING_RPC_ROUTE", "url": url}, status=503)
            return

        await fulfill_json(route, {"error": "FIXTURE_MISSING_SUPABASE_ROUTE", "url": url}, status=503)

    async def block_unknown_api(route):
        req = route.request
        if req.resource_type not in ("xhr", "fetch"):
            await route.continue_()
            return

        url = req.url
        method = req.method.upper()

        if "voom-ios.preview.emergentagent.com/api/" in url:
            state["blocked"].append(url)
            if method in ("POST", "PUT", "PATCH", "DELETE"):
                await block_write(route, "FIXTURE_BLOCKED_PREVIEW_API_WRITE")
            else:
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

        state["blocked"].append(url)
        await route.abort()

    await page.route("**/*", block_unknown_api)
    await page.route(f"{SUPABASE_URL}/**", handle_supabase)
    return state


async def click_next(page):
    current = int((await page.get_by_test_id('order-current-step').inner_text()).split()[1])
    await page.get_by_test_id('order-next-step').click()
    await page.get_by_test_id('order-current-step').filter(has_text=f'Step {current + 1} di').wait_for(state='visible')


async def go_to_summary(page):
    await click_next(page)  # step1 -> step2
    await click_next(page)  # step2 -> step3
    await page.get_by_test_id(f'order-payment-option-{PAYMENT_ID}').click()
    await click_next(page)  # step3 -> step4
    await page.get_by_test_id(f'order-shipping-option-{SHIPPING_ID}').click()
    await click_next(page)  # step4 -> step5


async def back_to_customer_step(page):
    for expected_step in (4, 3, 2, 1):
        await page.get_by_test_id('order-previous-step').click()
        await page.get_by_test_id('order-current-step').filter(has_text=f'Step {expected_step} di').wait_for(state='visible')


async def pick_customer(page, customer_id: str):
    await page.get_by_test_id(f'order-customer-option-{customer_id}').click()
    customer = next(c for c in _customers_rows() if c['id'] == customer_id)
    await page.get_by_test_id('order-current-step').filter(has_text=customer['business_name']).wait_for(state='visible')


async def assert_money(page, selector: str, expected: str):
    await expect(page.locator(selector)).to_have_text(expected)


async def run(page):
    page.on("console", lambda msg: print(f"CONSOLE[{msg.type}]: {msg.text}"))
    page_errors = []
    page.on('pageerror', lambda err: page_errors.append(str(err)))
    await page.set_viewport_size({"width": 390, "height": 844})

    await inject_bootstrap_storage(page)
    state = await install_network_fixture(page)

    try:
        await page.goto(f"{PREVIEW_URL}/order-collection-v2", wait_until="domcontentloaded")
        await page.wait_for_selector('[data-testid="order-current-step"]', timeout=25000)
        print("PASS: order wizard opened")

        # NEW customer baseline
        await pick_customer(page, CUSTOMER_NEW)
        await click_next(page)
        await page.get_by_test_id(f'order-product-add-one-{PRODUCT_ELIGIBLE}').click()
        await page.get_by_test_id(f'order-product-add-one-{PRODUCT_EXCLUDED}').click()
        await assert_money(page, '[data-testid="order-cart-grand-total"]', '€186.66')
        await assert_money(page, '[data-testid="order-cart-tax-breakdown"]', 'Imp: €150.00 + Acc: €3.00 + IVA: €33.66')
        print("PASS: step2 baseline totals")

        await click_next(page)
        await page.get_by_test_id(f'order-payment-option-{PAYMENT_ID}').click()
        await click_next(page)
        await page.get_by_test_id(f'order-shipping-option-{SHIPPING_ID}').click()
        await click_next(page)

        await page.wait_for_selector('[data-testid="order-welcome-discount"]', timeout=15000)
        await page.get_by_test_id('order-summary-grand-total').scroll_into_view_if_needed()
        await page.screenshot(path='/app/test_reports/artifacts_iter62/iter62_welcome_before.jpeg', quality=20, full_page=False)
        await assert_money(page, '[data-testid="order-summary-net"]', '€150.00')
        await assert_money(page, '[data-testid="order-summary-excise"]', '€3.00')
        await assert_money(page, '[data-testid="order-summary-vat"]', '€33.66')
        await assert_money(page, '[data-testid="order-summary-shipping-cost"]', '€12.20')
        await assert_money(page, '[data-testid="order-summary-grand-total"]', '€198.86')

        await page.get_by_test_id('order-welcome-discount').click()
        await assert_money(page, '[data-testid="order-summary-grand-total"]', '€168.36')
        await page.get_by_test_id('order-summary-grand-total').scroll_into_view_if_needed()
        await page.screenshot(path='/app/test_reports/artifacts_iter62/iter62_welcome_after.jpeg', quality=20, full_page=False)

        await assert_money(page, '[data-testid="order-summary-net"]', '€125.00')
        await assert_money(page, '[data-testid="order-summary-excise"]', '€3.00')
        await assert_money(page, '[data-testid="order-summary-vat"]', '€28.16')
        await assert_money(page, '[data-testid="order-summary-shipping-cost"]', '€12.20')
        await assert_money(page, '[data-testid="order-summary-grand-total"]', '€168.36')
        print("PASS: welcome discount recalculation matches fixture")

        # With welcome selected, foreign orders must not keep a hidden discount.
        for step in (4, 3, 2):
            await page.get_by_test_id('order-previous-step').click()
            await page.get_by_test_id('order-current-step').filter(has_text=f'Step {step} di').wait_for(state='visible')
        await assert_money(page, '[data-testid="order-cart-grand-total"]', '€168.36')
        await page.get_by_test_id('order-foreign-toggle').click()
        await assert_money(page, '[data-testid="order-cart-tax-breakdown"]', 'Imp: €150.00 + Acc: €3.00 + IVA: €0.00')
        await page.get_by_test_id('order-foreign-toggle').click()
        await assert_money(page, '[data-testid="order-cart-tax-breakdown"]', 'Imp: €150.00 + Acc: €3.00 + IVA: €33.66')
        await click_next(page)
        await page.get_by_test_id(f'order-payment-option-{PAYMENT_ID}').click()
        await click_next(page)
        await page.get_by_test_id(f'order-shipping-option-{SHIPPING_ID}').click()
        await click_next(page)
        await expect(page.get_by_test_id('order-welcome-discount')).to_have_attribute('aria-checked', 'false')
        print('PASS: foreign toggle clears selected welcome without discount leakage')
        await page.get_by_test_id('order-welcome-discount').click()

        # Switch customer to EXISTING: must clear selected welcome and show ineligible
        await back_to_customer_step(page)
        await pick_customer(page, CUSTOMER_EXISTING)
        await go_to_summary(page)
        await page.wait_for_selector('[data-testid="order-welcome-ineligible"]', timeout=15000)
        checkbox_visible = await page.locator('[data-testid="order-welcome-discount"]').count()
        assert checkbox_visible == 0, "Expected no welcome checkbox for existing customer"
        print("PASS: existing customer ineligible + checkbox hidden")

        # HEAD error customer: fail-closed error + retry -> eligible
        await back_to_customer_step(page)
        await pick_customer(page, CUSTOMER_ERROR)
        await go_to_summary(page)
        await page.wait_for_selector('[data-testid="order-welcome-error"]', timeout=15000)
        await page.wait_for_selector('[data-testid="order-welcome-retry"]', timeout=10000)
        checkbox_visible = await page.locator('[data-testid="order-welcome-discount"]').count()
        assert checkbox_visible == 0, "Checkbox must be hidden on verification error"
        await page.get_by_test_id('order-welcome-retry').click()
        await page.wait_for_selector('[data-testid="order-welcome-discount"]', timeout=15000)
        print("PASS: retry after HEAD error recovered to eligible")

        # Null count customer: fail-closed error
        await back_to_customer_step(page)
        await pick_customer(page, CUSTOMER_NULL)
        await go_to_summary(page)
        await page.wait_for_selector('[data-testid="order-welcome-error"]', timeout=15000)
        checkbox_visible = await page.locator('[data-testid="order-welcome-discount"]').count()
        assert checkbox_visible == 0, "Checkbox must stay hidden on null-count fail-closed"
        print("PASS: null count fail-closed behavior")

        # Restored welcome choice must survive verification, without submitting at full price meanwhile.
        draft = {
            'id': 'fixture-welcome-pending', 'customerId': CUSTOMER_NEW, 'customerName': 'TEST FIRST ORDER NEW',
            'cart': [{'product': p, 'quantity': 1, 'unit_price': p['unit_price']} for p in _products_rows(False)],
            'currentStep': 4, 'isForeignOrder': False, 'selectedPaymentId': PAYMENT_ID, 'selectedShippingId': SHIPPING_ID,
            'customShippingAddress': '', 'notes': '', 'rottamazioneAmount': 0, 'rottamazioneDescription': '',
            'cashBackToUse': 0, 'scontoBenvenuto': True, 'orderChannel': 'remoto', 'totalAmount': 168.36,
            'productCount': 2, 'savedAt': '2026-10-07T12:00:00.000Z',
        }
        await page.evaluate("d => localStorage.setItem('@order_drafts', JSON.stringify([d]))", draft)
        state['hold_new'] = asyncio.Event()
        await page.goto(f'{PREVIEW_URL}/order-collection-v2?draftId=fixture-welcome-pending')
        await page.get_by_test_id('order-welcome-loading').wait_for(state='visible')
        await expect(page.get_by_test_id('order-submit')).to_be_disabled()
        await expect(page.get_by_test_id('order-generate-quote')).to_be_disabled()
        state['hold_new'].set()
        await page.get_by_test_id('order-welcome-discount').wait_for(state='visible')
        await expect(page.get_by_test_id('order-welcome-discount')).to_have_attribute('aria-checked', 'true')
        await assert_money(page, '[data-testid="order-summary-grand-total"]', '€168.36')
        await expect(page.get_by_test_id('order-submit')).to_be_enabled()
        await expect(page.get_by_test_id('order-generate-quote')).to_be_enabled()
        await page.get_by_test_id('order-welcome-section').scroll_into_view_if_needed()
        await page.screenshot(path='/app/test_reports/artifacts_iter62/iter62_welcome_draft_restored.jpeg', quality=20, full_page=False)
        print('PASS: restored welcome draft blocks confirmation/PDF while checking, then retains 25%')

        # Generic error scan block required by automation policy
        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")

        print(f"Blocked requests: {len(state['blocked'])}")
        print(f"Blocked write attempts: {len(state['writes_blocked'])}")
        assert not page_errors, page_errors
        assert not state['writes_blocked'], state['writes_blocked']
        assert not state['blocked'], state['blocked']

    except Exception as exc:
        print(f"FAIL: iter62 order welcome fixture failed: {exc}")
        await page.screenshot(path='/app/test_reports/artifacts_iter62/iter62_failure.jpeg', quality=20, full_page=False)
        raise
