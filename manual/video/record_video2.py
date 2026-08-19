"""Registrazione VIDEO 2 — Genera con AI, risultato, mappa, salva."""
import time, json
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com"
DUR = json.load(open('/app/manual/video/audio/durations.json'))
OUTDIR = '/app/manual/video/rec2'

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
        geolocation={"latitude": 45.1847, "longitude": 9.1582},  # Pavia (zona PAVESE)
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

    page.goto(URL + "/ai-tour", wait_until="domcontentloaded", timeout=90000)
    page.get_by_text("GENERA CON AI").first.wait_for(state="visible", timeout=45000)
    page.wait_for_timeout(2000)

    # S1: tap GENERA CON AI
    mark("v2_s1")
    page.wait_for_timeout(2500)
    gen = page.get_by_text("GENERA CON AI").first
    gen.scroll_into_view_if_needed()
    page.wait_for_timeout(800)
    gen.click(force=True)
    s1_end = marks[-1]["t"] + DUR["v2_s1"] + 1.0
    # S1b parte subito dopo s1 (durante l'elaborazione)
    while now() < s1_end:
        page.wait_for_timeout(200)
    mark("v2_s1b")
    s1b_end = marks[-1]["t"] + DUR["v2_s1b"] + 1.0

    # attendo il risultato (Avvia Tour nell'header)
    ok = False
    for _ in range(48):
        page.wait_for_timeout(5000)
        if page.get_by_text("Avvia Tour", exact=False).count() > 0:
            ok = True
            break
    if not ok:
        print("FAIL generazione")
        ctx.close()
        browser.close()
        raise SystemExit(1)
    print(f"  risultato @ {now():.1f}s", flush=True)
    # aspetto comunque la fine di s1b prima di parlare del risultato
    while now() < s1b_end:
        page.wait_for_timeout(200)

    # S2: KPI in alto
    page.mouse.move(390, 800)
    page.mouse.wheel(0, -4000)
    mark("v2_s2")
    hold("v2_s2")

    # S3: strategia AI (scroll giù di poco)
    page.mouse.wheel(0, 900)
    mark("v2_s3")
    hold("v2_s3")

    # S4: tappe + badge Orfano toccabile
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
        print("  badge orfano aperto", flush=True)
    except Exception as e:
        print("  badge orfano non trovato:", e, flush=True)
    hold("v2_s4")
    if opened:
        try:
            page.get_by_text("Chiudi", exact=True).first.click(force=True)
            page.wait_for_timeout(800)
        except Exception:
            pass

    # S5: vista Mappa + schermo intero
    page.mouse.wheel(0, -6000)
    page.wait_for_timeout(800)
    mark("v2_s5")
    try:
        page.get_by_text("Mappa", exact=True).first.click(force=True)
        page.wait_for_timeout(3500)
        page.get_by_text("Schermo intero", exact=False).first.click(force=True)
        page.wait_for_timeout(4000)
        page.get_by_text("Riduci", exact=False).first.click(force=True)
    except Exception as e:
        print("  mappa:", e, flush=True)
    hold("v2_s5")

    # S6: salva
    mark("v2_s6")
    page.wait_for_timeout(1500)
    try:
        page.get_by_text("Salva", exact=True).first.click(force=True)
        print("  salvato", flush=True)
    except Exception as e:
        print("  salva:", e, flush=True)
    hold("v2_s6", extra=2.0)

    marks.append({"scene": "end", "t": round(now(), 2)})
    ctx.close()
    browser.close()

with open(f"{OUTDIR}/marks.json", "w") as f:
    json.dump(marks, f, indent=1)
print("FATTO", json.dumps(marks))
