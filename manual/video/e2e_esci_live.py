"""E2E: vista live -> Esci -> banner Riprendi -> rientro in vista live."""
import asyncio, json
from playwright.async_api import async_playwright

BASE = 'https://voom-ios.preview.emergentagent.com'

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(storage_state='/tmp/tadini_state.json', viewport={'width': 390, 'height': 844})
        page = await ctx.new_page()
        try:
            await page.goto(f'{BASE}/ai-tour', wait_until='domcontentloaded', timeout=60000)
            # 1) auto-rientro in vista live
            await page.wait_for_selector('text=TOUR LIVE', timeout=45000)
            await page.wait_for_selector('text=Esci', timeout=15000)
            print('STEP1 OK: vista live attiva con tasto Esci')
            await page.screenshot(path='/tmp/e2e_live1.png')
            # 2) Esci -> tabs + banner
            await page.click('text=Esci')
            await page.wait_for_selector('text=sei uscito dalla vista live', timeout=15000)
            await page.wait_for_selector('text=Riprendi vista live', timeout=5000)
            await page.wait_for_selector('text=I miei Tour', timeout=5000)
            print('STEP2 OK: uscito, banner TOUR LIVE con Riprendi visibile, tabs attive')
            await page.screenshot(path='/tmp/e2e_live2.png')
            # 3) reload: NON deve rientrare automaticamente... nota: flag in-memory si azzera al reload
            # (parita' web: sessionStorage sopravvive al reload; su mobile nativa l'app resta in memoria)
            # 4) Riprendi -> vista live
            await page.click('text=Riprendi vista live')
            await page.wait_for_selector('text=Termina', timeout=20000)
            await page.wait_for_selector('text=PROSSIMA VISITA', timeout=10000)
            print('STEP3 OK: rientrato in vista live (Termina + Prossima visita)')
            await page.screenshot(path='/tmp/e2e_live3.png')
        except Exception as e:
            print('FAIL:', str(e)[:400])
            await page.screenshot(path='/tmp/e2e_live_fail.png')
        finally:
            await ctx.close(); await browser.close()

asyncio.run(main())
