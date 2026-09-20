"""Backend tests for AI Tour Fase 3-4 additions:
- POST /api/ai-tour/parse-brief now accepts optional previousJson + schemaErrors
- POST /api/ai-tour/transcribe now accepts a 'prompt' form field (Whisper vocab, max 900 chars)

These tests verify the contract does not break: schema validation must not reject
requests with (or without) the new fields. They use the external EXPO_PUBLIC_BACKEND_URL.
No real audio is needed for transcribe validation checks (we only verify no 422).
"""
import io
import os

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to the frontend/.env value if the env var is not exported in shell
    try:
        with open("/app/frontend/.env", "r") as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break
    except Exception:
        pass

pytestmark = pytest.mark.skipif(not BASE_URL, reason="EXPO_PUBLIC_BACKEND_URL not set")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    return s


# ----- /api/ai-tour/parse-brief -----

def test_parse_brief_rejects_empty_text(api):
    """Empty text must still return 400 (contract preserved)."""
    r = api.post(f"{BASE_URL}/api/ai-tour/parse-brief", json={
        "text": "",
        "projects": [],
        "cities": [],
        "today": "2026-01-15",
    }, timeout=30)
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text[:200]}"


def test_parse_brief_accepts_without_new_fields(api):
    """Backward-compat: legacy payload without previousJson/schemaErrors must not 422."""
    r = api.post(f"{BASE_URL}/api/ai-tour/parse-brief", json={
        "capabilities": ["tourbrief_v4"],
        "text": "domani 10 clienti FED a Pavia",
        "projects": ["FED", "DoctorVape"],
        "cities": ["Pavia", "Voghera"],
        "today": "2026-01-15",
    }, timeout=100)
    # Must not be a validation error. It may be 200 (AI ok) or a 5xx if the AI backend is slow.
    assert r.status_code != 422, f"Validation regression: {r.status_code} {r.text[:200]}"


def test_parse_brief_accepts_previousjson_and_schemaerrors(api):
    """New optional fields (Fase 3) accepted without 422."""
    payload = {
        "capabilities": ["tourbrief_v4"],
        "text": "domani 10 clienti FED a Pavia",
        "projects": ["FED"],
        "cities": ["Pavia"],
        "today": "2026-01-15",
        "previousJson": "{\"anchor\":{},\"selection\":{}}",
        "schemaErrors": [
            "selection.target.count deve essere >= 1",
            "route.returnHome deve essere booleano",
        ],
    }
    r = api.post(f"{BASE_URL}/api/ai-tour/parse-brief", json=payload, timeout=100)
    assert r.status_code != 422, f"Validation regression on new fields: {r.status_code} {r.text[:200]}"


def test_parse_brief_accepts_empty_new_fields(api):
    """Explicit empty new fields must also be accepted."""
    r = api.post(f"{BASE_URL}/api/ai-tour/parse-brief", json={
        "capabilities": ["tourbrief_v4"],
        "text": "oggi 5 clienti FED",
        "projects": ["FED"],
        "cities": [],
        "today": "2026-01-15",
        "previousJson": "",
        "schemaErrors": [],
    }, timeout=100)
    assert r.status_code != 422, f"Validation regression: {r.status_code} {r.text[:200]}"


# ----- /api/ai-tour/transcribe -----

def _fake_audio() -> bytes:
    # Minimal 4-byte payload, not a valid audio: we only verify that the endpoint
    # does NOT reject the 'prompt' form field at validation time.
    return b"\x00\x00\x00\x00"


def test_transcribe_accepts_without_prompt(api):
    files = {"audio": ("test.m4a", io.BytesIO(_fake_audio()), "audio/m4a")}
    r = api.post(f"{BASE_URL}/api/ai-tour/transcribe", files=files, timeout=30)
    # 422 would mean the multipart contract broke; anything else (400/500) is acceptable here
    assert r.status_code != 422, f"Validation regression: {r.status_code} {r.text[:200]}"


def test_transcribe_accepts_prompt_form_field(api):
    files = {"audio": ("test.m4a", io.BytesIO(_fake_audio()), "audio/m4a")}
    data = {"prompt": "FED, DoctorVape, Pavia, Voghera, Rossi, Bianchi"}
    r = api.post(f"{BASE_URL}/api/ai-tour/transcribe", files=files, data=data, timeout=30)
    assert r.status_code != 422, f"prompt field regression: {r.status_code} {r.text[:200]}"


def test_transcribe_accepts_long_prompt_up_to_900(api):
    """Long prompts must be accepted (server truncates to 900 chars internally)."""
    files = {"audio": ("test.m4a", io.BytesIO(_fake_audio()), "audio/m4a")}
    data = {"prompt": "x" * 1500}
    r = api.post(f"{BASE_URL}/api/ai-tour/transcribe", files=files, data=data, timeout=30)
    assert r.status_code != 422, f"Long prompt regression: {r.status_code} {r.text[:200]}"
