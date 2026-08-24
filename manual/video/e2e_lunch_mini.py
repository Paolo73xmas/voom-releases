"""Mini-test: pausa pranzo -> riprendi -> verifica che il tour resti ACTIVE."""
import asyncio
from playwright.async_api import async_playwright

BASE = 'https://voom-ios.preview.emergentagent.com'

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(storage_state='/tmp/tadini_state.json', viewport={'width': 390, 'height': 844})
        page = await ctx.new_page()
        try:
            await page.goto(f'{BASE}/ai-tour', wait_until='domcontentloaded', timeout=60000)
            await page.wait_for_selector('text=TOUR LIVE', timeout=60000)
            await page.click('text="Pausa Pranzo"')
            await page.wait_for_selector('text=una sola volta al giorno', timeout=10000)
            await page.click('text=/Inizia pausa/')
            await page.wait_for_selector('text=Pausa pranzo in corso', timeout=30000)
            print('pausa avviata')
            # attendi la fine del ricalcolo prima di riprendere
            await page.wait_for_timeout(12000)
            await page.click('text=Riprendi ora')
            await page.wait_for_selector('text=Pausa pranzo in corso', state='detached', timeout=20000)
            print('ripresa OK')
            await page.wait_for_timeout(3000)
        except Exception as e:
            print('FAIL:', str(e)[:300])
            await page.screenshot(path='/tmp/lunch_mini_fail.png')
        finally:
            await ctx.close()
            await browser.close()

asyncio.run(main())
