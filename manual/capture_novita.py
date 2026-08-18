"""Cattura le novità per il manuale AI Tour v1.1:
- ai21-orfano-storico: modale storico ordini del badge Orfano
- ai19-tour-mappa (ricattura): mappa risultato con tasto Schermo intero
- ai22-mappa-fullscreen: mappa a tutto schermo con tasto Riduci
"""
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
    try:
        page.locator("input").first.wait_for(state="visible", timeout=8000)
        page.locator("input").first.fill(EMAIL)
        page.locator("input[type='password']").first.fill(PASSWORD)
        page.get_by_text("Accedi", exact=True).last.click(force=True)
        page.wait_for_timeout(10000)
    except Exception:
        print("  login skip")
    page.get_by_text("AI Tour", exact=True).first.click(force=True)
    page.wait_for_timeout(5000)
    page.get_by_text("Sviluppo Territorio", exact=False).first.click(force=True)
    page.get_by_text("Indirizzo", exact=True).first.click(force=True)
    page.wait_for_timeout(500)
    page.locator("input[placeholder*='Via']").first.fill("Via del Corso, Roma")
    page.get_by_text("GENERA CON AI", exact=False).first.click(force=True)
    for _ in range(30):
        page.wait_for_timeout(5000)
        if page.get_by_text("Avvia Tour", exact=False).count() > 0:
            break
    print("  tour generato")
    # 1) Modale storico Orfano
    orfano = page.get_by_text("Orfano", exact=True).first
    orfano.scroll_into_view_if_needed()
    page.wait_for_timeout(600)
    orfano.click(force=True)
    page.get_by_text("Ordini degli ultimi 12 mesi", exact=False).first.wait_for(state="visible", timeout=10000)
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{OUT}/ai21-orfano-storico.png")
    print("  [OK] ai21-orfano-storico.png")
    page.get_by_text("Chiudi", exact=True).first.click(force=True)
    page.wait_for_timeout(1000)
    # 2) Mappa con tasto Schermo intero
    page.get_by_text("Mappa", exact=True).last.click(force=True)
    page.get_by_text("Schermo intero", exact=False).first.wait_for(state="visible", timeout=15000)
    page.wait_for_timeout(4500)
    page.screenshot(path=f"{OUT}/ai19-tour-mappa.png")
    print("  [OK] ai19-tour-mappa.png (ricattura)")
    # 3) Fullscreen con Riduci
    page.get_by_text("Schermo intero", exact=False).first.click(force=True)
    page.get_by_text("Riduci", exact=True).first.wait_for(state="visible", timeout=10000)
    page.wait_for_timeout(4500)
    page.screenshot(path=f"{OUT}/ai22-mappa-fullscreen.png")
    print("  [OK] ai22-mappa-fullscreen.png")
    browser.close()
    print("FATTO")
