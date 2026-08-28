"""E2E allineamento 0132b09: GPS chip, banner oltre-orario + Posticipa, etichette Chiuso, zone deselezionate."""
import asyncio
from playwright.async_api import async_playwright

BASE = 'https://voom-ios.preview.emergentagent.com'

async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path='/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell', args=['--no-sandbox'])
        ctx = await b.new_context(storage_state='/tmp/tadini_state.json', viewport={'width': 390, 'height': 844},
                                  geolocation={'latitude': 45.1847, 'longitude': 9.1582}, permissions=['geolocation'])
        page = await ctx.new_page()
        page.on('pageerror', lambda e: print('PAGEERROR:', str(e)[:150]))
        try:
            await page.goto(f'{BASE}/ai-tour', wait_until='domcontentloaded', timeout=60000)
            await page.wait_for_selector('text=PROSSIMA VISITA', timeout=60000)
            print('T0 OK: live attivo')
            try:
                await page.click('text=No, grazie', timeout=2500)
            except Exception:
                pass

            # GPS chip
            chip = page.locator('[data-testid="aitour-live-gps-chip"]')
            await chip.wait_for(state='visible', timeout=20000)
            print('T1 OK: GPS chip =', (await chip.inner_text()).strip())

            # banner oltre orario
            band = page.locator('[data-testid="aitour-live-overtime"]')
            await band.wait_for(state='visible', timeout=20000)
            t_input = page.locator('[data-testid="aitour-live-overtime-time"]')
            prefill = await t_input.input_value()
            print('T2 OK: banner oltre orario visibile, orario proposto:', prefill)
            await page.screenshot(path='/tmp/align_overtime.png', quality=20, type='jpeg')

            # posticipa fine giro
            await page.click('[data-testid="aitour-live-overtime-extend-btn"]')
            await page.wait_for_selector('text=/Fine giro posticipata/', timeout=90000)
            print('T3 OK: fine giro posticipata + ricalcolo')
            await band.wait_for(state='detached', timeout=15000)
            print('T4 OK: banner oltre orario scomparso dopo il posticipo')

            # etichetta skip "Chiuso ora"
            await page.click('text="Salta visita"')
            await page.wait_for_selector('text=Chiuso ora (orario/ferie)', timeout=10000)
            print('T5 OK: skip label "Chiuso ora (orario/ferie)"')
            await page.click('text="Annulla"')
            await page.wait_for_timeout(500)

            # etichetta esito "Chiuso definitivamente"
            await page.click('text="Ispezione"')
            await page.wait_for_selector('text=Chiuso definitivamente', timeout=10000)
            print('T6 OK: esito label "Chiuso definitivamente"')
            await page.screenshot(path='/tmp/align_esito.png', quality=20, type='jpeg')
            print('E2E LIVE: COMPLETATO')
        except Exception as e:
            print('FAIL:', str(e)[:400])
            await page.screenshot(path='/tmp/align_fail.png', quality=20, type='jpeg')
        finally:
            await ctx.close()
            await b.close()

asyncio.run(main())
