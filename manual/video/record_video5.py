"""Registrazione VIDEO 5 — Operazioni Live: Ordine (riordino), Ripasso, Tappa, Pausa Pranzo.
Prerequisito: tour sintetico attivo (scripts/synthetic_tour_ops.mjs create) + /tmp/tadini_state.json."""
import time, json
from playwright.sync_api import sync_playwright

URL = "https://voom-ios.preview.emergentagent.com"
DUR = json.load(open('/app/manual/video/audio/durations.json'))
OUTDIR = '/app/manual/video/rec5'

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

    def close_suggestion():
        try:
            page.get_by_text("No, grazie", exact=True).first.click(force=True, timeout=2500)
            page.wait_for_timeout(600)
            print("  suggerimento chiuso", flush=True)
        except Exception:
            pass

    # S1: vista live con i 3 bottoni operazioni
    page.goto(f"{URL}/ai-tour", wait_until="domcontentloaded", timeout=90000)
    page.get_by_text("TOUR LIVE", exact=False).first.wait_for(state="visible", timeout=90000)
    page.get_by_text("Pausa Pranzo", exact=True).first.wait_for(state="visible", timeout=30000)
    page.wait_for_timeout(2500)
    mark("v5_s1")
    page.wait_for_timeout(1500)
    page.get_by_text("Pausa Pranzo", exact=True).first.scroll_into_view_if_needed()
    hold("v5_s1")

    # S2: RIORDINO
    mark("v5_s2")
    page.wait_for_timeout(2000)
    page.get_by_text("Ordine", exact=True).first.click(force=True)
    page.get_by_text("Cambia Ordine Tappe", exact=False).first.wait_for(state="visible", timeout=15000)
    page.wait_for_timeout(2500)
    page.get_by_test_id("reorder-down-0").click(force=True)
    print("  freccia giu riga 1", flush=True)
    page.wait_for_timeout(2000)
    page.get_by_text("Conferma nuovo ordine", exact=False).first.click(force=True)
    page.get_by_text("Ordine tappe aggiornato", exact=False).first.wait_for(state="visible", timeout=90000)
    print("  riordino confermato", flush=True)
    hold("v5_s2")

    # S3: RIPASSO (salta con orario)
    close_suggestion()
    mark("v5_s3")
    page.wait_for_timeout(1500)
    page.get_by_text("Salta visita", exact=False).first.click(force=True)
    page.get_by_text("Ripassa oggi (facoltativo)", exact=False).first.wait_for(state="visible", timeout=15000)
    page.wait_for_timeout(1200)
    page.get_by_text("Chiuso", exact=True).first.click(force=True)
    page.wait_for_timeout(1500)
    chip = page.locator('[data-testid^="revisit-chip-"]').first
    chip_text = chip.inner_text()
    chip.click(force=True)
    print("  chip ripasso:", chip_text, flush=True)
    page.wait_for_timeout(1500)
    page.get_by_text(f"Ripassa alle {chip_text}", exact=False).first.click(force=True)
    page.get_by_text(f"Ripasso {chip_text}", exact=False).first.wait_for(state="visible", timeout=60000)
    print("  badge ripasso visibile", flush=True)
    hold("v5_s3")

    # S4: AGGIUNGI TAPPA (Falla ORA)
    close_suggestion()
    mark("v5_s4")
    page.wait_for_timeout(1200)
    page.get_by_text("Tappa", exact=True).first.click(force=True)
    page.get_by_text("Aggiungi tappa al giro", exact=False).first.wait_for(state="visible", timeout=20000)
    page.locator("text=/km$/").first.wait_for(state="visible", timeout=60000)
    page.wait_for_timeout(1500)
    page.locator("text=/km$/").first.click(force=True)
    page.get_by_text("Quando inserirla nel giro?", exact=False).first.wait_for(state="visible", timeout=15000)
    page.wait_for_timeout(1200)
    page.get_by_text("Falla ORA", exact=False).first.click(force=True)
    page.wait_for_timeout(1500)
    page.get_by_text("Aggiungi al giro", exact=False).first.click(force=True)
    page.get_by_text("aggiunta al giro", exact=False).first.wait_for(state="visible", timeout=90000)
    print("  tappa aggiunta", flush=True)
    hold("v5_s4")

    # S5: PAUSA PRANZO
    close_suggestion()
    mark("v5_s5")
    page.wait_for_timeout(1200)
    page.get_by_text("Pausa Pranzo", exact=True).first.click(force=True)
    page.get_by_text("una sola volta al giorno", exact=False).first.wait_for(state="visible", timeout=15000)
    page.wait_for_timeout(1800)
    page.get_by_text("Inizia pausa", exact=False).first.click(force=True)
    page.get_by_text("Pausa pranzo in corso", exact=False).first.wait_for(state="visible", timeout=30000)
    print("  countdown avviato", flush=True)
    page.wait_for_timeout(5000)
    for attempt in range(6):
        try:
            page.get_by_text("Riprendi ora", exact=False).first.click(force=True, timeout=5000)
            page.get_by_text("Pausa pranzo in corso", exact=False).first.wait_for(state="detached", timeout=8000)
            break
        except Exception:
            page.wait_for_timeout(3000)
    print("  ripresa dalla pausa", flush=True)
    hold("v5_s5", extra=1.6)

    marks.append({"scene": "end", "t": round(now(), 2)})
    ctx.close()
    browser.close()

with open(f"{OUTDIR}/marks.json", "w") as f:
    json.dump(marks, f, indent=1)
print("FATTO", json.dumps(marks))
