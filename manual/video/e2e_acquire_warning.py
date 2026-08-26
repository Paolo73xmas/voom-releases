"""E2E avviso acquisizione prospect: dialog con warning rosso 'IMPORTANTE' nel Live.
Prerequisito: node scripts/synthetic_tour_acquire.mjs create + /tmp/tadini_state.json.
"""
import asyncio
from playwright.async_api import async_playwright

BASE = 'https://voom-ios.preview.emergentagent.com'

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            executable_path='/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell',
            args=['--no-sandbox'],
        )
        ctx = await browser.new_context(storage_state='/tmp/tadini_state.json', viewport={'width': 390, 'height': 844})
        page = await ctx.new_page()
        try:
            await page.goto(f'{BASE}/ai-tour', wait_until='domcontentloaded', timeout=60000)
            await page.wait_for_selector('text=TOUR LIVE', timeout=60000)
            print('STEP0 OK: vista live attiva')

            # eventuale banner suggerimento che intercetta i click
            try:
                await page.click('text=No, grazie', timeout=3000)
            except Exception:
                pass

            await page.wait_for_selector('text=Nessuna scheda cliente', timeout=15000)
            print('STEP1 OK: hint tappa senza scheda cliente visibile')

            await page.click('text="Ispezione"')
            await page.wait_for_selector('text=Acquisisci il punto vendita', timeout=15000)
            print('STEP2 OK: dialog acquisizione aperto')

            warn = page.locator('[data-testid="aitour-acquire-repress-warning"]')
            await warn.wait_for(state='visible', timeout=10000)
            txt = await warn.inner_text()
            assert 'IMPORTANTE' in txt and 'ISPEZIONE' in txt, 'testo warning mancante'
            print('STEP3 OK: warning rosso IMPORTANTE presente:', txt[:80].replace('\n', ' '))
            await page.screenshot(path='/tmp/acquire_e2e_warning.png')
            print('E2E ACQUIRE: TUTTI GLI STEP OK')
        except Exception as e:
            print('FAIL:', str(e)[:600])
            await page.screenshot(path='/tmp/acquire_e2e_fail.png')
        finally:
            await ctx.close()
            await browser.close()

asyncio.run(main())
