"""Check generale READ-ONLY: naviga tutte le schermate principali e raccoglie errori.
Nessuna scrittura su DB. Prerequisito: /tmp/tadini_state.json valido.
"""
import asyncio
from playwright.async_api import async_playwright

BASE = 'https://voom-ios.preview.emergentagent.com'

ROUTES = [
    ('/', 'Dashboard', 'text=Dashboard'),
    ('/map', 'Mappa', '[data-testid="map-dots-count"], text=Legenda, iframe'),
    ('/customers', 'Clienti', 'input'),
    ('/orders', 'Ordini', 'text=/Ordini/i'),
    ('/products', 'Prodotti', 'input'),
    ('/calendar', 'Calendario', 'text=/Lun|Gen|Feb|Mar|Apr|Mag|Giu|Lug|Ago|Set|Ott|Nov|Dic/i'),
    ('/profile', 'Profilo', 'text=/Aspetto|Esci|Profilo/i'),
    ('/altro', 'Altro', 'text=/Rimborsi|Manuale|Altro/i'),
    ('/ai-tour', 'AI Tour', 'text=GENERA CON AI'),
    ('/drafts', 'Bozze', 'text=/Bozze|bozza/i'),
    ('/rimborsi', 'Rimborsi', 'text=/Rimbors/i'),
    ('/orphan-claims', 'Orfani', 'text=/orfan/i'),
    ('/bulk-visit-slots', 'Agg. Massivo fasce', 'text=/fascia|Seleziona|clienti/i'),
]

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
        page_errors = []
        console_errors = []
        page.on('pageerror', lambda e: page_errors.append(str(e)[:200]))
        page.on('console', lambda m: console_errors.append(m.text[:200]) if m.type == 'error' else None)

        results = []
        for path, name, marker in ROUTES:
            pe_before, ce_before = len(page_errors), len(console_errors)
            try:
                await page.goto(f'{BASE}{path}', wait_until='domcontentloaded', timeout=45000)
                found = False
                for sel in marker.split(', '):
                    try:
                        await page.wait_for_selector(sel, timeout=20000)
                        found = True
                        break
                    except Exception:
                        continue
                # check schermata non bianca
                body_txt = (await page.inner_text('body'))[:50].strip()
                pe = len(page_errors) - pe_before
                status = 'OK' if (found and body_txt) else ('RENDER senza marker' if body_txt else 'VUOTA')
                if pe:
                    status += f' +{pe} pageerror'
                results.append((name, path, status))
                print(f'{name} ({path}): {status}')
            except Exception as e:
                results.append((name, path, 'FAIL ' + str(e)[:120]))
                print(f'{name} ({path}): FAIL', str(e)[:120])
        # dettaglio mappa: badge puntini
        try:
            await page.goto(f'{BASE}/map', wait_until='domcontentloaded', timeout=45000)
            badge = page.locator('[data-testid="map-dots-count"]')
            await badge.wait_for(state='visible', timeout=30000)
            print('MAPPA badge puntini:', (await badge.inner_text()).strip())
        except Exception as e:
            print('MAPPA badge puntini: non visibile -', str(e)[:100])
        # dettaglio primo cliente (read-only)
        try:
            await page.goto(f'{BASE}/customers', wait_until='domcontentloaded', timeout=45000)
            await page.wait_for_timeout(4000)
            card = page.locator('text=/Cliente|Prospect/').first
            await card.click(timeout=10000)
            await page.wait_for_selector('text=/Telefono|Contatti|Informazioni/i', timeout=20000)
            print('DETTAGLIO CLIENTE: OK')
        except Exception as e:
            print('DETTAGLIO CLIENTE: FAIL', str(e)[:150])

        print('--- PAGEERROR totali:', len(page_errors))
        for e in page_errors[:8]:
            print('  PE:', e)
        uniq = []
        for c in console_errors:
            if c not in uniq:
                uniq.append(c)
        print('--- CONSOLE ERROR unici:', len(uniq))
        for c in uniq[:12]:
            print('  CE:', c)
        await ctx.close()
        await browser.close()

asyncio.run(main())
