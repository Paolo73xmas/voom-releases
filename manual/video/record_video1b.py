"""Registrazione VIDEO 1 (v2) — Genera il giro (form), account tadini.
Gestisce il Tour Live attivo: dopo il tap su AI Tour esce subito dalla vista live
(marks live_in/live_out -> blur fullscreen in assemble)."""
import time, json
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com"
DUR = json.load(open('/app/manual/video/audio/durations.json'))
OUTDIR = '/app/manual/video/rec1b'

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
        geolocation={"latitude": 45.1847, "longitude": 9.1582},
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

    # S1: splash + intro
    mark("v1_s1")
    page.goto(URL, wait_until="domcontentloaded", timeout=90000)
    hold("v1_s1")

    # S2: dashboard -> tap AI Tour (blur nome header in post)
    page.get_by_text("AI Tour", exact=True).first.wait_for(state="visible", timeout=30000)
    mark("v1_s2")
    page.wait_for_timeout(2500)
    page.get_by_text("AI Tour", exact=True).first.click(force=True)
    # se c'è un tour live attivo compare la vista live: esci subito (blur fullscreen in post)
    try:
        esci = page.get_by_text("Esci", exact=True).first
        esci.wait_for(state="visible", timeout=8000)
        mark("live_in")
        esci.click(force=True)
        page.get_by_text("GENERA CON AI").first.wait_for(state="visible", timeout=15000)
        mark("live_out")
        print("  live view -> Esci", flush=True)
    except Exception:
        print("  nessun live attivo", flush=True)
    hold("v1_s2")
    marks.append({"scene": "dash_end", "t": round(now(), 2)})

    # S3: form Genera — data Domani + orari
    page.get_by_text("GENERA CON AI").first.wait_for(state="visible", timeout=30000)
    mark("v1_s3")
    page.wait_for_timeout(2500)
    page.get_by_text("Domani", exact=True).first.click(force=True)
    page.wait_for_timeout(2500)
    try:
        plus = page.get_by_text("+15", exact=True)
        minus = page.get_by_text("−15", exact=True)
        if plus.count() >= 2:
            plus.nth(1).click(force=True)
            page.wait_for_timeout(1600)
            minus.nth(1).click(force=True)
    except Exception as e:
        print("  stepper:", e, flush=True)
    hold("v1_s3")

    # S4: tipo giornata
    mark("v1_s4")
    page.get_by_text("Giro Clienti", exact=True).first.click(force=True)
    page.wait_for_timeout(3500)
    page.get_by_text("Sviluppo Territorio", exact=True).first.click(force=True)
    page.wait_for_timeout(3500)
    page.get_by_text("Giornata Mista", exact=True).first.click(force=True)
    page.wait_for_timeout(3500)
    page.get_by_text("Decidi tu", exact=False).first.click(force=True)
    hold("v1_s4")

    # S5: partenza / rientro
    part = page.get_by_text("Partenza", exact=True).first
    part.scroll_into_view_if_needed()
    mark("v1_s5")
    page.wait_for_timeout(1500)
    page.get_by_text("Indirizzo", exact=True).first.click(force=True)
    page.wait_for_timeout(2500)
    page.get_by_text("Posizione corrente", exact=True).first.click(force=True)
    hold("v1_s5")

    # S6: area + zone chips
    area = page.get_by_text("Territorio assegnato", exact=True).first
    area.scroll_into_view_if_needed()
    page.mouse.move(195, 500)
    page.mouse.wheel(0, 120)
    mark("v1_s6")
    page.wait_for_timeout(3000)
    try:
        chip = page.get_by_text("LIGURIA", exact=True).first
        chip.click(force=True)
        page.wait_for_timeout(2200)
        chip.click(force=True)
    except Exception as e:
        print("  zone chip:", e, flush=True)
    hold("v1_s6")

    # S7: visite obbligatorie
    vo = page.get_by_text("Visite obbligatorie", exact=False).first
    vo.scroll_into_view_if_needed()
    page.mouse.move(195, 500)
    page.mouse.wheel(0, 80)
    mark("v1_s7")
    page.wait_for_timeout(1500)
    try:
        search = page.locator("input[placeholder*='Cerca']").last
        search.click(force=True)
        search.type("tabac", delay=180)
        page.wait_for_timeout(3000)
        search.fill("")
    except Exception as e:
        print("  ricerca:", e, flush=True)
    hold("v1_s7")

    # S8: chiusura sul bottone GENERA
    gen = page.get_by_text("GENERA CON AI").first
    gen.scroll_into_view_if_needed()
    mark("v1_s8")
    hold("v1_s8", extra=2.0)

    marks.append({"scene": "end", "t": round(now(), 2)})
    ctx.close()
    browser.close()

with open(f"{OUTDIR}/marks.json", "w") as f:
    json.dump(marks, f, indent=1)
print("FATTO", json.dumps(marks))
