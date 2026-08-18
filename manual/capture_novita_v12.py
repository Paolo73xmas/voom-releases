"""Cattura le novità per il manuale AI Tour v1.2:
- ai23-splash: nuovo splash animato AI TOUR all'avvio
- ai24-dashboard-dark: dashboard in tema scuro con toggle sole/luna nell'header
- ai27-profilo-aspetto: selettore Aspetto (Chiaro/Scuro) nel Profilo
- ai25-zone-chips: form Genera con chips zone del territorio (alias)
- ai26-avvia-header: risultato tour con tasto "Avvia Tour" nell'header
"""
import re
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com"
OUT = "/app/manual/img"
EMAIL_A = "gdeintinis@gmail.com"
PASS_A = "GabrieleDeIntinis123!"
EMAIL_B = "roberto.beretta@voomweb.it"
PASS_B = "Roberto123!"


def handle_privacy(page):
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


def login(page, email, password):
    page.locator("input").first.wait_for(state="visible", timeout=30000)
    page.locator("input").first.fill(email)
    page.locator("input[type='password']").first.fill(password)
    page.get_by_text("Accedi", exact=True).last.click(force=True)
    page.wait_for_timeout(10000)


with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell",
        args=["--no-sandbox"],
    )

    # ── Contesto A: splash + dashboard dark + profilo aspetto ──
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    # Splash: attendo il marker e catturo durante l'animazione
    try:
        page.get_by_text("Il tuo giro di oggi", exact=False).first.wait_for(state="visible", timeout=45000)
        page.wait_for_timeout(1700)
        page.screenshot(path=f"{OUT}/ai23-splash.png")
        print("  [OK] ai23-splash.png")
        page.wait_for_timeout(1200)
        page.screenshot(path=f"{OUT}/ai23-splash-b.png")
        print("  [OK] ai23-splash-b.png (candidato)")
    except Exception as e:
        print("  [SKIP] splash:", e)
    page.wait_for_timeout(6000)
    handle_privacy(page)
    login(page, EMAIL_A, PASS_A)
    # Dashboard in dark (default) con toggle sole/luna
    page.get_by_text("Dashboard", exact=False).first.wait_for(state="visible", timeout=20000)
    page.wait_for_timeout(3000)
    page.screenshot(path=f"{OUT}/ai24-dashboard-dark.png")
    print("  [OK] ai24-dashboard-dark.png")
    # Profilo → sezione Aspetto
    page.get_by_text("Profilo", exact=True).last.click(force=True)
    page.get_by_text("Aspetto", exact=True).first.wait_for(state="visible", timeout=15000)
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{OUT}/ai27-profilo-aspetto.png")
    print("  [OK] ai27-profilo-aspetto.png")
    ctx.close()

    # ── Contesto B: roberto (zone) → chips zone + header Avvia Tour ──
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(12000)
    handle_privacy(page)
    login(page, EMAIL_B, PASS_B)
    page.get_by_text("AI Tour", exact=True).first.click(force=True)
    page.wait_for_timeout(6000)
    # Scroll fino alla sezione Area con chips zone
    try:
        area = page.get_by_text("Territorio assegnato", exact=True).first
        area.scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        page.mouse.move(195, 500)
        page.mouse.wheel(0, 150)
        page.wait_for_timeout(1200)
        page.screenshot(path=f"{OUT}/ai25-zone-chips.png")
        print("  [OK] ai25-zone-chips.png")
    except Exception as e:
        print("  [SKIP] zone chips:", e)
    # Genera il tour (territorio assegnato, default)
    page.get_by_text("GENERA CON AI", exact=False).first.click(force=True)
    ok = False
    for _ in range(36):
        page.wait_for_timeout(5000)
        if page.get_by_text("Avvia Tour", exact=False).count() > 0:
            ok = True
            break
    if ok:
        print("  tour generato")
        page.wait_for_timeout(2500)
        page.screenshot(path=f"{OUT}/ai26-avvia-header.png")
        print("  [OK] ai26-avvia-header.png")
    else:
        print("  [SKIP] generazione non completata")
    ctx.close()
    browser.close()
    print("FATTO")
