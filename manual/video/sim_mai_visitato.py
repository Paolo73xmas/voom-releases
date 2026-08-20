"""Simulazione con schermate: Tour Live con tappa 'Mai Visitata' (GPS simulato sul posto)."""
import asyncio
from playwright.async_api import async_playwright

BASE = 'https://voom-ios.preview.emergentagent.com'
LAT, LNG = 45.2075601, 9.1916762  # Tabaccheria di FINOTTI VALERIO, Pavia

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(
            storage_state='/tmp/tadini_state.json',
            viewport={'width': 390, 'height': 844},
            geolocation={'latitude': LAT, 'longitude': LNG},
            permissions=['geolocation'],
        )
        page = await ctx.new_page()
        try:
            await page.goto(f'{BASE}/ai-tour', wait_until='domcontentloaded', timeout=60000)
            await page.wait_for_selector('text=TOUR LIVE', timeout=45000)
            await page.wait_for_selector('text=Mai visitata', timeout=15000)
            await page.wait_for_timeout(1500)
            print('S1 OK: vista live con tappa Mai visitata')
            await page.screenshot(path='/tmp/sim1.png')

            await page.click('text=Sono arrivato')
            await page.wait_for_selector('text=Scheda', timeout=15000)
            await page.wait_for_timeout(1200)
            print('S2 OK: arrivato sul posto')
            await page.screenshot(path='/tmp/sim2.png')

            await page.get_by_text('Ispezione', exact=True).click(timeout=10000)
            await page.wait_for_selector('text=Acquisisci come prospect', timeout=10000)
            await page.wait_for_timeout(800)
            print('S3 OK: dialog acquisizione prospect con verifica GPS')
            await page.screenshot(path='/tmp/sim3.png')

            await page.click('text=Verifica GPS e procedi')
            await page.wait_for_url('**/anagrafica**', timeout=20000)
            await page.wait_for_timeout(3500)
            print('S4 OK: Prima Visita precompilata con i dati della tabaccheria')
            await page.screenshot(path='/tmp/sim4.png')
        except Exception as e:
            print('FAIL:', str(e)[:400])
            await page.screenshot(path='/tmp/sim_fail.png')
        finally:
            await ctx.close(); await browser.close()

asyncio.run(main())
