"""Ricattura ai10-live-esito con la scelta dell'ora del follow-up (chips orario)."""
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
        print("  login skip (già autenticato)")
    page.get_by_text("AI Tour", exact=True).first.click(force=True)
    page.wait_for_timeout(5000)
    page.get_by_text("Sviluppo Territorio", exact=False).first.click(force=True)
    page.get_by_text("Domani", exact=True).first.click(force=True)
    page.wait_for_timeout(400)
    page.get_by_text("Indirizzo", exact=True).first.click(force=True)
    page.wait_for_timeout(500)
    page.locator("input[placeholder*='Via']").first.fill("Via del Corso, Roma")
    page.get_by_text("GENERA CON AI", exact=False).first.click(force=True)
    found = False
    for _ in range(24):
        page.wait_for_timeout(5000)
        if page.get_by_text("Avvia Tour", exact=False).count() > 0:
            found = True
            break
    if not found:
        page.screenshot(path=f"{OUT}/debug_state.png")
        print("  [DEBUG] Avvia Tour non trovato, screenshot debug_state.png")
        body = page.locator("body").inner_text()[:800]
        print("  [DEBUG] testo pagina:", body.replace("\n", " | ")[:800])
        browser.close()
        raise SystemExit(1)
    page.get_by_text("Avvia Tour", exact=False).first.click(force=True)
    for _ in range(12):
        page.wait_for_timeout(3000)
        if page.get_by_text("TOUR LIVE", exact=False).count() > 0:
            break
    print("  live attivo")
    # Apri il modale esito
    page.get_by_text("Visita terminata", exact=False).first.click(force=True)
    page.wait_for_timeout(2000)
    # Seleziona esito + follow-up + ora
    page.get_by_text("Interessato", exact=True).first.click(force=True)
    page.wait_for_timeout(400)
    page.get_by_text("+1 sett", exact=True).first.click(force=True)
    page.wait_for_timeout(600)
    page.get_by_text("15:00", exact=True).first.click(force=True)
    page.wait_for_timeout(600)
    # Scrolla dentro il foglio per mostrare follow-up + chips orario + hint
    page.mouse.move(195, 600)
    for _ in range(6):
        page.mouse.wheel(0, 300)
        page.wait_for_timeout(150)
    page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/ai10-live-esito.png")
    print("  [OK] ai10-live-esito.png")
    # Chiudi senza salvare e termina il tour di test
    page.get_by_text("Annulla", exact=True).first.click(force=True)
    page.wait_for_timeout(1500)
    page.get_by_text("Termina", exact=True).first.click(force=True)
    page.wait_for_timeout(4000)
    page.get_by_text("Termina definitivamente", exact=False).first.click(force=True)
    page.wait_for_timeout(5000)
    browser.close()
    print("FATTO")
