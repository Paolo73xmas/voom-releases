"""Setup: login tadini + privacy accettata -> salva storage_state per le registrazioni."""
import re
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com"

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/pw-browsers/chromium_headless_shell-1228/chrome-linux/headless_shell",
        args=["--no-sandbox"],
    )
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
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
    page.locator("input").first.fill("tadini@voomweb.it")
    page.locator("input[type='password']").first.fill("Tadini2025!")
    page.get_by_text("Accedi", exact=True).last.click(force=True)
    page.wait_for_timeout(10000)
    ok = page.get_by_text("Dashboard", exact=False).count() > 0
    print("login dashboard:", ok)
    ctx.storage_state(path="/tmp/tadini_state.json")
    print("stato salvato")
    ctx.close()
    browser.close()
