"""Ricattura in tema scuro attuale: ai01-dashboard (azioni rapide), ai02-genera-form (alto), ai03-genera-form-2 (basso)."""
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
    page.locator("input").first.fill("gdeintinis@gmail.com")
    page.locator("input[type='password']").first.fill("GabrieleDeIntinis123!")
    page.get_by_text("Accedi", exact=True).last.click(force=True)
    page.wait_for_timeout(10000)
    # ai01: dashboard con card AI Tour tra le azioni rapide
    ai = page.get_by_text("AI Tour", exact=True).first
    ai.scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    page.mouse.move(195, 400)
    page.mouse.wheel(0, 120)
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{OUT}/ai01-dashboard.png")
    print("  [OK] ai01-dashboard.png")
    # ai02: form Genera parte alta
    page.get_by_text("AI Tour", exact=True).first.click(force=True)
    page.get_by_text("GENERA CON AI", exact=False).first.wait_for(state="visible", timeout=20000)
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{OUT}/ai02-genera-form.png")
    print("  [OK] ai02-genera-form.png")
    # ai03: parte bassa (partenza, rientro, area, visite obbligatorie)
    part = page.get_by_text("Partenza", exact=True).first
    part.scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    page.mouse.move(195, 500)
    page.mouse.wheel(0, 60)
    page.wait_for_timeout(1200)
    page.screenshot(path=f"{OUT}/ai03-genera-form-2.png")
    print("  [OK] ai03-genera-form-2.png")
    ctx.close()
    browser.close()
    print("FATTO")
