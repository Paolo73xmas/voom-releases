"""Registrazione VIDEO 2 (v2) — GENERA CON AI, risultato, mappa (con pallino GPS), salva con NOME.
Account tadini; esce dal live PRIMA del mark start (preroll scartato dal montaggio)."""
import time, json
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com"
DUR = json.load(open('/app/manual/video/audio/durations.json'))
OUTDIR = '/app/manual/video/rec2b'

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

    # preroll (scartato): apertura + eventuale uscita dal live
    page.goto(URL + "/ai-tour", wait_until="domcontentloaded", timeout=90000)
    try:
        esci = page.get_by_text("Esci", exact=True).first
        esci.wait_for(state="visible", timeout=25000)
        esci.click(force=True)
        print("  live -> Esci", flush=True)
    except Exception:
        pass
    page.get_by_text("GENERA CON AI").first.wait_for(state="visible", timeout=45000)
    page.wait_for_timeout(2000)
    # tadini ha più zone territorio: senza selezione la generazione si ferma -> Area Automatica (AI)
    try:
        auto = page.get_by_text("Automatica (AI)", exact=True).first
        auto.scroll_into_view_if_needed()
        auto.click(force=True)
        page.wait_for_timeout(800)
        page.mouse.wheel(0, -4000)
        page.wait_for_timeout(800)
    except Exception as e:
        print("  area auto:", e, flush=True)
    mark("start")

    # S1: tap GENERA CON AI
    mark("v2_s1")
    page.wait_for_timeout(2500)
    gen = page.get_by_text("GENERA CON AI").first
    gen.scroll_into_view_if_needed()
    page.wait_for_timeout(800)
    gen.click(force=True)
    s1_end = marks[-1]["t"] + DUR["v2_s1"] + 1.0
    while now() < s1_end:
        page.wait_for_timeout(200)
    mark("v2_s1b")
    s1b_end = marks[-1]["t"] + DUR["v2_s1b"] + 1.0

    ok = False
    for _ in range(48):
        page.wait_for_timeout(5000)
        if page.get_by_text("Avvia Tour", exact=False).count() > 0:
            ok = True
            break
    if not ok:
        print("FAIL generazione", flush=True)
        ctx.close()
        browser.close()
        raise SystemExit(1)
    print(f"  risultato @ {now():.1f}s", flush=True)
    while now() < s1b_end:
        page.wait_for_timeout(200)

    # S2: KPI in alto
    page.mouse.move(390, 800)
    page.mouse.wheel(0, -4000)
    mark("v2_s2")
    hold("v2_s2")

    # S3: strategia AI
    page.mouse.wheel(0, 900)
    mark("v2_s3")
    hold("v2_s3")

    # S4: tappe + badge Orfano
    page.mouse.wheel(0, 1100)
    mark("v2_s4")
    page.wait_for_timeout(2000)
    opened = False
    try:
        badge = page.get_by_text("Orfano", exact=True).first
        badge.scroll_into_view_if_needed()
        page.wait_for_timeout(800)
        badge.click(force=True)
        opened = True
    except Exception as e:
        print("  badge orfano:", e, flush=True)
    hold("v2_s4")
    if opened:
        try:
            page.get_by_text("Chiudi", exact=True).first.click(force=True)
            page.wait_for_timeout(800)
        except Exception:
            pass

    # S5: vista Mappa (pallino GPS) + schermo intero
    page.mouse.wheel(0, -6000)
    page.wait_for_timeout(800)
    mark("v2_s5")
    try:
        page.get_by_text("Mappa", exact=True).first.click(force=True)
        page.wait_for_timeout(4000)
        page.get_by_text("Schermo intero", exact=False).first.click(force=True)
        page.wait_for_timeout(4500)
        page.get_by_text("Riduci", exact=False).first.click(force=True)
    except Exception as e:
        print("  mappa:", e, flush=True)
    hold("v2_s5")

    # S6: Salva -> dialog NOME -> conferma
    mark("v2_s6")
    page.wait_for_timeout(1500)
    try:
        page.get_by_text("Salva", exact=True).first.click(force=True)
        page.locator("input[placeholder*='Es. Giro']").first.wait_for(state="visible", timeout=8000)
        page.wait_for_timeout(1200)
        page.locator("input[placeholder*='Es. Giro']").first.type("Giro Pavese", delay=110)
        page.wait_for_timeout(900)
        page.get_by_text("Salva", exact=True).last.click(force=True)
        page.get_by_text("Salvato", exact=True).first.wait_for(state="visible", timeout=12000)
        print("  salvato con nome", flush=True)
    except Exception as e:
        print("  salva:", e, flush=True)
    hold("v2_s6", extra=2.0)

    marks.append({"scene": "end", "t": round(now(), 2)})
    ctx.close()
    browser.close()

with open(f"{OUTDIR}/marks.json", "w") as f:
    json.dump(marks, f, indent=1)
print("FATTO", json.dumps(marks))
