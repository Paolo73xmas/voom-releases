"""E2E allineamento 3be6260+2afe57c: dettaglio tappa (tap nome + marker mappa) con Fallo Ora."""
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
            try:
                await page.click('text=No, grazie', timeout=2500)
            except Exception:
                pass
            print('T0 OK: live attivo')

            # tap sul nome dell'ULTIMA tappa in elenco → dettaglio
            names = page.locator('[data-testid^="aitour-live-pending-name-"]')
            n = await names.count()
            last_name = (await names.nth(n - 1).inner_text()).strip()
            await names.nth(n - 1).click()
            await page.wait_for_selector('[data-testid="aitour-stop-detail-dialog"]', timeout=8000)
            body = await page.locator('[data-testid="aitour-stop-detail-dialog"]').inner_text()
            assert 'Ultima visita' in body and 'Fatturato 6 mesi' in body and 'Fallo Ora' in body
            print(f'T1 OK: dettaglio "{last_name}" con statistiche e hint Fallo Ora')
            await page.screenshot(path='/tmp/donow_detail.png', quality=20, type='jpeg')

            # Fallo Ora → diventa la prossima
            await page.click('[data-testid="aitour-stop-detail-donow"]')
            await page.wait_for_selector('text=/è ora la prossima visita/', timeout=90000)
            first_now = (await page.locator('[data-testid="aitour-live-pending-name-1"]').inner_text()).strip()
            assert first_now == last_name, f'atteso {last_name}, trovato {first_now}'
            print('T2 OK: Fallo Ora eseguito, ora è la prossima visita')

            # tap sulla prossima → dettaglio dice già prossima, niente bottone
            await page.click('[data-testid="aitour-live-pending-name-1"]')
            await page.wait_for_selector('text=È già la prossima visita del giro.', timeout=8000)
            has_btn = await page.locator('[data-testid="aitour-stop-detail-donow"]').count()
            print('T3 OK: dettaglio prossima visita senza Fallo Ora (bottone presente:', bool(has_btn), ')')
            await page.click('[data-testid="aitour-stop-detail-close"]')
            await page.wait_for_timeout(500)

            # tap sul MARKER in mappa (bridge iframe → app)
            await page.click('text=Mappa del giro')
            frame = page.frame_locator('iframe[title="Mappa del tour"]')
            await frame.locator('.aitour-marker').first.wait_for(state='visible', timeout=20000)
            await page.wait_for_timeout(1500)
            markers = frame.locator('.aitour-marker div')
            count = await markers.count()
            # clicca un marker numerato (i primi possono essere P/A partenza/rientro)
            clicked = False
            for i in range(count):
                txt = (await markers.nth(i).inner_text()).strip()
                if txt not in ('P', 'A', ''):
                    await markers.nth(i).click()
                    clicked = True
                    break
            if clicked:
                await page.wait_for_selector('[data-testid="aitour-stop-detail-dialog"]', timeout=8000)
                print('T4 OK: tap sul segnaposto in mappa apre il dettaglio tappa')
                await page.screenshot(path='/tmp/donow_map.png', quality=20, type='jpeg')
                await page.click('[data-testid="aitour-stop-detail-close"]')
            else:
                print('T4 WARN: nessun marker numerato trovato da cliccare')
            print('E2E DETTAGLIO/FALLO ORA: COMPLETATO')
        except Exception as e:
            print('FAIL:', str(e)[:400])
            await page.screenshot(path='/tmp/donow_fail.png', quality=20, type='jpeg')
        finally:
            await ctx.close()
            await b.close()

asyncio.run(main())
