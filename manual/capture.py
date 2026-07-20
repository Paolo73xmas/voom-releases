"""
Cattura screenshot dell'app VOOM crm per il manuale utente.
Salva PNG in /app/manual/img/
"""
import re
import time
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com"
OUT = "/app/manual/img"
EMAIL = "admin1@voomweb.it"
PASSWORD = "Test123!"

def shot(page, name, full=False):
    page.screenshot(path=f"{OUT}/{name}.png", full_page=full)
    print(f"  [OK] {name}.png")

def wait(page, ms):
    page.wait_for_timeout(ms)

def click_first_touchable_below(page, y_min=200, y_max=700):
    """Clicca il primo elemento interattivo (tabindex=0) sotto y_min (per selezionare opzioni)."""
    els = page.query_selector_all("div[tabindex='0']")
    for el in els:
        try:
            box = el.bounding_box()
            if box and y_min < box["y"] < y_max and box["height"] > 30 and box["width"] > 150:
                el.click(force=True)
                return True
        except Exception:
            continue
    return False

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page()

    print("1) Apertura app...")
    page.goto(URL, wait_until="domcontentloaded", timeout=60000)
    wait(page, 6000)

    # ── Consenso privacy (se presente) ──
    try:
        consent = page.get_by_text(re.compile("Informativa Privacy", re.I)).first
        consent.wait_for(state="visible", timeout=8000)
        shot(page, "01-privacy")
        for label in ["Dichiaro di aver letto e compreso", "Dichiaro di aver letto, compreso e accettato", "Dichiaro di comprendere che il conferimento"]:
            page.get_by_text(re.compile(label, re.I)).first.click(force=True)
            wait(page, 300)
        page.get_by_text(re.compile("Accetta e Continua", re.I)).first.click(force=True)
        wait(page, 4000)
        print("  consenso accettato")
    except Exception:
        print("  nessun consenso")

    # ── Login ──
    print("2) Login...")
    try:
        email = page.get_by_placeholder(re.compile("email", re.I)).first
        email.wait_for(state="visible", timeout=10000)
        shot(page, "02-login")
        email.fill(EMAIL)
        page.get_by_placeholder(re.compile("password", re.I)).first.fill(PASSWORD)
        page.get_by_text("Accedi", exact=True).last.click(force=True)
        wait(page, 9000)
    except Exception as e:
        print(f"  login skip: {e}")

    # ── Dashboard ──
    print("3) Dashboard...")
    page.get_by_text("Panoramica", exact=False).first.wait_for(state="visible", timeout=25000)
    wait(page, 3000)
    shot(page, "03-dashboard-top")
    page.mouse.wheel(0, 600)
    wait(page, 1200)
    shot(page, "04-dashboard-azioni")
    page.mouse.wheel(0, -800)
    wait(page, 800)

    # ── Mappa ──
    print("4) Mappa...")
    page.get_by_text("Mappa", exact=True).last.click(force=True)
    wait(page, 9000)
    shot(page, "05-mappa")
    # ricerca unificata
    dims = page.evaluate("() => ({w: window.innerWidth})")
    page.mouse.click(dims["w"] - 32, 173)
    wait(page, 1500)
    try:
        si = page.get_by_placeholder(re.compile("Cliente, P.IVA", re.I)).first
        si.wait_for(state="visible", timeout=6000)
        si.fill("roma")
        wait(page, 5000)
        shot(page, "06-mappa-ricerca")
        # seleziona primo risultato cliente per aprire popup
        res = page.get_by_text(re.compile("TABACCH|RIVENDITA", re.I)).first
        res.click(force=True)
        wait(page, 5000)
        shot(page, "07-mappa-popup")
        # chiudi popup cliccando sulla mappa in alto
        page.mouse.click(dims["w"] // 2, 250)
        wait(page, 1500)
    except Exception as e:
        print(f"  ricerca mappa skip: {e}")

    # ── Clienti ──
    print("5) Clienti...")
    page.get_by_text("Clienti", exact=True).last.click(force=True)
    wait(page, 6000)
    shot(page, "08-clienti")
    # apri scheda primo cliente
    try:
        first_cust = page.get_by_text(re.compile("^(RIVENDITA|TABACCHERIA)", re.I)).first
        first_cust.click(force=True)
        wait(page, 5000)
        shot(page, "09-cliente-dettaglio")
        page.go_back()
        wait(page, 3000)
    except Exception as e:
        print(f"  dettaglio cliente skip: {e}")

    # ── Raccolta Ordine (wizard) ──
    print("6) Wizard Raccolta Ordine...")
    page.goto(f"{URL}/order-collection-v2", wait_until="domcontentloaded")
    wait(page, 8000)
    try:
        page.get_by_text(re.compile("Passo 1 di 5", re.I)).first.wait_for(state="visible", timeout=15000)
        # cerca e seleziona cliente
        try:
            search = page.get_by_placeholder(re.compile("Cerca", re.I)).first
            search.fill("riv")
            wait(page, 2500)
        except Exception:
            pass
        cust = page.get_by_text(re.compile("^(RIVENDITA|TABACCHERIA)", re.I)).first
        cust.click(force=True)
        wait(page, 1500)
        shot(page, "10-ordine-step1")
        page.get_by_text("Continua ai Prodotti", exact=True).first.click(force=True)
        wait(page, 6000)
        shot(page, "11-ordine-step2")
        # aggiungi un prodotto (+1)
        try:
            page.get_by_text("+1", exact=True).first.click(force=True)
            wait(page, 1500)
            shot(page, "12-ordine-step2-carrello")
        except Exception as e:
            print(f"  +1 skip: {e}")
        page.get_by_text("Continua al Pagamento", exact=True).first.click(force=True)
        wait(page, 4000)
        click_first_touchable_below(page, 230)
        wait(page, 1200)
        shot(page, "13-ordine-step3-pagamento")
        page.get_by_text("Continua alla Spedizione", exact=True).first.click(force=True)
        wait(page, 4000)
        click_first_touchable_below(page, 230)
        wait(page, 1200)
        shot(page, "14-ordine-step4-spedizione")
        page.get_by_text("Vai al Riepilogo", exact=True).first.click(force=True)
        wait(page, 4000)
        shot(page, "15-ordine-step5-riepilogo")
        # scrolla fino alla card PDF
        for _ in range(6):
            page.mouse.wheel(0, 600)
            wait(page, 500)
        try:
            page.get_by_text("Preventivo PDF", exact=False).first.wait_for(state="visible", timeout=5000)
        except Exception:
            pass
        shot(page, "16-ordine-pdf-preventivo")
    except Exception as e:
        print(f"  wizard skip: {e}")

    # ── Bozze ──
    print("7) Bozze...")
    page.goto(f"{URL}/drafts", wait_until="domcontentloaded")
    wait(page, 5000)
    shot(page, "17-bozze")

    # ── Ordini ──
    print("8) Ordini...")
    page.goto(f"{URL}/orders", wait_until="domcontentloaded")
    wait(page, 7000)
    shot(page, "18-ordini")

    # ── Prodotti ──
    print("9) Prodotti...")
    page.goto(f"{URL}/products", wait_until="domcontentloaded")
    wait(page, 7000)
    shot(page, "19-prodotti")

    # ── Calendario ──
    print("10) Calendario...")
    page.goto(f"{URL}/calendar", wait_until="domcontentloaded")
    wait(page, 7000)
    shot(page, "20-calendario")

    # ── Menu Altro ──
    print("11) Menu Altro...")
    page.goto(f"{URL}/altro", wait_until="domcontentloaded")
    wait(page, 5000)
    shot(page, "21-altro")

    # ── Anagrafica / Prima Visita ──
    print("12) Anagrafica...")
    page.goto(f"{URL}/anagrafica", wait_until="domcontentloaded")
    wait(page, 6000)
    shot(page, "22-anagrafica")

    # ── Sostituzioni ──
    print("13) Sostituzioni...")
    page.goto(f"{URL}/substitutions", wait_until="domcontentloaded")
    wait(page, 6000)
    shot(page, "23-sostituzioni")

    # ── Profilo ──
    print("14) Profilo...")
    page.goto(f"{URL}/profile", wait_until="domcontentloaded")
    wait(page, 6000)
    shot(page, "24-profilo")

    browser.close()
    print("FATTO — screenshot salvati in", OUT)
