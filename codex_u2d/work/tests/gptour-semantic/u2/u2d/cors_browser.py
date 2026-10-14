#!/usr/bin/env python3
"""U2-d/2: CORS verified in a REAL browser (Chromium via Playwright), not with in-process fetch.
Two static origins (allowed / not allowed) serve the same page, which calls the lab handler (lab_serve.ts) with Authorization + JSON body
(→ browser preflight). Checks: preflight OPTIONS really sent; success (200) and error (401 expired JWT, 400 invalid_request) responses readable from the
allowed origin; blocked from the other origin (TypeError, no handler side effects beyond the refused preflight). Writes evidence/cors_browser_report.json."""
import http.server, json, os, secrets, socket, subprocess, sys, threading, time
from pathlib import Path
here = Path(__file__).resolve().parent; repo = here.parents[3]
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
API, OK_PORT, BAD_PORT = free_port(), free_port(), free_port()
ALLOWED = f'http://127.0.0.1:{OK_PORT}'; OTHER = f'http://127.0.0.1:{BAD_PORT}'; API_URL = f'http://127.0.0.1:{API}/gptour-semantic-v2'
PAGE = """<!doctype html><html><body><script>
window.__done = (async () => {
  const q = new URLSearchParams(location.search); const jwt = q.get('jwt'), exp = q.get('exp'), api = q.get('api'); const out = {};
  const call = async (name, token, body) => { try { const r = await fetch(api, { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body }); out[name] = { status: r.status, body: await r.json() }; } catch (e) { out[name] = { error: String(e) }; } };
  await call('capabilities', jwt, JSON.stringify({ operation: 'capabilities', contractVersion: 'semantic-1.2' }));
  await call('expired_jwt', exp, JSON.stringify({ operation: 'capabilities', contractVersion: 'semantic-1.2' }));
  await call('invalid_json', jwt, '{not json');
  return out; })();
</script></body></html>"""
class Page(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        b = PAGE.encode(); self.send_response(200); self.send_header('content-type', 'text/html'); self.send_header('content-length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def log_message(self, *a): pass
servers = [http.server.ThreadingHTTPServer(('127.0.0.1', p), Page) for p in (OK_PORT, BAD_PORT)]
for s in servers: threading.Thread(target=s.serve_forever, daemon=True).start()
secret = secrets.token_hex(16)  # synthetic, per run, never persisted
deno = subprocess.Popen([os.environ['U2_DENO_BIN'], 'run', '--no-config', '--no-lock', '--allow-env=LAB_PORT,LAB_ALLOWED_ORIGIN,LAB_SECRET,U2C_CONFIG', f'--allow-read={repo}', f'--allow-net=127.0.0.1:{API}', str(here / 'lab_serve.ts')],
                        env={**os.environ, 'LAB_PORT': str(API), 'LAB_ALLOWED_ORIGIN': ALLOWED, 'LAB_SECRET': secret}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, cwd=repo)
lines, jwt, jwt_exp = [], None, None
deadline = time.time() + 30
while time.time() < deadline:
    l = deno.stdout.readline()
    if not l: break
    lines.append(l.rstrip())
    if l.startswith('JWT '): jwt = l.split()[1]
    if l.startswith('JWT_EXPIRED '): jwt_exp = l.split()[1]
    if l.startswith('LISTENING'): break
if not jwt or not jwt_exp or deno.poll() is not None: print('\n'.join(lines)); raise SystemExit('lab server failed to start')
def pump():
    for l in deno.stdout: lines.append(l.rstrip())
threading.Thread(target=pump, daemon=True).start()
from playwright.sync_api import sync_playwright
results = {}
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('U2D_CHROME') or None, args=['--no-sandbox'])
    for name, origin in (('allowed', ALLOWED), ('other', OTHER)):
        page = browser.new_page(); page.goto(f'{origin}/?jwt={jwt}&exp={jwt_exp}&api={API_URL}')
        results[name] = page.evaluate('window.__done'); page.close()
    browser.close()
time.sleep(0.5); deno.terminate(); deno.wait(timeout=10)
for s in servers: s.shutdown()
reqs = [l for l in lines if l.startswith('REQ ')]
ok = results['allowed']; bad = results['other']
checks = {
 'preflight_sent_from_allowed_origin': any(l == f'REQ OPTIONS {ALLOWED} 204' for l in reqs),
 # NOTE: a browser never exposes Access-Control-Allow-Origin to page JS (not a CORS-safelisted response header): the proof is that status+body are READABLE (otherwise fetch rejects with TypeError).
 'allowed_capabilities_200_readable': ok.get('capabilities', {}).get('status') == 200 and ok['capabilities']['body'].get('operation') == 'capabilities',
 'allowed_error_401_readable': ok.get('expired_jwt', {}).get('status') == 401 and ok['expired_jwt']['body'].get('ingress') == 'unauthorized',
 'allowed_contract_error_400_readable': ok.get('invalid_json', {}).get('status') == 400 and ok['invalid_json']['body'].get('errorCode') == 'invalid_request',
 'allowed_posts_reached_handler_after_preflight': [l for l in reqs if ALLOWED in l][:4] == [f'REQ OPTIONS {ALLOWED} 204', f'REQ POST {ALLOWED} 200', f'REQ POST {ALLOWED} 401', f'REQ POST {ALLOWED} 400'],
 'other_origin_preflight_refused_403': any(l == f'REQ OPTIONS {OTHER} 403' for l in reqs),
 'other_origin_all_fetches_blocked_by_browser': all('error' in v for v in bad.values()) and len(bad) == 3,
 'other_origin_no_post_reached_handler': not any(l.startswith(f'REQ POST {OTHER}') for l in reqs),
}
report = {'generated_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'browser': 'chromium (playwright)', 'allowed_origin': ALLOWED, 'other_origin': OTHER, 'api': API_URL,
          'results': results, 'handler_requests': reqs, 'checks': checks, 'pass': all(checks.values()), 'note': 'JWT/secret synthetic per run; memory store; LLM/planner MOCKED; no remote access'}
(here / 'evidence').mkdir(exist_ok=True); (here / 'evidence' / 'cors_browser_report.json').write_text(json.dumps(report, indent=1))
for k, v in checks.items(): print(f"{'PASS' if v else 'FAIL'} cors-browser: {k}")
print(f"U2D CORS-BROWSER DONE checks={len(checks)} pass={sum(checks.values())} fail={len(checks) - sum(checks.values())}")
raise SystemExit(0 if report['pass'] else 1)
