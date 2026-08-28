"""E2E schermo intero 'Disegna aree': espandi -> disegna -> riduci -> aree conservate.

 T1: modalità draw attiva, pulsante 'Schermo intero' visibile
 T2: disegna un poligono inline -> status 1 area
 T3: espandi -> modal fullscreen con mappa e controlli; l'area disegnata è ripristinata
 T4: nel fullscreen disegna una seconda area -> status 2 aree
 T5: riduci -> mappa inline rimontata con entrambe le aree (status invariato)
Nessuna scrittura DB (nessun salvataggio giro).
"""
import re
import sys
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com/ai-tour"
IFRAME = "iframe[title='Disegna aree del giro']"

def draw_polygon(page, frame, box, inset=0.2):
    poly_btn = frame.locator(".leaflet-draw-draw-polygon")
    poly_btn.wait_for(state="visible", timeout=20000)
    page.wait_for_timeout(2500)
    # attiva il tool con verifica (compare la toolbar azioni 'Annulla/Concludi')
    for _ in range(3):
        poly_btn.click()
        page.wait_for_timeout(700)
        if frame.locator(".leaflet-draw-actions").first.is_visible():
            break
    mapel = frame.locator("#map")
    w, h = box["width"], box["height"]
    pts = [
        (w * inset, h * inset),
        (w * (1 - inset), h * inset),
        (w * (1 - inset), h * (1 - inset)),
        (w * inset, h * (1 - inset)),
    ]
    placed = 0
    for (x, y) in pts:
        for attempt in range(4):
            mapel.click(position={"x": x, "y": y}, force=True)
            page.wait_for_timeout(500)
            n = frame.locator(".leaflet-editing-icon").count()
            if n > placed:
                placed = n
                break
    print("vertici piazzati:", placed)
    # chiude il poligono con l'azione 'Concludi' della toolbar leaflet-draw
    frame.get_by_text("Concludi", exact=True).click()
    page.wait_for_timeout(2000)

def get_srcdoc_frame(page):
    for f in page.frames:
        if f != page.main_frame and "srcdoc" in (f.url or ""):
            try:
                if f.locator("#map").count() > 0:
                    return f
            except Exception:
                continue
    return None

def drawn_count(page):
    f = get_srcdoc_frame(page)
    return f.evaluate("window.drawnItems ? window.drawnItems.getLayers().length : -1") if f else -1

def run():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path="/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell", args=["--no-sandbox"])
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, storage_state="/tmp/roberto_state.json")
        page = ctx.new_page()
        page.goto(URL, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(15000)
        if page.get_by_text("TOUR LIVE", exact=True).count() > 0:
            page.get_by_text("Esci", exact=True).first.click()
            page.wait_for_timeout(3000)

        # T1
        try:
            page.get_by_text("Disegna aree (mappa)", exact=True).first.click()
            page.wait_for_timeout(4000)
            page.get_by_test_id("aitour-draw-expand").wait_for(state="visible", timeout=15000)
            results.append("T1 OK: pulsante 'Schermo intero' visibile")
        except Exception as e:
            results.append(f"T1 FAIL: {e}")
            print("\n".join(results)); browser.close(); return 1

        # T2: disegna inline
        try:
            frame = page.frame_locator(IFRAME)
            page.wait_for_timeout(2000)
            box = page.locator(IFRAME).bounding_box()
            draw_polygon(page, frame, box, inset=0.25)
            txt = page.get_by_test_id("aitour-draw-areas-status").first.inner_text()
            assert "1 area/e" in txt, txt
            results.append(f"T2 OK: area inline -> '{txt}'")
        except Exception as e:
            page.screenshot(path="/tmp/e2e_fs_t2.png")
            results.append(f"T2 FAIL: {e}")
            print("\n".join(results)); browser.close(); return 1

        # T3: espandi
        try:
            page.get_by_test_id("aitour-draw-expand").click()
            page.wait_for_timeout(5000)
            page.get_by_test_id("aitour-draw-reduce").wait_for(state="visible", timeout=10000)
            page.get_by_text("Mappa aperta a schermo intero").wait_for(state="visible", timeout=5000) if False else None
            frame = page.frame_locator(IFRAME)
            frame.locator(".leaflet-draw-draw-polygon").wait_for(state="visible", timeout=20000)
            page.wait_for_timeout(2000)
            # l'area disegnata deve essere ripristinata nella nuova mappa
            n_layers = drawn_count(page)
            print("layer disegnati in fullscreen:", n_layers)
            assert n_layers >= 1, "area non ripristinata nel fullscreen"
            page.screenshot(path="/tmp/e2e_fs_t3.png")
            results.append("T3 OK: fullscreen aperto, area ripristinata sulla mappa")
        except Exception as e:
            page.screenshot(path="/tmp/e2e_fs_t3.png")
            results.append(f"T3 FAIL: {e}")
            print("\n".join(results)); browser.close(); return 1

        # T4: disegna seconda area in fullscreen
        try:
            box = page.locator(IFRAME).bounding_box()
            draw_polygon(page, frame, box, inset=0.38)
            txt = page.get_by_test_id("aitour-draw-areas-status").last.inner_text()
            assert "2 area/e" in txt, txt
            results.append(f"T4 OK: seconda area in fullscreen -> '{txt}'")
        except Exception as e:
            page.screenshot(path="/tmp/e2e_fs_t4.png")
            results.append(f"T4 FAIL: {e}")

        # T5: riduci
        try:
            page.get_by_test_id("aitour-draw-reduce").click()
            page.wait_for_timeout(5000)
            page.get_by_test_id("aitour-draw-expand").wait_for(state="visible", timeout=15000)
            frame = page.frame_locator(IFRAME)
            frame.locator(".leaflet-draw-draw-polygon").wait_for(state="visible", timeout=20000)
            page.wait_for_timeout(2500)
            n_layers = drawn_count(page)
            txt = page.get_by_test_id("aitour-draw-areas-status").first.inner_text()
            print("layer disegnati inline dopo riduzione:", n_layers, "| status:", txt)
            assert n_layers >= 2 and re.search(r"2 area/e", txt), f"layers={n_layers} status={txt}"
            page.screenshot(path="/tmp/e2e_fs_t5.png")
            results.append(f"T5 OK: ridotto, 2 aree conservate -> '{txt}'")
        except Exception as e:
            page.screenshot(path="/tmp/e2e_fs_t5.png")
            results.append(f"T5 FAIL: {e}")

        browser.close()
    print("\n".join(results))
    fails = [r for r in results if "FAIL" in r]
    print("E2E SCHERMO INTERO:", "COMPLETATO" if not fails else f"{len(fails)} FALLITI")
    return 0 if not fails else 1

sys.exit(run())
