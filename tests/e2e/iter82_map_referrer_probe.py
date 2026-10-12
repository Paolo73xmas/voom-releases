"""Iteration 82: map tile Referer/Origin diagnostic probe.

Scope:
- Read-only synthetic network probe against preview origin.
- No authenticated app flows.
- Fail-closed for business/API traffic.
"""

from __future__ import annotations

import json
from urllib.parse import parse_qs, urlparse

from dotenv import dotenv_values


CONFIG = dotenv_values("/app/frontend/.env")
PREVIEW_URL = CONFIG["EXPO_PACKAGER_PROXY_URL"].rstrip("/")
TILE_BASE = "https://tile.openstreetmap.org/0/0/0.png"


def _q(url: str) -> dict:
    return parse_qs(urlparse(url).query)


def _probe_of(url: str) -> str:
    return _q(url).get("probe", ["unknown"])[0]


def _probe_doc_html(probe_id: str, *, include_meta: bool) -> str:
    meta = (
        '<meta name="referrer" content="strict-origin-when-cross-origin">'
        if include_meta
        else ""
    )
    tile_url = TILE_BASE  # Canonical tile URL; distinguish cases by frame name, never cache-bust tiles.
    return f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    {meta}
    <style>
      body {{ margin: 0; font-family: sans-serif; background: #fff; }}
      #tile {{ width: 256px; height: 256px; display: block; border: 1px solid #ccc; }}
      #status {{ font-size: 12px; padding: 4px; }}
    </style>
  </head>
  <body>
    <img id="tile" alt="osm-tile" src="{tile_url}" />
    <div id="status">loading</div>
    <script>
      (() => {{
        const id = {json.dumps(probe_id)};
        const img = document.getElementById('tile');
        const status = document.getElementById('status');
        const done = (ok, reason) => {{
          status.textContent = ok ? 'loaded' : 'failed:' + reason;
          window.parent.postMessage({{ kind: 'probe-result', probe: id, ok, reason }}, '*');
        }};
        img.addEventListener('load', () => done(true, 'load'));
        img.addEventListener('error', () => done(false, 'error'));
      }})();
    </script>
  </body>
</html>
"""


def _harness_html() -> str:
    srcdoc_a = _probe_doc_html("a_srcdoc_sandbox", include_meta=False).replace("\"", "&quot;")
    srcdoc_b = _probe_doc_html("b_srcdoc_meta_policy", include_meta=True).replace("\"", "&quot;")
    return f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>iter82 map policy probe</title>
    <style>
      body {{ margin: 0; padding: 8px; font-family: sans-serif; }}
      .row {{ margin-bottom: 10px; }}
      iframe {{ width: 280px; height: 300px; border: 1px solid #777; }}
      pre {{ white-space: pre-wrap; font-size: 12px; }}
    </style>
  </head>
  <body>
    <div class="row">
      <div>A) srcDoc + sandbox allow-scripts</div>
      <iframe id="frame-a" name="a_srcdoc_sandbox" sandbox="allow-scripts" srcdoc="{srcdoc_a}"></iframe>
    </div>
    <div class="row">
      <div>B) srcDoc + meta strict-origin-when-cross-origin + iframe referrerPolicy</div>
      <iframe id="frame-b" name="b_srcdoc_meta_policy" sandbox="allow-scripts" referrerpolicy="strict-origin-when-cross-origin" srcdoc="{srcdoc_b}"></iframe>
    </div>
    <div class="row">
      <div>C) URL document in sandbox allow-scripts</div>
      <iframe id="frame-c" name="c_url_doc_sandbox" sandbox="allow-scripts" referrerpolicy="strict-origin-when-cross-origin" src="/orchestrator-map-policy-probe.html?mode=doc&probe=c_url_doc_sandbox&meta=1"></iframe>
    </div>
    <div class="row">
      <div>D) Optional unsandboxed baseline URL document</div>
      <iframe id="frame-d" name="d_unsandboxed_baseline" referrerpolicy="strict-origin-when-cross-origin" src="/orchestrator-map-policy-probe.html?mode=doc&probe=d_unsandboxed_baseline&meta=1"></iframe>
    </div>
    <pre id="results">[]</pre>
    <script>
      (() => {{
        const out = [];
        const needed = new Set(['a_srcdoc_sandbox', 'b_srcdoc_meta_policy', 'c_url_doc_sandbox', 'd_unsandboxed_baseline']);
        window.__probe_done = false;
        window.addEventListener('message', (ev) => {{
          const d = ev.data || {{}};
          if (d.kind !== 'probe-result') return;
          out.push(d);
          document.getElementById('results').textContent = JSON.stringify(out, null, 2);
          needed.delete(d.probe);
          if (needed.size === 0) window.__probe_done = true;
        }});
      }})();
    </script>
  </body>
</html>
"""


async def _img_stats(frame, selector: str = "#tile") -> dict:
    return await frame.locator(selector).evaluate(
        """(img) => {
          const out = {
            complete: !!img.complete,
            naturalWidth: img.naturalWidth || 0,
            naturalHeight: img.naturalHeight || 0,
            sampleUniqueColors: 0,
            sampleError: null,
          };
          try {
            const c = document.createElement('canvas');
            c.width = Math.max(1, img.naturalWidth || 1);
            c.height = Math.max(1, img.naturalHeight || 1);
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const d = ctx.getImageData(0, 0, c.width, c.height).data;
            const step = Math.max(4, Math.floor((c.width * c.height * 4) / 2048));
            const set = new Set();
            for (let i = 0; i < d.length; i += step) {
              const r = d[i] >> 4;
              const g = d[i + 1] >> 4;
              const b = d[i + 2] >> 4;
              set.add(`${r}-${g}-${b}`);
            }
            out.sampleUniqueColors = set.size;
          } catch (e) {
            out.sampleError = String(e);
          }
          return out;
        }"""
    )


async def run(page):
    preview_origin = PREVIEW_URL
    preview_host = urlparse(preview_origin).netloc
    state = {
        "tile_requests": {},
        "tile_responses": {},
        "blocked_business": [],
        "console": [],
    }

    async def route_handler(route):
        req = route.request
        url = req.url
        parsed = urlparse(url)
        host = parsed.netloc
        path = parsed.path

        # Synthetic same-origin static harness and static document.
        if host == preview_host and path == "/orchestrator-map-policy-harness.html":
            await route.fulfill(
                status=200,
                headers={"content-type": "text/html; charset=utf-8", "cache-control": "no-store"},
                body=_harness_html(),
            )
            return

        if host == preview_host and path == "/orchestrator-map-policy-probe.html":
            query = _q(url)
            probe_id = query.get("probe", ["unknown"])[0]
            include_meta = query.get("meta", ["0"])[0] == "1"
            await route.fulfill(
                status=200,
                headers={"content-type": "text/html; charset=utf-8", "cache-control": "no-store"},
                body=_probe_doc_html(probe_id, include_meta=include_meta),
            )
            return

        # Capture and allow exactly one canonical OSM tile variant path.
        if host == "tile.openstreetmap.org" and path == "/0/0/0.png":
            probe_id = req.frame.name
            req_headers = await req.all_headers()
            state["tile_requests"][probe_id] = {
                "url": url,
                "method": req.method,
                "referer": req_headers.get("referer", ""),
                "origin": req_headers.get("origin", ""),
                "user-agent": req_headers.get("user-agent", ""),
                "cache-control": req_headers.get("cache-control", ""),
                "pragma": req_headers.get("pragma", ""),
            }
            await route.continue_()
            return

        # Fail-closed business/API/auth/CRM/edge calls.
        bad_host_tokens = ("supabase", "crm", "edge", "api")
        if "/api/" in url or any(tok in host for tok in bad_host_tokens):
            state["blocked_business"].append({"url": url, "method": req.method})
            await route.fulfill(status=503, headers={"content-type": "application/json"}, body='{"error":"blocked"}')
            return

        # Block all other network to keep probe minimal/controlled.
        await route.abort("blockedbyclient")

    async def response_handler(response):
        url = response.url
        parsed = urlparse(url)
        if parsed.netloc == "tile.openstreetmap.org" and parsed.path == "/0/0/0.png":
            probe_id = response.request.frame.name
            headers = await response.all_headers()
            state["tile_responses"][probe_id] = {
                "status": response.status,
                "content-type": headers.get("content-type", ""),
                "cache-control": headers.get("cache-control", ""),
                "x-cache": headers.get("x-cache", ""),
            }

    page.on("console", lambda m: state["console"].append(m.text))
    page.on("response", response_handler)

    await page.set_viewport_size({"width": 375, "height": 667})
    await page.route("**/*", route_handler)

    await page.goto(f"{preview_origin}/orchestrator-map-policy-harness.html", wait_until="domcontentloaded")
    await page.wait_for_function("() => window.__probe_done === true", timeout=30000)
    await page.wait_for_timeout(1000)

    # Per-case screenshots and image sampling checks.
    frame_a = page.frame_locator("#frame-a")
    frame_b = page.frame_locator("#frame-b")
    frame_c = page.frame_locator("#frame-c")
    frame_d = page.frame_locator("#frame-d")

    await frame_a.locator("#tile").wait_for(timeout=15000)
    await frame_b.locator("#tile").wait_for(timeout=15000)
    await frame_c.locator("#tile").wait_for(timeout=15000)
    await frame_d.locator("#tile").wait_for(timeout=15000)

    stats = {
        "a_srcdoc_sandbox": await _img_stats(frame_a),
        "b_srcdoc_meta_policy": await _img_stats(frame_b),
        "c_url_doc_sandbox": await _img_stats(frame_c),
        "d_unsandboxed_baseline": await _img_stats(frame_d),
    }

    await page.locator("#frame-a").screenshot(path="/tmp/iter82_case_a.jpeg", quality=40)
    await page.locator("#frame-b").screenshot(path="/tmp/iter82_case_b.jpeg", quality=40)
    await page.locator("#frame-c").screenshot(path="/tmp/iter82_case_c.jpeg", quality=40)
    await page.locator("#frame-d").screenshot(path="/tmp/iter82_case_d.jpeg", quality=40)

    c_ref = (state["tile_requests"].get("c_url_doc_sandbox") or {}).get("referer", "")
    c_conclusion = (
        "C has no Referer header; static URL/meta did not overcome sandbox opaque-origin behavior."
        if not c_ref
        else "C includes Referer header; static URL document changes request header behavior."
    )

    return {
        "ok": True,
        "preview_origin": preview_origin,
        "traffic_count": len(state["tile_requests"]),
        "tile_requests": state["tile_requests"],
        "tile_responses": state["tile_responses"],
        "image_stats": stats,
        "blocked_business_calls": state["blocked_business"],
        "conclusion": c_conclusion,
        "note": "Map-like thumbnail checks are heuristic (sampleUniqueColors + screenshots), not proof of full map renderer correctness.",
        "screenshots": [
            "/tmp/iter82_case_a.jpeg",
            "/tmp/iter82_case_b.jpeg",
            "/tmp/iter82_case_c.jpeg",
            "/tmp/iter82_case_d.jpeg",
        ],
    }
