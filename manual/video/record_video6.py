"""Registrazione VIDEO 6 — Dillo all'AI V4: richiesta naturale, chips GPT Luna, rientro a casa,
multi-giornata a settori, salvataggio con nome, I miei Tour, Portafoglio.
Marks speciali: start (scarta preroll), waitN (time-lapse), cutN (segmento escluso)."""
import time, json
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com"
DUR = json.load(open('/app/manual/video/audio/durations.json'))
OUTDIR = '/app/manual/video/rec6'

REQ1 = "domani fammi visitare una decina di clienti Laservideo e DoctorVape, quelli fermi da più tempo, non farmi girare troppo e alla fine torno a casa"
REQ2 = "oggi dalle 14 alle 18 devo visitare tutti i miei clienti di Voghera, Pavia, Stradella e Broni, tutti quanti"

marks = []
t0 = 0.0

def now():
    return time.monotonic() - t0

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell",
        args=["--no-sandbox"],
    )
    ctx = browser.new_context(
        viewport={"width": 780, "height": 1688},
        storage_state="/tmp/tadini_state.json",
        geolocation={"latitude": 45.1847, "longitude": 9.1582},  # Pavia
        permissions=["geolocation"],
        record_video_dir=OUTDIR,
        record_video_size={"width": 780, "height": 1688},
    )
    page = ctx.new_page()
    page.add_init_script("document.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.zoom='2';});")
    t0 = time.monotonic()

    def mark(scene):
        marks.append({"scene": scene, "t": round(now(), 2)})
        print(f"  {scene} @ {now():.1f}s", flush=True)

    def hold(scene, extra=1.2):
        end = marks[-1]["t"] + DUR[scene] + extra
        remaining = end - now()
        if remaining > 0:
            page.wait_for_timeout(int(remaining * 1000))

    def exit_live():
        try:
            esci = page.get_by_text("Esci", exact=True).first
            esci.wait_for(state="visible", timeout=25000)
            esci.click(force=True)
            print("  live -> Esci", flush=True)
        except Exception:
            pass
        page.get_by_text("GENERA CON AI").first.wait_for(state="visible", timeout=45000)
        page.wait_for_timeout(1500)

    def open_dillo():
        btn = page.get_by_text("Dillo all'AI", exact=False).first
        btn.scroll_into_view_if_needed()
        page.wait_for_timeout(700)
        btn.click(force=True)
        page.get_by_text("Interpreta la richiesta", exact=False).first.wait_for(state="visible", timeout=10000)

    def brief_input():
        return page.locator("textarea[placeholder*='Scrivi o detta'], input[placeholder*='Scrivi o detta']").first

    # ---- preroll (scartato) ----
    page.goto(URL + "/ai-tour", wait_until="domcontentloaded", timeout=90000)
    exit_live()
    mark("start")

    # S1: intro Dillo all'AI (bottone in vista)
    btn = page.get_by_text("Dillo all'AI", exact=False).first
    btn.scroll_into_view_if_needed()
    mark("v6_s1")
    hold("v6_s1")

    # S2: apri modale + digita la richiesta
    mark("v6_s2")
    open_dillo()
    page.wait_for_timeout(1200)
    brief_input().click(force=True)
    brief_input().type(REQ1, delay=52)
    hold("v6_s2")

    # S3: Interpreta -> chips GPT Luna
    mark("v6_s3")
    page.get_by_text("Interpreta la richiesta", exact=False).first.click(force=True)
    page.get_by_text("Genera il giro", exact=True).first.wait_for(state="visible", timeout=90000)
    print(f"  chips @ {now():.1f}s", flush=True)
    page.wait_for_timeout(1000)
    page.mouse.move(390, 900)
    page.mouse.wheel(0, 500)
    hold("v6_s3")

    # S4: Genera il giro (rientro a casa)
    mark("v6_s4")
    g = page.get_by_text("Genera il giro", exact=True).first
    g.scroll_into_view_if_needed()
    page.wait_for_timeout(600)
    g.click(force=True)
    hold("v6_s4")
    # attesa elaborazione in time-lapse fino al risultato
    mark("wait1")
    ok = False
    for _ in range(40):
        page.wait_for_timeout(4000)
        if page.get_by_text("Avvia Tour", exact=False).count() > 0:
            ok = True
            break
    print(f"  risultato demo1 @ {now():.1f}s ok={ok}", flush=True)
    mark("show1")  # 6s sul risultato (muto)
    page.mouse.wheel(0, -4000)
    page.wait_for_timeout(6000)

    # ---- cut: reset per la demo multi-giornata ----
    mark("cut1")
    page.goto(URL + "/ai-tour", wait_until="domcontentloaded", timeout=90000)
    exit_live()

    # S5: richiesta "troppo grande" -> interpreta -> genera
    btn = page.get_by_text("Dillo all'AI", exact=False).first
    btn.scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    mark("v6_s5")
    open_dillo()
    page.wait_for_timeout(800)
    brief_input().click(force=True)
    brief_input().type(REQ2, delay=45)
    page.wait_for_timeout(600)
    page.get_by_text("Interpreta la richiesta", exact=False).first.click(force=True)
    page.get_by_text("Genera il giro", exact=True).first.wait_for(state="visible", timeout=90000)
    page.wait_for_timeout(1500)
    g = page.get_by_text("Genera il giro", exact=True).first
    g.scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    g.click(force=True)
    hold("v6_s5")
    # time-lapse fino al dialog multi-giornata
    mark("wait2")
    dlg = page.get_by_text("Il giro necessita di più giornate", exact=True).first
    dlg.wait_for(state="visible", timeout=300000)
    print(f"  dialog multiday @ {now():.1f}s", flush=True)

    # S6: dialog -> Sì, crea più giornate
    mark("v6_s6")
    end6 = marks[-1]["t"] + DUR["v6_s6"]
    while now() < end6 - 2.5:
        page.wait_for_timeout(200)
    page.get_by_text("Sì, crea più giornate", exact=False).first.click(force=True)
    hold("v6_s6")
    # time-lapse ripianificazione a settori
    mark("wait3")
    page.get_by_text("Giorno 1", exact=False).first.wait_for(state="visible", timeout=420000)
    page.get_by_text("Giro strutturato su", exact=False).first.wait_for(state="visible", timeout=120000)
    print(f"  multiday pronto @ {now():.1f}s", flush=True)
    page.wait_for_timeout(1500)

    # S7: tab Giorno 1/2/3
    page.mouse.wheel(0, -5000)
    page.wait_for_timeout(800)
    mark("v6_s7")
    page.wait_for_timeout(3500)
    for day in ["Giorno 2", "Giorno 3", "Giorno 1"]:
        try:
            page.get_by_text(day, exact=False).first.click(force=True)
            page.wait_for_timeout(3200)
        except Exception as e:
            print(f"  tab {day}:", e, flush=True)
    hold("v6_s7")

    # S8: Salva con nome
    mark("v6_s8")
    page.wait_for_timeout(1000)
    try:
        page.get_by_text("Salva", exact=True).first.click(force=True)
        page.locator("input[placeholder*='Es. Giro']").first.wait_for(state="visible", timeout=8000)
        page.wait_for_timeout(900)
        page.locator("input[placeholder*='Es. Giro']").first.type("Giro Oltrepò", delay=110)
        page.wait_for_timeout(700)
        page.get_by_text("Salva", exact=True).last.click(force=True)
        page.get_by_text("Salvato", exact=True).first.wait_for(state="visible", timeout=20000)
        print("  salvato multiday con nome", flush=True)
    except Exception as e:
        print("  salva:", e, flush=True)
    hold("v6_s8")

    # S9: I miei Tour + Portafoglio + chiusura
    mark("v6_s9")
    try:
        page.get_by_text("I miei Tour", exact=True).first.click(force=True)
        page.wait_for_timeout(6000)
        page.get_by_text("Portafoglio", exact=True).first.click(force=True)
        page.wait_for_timeout(4000)
        page.mouse.move(390, 900)
        page.mouse.wheel(0, 700)
    except Exception as e:
        print("  tabs:", e, flush=True)
    hold("v6_s9", extra=2.0)

    marks.append({"scene": "end", "t": round(now(), 2)})
    ctx.close()
    browser.close()

with open(f"{OUTDIR}/marks.json", "w") as f:
    json.dump(marks, f, indent=1)
print("FATTO", json.dumps(marks))
