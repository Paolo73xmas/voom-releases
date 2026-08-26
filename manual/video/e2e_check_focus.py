"""Approfondimento check: dashboard (dati caricati), prodotti, orfani, dettaglio cliente."""
import asyncio
from playwright.async_api import async_playwright

BASE = 'https://voom-ios.preview.emergentagent.com'

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            executable_path='/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell',
            args=['--no-sandbox'],
        )
        ctx = await browser.new_context(storage_state='/tmp/tadini_state.json', viewport={'width': 390, 'height': 844})
        page = await ctx.new_page()
        errs = []
        page.on('console', lambda m: errs.append(m.text[:150]) if m.type == 'error' and 'Unknown event handler' not in m.text else None)

        # 1) Dashboard: attesa piena senza navigare via
        await page.goto(f'{BASE}/', wait_until='domcontentloaded', timeout=45000)
        await page.wait_for_timeout(9000)
        body = await page.inner_text('body')
        print('DASH ha Scadenziario:', 'cadenziario' in body or 'Appuntament' in body)
        print('DASH errori fetch dopo attesa piena:', [e for e in errs if 'fetch' in e.lower()][:3] or 'NESSUNO')
        await page.screenshot(path='/tmp/chk_dash.png', quality=20, type='jpeg')

        # 2) Prodotti
        errs.clear()
        await page.goto(f'{BASE}/products', wait_until='domcontentloaded', timeout=45000)
        await page.wait_for_timeout(8000)
        body = await page.inner_text('body')
        print('PRODOTTI primi 120 char:', body[:120].replace(chr(10), ' | '))
        print('PRODOTTI errori:', errs[:3] or 'NESSUNO')
        await page.screenshot(path='/tmp/chk_products.png', quality=20, type='jpeg')

        # 3) Orfani
        errs.clear()
        await page.goto(f'{BASE}/orphan-claims', wait_until='domcontentloaded', timeout=45000)
        await page.wait_for_timeout(6000)
        body = await page.inner_text('body')
        print('ORFANI primi 120 char:', body[:120].replace(chr(10), ' | '))
        print('ORFANI errori:', errs[:3] or 'NESSUNO')

        # 4) Dettaglio cliente: click sulla prima card della lista
        errs.clear()
        await page.goto(f'{BASE}/customers', wait_until='domcontentloaded', timeout=45000)
        await page.wait_for_timeout(7000)
        await page.screenshot(path='/tmp/chk_customers.png', quality=20, type='jpeg')
        cards = page.locator('[data-testid^="customer-card"], [data-testid^="customer-row"]')
        n = await cards.count()
        if n == 0:
            # fallback: click sul nome del primo cliente in lista (testo maiuscolo lungo)
            body = await page.inner_text('body')
            import re
            m = re.search(r'([A-Z][A-Z\'\. &]{10,40})\n', body)
            if m:
                await page.get_by_text(m.group(1).strip(), exact=True).first.click()
        else:
            await cards.first.click()
        await page.wait_for_timeout(5000)
        body2 = await page.inner_text('body')
        ok = any(k in body2 for k in ['Telefono', 'P.IVA', 'Informazioni', 'Fascia'])
        print('DETTAGLIO CLIENTE aperto:', ok)
        print('DETTAGLIO errori:', errs[:3] or 'NESSUNO')
        await page.screenshot(path='/tmp/chk_customer_detail.png', quality=20, type='jpeg')

        await ctx.close()
        await browser.close()

asyncio.run(main())
