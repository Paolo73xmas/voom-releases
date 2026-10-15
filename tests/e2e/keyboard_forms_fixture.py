"""Isolated keyboard-form UI checks. No live auth/CRM/GPS, no native IME claim."""
import importlib.util
import json
from pathlib import Path
from urllib.parse import urlsplit, parse_qs


spec = importlib.util.spec_from_file_location('order_fixture', Path(__file__).with_name('iter62_order_welcome_fixture.py'))
orders = importlib.util.module_from_spec(spec)
spec.loader.exec_module(orders)
CUSTOMER = orders.CUSTOMER_NEW
PRODUCT = orders.PRODUCT_ELIGIBLE


async def install(page, origin):
    await orders.inject_bootstrap_storage(page)
    await page.add_init_script("""(() => {
      const deny = (_, error) => { if (error) setTimeout(() => error({code:1,message:'Synthetic permission denial'}),0); };
      Object.defineProperty(navigator, 'geolocation', {value:{getCurrentPosition:deny,watchPosition:deny,clearWatch:()=>{}}});
    })();""")
    state = {'unknown': [], 'writes': [], 'page_errors': [], 'requests': 0}
    page.on('pageerror', lambda e: state['page_errors'].append(str(e)))
    customer = {'id': CUSTOMER, 'business_name': 'TEST CUSTOMER ALFA', 'agent_id': orders.FIXTURE_AGENT_ID,
                'city': 'Milano', 'province': 'MI', 'address': 'Via Test 1', 'postal_code': '20100',
                'contact_name': 'Mario', 'contact_surname': 'Rossi', 'contact_phone': '3331234567',
                'contact_email': 'fixture@example.test', 'vat_number': '58371620495',
                'fiscal_code': 'RSSMRA80A01H501U', 'category': 'client', 'notes': 'Synthetic customer'}
    profile = {'id': orders.FIXTURE_AGENT_ID, 'email': orders.FIXTURE_EMAIL, 'full_name': 'Fixture Agent',
               'role': 'agent', 'branch_id': None, 'is_active': True}
    rows = {
        'profiles': [profile], 'customers': [customer], 'products': orders._products_rows(False),
        'projects': [{'id': 'p1', 'slug': 'test-project', 'name': 'Progetto Test', 'color': '#777777'}],
        'customer_types': [{'id': 'ct1', 'value': 'tabaccheria', 'label': 'Tabaccheria', 'sort_order': 1}],
        'rimborsi_categorie': [{'id': 'cat1', 'nome': 'Carburante', 'is_active': True}],
        'payment_methods': [{'id': orders.PAYMENT_ID, 'name': 'Contanti', 'is_active': True, 'display_order': 1}],
        'shipping_methods': [{'id': orders.SHIPPING_ID, 'name': 'Spedizione Test', 'cost': 10,
                              'is_active': True, 'foreign_only': False, 'cost_type': 'fixed', 'display_order': 1}],
    }
    for table in ['tabaccherie', 'orders', 'order_items', 'visits', 'inspections', 'inspection_photos', 'appointments',
                  'rimborsi', 'substitutions', 'substitution_items', 'packages', 'package_items',
                  'user_category_permissions', 'categories', 'cashback_transactions', 'cashback_settings',
                  'agent_profiles', 'branches', 'branch_stock', 'stock_reservations', 'customer_cashback',
                  'settings', 'system_settings', 'calendar_events', 'agent_locations', 'cashback_config', 'customer_cashback_balance', 'rottamazione_config']:
        rows[table] = []

    async def reply(route, data, status=200, count=None):
        headers = {'content-type': 'application/json', 'access-control-allow-origin': origin,
                   'access-control-expose-headers': 'content-range', 'access-control-allow-headers': '*'}
        if count is not None:
            headers['content-range'] = f'*/{count}'
        await route.fulfill(status=status, headers=headers, body='' if route.request.method == 'HEAD' else json.dumps(data))

    async def handler(route):
        req = route.request
        url = urlsplit(req.url)
        is_business = url.hostname.endswith('.supabase.co') or url.path.startswith('/api/')
        if is_business:
            state['requests'] += 1
            if req.method == 'OPTIONS':
                return await reply(route, {})
            if url.path == '/auth/v1/user':
                return await reply(route, orders.build_auth_payload()['user'])
            if url.path == '/rest/v1/rpc/get_available_stock':
                return await reply(route, [{'product_id': p['id'], 'stock_quantity': 10, 'reserved_quantity': 0, 'available_quantity': 10} for p in orders._products_rows(False)])
            if req.method not in ['GET', 'HEAD']:
                state['writes'].append(url.path)
                return await reply(route, {'error': 'isolated test blocks mutation'}, 503)
            if url.path.startswith('/rest/v1/'):
                table = url.path.removeprefix('/rest/v1/')
                if table in rows:
                    data = rows[table]
                    query = parse_qs(url.query)
                    # Query field names parsed exactly, never confuse agent_id with id.
                    if query.get('id', [''])[0].startswith('eq.'):
                        wanted = query['id'][0][3:]
                        data = [r for r in data if r.get('id') == wanted]
                    if table == 'customers' and ('business_name' in query or 'vat_number' in query):
                        data = []
                    if 'application/vnd.pgrst.object+json' in req.headers.get('accept', ''):
                        return await reply(route, data[0] if data else None, count=len(data))
                    return await reply(route, data, count=len(data))
            state['unknown'].append(url.path)
            return await reply(route, {'error': 'unknown test endpoint'}, 503)
        # Only preview static assets/document & dev resources may leave this harness.
        if url.netloc == urlsplit(origin).netloc and not url.path.startswith('/api/'):
            if req.method == 'GET' or url.path.startswith('/cdn-cgi/'):
                return await route.continue_()
        if req.resource_type in ['font', 'stylesheet'] and url.hostname in ['fonts.googleapis.com', 'fonts.gstatic.com']:
            return await route.continue_()
        if req.resource_type == 'script' and url.hostname == 'static.cloudflareinsights.com' and url.path.startswith('/beacon.min.js/'):
            return await route.continue_()
        state['unknown'].append(url.netloc + url.path)
        await route.abort()
    await page.route('**/*', handler)
    return state