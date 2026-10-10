"""Browser smoke; all CRM/Auth/AI/OSRM responses are test fixtures. No live API forwards."""
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import expect
from iter61_gptour_multicomune_fixture import install_network_fixture
from iter60_gptour_back_navigation_fixture import SUPABASE_URL, FIXTURE_AGENT_ID


async def run(page):
    out = Path('/app/test_reports/commercial_isolated')
    out.mkdir(parents=True, exist_ok=True)
    state = {'edge_calls': [], 'unknown_blocked': [], 'live_api_forwards': 0, 'checks': []}
    old = await install_network_fixture(page)

    async def answer(route, data):
        headers = {'content-type': 'application/json'}
        if route.request.method == 'HEAD':
            headers['content-range'] = f'0-0/{len(data) if isinstance(data, list) else 0}'
        await route.fulfill(status=200, headers=headers, body=json.dumps(data))

    def customer(name, city='Rozzano'):
        return dict(id=name, business_name=f'FIXTURE {name}', category='client', latitude=45.38, longitude=9.14,
                    city=city, province='MI', address='Via Fixture', tabaccheria_id=None, disabled=False,
                    last_visit_date=None, last_order_date=None, preferred_visit_slots=None, excluded_visit_days=None)

    customers = [customer(n) for n in ['old', 'edge', 'recent', 'never-bought']]
    registry = [dict(id=n, denominazione=f'FIXTURE {n}', comune=c, provincia='MI', lat=45.38, lng=9.15,
                     assigned=True, indirizzo='Via Fixture') for n, c in [('new', 'Rozzano'), ('opera', 'Opera')]]
    today = datetime.now(timezone.utc).date()
    orders = [dict(id=f'order-{n}', customer_id=n, order_date=(today-timedelta(days=d)).isoformat(),
                   order_number=f'FIX-{n}', is_deleted=False, status='confirmed') for n, d in [('old', 21), ('edge', 20), ('recent', 19)]]

    async def override(route):
        url = route.request.url
        if '/functions/v1/ai-tour-gptour' in url:
            body = route.request.post_data_json
            intent = body.get('intent') or {}
            keys = [line.split('\t')[0] for line in body.get('candidatesText', '').splitlines()[1:] if line.strip()]
            state['edge_calls'].append({'intent': intent, 'keys': keys, 'request_fields': list(body.keys()), 'count': body.get('count'), 'agent_matches': body.get('agentInfo', {}).get('agentId') == FIXTURE_AGENT_ID})
            await answer(route, dict(reply='Piano fixture', needsInfo=False, multiDay=False, lodging='home',
                tourDate=(intent.get('tourDates') or [(today+timedelta(days=1)).isoformat()])[0], startTime=None, endTime=None,
                selection=[dict(key=k, reason=None) for k in keys], days=[], notes=None, effectiveAgentId=FIXTURE_AGENT_ID,
                intentReset=True, intent=dict(requestedEntityTypes=['orphan'], orderMinDays=None, requireOrderHistory=False,
                                             allowNearby=True, requestedArea=dict(comune='Roma'))))
        elif '/rest/v1/rpc/ai_tour_order_stats' in url:
            await answer(route, [dict(customer_id=c['id'], order_count=1, last_order_date=None, revenue_6m=0, total_revenue=0) for c in customers])
        elif '/rest/v1/rpc/ai_tour_contact_stats' in url:
            await answer(route, [dict(customer_id=c['id'], last_visit_date=None, last_inspection_date=None) for c in customers])
        elif '/rest/v1/rpc/ai_tour_free_tabaccherie' in url:
            await answer(route, registry)
        elif '/rest/v1/customers' in url:
            await answer(route, customers)
        elif '/rest/v1/orders' in url:
            await answer(route, orders)
        elif '/rest/v1/tabaccherie' in url:
            await answer(route, [dict(id=r['id'], customer_id=None, stato_visita='non_visitato', chiusa=False) for r in registry])
        elif '/rest/v1/agent_zones' in url:
            await answer(route, [dict(id='fixture-zone', agent_id=FIXTURE_AGENT_ID, zone_name='Fixture Sud', alias=None,
                coordinates=[[9.0,45.2],[9.4,45.2],[9.4,45.6],[9.0,45.6],[9.0,45.2]], agent=dict(full_name='Fixture'))])
        elif any(path in url for path in ['/rest/v1/visits?', '/rest/v1/inspections?', '/rest/v1/electronic_invoices?', '/rest/v1/rimborsi_agenti_abilitati?']):
            await answer(route, [])
        else:
            await route.fallback()  # Original fixture handles ALL other Supabase paths; never forwards them.

    await page.route(f'{SUPABASE_URL}/**', override)
    # Top-level gate: application bundles only; all API traffic goes to fixture handlers.
    host = urlparse(page.url).netloc

    async def guard(route):
        url = route.request.url
        if url.startswith(SUPABASE_URL) or url.startswith('https://router.project-osrm.org/'):
            await route.fallback()
        elif urlparse(url).netloc == host and '/api/' not in url:
            await route.continue_()
        elif url.startswith('https://unpkg.com/leaflet@1.9.4/dist/') and route.request.resource_type in ('script', 'stylesheet'):
            await route.continue_()  # Static library only, no CRM/AI traffic.
        elif route.request.resource_type in ('image', 'font', 'stylesheet'):
            await route.abort()
        else:
            state['unknown_blocked'].append(url)
            await route.abort()

    await page.route('**/*', guard)
    async def stop_names():
        rows = page.get_by_test_id(re.compile(r'^gptour-stop-\d+$'))
        return [(await row.get_attribute('aria-label')).split('. ', 1)[1] for row in await rows.all()]
    try:
        await page.set_viewport_size({'width': 390, 'height': 844})
        if await page.get_by_test_id('privacy-accept').is_visible():
            for name in ['privacy-read-checkbox', 'privacy-terms-checkbox', 'privacy-data-checkbox', 'privacy-accept']:
                await page.get_by_test_id(name).click()
        await page.get_by_test_id('login-email').fill('gptour-fixture@example.test')
        await page.get_by_test_id('login-password').fill('fixture-only-not-a-real-password')
        await page.get_by_test_id('login-submit').click()
        await page.get_by_test_id('dashboard-refresh').wait_for(timeout=45000)
        await page.get_by_text('AI Tour', exact=True).first.click()
        await page.get_by_test_id('aitour-open-gptour').click()
        await expect(page.get_by_test_id('gptour-message-input')).to_be_editable(timeout=45000)

        async def send(text, expected_calls):
            await page.get_by_test_id('gptour-message-input').fill(text)
            await page.get_by_test_id('gptour-send').click()
            await expect(page.get_by_test_id('gptour-plan')).to_be_visible(timeout=60000)
            await expect(page.get_by_test_id('gptour-message-input')).to_be_editable(timeout=60000)
            assert len(state['edge_calls']) == expected_calls, state

        await send('Domani clienti che non comprano da 20 giorni e nuovi punti vendita a Rozzano. Niente follow-up.', 2)
        await expect(page.get_by_test_id('gptour-purchase-filter')).to_contain_text('nuovi punti mai visitati')
        rows = await stop_names()
        assert set(rows) == {'FIXTURE old', 'FIXTURE edge', 'FIXTURE new'}, rows
        state['checks'].append('mixed: two verified buyers + one new; recent and never-buyer excluded')
        await page.get_by_test_id('gptour-plan-metrics').scroll_into_view_if_needed()
        await page.screenshot(path=str(out/'mixed.jpeg'), quality=20, full_page=False)
        await send('Parti alle 09:00', 4)
        await expect(page.get_by_test_id('gptour-plan-metrics')).to_contain_text('09:00')
        await send('Aggiungi anche Opera', 6)
        await expect(page.get_by_test_id('gptour-criteria')).to_contain_text('Opera')
        assert len(await stop_names()) == 4
        await send('No, lascia perdere i nuovi clienti. Solo quelli che non ordinano da 20 giorni.', 8)
        rows = await stop_names()
        assert set(rows) == {'FIXTURE old', 'FIXTURE edge'}, rows
        state['checks'].append('time and area preserved; explicit removal leaves only inactive buyers')
        assert all(c['agent_matches'] for c in state['edge_calls'])
        for call in state['edge_calls'][:6]:
            assert call['intent']['requireOrderHistory'] is False
            assert call['intent']['orderMinDays'] is None
            assert call['intent']['commercialGroups']['inactiveDays'] == 20
            assert call['intent']['commercialGroups']['newPoints'] is True
        assert state['edge_calls'][-1]['intent']['requireOrderHistory'] is True
        assert len({tuple(call['intent']['tourDates']) for call in state['edge_calls']}) == 1
        state['checks'].append('mixed payload has NO global purchase flags; threshold belongs only to existing group; date unchanged')
        await page.get_by_test_id('gptour-plan-metrics').scroll_into_view_if_needed()
        await page.screenshot(path=str(out/'inactive-only.jpeg'), quality=20, full_page=False)
        await page.get_by_test_id('gptour-back').click()
        await page.get_by_test_id('aitour-open-gptour').click()
        await expect(page.get_by_test_id('gptour-purchase-filter')).to_contain_text('20 giorni', timeout=45000)
        await expect(page.get_by_test_id('gptour-criteria')).to_contain_text('Opera')
        assert len(state['edge_calls']) == 8
        state['checks'].append('draft reopened without extra AI; scoped purchase filter retained')
        assert not old['blocked_unknown_api'], old['blocked_unknown_api']
        state['pass'] = True
        print('PASS isolated commercial browser smoke:', state['checks'])
    except Exception as exc:
        state['pass'] = False
        state['error'] = str(exc)[:2000]
        await page.screenshot(path=str(out/'failure.jpeg'), quality=20, full_page=False)
        print('FAIL isolated commercial smoke:', type(exc).__name__, str(exc)[:300])
        raise
    finally:
        (out/'browser.json').write_text(json.dumps(state, indent=2, ensure_ascii=False))