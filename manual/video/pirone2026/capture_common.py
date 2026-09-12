"""Produzione tutorial: accesso autorizzato, sola lettura e catture senza credenziali."""
import json
import os
import re
import shutil
from pathlib import Path
from urllib.parse import urlparse

from dotenv import dotenv_values
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).parent
FRAMES = OUT / 'screens'
STATE = Path('/tmp/voom-pirone-tutorial-session.json')
ENV = dotenv_values(ROOT / 'frontend/.env')
BASE = ENV['EXPO_PUBLIC_BACKEND_URL'].rstrip('/')
SUPABASE = ENV['EXPO_PUBLIC_SUPABASE_URL'].rstrip('/')
ACTOR = '83ca397d-08f6-4e0e-9b1b-8c794f7b0c95'
READ_RPCS = {
    'ai_tour_order_stats', 'ai_tour_learned_durations', 'ai_tour_no_interest_ids',
    'ai_tour_free_tabaccherie', 'ai_tour_comune_centroid', 'agent_own_stamina',
    'get_orphan_tabaccherie_ids', 'tabaccherie_points_in_bbox',
}


class Recorder:
    def __init__(self):
        self.audit = []
        if (OUT / 'network_audit.json').exists():
            self.audit = json.loads((OUT / 'network_audit.json').read_text())
        self.shots = {}
        self.response_data = {}
        self.simulation_handler = None
        FRAMES.mkdir(parents=True, exist_ok=True)
        if (OUT / 'screens.json').exists():
            self.shots = json.loads((OUT / 'screens.json').read_text())

    async def guard(self, route):
        request = route.request
        path = urlparse(request.url).path
        is_crm = request.url.startswith(SUPABASE)
        if is_crm and '/rest/v1/' in path and request.method in ('GET', 'HEAD') and self.simulation_handler:
            simulated = await self.simulation_handler(request)
            if simulated is not None:
                self.audit.append({'method': request.method, 'path': path, 'result': 'LOCAL_DEMONSTRATION_RESPONSE'})
                await route.fulfill(status=200, content_type='application/json', body=json.dumps(simulated))
                return
        if is_crm and request.method not in ('GET', 'HEAD', 'OPTIONS'):
            allowed = '/auth/v1/token' in path or ('/rest/v1/rpc/' in path and path.rsplit('/', 1)[-1] in READ_RPCS) or path.endswith('/functions/v1/ai-tour')
            self.audit.append({'method': request.method, 'path': path, 'result': 'AUTH_OR_READ_ALLOWED' if allowed else 'BLOCKED'})
            if not allowed:
                await route.fulfill(status=403, content_type='application/json', body=json.dumps({'code': 'TUTORIAL_READ_ONLY', 'message': 'Registrazione in sola lettura: nessun dato salvato.'}))
                return
        await route.continue_()

    async def start(self):
        self.pw = await async_playwright().start()
        self.browser = await self.pw.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
        self.context = await self.browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='it-IT', timezone_id='Europe/Rome', storage_state=str(STATE) if STATE.exists() else None)
        await self.context.route('**/*', self.guard)
        self.page = await self.context.new_page()
        await self.page.goto(BASE, wait_until='domcontentloaded')
        await self.page.wait_for_function("() => document.querySelector('#root')?.innerText.trim().length > 0", timeout=90000)
        await self.page.locator('[data-testid="privacy-read-checkbox"], [data-testid="login-email"], [data-testid="dashboard-logout"]').first.wait_for(state='visible', timeout=90000)
        if await self.page.get_by_test_id('privacy-read-checkbox').count():
            for tid in ['privacy-read-checkbox', 'privacy-terms-checkbox', 'privacy-data-checkbox']:
                await self.page.get_by_test_id(tid).click()
            await self.page.get_by_test_id('privacy-accept').click()
            await self.page.locator('[data-testid="login-email"], [data-testid="dashboard-logout"]').first.wait_for(state='visible', timeout=90000)
        if not STATE.exists() or await self.page.get_by_test_id('login-email').count():
            raw = (ROOT / 'memory/test_credentials.md').read_text().split('## Account autorizzato per nuovo tutorial AI Tour')[1]
            email = re.search(r'Email: (.+)', raw)[1].strip()
            password = re.search(r'Password: (.+)', raw)[1].strip()
            await self.page.get_by_test_id('login-email').fill(email)
            await self.page.get_by_test_id('login-password').fill(password)
            await self.page.get_by_test_id('login-submit').click()
        await self.page.get_by_test_id('dashboard-logout').wait_for(timeout=90000)
        await self.page.context.storage_state(path=str(STATE))
        os.chmod(STATE, 0o600)
        # Identità verificata, senza mai stampare token/password.
        actor = await self.page.evaluate("() => { const k=Object.keys(localStorage).find(k=>k.endsWith('-auth-token')); return k ? JSON.parse(localStorage[k]).user.id : null; }")
        if actor != ACTOR:
            raise RuntimeError('Account diverso da quello autorizzato: registrazione interrotta')
        return self

    async def open(self, path):
        await self.page.goto(BASE + path, wait_until='domcontentloaded')
        await self.page.wait_for_function("() => document.querySelector('#root')?.innerText.trim().length > 0", timeout=90000)

    async def shot(self, name, focus=None, *, simulation=False, scroll=True):
        rect = None
        if focus is not None:
            await focus.wait_for(state='visible', timeout=90000)
            if scroll:
                await focus.scroll_into_view_if_needed()
            rect = await focus.bounding_box()
        # Breve assestamento fotografico; non usato per stabilire successo di azioni.
        await self.page.wait_for_timeout(450)
        if focus is not None:
            rect = await focus.bounding_box()
        await self.page.screenshot(path=str(FRAMES / f'{name}.png'), full_page=False)
        self.shots[name] = {'file': f'screens/{name}.png', 'focus': rect, 'simulation': simulation, 'viewport': [390, 844]}
        self.save_metadata()
        print('CAPTURED', name, flush=True)

    def save_metadata(self):
        (OUT / 'screens.json').write_text(json.dumps(self.shots, ensure_ascii=False, indent=2))
        (OUT / 'network_audit.json').write_text(json.dumps(self.audit, indent=2))

    async def finish(self):
        self.save_metadata()
        await self.context.storage_state(path=str(STATE))
        os.chmod(STATE, 0o600)
        await self.context.close()
        await self.browser.close()
        await self.pw.stop()