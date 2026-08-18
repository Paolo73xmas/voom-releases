"""Cattura ai26-avvia-header: risultato tour con tasto Avvia Tour nell'header (roberto, GPS Milano)."""
import re
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com"
OUT = "/app/manual/img"

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell",
        args=["--no-sandbox"],
    )
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        geolocation={"latitude": 45.4642, "longitude": 9.19},
        permissions=["geolocation"],
    )
    page = ctx.new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(12000)
    try:
        page.get_by_text(re.compile("Informativa Privacy", re.I)).first.wait_for(state="visible", timeout=8000)
        page.mouse.move(195, 300)
        for _ in range(30):
            page.mouse.wheel(0, 1500)
            page.wait_for_timeout(100)
        for el in page.get_by_text(re.compile("Dichiaro", re.I)).all()[:3]:
            el.click(force=True)
            page.wait_for_timeout(250)
        page.get_by_text(re.compile("Accetta e Continua", re.I)).first.click(force=True)
        page.wait_for_timeout(5000)
    except Exception:
        pass
    page.locator("input").first.wait_for(state="visible", timeout=30000)
    page.locator("input").first.fill("roberto.beretta@voomweb.it")
    page.locator("input[type='password']").first.fill("Roberto123!")
    page.get_by_text("Accedi", exact=True).last.click(force=True)
    page.wait_for_timeout(10000)
    page.get_by_text("AI Tour", exact=True).first.click(force=True)
    page.wait_for_timeout(6000)
    page.get_by_text("GENERA CON AI", exact=False).first.click(force=True)
    ok = False
    for _ in range(36):
        page.wait_for_timeout(5000)
        if page.get_by_text("Avvia Tour", exact=False).count() > 0:
            ok = True
            break
    if ok:
        page.wait_for_timeout(2500)
        page.screenshot(path=f"{OUT}/ai26-avvia-header.png")
        print("  [OK] ai26-avvia-header.png")
    else:
        print("  [SKIP] generazione non completata")
        page.screenshot(path=f"{OUT}/debug-c.png")
    ctx.close()
    browser.close()
    print("FATTO")
