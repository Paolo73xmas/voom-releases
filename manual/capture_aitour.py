"""
Cattura screenshot della sezione AI Tour (app mobile VOOM crm) per il manuale operativo agente.
Salva PNG in /app/manual/img/ con prefisso "ai".
Al termine il tour di test viene terminato; il cleanup dei dati va fatto con
  cd /app/frontend && node scripts/cleanup_aitour_test.mjs
"""
import re
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com"
OUT = "/app/manual/img"
EMAIL = "gdeintinis@gmail.com"
PASSWORD = "GabrieleDeIntinis123!"


def shot(page, name):
    page.screenshot(path=f"{OUT}/{name}.png")
    print(f"  [OK] {name}.png")


def wait(page, ms):
    page.wait_for_timeout(ms)


with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell",
        args=["--no-sandbox"],
    )
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page()

    print("1) Apertura app + login agente...")
    page.goto(URL, wait_until="domcontentloaded", timeout=60000)
    wait(page, 6000)

    # Privacy (se presente)
    try:
        page.get_by_text(re.compile("Informativa Privacy", re.I)).first.wait_for(state="visible", timeout=8000)
        page.mouse.move(195, 300)
        for _ in range(30):
            page.mouse.wheel(0, 1500)
            wait(page, 100)
        for el in page.get_by_text(re.compile("Dichiaro", re.I)).all()[:3]:
            el.click(force=True)
            wait(page, 250)
        page.get_by_text(re.compile("Accetta e Continua", re.I)).first.click(force=True)
        wait(page, 5000)
        print("  privacy accettata")
    except Exception:
        print("  nessuna privacy")

    page.locator("input").first.fill(EMAIL)
    page.locator("input[type='password']").first.fill(PASSWORD)
    page.get_by_text("Accedi", exact=True).last.click(force=True)
    wait(page, 10000)

    print("2) Dashboard con quick action AI Tour...")
    page.get_by_text("AI Tour", exact=True).first.wait_for(state="visible", timeout=20000)
    shot(page, "ai01-dashboard")

    print("3) Form Genera Tour...")
    page.get_by_text("AI Tour", exact=True).first.click(force=True)
    wait(page, 5000)
    shot(page, "ai02-genera-form")
    page.mouse.move(195, 500)
    page.mouse.wheel(0, 700)
    wait(page, 600)
    shot(page, "ai03-genera-form-2")

    print("4) Generazione (Sviluppo, partenza indirizzo)...")
    page.get_by_text("Sviluppo Territorio", exact=False).first.click(force=True)
    page.get_by_text("Indirizzo", exact=True).first.click(force=True)
    wait(page, 500)
    page.locator("input[placeholder*='Via']").first.fill("Via del Corso, Roma")
    page.get_by_text("GENERA CON AI", exact=False).first.click(force=True)
    wait(page, 2500)
    shot(page, "ai04-generazione")
    ok = False
    for _ in range(24):
        wait(page, 5000)
        if page.get_by_text("Avvia Tour", exact=False).count() > 0:
            ok = True
            break
    if not ok:
        raise SystemExit("generazione fallita")

    print("5) Risultato...")
    shot(page, "ai05-risultato")
    page.mouse.move(195, 500)
    page.mouse.wheel(0, 900)
    wait(page, 600)
    shot(page, "ai06-risultato-fermate")
    # Escluse (in fondo)
    try:
        for _ in range(14):
            page.mouse.wheel(0, 1200)
            wait(page, 150)
        page.get_by_text(re.compile("Visite escluse", re.I)).first.click(force=True)
        wait(page, 600)
        shot(page, "ai07-risultato-escluse")
    except Exception:
        print("  escluse non trovate")
    for _ in range(18):
        page.mouse.wheel(0, -1500)
        wait(page, 80)

    print("6) Avvia Tour → Live...")
    page.get_by_text("Avvia Tour", exact=False).first.click(force=True)
    live = False
    for _ in range(12):
        wait(page, 3000)
        if page.get_by_text("TOUR LIVE", exact=False).count() > 0:
            live = True
            break
    if not live:
        raise SystemExit("live non avviato")
    shot(page, "ai08-live")

    print("7) Sono arrivato + esito...")
    page.get_by_text("Sono arrivato", exact=False).first.click(force=True)
    wait(page, 3000)
    shot(page, "ai09-live-arrivato")
    page.get_by_text("Visita terminata", exact=False).first.click(force=True)
    wait(page, 1500)
    # Compila il modale per lo screenshot
    page.get_by_text("Interessato", exact=True).first.click(force=True)
    wait(page, 300)
    page.get_by_text("+1 sett", exact=False).first.click(force=True)
    wait(page, 400)
    shot(page, "ai10-live-esito")
    # Non salvare il follow-up reale: torna a "Nessuno" prima di confermare
    page.get_by_text("Nessuno", exact=True).first.click(force=True)
    wait(page, 300)
    page.get_by_text("Conferma esito", exact=False).first.click(force=True)
    recalc = False
    for _ in range(15):
        wait(page, 4000)
        if page.get_by_text("Giro ricalcolato", exact=False).count() > 0:
            recalc = True
            break
    print("  ricalcolo:", recalc)
    shot(page, "ai11-live-ricalcolo")

    print("8) Salta visita...")
    page.get_by_text("Salta visita", exact=False).first.click(force=True)
    wait(page, 1500)
    page.get_by_text("Chiuso", exact=True).first.click(force=True)
    wait(page, 400)
    shot(page, "ai12-live-salta")
    page.get_by_text("Salta e ricalcola", exact=False).first.click(force=True)
    for _ in range(15):
        wait(page, 4000)
        if page.get_by_text("Giro ricalcolato", exact=False).count() > 0:
            break
    if page.get_by_text("minuti di margine", exact=False).count() > 0:
        shot(page, "ai13-live-suggerimento")

    print("9) Consuntivo + termina...")
    page.get_by_text("Termina", exact=True).first.click(force=True)
    wait(page, 5000)
    shot(page, "ai14-consuntivo")
    page.get_by_text("Termina definitivamente", exact=False).first.click(force=True)
    wait(page, 5000)

    print("10) I miei Tour...")
    page.get_by_text("I miei Tour", exact=True).first.click(force=True)
    wait(page, 3000)
    shot(page, "ai15-tours")

    print("11) Settimana...")
    page.get_by_text("Settimana", exact=True).first.click(force=True)
    wait(page, 2000)
    shot(page, "ai16-settimana-form")
    page.get_by_text("Indirizzo", exact=True).first.click(force=True)
    wait(page, 400)
    page.locator("input[placeholder*='Via']").first.fill("Via del Corso, Roma")
    page.get_by_text("PIANIFICA SETTIMANA", exact=False).first.click(force=True)
    for _ in range(20):
        wait(page, 4000)
        if page.get_by_text("Visite pianificate", exact=False).count() > 0:
            break
    page.mouse.move(195, 500)
    page.mouse.wheel(0, 500)
    wait(page, 500)
    shot(page, "ai17-settimana-risultato")

    print("12) Mese...")
    page.get_by_text("Mese", exact=True).first.click(force=True)
    wait(page, 2000)
    page.get_by_text("Indirizzo", exact=True).first.click(force=True)
    wait(page, 400)
    page.locator("input[placeholder*='Via']").first.fill("Via del Corso, Roma")
    page.get_by_text("PIANIFICA MESE", exact=False).first.click(force=True)
    for _ in range(20):
        wait(page, 4000)
        if page.get_by_text("Settimane rimanenti", exact=False).count() > 0:
            break
    page.mouse.move(195, 500)
    page.mouse.wheel(0, 400)
    wait(page, 500)
    shot(page, "ai18-mese-risultato")

    browser.close()
    print("FATTO. Ricorda il cleanup: cd /app/frontend && node scripts/cleanup_aitour_test.mjs")
