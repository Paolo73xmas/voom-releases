"""E2E Fasi 1-3: operazioni live sul giro (riordino, ripasso, aggiunta tappa, pausa pranzo).
Prerequisito: tour sintetico attivo (scripts/synthetic_tour_ops.mjs create) + /tmp/tadini_state.json.
"""
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
            print('STEP0 OK: vista live attiva')

            # bottoni operazioni live
            for label in ['Pausa Pranzo', 'Tappa', 'Ordine']:
                await page.wait_for_selector(f'text="{label}"', timeout=10000)
            print('STEP1 OK: bottoni Pausa Pranzo / Tappa / Ordine visibili')
            await page.screenshot(path='/tmp/ops_e2e_1_live.png')

            # ---- RIORDINO ----
            await page.click('text="Ordine"')
            await page.wait_for_selector('text=Cambia Ordine Tappe', timeout=10000)
            await page.wait_for_timeout(800)
            await page.screenshot(path='/tmp/ops_e2e_2_reorder_open.png')
            await page.get_by_test_id('reorder-down-0').click()
            print('cliccata freccia giu riga 1')
            await page.wait_for_timeout(500)
            await page.click('text=Conferma nuovo ordine')
            await page.wait_for_selector('text=Ordine tappe aggiornato', timeout=90000)
            print('STEP2 OK: riordino confermato con messaggio')
            await page.screenshot(path='/tmp/ops_e2e_3_reorder_done.png')

            # ---- RIPASSO (salta con orario) ----
            await page.click('text=Salta visita')
            await page.wait_for_selector('text=Ripassa oggi (facoltativo)', timeout=10000)
            await page.click('text=Chiuso')
            chip = page.locator('[data-testid^="revisit-chip-"]').first
            chip_text = await chip.inner_text()
            await chip.click()
            print('chip ripasso scelto:', chip_text)
            await page.click(f'text=Ripassa alle {chip_text}')
            await page.wait_for_selector(f'text=Ripasso {chip_text}', timeout=60000)
            print('STEP3 OK: ripasso programmato, badge visibile')
            await page.screenshot(path='/tmp/ops_e2e_4_revisit.png')

            # ---- AGGIUNGI TAPPA (Falla ORA) ----
            # chiudi eventuale suggerimento "recupero tempo" che sposta il layout
            try:
                await page.click('text=No, grazie', timeout=3000)
                print('suggerimento recupero tempo chiuso')
                await page.wait_for_timeout(500)
            except Exception:
                pass
            await page.click('text="Tappa"')
            await page.wait_for_selector('text=Aggiungi tappa al giro', timeout=15000)
            # attendi caricamento pool
            await page.wait_for_selector('text=/km$/', timeout=60000)
            await page.screenshot(path='/tmp/ops_e2e_5_addstop_open.png')
            # seleziona il primo risultato
            first = page.locator('text=/km$/').first
            await first.click()
            await page.wait_for_selector('text=Quando inserirla nel giro?', timeout=10000)
            await page.click('text=Falla ORA')
            await page.screenshot(path='/tmp/ops_e2e_6_addstop_selected.png')
            await page.click('text=Aggiungi al giro')
            await page.wait_for_selector('text=aggiunta al giro', timeout=90000)
            print('STEP4 OK: tappa aggiunta al giro')
            await page.screenshot(path='/tmp/ops_e2e_7_addstop_done.png')

            # ---- PAUSA PRANZO ----
            await page.click('text="Pausa Pranzo"')
            await page.wait_for_selector('text=una sola volta al giorno', timeout=10000)
            await page.click('text=/Inizia pausa/')
            await page.wait_for_selector('text=Pausa pranzo in corso', timeout=30000)
            print('STEP5 OK: pausa pranzo avviata con countdown')
            await page.screenshot(path='/tmp/ops_e2e_8_lunch.png')
            # attendi la fine dell'eventuale ricalcolo (busy) e riprova il click
            for attempt in range(6):
                try:
                    await page.click('text=Riprendi ora', timeout=5000)
                    await page.wait_for_selector('text=Pausa pranzo in corso', state='detached', timeout=8000)
                    break
                except Exception:
                    await page.wait_for_timeout(3000)
            await page.wait_for_selector('text=Pausa pranzo in corso', state='detached', timeout=30000)
            print('STEP6 OK: ripresa dalla pausa')
            await page.screenshot(path='/tmp/ops_e2e_9_resumed.png')
        except Exception as e:
            print('FAIL:', str(e)[:500])
            await page.screenshot(path='/tmp/ops_e2e_fail.png')
        finally:
            await ctx.close()
            await browser.close()

asyncio.run(main())
