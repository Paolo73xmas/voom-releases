"""E2E Modifica giro: post-generazione + tour salvato (planned) richiamato.
Prerequisito: /tmp/tadini_state.json (setup_auth.py). Tour per DOMANI per evitare orari passati.
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
        page.on('pageerror', lambda e: print('PAGEERROR:', str(e)[:200]))
        try:
            await page.goto(f'{BASE}/ai-tour', wait_until='domcontentloaded', timeout=60000)
            await page.wait_for_selector('text=GENERA CON AI', timeout=60000)
            print('STEP0 OK: form AI Tour')

            # data = domani (evita "orario di fine già passato")
            await page.click('text=Domani')
            await page.wait_for_timeout(400)

            await page.click('text=GENERA CON AI')
            await page.wait_for_selector('[data-testid="aitour-edit-btn"]', timeout=150000)
            print('STEP1 OK: tour generato, bottone Modifica visibile')
            await page.screenshot(path='/tmp/edit_e2e_1_result.png')

            # ---- PANNELLO MODIFICA (post-generazione) ----
            await page.click('[data-testid="aitour-edit-btn"]')
            await page.wait_for_selector('[data-testid="aitour-edit-panel"]', timeout=15000)
            rows = await page.locator('[data-testid^="aitour-edit-stop-"]').count()
            print(f'STEP2 OK: pannello aperto, {rows} visite nel giro')
            await page.screenshot(path='/tmp/edit_e2e_2_panel.png')

            # ricerca per città
            await page.fill('[data-testid="aitour-edit-search"]', 'pavia')
            await page.wait_for_timeout(600)
            avail_pavia = await page.locator('[data-testid^="aitour-edit-add-mandatory-"]').count()
            print(f'STEP3 OK: ricerca "pavia" -> {avail_pavia} candidati')
            await page.fill('[data-testid="aitour-edit-search"]', 'via')
            await page.wait_for_timeout(600)
            avail_via = await page.locator('[data-testid^="aitour-edit-add-mandatory-"]').count()
            print(f'STEP3b OK: ricerca indirizzo "via" -> {avail_via} candidati')
            await page.fill('[data-testid="aitour-edit-search"]', '')
            await page.wait_for_timeout(600)

            # aggiungi come OBBLIGATORIA (stella rossa) il primo candidato
            first_add = page.locator('[data-testid^="aitour-edit-add-mandatory-"]').first
            await first_add.click()
            await page.wait_for_timeout(400)
            rows2 = await page.locator('[data-testid^="aitour-edit-stop-"]').count()
            print(f'STEP4 OK: aggiunta obbligatoria, visite {rows} -> {rows2}')
            assert rows2 == rows + 1, 'conteggio visite dopo aggiunta errato'

            # rimuovi la prima visita
            await page.click('[data-testid="aitour-edit-remove-1"]')
            await page.wait_for_timeout(400)
            rows3 = await page.locator('[data-testid^="aitour-edit-stop-"]').count()
            print(f'STEP5 OK: rimozione, visite {rows2} -> {rows3}')
            assert rows3 == rows2 - 1, 'conteggio visite dopo rimozione errato'
            await page.screenshot(path='/tmp/edit_e2e_3_edited.png')

            # RICALCOLA CON AI
            await page.click('[data-testid="aitour-recalc-ai-btn"]')
            await page.wait_for_selector('text=Giro ricalcolato', timeout=120000)
            print('STEP6 OK: ricalcolo AI completato (messaggio visibile)')
            await page.screenshot(path='/tmp/edit_e2e_4_recalced.png')

            # ---- SALVA ----
            await page.click('text="Salva"')
            await page.wait_for_selector('text=Salvato', timeout=30000)
            print('STEP7 OK: tour salvato')

            # ---- TOUR SALVATO RICHIAMATO (pool caricato al volo dopo reload) ----
            await page.reload(wait_until='domcontentloaded')
            await page.wait_for_selector('text=GENERA CON AI', timeout=60000)
            await page.click('text=I miei Tour')
            await page.wait_for_selector('text=/visite/', timeout=30000)
            await page.locator('text=/visite ·/').first.click()
            await page.wait_for_selector('[data-testid="aitour-edit-btn"]', timeout=30000)
            print('STEP8 OK: tour salvato richiamato, bottone Modifica presente (status planned)')
            await page.screenshot(path='/tmp/edit_e2e_5_saved_view.png')

            # apri pannello: il pool viene caricato al volo
            await page.click('[data-testid="aitour-edit-btn"]')
            await page.wait_for_selector('[data-testid="aitour-edit-panel"]', timeout=60000)
            saved_rows = await page.locator('[data-testid^="aitour-edit-stop-"]').count()
            avail_saved = await page.locator('[data-testid^="aitour-edit-add-"]').count()
            print(f'STEP9 OK: pannello su tour salvato, {saved_rows} visite, candidati disponibili: {avail_saved > 0}')

            # riordina: sposta la prima visita in giù, poi APPLICA SEQUENZA MANUALE
            name1 = await page.locator('[data-testid="aitour-edit-stop-1"]').inner_text()
            await page.click('[data-testid="aitour-edit-down-1"]')
            await page.wait_for_timeout(400)
            name2 = await page.locator('[data-testid="aitour-edit-stop-2"]').inner_text()
            assert name1.split('\n')[0].strip('12345678 ') in name2, 'riordino non riflesso'
            print('STEP10 OK: riordino manuale eseguito nel pannello')
            await page.click('[data-testid="aitour-apply-order-btn"]')
            await page.wait_for_selector('text=Giro ricalcolato e tour salvato aggiornato', timeout=120000)
            print('STEP11 OK: sequenza manuale applicata e tour salvato aggiornato')
            await page.screenshot(path='/tmp/edit_e2e_6_saved_updated.png')
            print('E2E COMPLETO: TUTTI GLI STEP OK')
        except Exception as e:
            print('FAIL:', str(e)[:600])
            await page.screenshot(path='/tmp/edit_e2e_fail.png')
        finally:
            await ctx.close()
            await browser.close()

asyncio.run(main())
