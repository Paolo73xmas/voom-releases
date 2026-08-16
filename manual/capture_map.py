"""Cattura screenshot della mappa del tour (risultato + live) per il manuale AI Tour."""
import re
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com"
OUT = "/app/manual/img"
EMAIL = "gdeintinis@gmail.com"
PASSWORD = "GabrieleDeIntinis123!"

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell",
        args=["--no-sandbox"],
    )
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(6000)
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
    page.locator("input").first.fill(EMAIL)
    page.locator("input[type='password']").first.fill(PASSWORD)
    page.get_by_text("Accedi", exact=True).last.click(force=True)
    page.wait_for_timeout(10000)
    page.get_by_text("AI Tour", exact=True).first.click(force=True)
    page.wait_for_timeout(5000)
    page.get_by_text("Sviluppo Territorio", exact=False).first.click(force=True)
    page.get_by_text("Indirizzo", exact=True).first.click(force=True)
    page.wait_for_timeout(500)
    page.locator("input[placeholder*='Via']").first.fill("Via del Corso, Roma")
    page.get_by_text("GENERA CON AI", exact=False).first.click(force=True)
    for _ in range(24):
        page.wait_for_timeout(5000)
        if page.get_by_text("Avvia Tour", exact=False).count() > 0:
            break

    # Vista mappa nel risultato
    elenco = page.get_by_text("Elenco", exact=True).first
    elenco.scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    for m in page.get_by_text("Mappa", exact=True).all():
        box = m.bounding_box()
        if box and 0 < box["y"] < 844:
            m.click(force=True)
            break
    page.wait_for_timeout(7000)
    # apri un popup per lo screenshot
    try:
        frame = page.frames[-1]
        frame.locator(".aitour-marker").nth(2).click(force=True)
        page.wait_for_timeout(1500)
    except Exception:
        pass
    page.screenshot(path=f"{OUT}/ai19-tour-mappa.png")
    print("  [OK] ai19-tour-mappa.png")

    # Live con mappa
    for _ in range(6):
        page.mouse.wheel(0, -1200)
        page.wait_for_timeout(100)
    page.get_by_text("Avvia Tour", exact=False).first.click(force=True)
    for _ in range(12):
        page.wait_for_timeout(3000)
        if page.get_by_text("TOUR LIVE", exact=False).count() > 0:
            break
    page.get_by_text("Mappa del giro", exact=False).first.click(force=True)
    page.wait_for_timeout(7000)
    page.screenshot(path=f"{OUT}/ai20-live-mappa.png")
    print("  [OK] ai20-live-mappa.png")

    # Termina il tour di test
    page.get_by_text("Termina", exact=True).first.click(force=True)
    page.wait_for_timeout(4000)
    page.get_by_text("Termina definitivamente", exact=False).first.click(force=True)
    page.wait_for_timeout(5000)
    browser.close()
    print("FATTO")
