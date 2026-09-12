"""Backend audit tests for public API health, manuals/video delivery, and AI Tour parsing."""

from pathlib import Path
import os
import tempfile

import pytest
import requests


def _read_base_url() -> str:
    env_path = Path('/app/frontend/.env')
    if not env_path.exists():
        raise RuntimeError('frontend/.env not found')
    base = ''
    for line in env_path.read_text(encoding='utf-8').splitlines():
        if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
            base = line.split('=', 1)[1].strip().strip('"').rstrip('/')
            break
    if not base:
        raise RuntimeError('EXPO_PUBLIC_BACKEND_URL missing in frontend/.env')
    return base


BASE_URL = _read_base_url()
API = f"{BASE_URL}/api"
TIMEOUT = 90


@pytest.fixture(scope='module')
def api_session():
    """Shared HTTP session for backend public endpoints."""
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    return s


# module: health and status endpoints
def test_api_root_ok(api_session):
    r = api_session.get(f"{API}/", timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json().get('message') == 'Hello World'


def test_api_status_list_ok(api_session):
    r = api_session.get(f"{API}/status", timeout=TIMEOUT)
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)


# module: manual and video streaming endpoints
def test_manual_pdf_endpoint_ok(api_session):
    r = api_session.get(f"{API}/manual", timeout=TIMEOUT)
    assert r.status_code == 200
    assert 'application/pdf' in r.headers.get('content-type', '')


def test_manual_aitour_pdf_endpoint_ok(api_session):
    r = api_session.get(f"{API}/manual-aitour", timeout=TIMEOUT)
    assert r.status_code == 200
    assert 'application/pdf' in r.headers.get('content-type', '')


def test_video_head_valid_ok(api_session):
    r = api_session.head(f"{API}/video-tutorial/1", timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.headers.get('accept-ranges') == 'bytes'


def test_video_get_with_range_valid_ok(api_session):
    r = api_session.get(
        f"{API}/video-tutorial/1",
        headers={'Range': 'bytes=0-1023'},
        timeout=TIMEOUT,
    )
    assert r.status_code == 206
    assert r.headers.get('accept-ranges') == 'bytes'
    assert r.headers.get('content-range', '').startswith('bytes 0-')
    assert len(r.content) > 0


def test_video_get_with_invalid_range_416(api_session):
    r = api_session.get(
        f"{API}/video-tutorial/1",
        headers={'Range': 'bytes=9999999999-99999999999'},
        timeout=TIMEOUT,
    )
    assert r.status_code == 416


def test_video_invalid_id_404(api_session):
    r = api_session.get(f"{API}/video-tutorial/9999", timeout=TIMEOUT)
    assert r.status_code == 404


# module: AI Tour parse and transcribe endpoints
def test_parse_brief_empty_text_400(api_session):
    payload = {
        'text': '',
        'projects': ['DoctorVape'],
        'cities': ['Roma'],
        'today': '2026-01-10',
        'capabilities': ['ordered_journey_v1'],
    }
    r = api_session.post(f"{API}/ai-tour/parse-brief", json=payload, timeout=TIMEOUT)
    assert r.status_code == 400


def test_parse_brief_real_text_ok(api_session):
    payload = {
        'text': 'Domani visita clienti a Roma, priorità ai prospect vicino al centro e rientro per le 18',
        'projects': ['DoctorVape', 'FED'],
        'cities': ['Roma', 'Fiumicino'],
        'today': '2026-01-10',
        'capabilities': ['ordered_journey_v1'],
    }
    r = api_session.post(f"{API}/ai-tour/parse-brief", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:500]}"
    data = r.json()
    assert data.get('contractVersion') == '4.1'
    assert isinstance(data.get('brief'), dict)
    assert isinstance(data['brief'].get('summary', ''), str)


def test_transcribe_with_synthetic_audio_if_sample_available(api_session):
    # Try known sample names; skip test if not available in this environment.
    candidate_names = ['demo', 'test', 'aitour', 'sample']
    sample_bytes = None
    sample_name = None
    for name in candidate_names:
        r = api_session.get(f"{API}/voice-sample/{name}", timeout=TIMEOUT)
        if r.status_code == 200 and len(r.content) > 0:
            sample_bytes = r.content
            sample_name = name
            break

    if not sample_bytes:
        pytest.skip('No synthetic voice sample available in this environment')

    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp:
        tmp.write(sample_bytes)
        tmp_path = tmp.name

    try:
        with open(tmp_path, 'rb') as fh:
            r = api_session.post(
                f"{API}/ai-tour/transcribe",
                files={'audio': (f'{sample_name}.mp3', fh, 'audio/mpeg')},
                timeout=TIMEOUT,
            )
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:300]}"
        text = r.json().get('text', '')
        assert isinstance(text, str)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
