"""Read-only backend audit tests for public /api endpoints (iteration 48)."""

from pathlib import Path
import os

import pytest
import requests


# Module: environment + shared HTTP session
def _base_url() -> str:
    env_val = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").strip().rstrip("/")
    if env_val:
        return env_val

    env_path = Path("/app/frontend/.env")
    if not env_path.exists():
        pytest.skip("frontend/.env non trovato")

    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            value = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            if value:
                return value

    pytest.skip("EXPO_PUBLIC_BACKEND_URL non configurata")


BASE = _base_url()
API = f"{BASE}/api"
TIMEOUT = 120


@pytest.fixture(scope="module")
def api_session():
    s = requests.Session()
    return s


# Module: health/manual/video endpoints (read-only)
def test_root_get_ok(api_session):
    r = api_session.get(f"{API}/", timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json().get("message") == "Hello World"


def test_status_get_ok(api_session):
    r = api_session.get(f"{API}/status", timeout=TIMEOUT)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_pirone_manual_video_head_supported(api_session):
    r = api_session.head(f"{API}/manual/aitour-guida-pirone/video", timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.headers.get("accept-ranges") == "bytes"


def test_video_tutorial_suffix_range_last_two_bytes(api_session):
    # Repro check requested: bytes=-2 must return last 2 bytes, not first 2.
    full = api_session.get(f"{API}/video-tutorial/1", timeout=TIMEOUT)
    assert full.status_code == 200
    full_bytes = full.content
    assert len(full_bytes) > 2

    suffix = api_session.get(
        f"{API}/video-tutorial/1",
        headers={"Range": "bytes=-2"},
        timeout=TIMEOUT,
    )
    assert suffix.status_code == 206
    assert suffix.content == full_bytes[-2:]


# Module: AI brief + transcribe endpoints (read-only)
def test_parse_brief_empty_400(api_session):
    payload = {
        "text": "",
        "projects": ["DoctorVape"],
        "cities": ["Roma"],
        "today": "2026-01-10",
        "capabilities": ["ordered_journey_v1"],
    }
    r = api_session.post(f"{API}/ai-tour/parse-brief", json=payload, timeout=TIMEOUT)
    assert r.status_code == 400


def test_parse_brief_valid_request_1(api_session):
    payload = {
        "text": "Domani clienti a Roma sud, rientro per le 18.",
        "projects": ["DoctorVape", "FED"],
        "cities": ["Roma", "Fiumicino"],
        "today": "2026-01-10",
        "capabilities": ["ordered_journey_v1"],
    }
    r = api_session.post(f"{API}/ai-tour/parse-brief", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200
    body = r.json()
    assert body.get("contractVersion") == "4.1"
    assert isinstance(body.get("brief"), dict)


def test_parse_brief_valid_request_2(api_session):
    payload = {
        "text": "Parto da casa, visita Rossi a Milano e Bianchi a Pavia, poi torno a casa.",
        "projects": ["DoctorVape"],
        "cities": ["Milano", "Pavia"],
        "today": "2026-01-10",
        "capabilities": ["ordered_journey_v1"],
    }
    r = api_session.post(f"{API}/ai-tour/parse-brief", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200
    body = r.json()
    assert body.get("contractVersion") == "4.1"
    assert isinstance(body.get("brief", {}).get("summary", ""), str)


def test_transcribe_valid_italian_audio_sample(api_session):
    # Local sample audio file (Italian), read-only upload for API verification.
    sample = Path("/app/manual/video/sample_diego.mp3")
    if not sample.exists():
        pytest.skip("sample_diego.mp3 non disponibile")

    with sample.open("rb") as fh:
        r = api_session.post(
            f"{API}/ai-tour/transcribe",
            files={"audio": ("sample_diego.mp3", fh, "audio/mpeg")},
            timeout=TIMEOUT,
        )

    assert r.status_code == 200, f"status={r.status_code} body={r.text[:300]}"
    text = r.json().get("text", "")
    assert isinstance(text, str)
    assert len(text.strip()) > 0
