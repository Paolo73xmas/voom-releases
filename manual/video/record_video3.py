"""Registrazione VIDEO 3 — Tour Live: avvio, azioni, Ispezione, orfano riassegnato, salta, mappa, termina."""
import time, json
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com"
DUR = json.load(open('/app/manual/video/audio/durations.json'))
OUTDIR = '/app/manual/video/rec3'

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

    page.goto(URL + "/ai-tour", wait_until="domcontentloaded", timeout=90000)
    page.get_by_text("I miei Tour", exact=True).first.wait_for(state="visible", timeout=45000)
    page.wait_for_timeout(2500)
    # apri il tour salvato da "I miei Tour"
    page.get_by_text("I miei Tour", exact=True).first.click(force=True)
    page.wait_for_timeout(2500)
    page.get_by_text("Sviluppo", exact=False).first.click(force=True)
    page.get_by_text("Avvia Tour", exact=False).first.wait_for(state="visible", timeout=20000)
    page.wait_for_timeout(1500)

    # S1: Avvia Tour -> live
    mark("v3_s1")
    page.wait_for_timeout(2200)
    page.get_by_text("Avvia Tour", exact=False).first.click(force=True)
    page.get_by_text("TOUR LIVE", exact=False).first.wait_for(state="visible", timeout=30000)
    print("  live attivo", flush=True)
    hold("v3_s1")

    # S2: card prossima visita (azioni)
    mark("v3_s2")
    hold("v3_s2")

    # S3: Ispezione -> scheda esito (se acquisizione: chiudi e salta tappa)
    esito = False
    for attempt in range(4):
        page.get_by_text("Ispezione", exact=True).first.click(force=True)
        page.wait_for_timeout(3000)
        if page.get_by_text("Foto ispezione", exact=False).count() > 0:
            esito = True
            break
        try:
            page.get_by_text("Annulla", exact=True).first.click(force=True)
        except Exception:
            page.keyboard.press("Escape")
        page.wait_for_timeout(1200)
        page.get_by_text("Salta visita", exact=False).first.click(force=True)
        page.wait_for_timeout(1500)
        page.get_by_text("Chiuso", exact=True).first.click(force=True)
        page.wait_for_timeout(800)
        page.get_by_text("Salta e ricalcola", exact=False).first.click(force=True)
        page.wait_for_timeout(7000)
    mark("v3_s3")
    if esito:
        page.wait_for_timeout(3000)
        try:
            page.get_by_text("Interessato", exact=True).first.click(force=True)
        except Exception:
            pass
        page.wait_for_timeout(4000)
        # scorri il modale per mostrare foto obbligatorie + contatti
        try:
            page.get_by_text("Foto ispezione", exact=False).first.scroll_into_view_if_needed()
        except Exception:
            pass
        page.wait_for_timeout(4000)
        try:
            page.get_by_text("Contatti punto vendita", exact=False).first.scroll_into_view_if_needed()
        except Exception:
            pass
    hold("v3_s3")

    # S4: orfano riassegnato (spiegazione a voce; chiudo il modale e mostro la card)
    if esito:
        try:
            page.get_by_text("Annulla", exact=True).first.click(force=True)
        except Exception:
            page.keyboard.press("Escape")
        page.wait_for_timeout(1000)
    mark("v3_s4")
    hold("v3_s4")

    # S5: salta visita con motivo -> ricalcolo
    mark("v3_s5")
    page.wait_for_timeout(2000)
    try:
        page.get_by_text("Salta visita", exact=False).first.click(force=True)
        page.wait_for_timeout(3500)
        page.get_by_text("Chiuso", exact=True).first.click(force=True)
        page.wait_for_timeout(2000)
        page.get_by_text("Salta e ricalcola", exact=False).first.click(force=True)
        print("  saltata + ricalcolo", flush=True)
    except Exception as e:
        print("  salta:", e, flush=True)
    hold("v3_s5")

    # S6: mappa del giro
    mark("v3_s6")
    try:
        page.get_by_text("Mappa del giro", exact=False).first.click(force=True)
    except Exception as e:
        print("  mappa live:", e, flush=True)
    hold("v3_s6", extra=2.0)

    # S7: termina + consuntivo
    mark("v3_s7")
    try:
        page.get_by_text("Termina", exact=True).first.click(force=True)
        page.get_by_text("Consuntivo", exact=False).first.wait_for(state="visible", timeout=10000)
        print("  consuntivo aperto", flush=True)
    except Exception as e:
        print("  termina:", e, flush=True)
    hold("v3_s7")
    try:
        page.get_by_text("Termina definitivamente", exact=False).first.click(force=True)
        page.wait_for_timeout(4000)
        print("  tour terminato", flush=True)
    except Exception as e:
        print("  termina def:", e, flush=True)

    marks.append({"scene": "end", "t": round(now(), 2)})
    ctx.close()
    browser.close()

with open(f"{OUTDIR}/marks.json", "w") as f:
    json.dump(marks, f, indent=1)
print("FATTO", json.dumps(marks))
