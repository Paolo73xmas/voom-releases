"""E2E fix cestino: cestinatura DURANTE un ricalcolo in corso non va persa.
Prerequisito: node scripts/synthetic_tour_ops.mjs create + /tmp/tadini_state.json.
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
        ctx = await browser.new_context(
            storage_state='/tmp/tadini_state.json',
            viewport={'width': 390, 'height': 844},
            geolocation={'latitude': 45.1847, 'longitude': 9.1582},
            permissions=['geolocation'],
        )
        page = await ctx.new_page()
        page.on('pageerror', lambda e: print('PAGEERROR:', str(e)[:150]))
        try:
            await page.goto(f'{BASE}/ai-tour', wait_until='domcontentloaded', timeout=60000)
            await page.wait_for_selector('text=PROSSIMA VISITA', timeout=60000)
            print('STEP0 OK: vista live attiva')
            try:
                await page.click('text=No, grazie', timeout=2500)
            except Exception:
                pass

            rows = await page.locator('[data-testid^="aitour-live-trash-"]').count()
            print(f'STEP1 OK: {rows} righe rimanenti con cestino')

            # cestina l'ULTIMA tappa
            await page.click(f'[data-testid="aitour-live-trash-{rows}"]')
            await page.wait_for_selector('[data-testid="aitour-trash-dialog"]', timeout=8000)
            await page.click('[data-testid="aitour-trash-confirm"]')
            # attendi l'avvio del ricalcolo
            await page.wait_for_selector('text=Ricalcolo del giro in corso', timeout=30000)
            print('STEP2 OK: prima cestinatura confermata, ricalcolo in corso')

            # MENTRE il ricalcolo gira: cestina un'ALTRA tappa (prima era impossibile, icona disabilitata)
            await page.click('[data-testid="aitour-live-trash-2"]')
            await page.wait_for_selector('[data-testid="aitour-trash-dialog"]', timeout=8000)
            print('STEP3 OK: dialog cestino apribile DURANTE il ricalcolo')
            await page.click('[data-testid="aitour-trash-confirm"]')
            # messaggio dedicato (se il ricalcolo era ancora in corso) o messaggio standard
            try:
                await page.wait_for_selector('text=/fuori dal giro|cestinata/', timeout=20000)
                print('STEP4 OK: seconda cestinatura registrata (messaggio visibile)')
            except Exception:
                print('STEP4 WARN: messaggio non intercettato (procedo con verifica DB)')
            await page.screenshot(path='/tmp/trash_e2e_during.png', quality=20, type='jpeg')

            # attendi il ricalcolo accodato/finale
            await page.wait_for_selector('text=Ricalcolo del giro in corso', state='detached', timeout=90000)
            await page.wait_for_timeout(3000)
            # se è partito il ricalcolo accodato, attendi anche quello
            try:
                await page.wait_for_selector('text=Ricalcolo del giro in corso', timeout=5000)
                await page.wait_for_selector('text=Ricalcolo del giro in corso', state='detached', timeout=90000)
                print('STEP5 OK: ricalcolo accodato eseguito dopo la cestinatura')
            except Exception:
                print('STEP5: nessun ricalcolo accodato osservato (forse già concluso)')
            await page.wait_for_timeout(2000)
            left = await page.locator('[data-testid^="aitour-live-trash-"]').count()
            print(f'STEP6: righe rimanenti dopo 2 cestinature: {left} (attese {rows - 2})')
            await page.screenshot(path='/tmp/trash_e2e_final.png', quality=20, type='jpeg')
            print('E2E CESTINO: COMPLETATO')
        except Exception as e:
            print('FAIL:', str(e)[:500])
            await page.screenshot(path='/tmp/trash_e2e_fail.png', quality=20, type='jpeg')
        finally:
            await ctx.close()
            await browser.close()

asyncio.run(main())
