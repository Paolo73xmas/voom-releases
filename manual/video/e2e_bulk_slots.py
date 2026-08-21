"""E2E Agg. Massivo fasce orarie: selezione cliente + ruota + salva. Poi screenshot scheda cliente."""
import asyncio
from playwright.async_api import async_playwright

BASE = 'https://voom-ios.preview.emergentagent.com'

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(storage_state='/tmp/tadini_state.json', viewport={'width': 390, 'height': 844})
        page = await ctx.new_page()
        try:
            await page.goto(f'{BASE}/bulk-visit-slots', wait_until='domcontentloaded', timeout=60000)
            await page.wait_for_selector('text=Agg. Massivo', timeout=60000)
            await page.wait_for_selector('text=Senza fascia', timeout=20000)
            await page.wait_for_timeout(2500)
            print('S1 OK: schermata Agg. Massivo caricata')
            await page.screenshot(path='/tmp/bulk1.png')

            # seleziona il primo cliente della lista
            rows = page.locator('div:has(> div > div)').filter(has_text='—')
            # click sul primo elemento riga: usa il primo checkbox (square-outline)
            first_row = page.locator('text=Fascia attuale').first  # fallback non usato
            # Semplice: clicca il primo nome cliente visibile nella lista
            await page.mouse.click(60, 330)
            await page.wait_for_timeout(600)

            # tocca due spicchi della ruota: '8 - 9' e '16 - 18'
            await page.get_by_text('8 - 9', exact=True).click()
            await page.wait_for_timeout(400)
            await page.get_by_text('16 - 18', exact=True).click()
            await page.wait_for_timeout(600)
            print('S2: spicchi selezionati')
            await page.screenshot(path='/tmp/bulk2.png')

            # salva
            await page.get_by_text('Assegna fascia', exact=True).click()
            await page.wait_for_timeout(3500)
            await page.screenshot(path='/tmp/bulk3.png')
            print('S3: salvato (verifica DB a parte)')
        except Exception as e:
            print('FAIL:', str(e)[:400])
            await page.screenshot(path='/tmp/bulk_fail.png')
        finally:
            await ctx.close(); await browser.close()

asyncio.run(main())
