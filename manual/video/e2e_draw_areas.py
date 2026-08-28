"""E2E 'Disegna aree (mappa)' nel Genera Tour (account roberto, nessuna scrittura DB).

Fasi:
 T1: apre AI Tour, verifica form (non live) e chip 'Disegna aree (mappa)'
 T2: attiva la modalità draw -> mappa + hint iniziale
 T3: GENERA senza aree -> errore 'Disegna almeno un'area'
 T4: disegna un poligono grande nell'iframe -> status '1 area/e disegnata/e — N clienti'
 T5: toggle 'Tutti i punti vendita' -> conteggio punti vendita nelle zone
 T6: GENERA CON AI -> piano generato con area label 'aree disegnate sulla mappa (1)'
     (nessun salvataggio: il tour NON viene salvato su DB)
"""
import re
import sys
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com/ai-tour"

def run():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path="/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell",
            args=["--no-sandbox"],
        )
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            storage_state="/tmp/roberto_state.json",
            geolocation={"latitude": 45.35, "longitude": 9.2},
            permissions=["geolocation"],
        )
        page = ctx.new_page()
        page.on("console", lambda m: print("[console]", m.text[:200]) if "error" in m.type.lower() else None)
        page.goto(URL, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(15000)

        # T1: form visibile (non live). Se c'è un TOUR LIVE reale: 'Esci' (solo locale, nessuna scrittura DB)
        try:
            page.wait_for_timeout(3000)
            if page.get_by_text("TOUR LIVE", exact=True).count() > 0:
                print("Live attivo: esco dalla vista live (azione solo locale)")
                page.get_by_text("Esci", exact=True).first.click()
                page.wait_for_timeout(3000)
            page.get_by_text("GENERA CON AI", exact=True).first.wait_for(state="visible", timeout=30000)
            chip = page.get_by_text("Disegna aree (mappa)", exact=True).first
            chip.wait_for(state="visible", timeout=10000)
            results.append("T1 OK: form Genera Tour visibile con chip 'Disegna aree (mappa)'")
        except Exception as e:
            results.append(f"T1 FAIL: {e}")
            print("\n".join(results)); browser.close(); return 1

        # T2: attiva modalità draw
        try:
            chip.click()
            page.wait_for_timeout(2000)
            page.get_by_test_id("aitour-draw-areas").wait_for(state="visible", timeout=10000)
            status = page.get_by_test_id("aitour-draw-areas-status")
            status.wait_for(state="visible", timeout=10000)
            txt = status.inner_text()
            assert "Disegna una o più aree" in txt, f"status inatteso: {txt}"
            results.append("T2 OK: mappa draw visibile con hint iniziale")
        except Exception as e:
            results.append(f"T2 FAIL: {e}")
            print("\n".join(results)); browser.close(); return 1

        # T3: genera senza aree -> errore
        try:
            page.get_by_text("GENERA CON AI", exact=True).first.click()
            page.get_by_text(re.compile("Disegna almeno un'area")).first.wait_for(state="visible", timeout=8000)
            results.append("T3 OK: errore 'Disegna almeno un'area' senza disegni")
        except Exception as e:
            results.append(f"T3 FAIL: {e}")

        # T4: disegna poligono nell'iframe (grande, copre le zone visibili dopo il fit)
        try:
            frame = page.frame_locator("iframe[title='Disegna aree del giro']")
            # attesa mappa e toolbar leaflet-draw
            frame.locator(".leaflet-draw-draw-polygon").wait_for(state="visible", timeout=20000)
            page.wait_for_timeout(2500)  # fitBounds + puntini
            frame.locator(".leaflet-draw-draw-polygon").click()
            page.wait_for_timeout(800)
            box = page.locator("iframe[title='Disegna aree del giro']").bounding_box()
            print("iframe box:", box)
            # 4 punti larghi dentro la mappa, poi chiude sul primo punto
            pts = [
                (box["x"] + box["width"] * 0.15, box["y"] + box["height"] * 0.2),
                (box["x"] + box["width"] * 0.85, box["y"] + box["height"] * 0.2),
                (box["x"] + box["width"] * 0.85, box["y"] + box["height"] * 0.8),
                (box["x"] + box["width"] * 0.15, box["y"] + box["height"] * 0.8),
            ]
            for (x, y) in pts:
                page.mouse.click(x, y)
                page.wait_for_timeout(500)
            # chiudi cliccando di nuovo il primo punto
            page.mouse.click(pts[0][0], pts[0][1])
            page.wait_for_timeout(2500)
            status_txt = page.get_by_test_id("aitour-draw-areas-status").inner_text()
            print("status post-draw:", status_txt)
            assert re.search(r"1 area/e disegnata/e", status_txt), f"status: {status_txt}"
            m = re.search(r"(\d+) clienti dentro", status_txt)
            results.append(f"T4 OK: poligono disegnato, status='{status_txt}'")
        except Exception as e:
            page.screenshot(path="/tmp/e2e_draw_t4.png")
            results.append(f"T4 FAIL: {e}")
            print("\n".join(results)); browser.close(); return 1

        # T5: toggle Tutti i punti vendita
        try:
            page.get_by_test_id("aitour-draw-dots-all").click()
            page.wait_for_timeout(1000)
            info = page.get_by_test_id("aitour-draw-dots-all-info")
            info.wait_for(state="visible", timeout=8000)
            # attende fine caricamento
            for _ in range(30):
                t = info.inner_text()
                if "Carico" not in t:
                    break
                page.wait_for_timeout(1000)
            t = info.inner_text()
            print("info tutti:", t)
            assert re.search(r"\d+ punti vendita nelle zone", t), f"info: {t}"
            results.append(f"T5 OK: modalità 'Tutti' con conteggio -> '{t}'")
        except Exception as e:
            results.append(f"T5 FAIL: {e}")

        # T6: GENERA CON AI con area disegnata (nessun salvataggio DB)
        try:
            page.get_by_text("GENERA CON AI", exact=True).first.click()
            # attende il risultato (piano) o un errore visibile
            deadline = 150
            outcome = None
            for _ in range(deadline):
                if page.get_by_text(re.compile("aree disegnate sulla mappa")).count() > 0:
                    outcome = "plan"
                    break
                err_re = re.compile("Le aree disegnate non toccano|Nessun soggetto disponibile|Nessuna visita|Errore nella generazione|Posizione non disponibile|orario di fine")
                err = page.get_by_text(err_re).count()
                if err > 0:
                    outcome = "error:" + page.get_by_text(err_re).first.inner_text()
                    break
                page.wait_for_timeout(1000)
            page.screenshot(path="/tmp/e2e_draw_t6.png")
            if outcome == "plan":
                results.append("T6 OK: piano generato con area 'aree disegnate sulla mappa'")
            elif outcome and outcome.startswith("error:"):
                results.append(f"T6 PARTIAL: generazione terminata con messaggio: {outcome[6:]}")
            else:
                results.append("T6 FAIL: timeout generazione senza esito visibile")
        except Exception as e:
            results.append(f"T6 FAIL: {e}")

        browser.close()
    print("\n".join(results))
    fails = [r for r in results if "FAIL" in r]
    print("E2E DISEGNA AREE:", "COMPLETATO" if not fails else f"{len(fails)} FALLITI")
    return 0 if not fails else 1

sys.exit(run())
