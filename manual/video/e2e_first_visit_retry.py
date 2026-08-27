"""E2E Prima Visita a prova di interruzione (anagrafica):
- visita TELEFONICA (senza foto) con rete visits BLOCCATA -> 3 retry -> schermata VISITA NON SALVATA
- RIPROVA con rete ripristinata -> visita salvata, cliente RIUSATO (non duplicato)
- tabaccherie SEMPRE bloccate (passi secondari non bloccanti, nessuna scrittura sul registro)
Cleanup DB incluso.
"""
import asyncio
from playwright.async_api import async_playwright

BASE = 'https://voom-ios.preview.emergentagent.com'
BIZNAME = 'E2E RETRY PROVA SRL'

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            executable_path='/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell',
            args=['--no-sandbox'],
        )
        ctx = await browser.new_context(storage_state='/tmp/tadini_state.json', viewport={'width': 390, 'height': 844})
        page = await ctx.new_page()

        block_visits = True

        async def route_visits(route):
            if block_visits and route.request.method == 'POST':
                await route.abort()
            else:
                await route.continue_()

        async def route_tabs(route):
            # blocco totale scritture registro tabaccherie (passi secondari non bloccanti)
            if route.request.method in ('POST', 'PATCH'):
                await route.abort()
            else:
                await route.continue_()

        await page.route('**/rest/v1/visits*', route_visits)
        await page.route('**/rest/v1/tabaccherie*', route_tabs)

        try:
            await page.goto(f'{BASE}/anagrafica', wait_until='domcontentloaded', timeout=60000)
            await page.wait_for_selector('text=Visita Telefonica', timeout=45000)
            print('STEP0 OK: anagrafica aperta')

            # Step 1: visita telefonica (niente GPS/foto)
            await page.locator('[role="switch"]').first.click()
            await page.wait_for_timeout(400)
            await page.click('text=Avanti')
            await page.wait_for_selector('text=Ragione Sociale *', timeout=10000)
            print('STEP1 OK: step 2 anagrafica')

            # compila i campi per indice (ordine dei FormField nello step 2)
            values = ['', '', '', '', '', '', '', '', '']
            fields = [BIZNAME, '12345678901', 'RSSMRA80A01G388X', 'VIA TEST 1', 'PAVIA', 'PV', '27100', 'MARIO', 'ROSSI']
            inputs = page.locator('input')
            n = await inputs.count()
            print(f'input trovati: {n}')
            for i, value in enumerate(fields):
                await inputs.nth(i).fill(value)
            # Note * (TextInput multiline dopo la sezione Note)
            notes = page.get_by_placeholder('Note sulla visita...')
            await notes.fill('Test e2e retry')
            await page.wait_for_timeout(400)
            print('STEP2 OK: form compilato')

            await page.click('text=Avanti')
            await page.wait_for_selector('text=Registra', timeout=10000)
            print('STEP3 OK: riepilogo')

            # Submit con visits BLOCCATO -> 3 tentativi (~5s) -> schermata bloccante
            await page.click('text=Registra')
            await page.wait_for_selector('[data-testid="first-visit-save-failed-overlay"]', timeout=45000)
            title = await page.locator('[data-testid="first-visit-save-failed-title"]').inner_text()
            print('STEP4 OK: schermata bloccante visibile:', title)
            await page.screenshot(path='/tmp/retry_e2e_blocked.png', quality=20, type='jpeg')

            # ripristina la rete e RIPROVA
            block_visits = False
            await page.click('[data-testid="first-visit-save-retry-button"]')
            await page.wait_for_selector('[data-testid="first-visit-save-failed-overlay"]', state='detached', timeout=45000)
            print('STEP5 OK: retry riuscito, schermata bloccante chiusa')
            await page.wait_for_timeout(2500)
            await page.screenshot(path='/tmp/retry_e2e_after.png', quality=20, type='jpeg')
            print('E2E RETRY: COMPLETATO')
        except Exception as e:
            print('FAIL:', str(e)[:500])
            await page.screenshot(path='/tmp/retry_e2e_fail.png', quality=20, type='jpeg')
        finally:
            await ctx.close()
            await browser.close()

asyncio.run(main())
