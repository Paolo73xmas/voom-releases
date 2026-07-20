import re
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(6000)
    try:
        consent = page.get_by_text(re.compile("Informativa Privacy", re.I)).first
        consent.wait_for(state="visible", timeout=6000)
        for label in ["Dichiaro di aver letto e compreso", "Dichiaro di aver letto, compreso e accettato", "Dichiaro di comprendere che il conferimento"]:
            page.get_by_text(re.compile(label, re.I)).first.click(force=True)
            page.wait_for_timeout(300)
        page.get_by_text(re.compile("Accetta e Continua", re.I)).first.click(force=True)
        page.wait_for_timeout(4000)
    except Exception:
        pass
    try:
        email = page.get_by_placeholder(re.compile("email", re.I)).first
        email.wait_for(state="visible", timeout=8000)
        email.fill("admin1@voomweb.it")
        page.get_by_placeholder(re.compile("password", re.I)).first.fill("Test123!")
        page.get_by_text("Accedi", exact=True).last.click(force=True)
        page.wait_for_timeout(9000)
    except Exception:
        pass

    page.get_by_text("Clienti", exact=True).last.click(force=True)
    page.wait_for_timeout(7000)
    # click sul primo elemento cliccabile grande nella lista (sotto la search bar)
    els = page.query_selector_all("div[tabindex='0']")
    for el in els:
        box = el.bounding_box()
        if box and box["y"] > 220 and box["height"] > 60 and box["width"] > 250:
            el.click(force=True)
            break
    page.wait_for_timeout(6000)
    page.screenshot(path="/app/manual/img/09-cliente-dettaglio.png")
    print("09-cliente-dettaglio OK")
    browser.close()
