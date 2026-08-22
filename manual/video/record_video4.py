"""Registrazione VIDEO 4 — Fascia oraria visite preferita: ruota nella scheda cliente + Agg. Massivo."""
import time, json
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com"
DUR = json.load(open('/app/manual/video/audio/durations.json'))
OUTDIR = '/app/manual/video/rec4'
CUSTOMER_ID = 'ca3d2242-2139-444a-8033-be60ab443a33'  # ALESSANDRO CARBONERO

marks = []
t0 = 0.0

def now():
    return time.monotonic() - t0

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
    ctx = browser.new_context(
        viewport={"width": 780, "height": 1688},
        storage_state="/tmp/tadini_state.json",
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

    # S1: scheda cliente -> sezione Fascia Visite -> Modifica -> ruota
    page.goto(f"{URL}/customer/{CUSTOMER_ID}", wait_until="domcontentloaded", timeout=90000)
    page.get_by_text("Fascia Visite", exact=False).first.wait_for(state="visible", timeout=60000)
    page.wait_for_timeout(2500)
    page.get_by_text("Fascia Visite", exact=False).first.scroll_into_view_if_needed()
    page.wait_for_timeout(1200)
    mark("v4_s1")
    page.wait_for_timeout(3500)
    page.get_by_text("Modifica", exact=True).first.click(force=True)
    page.wait_for_timeout(2500)
    try:
        page.get_by_text("Salva fasce", exact=False).first.scroll_into_view_if_needed()
    except Exception:
        pass
    page.wait_for_timeout(1500)
    page.get_by_text("9 - 11.30", exact=True).first.click(force=True)
    page.wait_for_timeout(2500)
    page.get_by_text("14.30 - 16", exact=True).first.click(force=True)
    print("  fasce selezionate su scheda", flush=True)
    hold("v4_s1")

    # S2: Agg. Massivo (selezione clienti + ruota, senza salvare)
    page.goto(f"{URL}/bulk-visit-slots", wait_until="domcontentloaded", timeout=90000)
    page.get_by_text("Senza fascia", exact=False).first.wait_for(state="visible", timeout=60000)
    page.wait_for_timeout(2500)
    mark("v4_s2")
    page.wait_for_timeout(2500)
    try:
        page.get_by_text("Seleziona tutti", exact=True).first.click(force=True)
        print("  selezionati tutti", flush=True)
    except Exception as e:
        print("  selezione clienti:", e, flush=True)
    page.wait_for_timeout(2200)
    try:
        page.get_by_text("8 - 9", exact=True).first.click(force=True)
        page.wait_for_timeout(1500)
        page.get_by_text("16 - 18", exact=True).first.click(force=True)
        print("  fasce selezionate su bulk", flush=True)
    except Exception as e:
        print("  ruota bulk:", e, flush=True)
    hold("v4_s2", extra=1.6)

    marks.append({"scene": "end", "t": round(now(), 2)})
    ctx.close()
    browser.close()

with open(f"{OUTDIR}/marks.json", "w") as f:
    json.dump(marks, f, indent=1)
print("FATTO", json.dumps(marks))
