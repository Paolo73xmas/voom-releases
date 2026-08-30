"""
Backend tests for the 'Dillo all'AI' feature:
- POST /api/ai-tour/parse-brief (4 user cases)
- POST /api/ai-tour/transcribe (multipart audio upload)

Uses the external EXPO_PUBLIC_BACKEND_URL from frontend/.env.
"""
import io
import os
import struct
import math
import wave

import pytest
import requests

# Read external URL (production preview) from frontend .env directly
BASE_URL = None
with open("/app/frontend/.env", "r", encoding="utf-8") as f:
    for line in f:
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            break

assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL missing"
API = f"{BASE_URL}/api"
TIMEOUT = 90  # LLM call may take time


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    return sess


# ---------- parse-brief ----------

REQUIRED_KEYS = {"dayType", "area", "segments", "targetCount", "compact", "splitDays", "mandatoryAll", "summary"}


def _post_parse(sess, text, projects=None, cities=None):
    payload = {"text": text, "projects": projects or [], "cities": cities or []}
    r = sess.post(f"{API}/ai-tour/parse-brief", json=payload, timeout=TIMEOUT)
    return r


def _assert_shape(data):
    assert isinstance(data, dict), f"expected dict, got {type(data)}"
    missing = REQUIRED_KEYS - set(data.keys())
    assert not missing, f"missing keys: {missing} in {data}"
    assert isinstance(data["area"], dict) and "kind" in data["area"] and "value" in data["area"]
    assert isinstance(data["segments"], list)


def _segment_types(data):
    return [str(s.get("type", "")) for s in data.get("segments", []) if isinstance(s, dict)]


def test_case1_voghera_frequent_overdue(s):
    """Caso1: Voghera + clients_frequent + clients_overdue, dayType=clienti"""
    text = ("Oggi ho bisogno di visitare i miei clienti che ordinano ogni mese "
            "nella zona di Voghera e fare un giro dei miei clienti che sono 30 "
            "giorni che non mi ordinano")
    r = _post_parse(s, text, projects=["DoctorVape"], cities=["Voghera", "Milano"])
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:400]}"
    data = r.json()
    _assert_shape(data)
    assert data["dayType"] == "clienti", f"dayType={data['dayType']}"
    assert data["area"]["kind"] == "city"
    assert "voghera" in str(data["area"]["value"] or "").lower()
    types = _segment_types(data)
    assert "clients_frequent" in types, f"segments={types}"
    assert "clients_overdue" in types, f"segments={types}"


def test_case2_doctorvape_split_2(s):
    """Caso2: project DoctorVape + mandatoryAll=true + splitDays=2"""
    text = ("fare il giro da tutti i miei clienti che sono DoctorVape e se non è "
            "possibile fare il giro tutto oggi, suddividimelo in due tappe su due giorni")
    r = _post_parse(s, text, projects=["DoctorVape"], cities=["Voghera", "Milano"])
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:400]}"
    data = r.json()
    _assert_shape(data)
    types = _segment_types(data)
    assert "project" in types, f"segments={types}"
    # project name should include DoctorVape
    proj = next((s2 for s2 in data["segments"] if s2.get("type") == "project"), None)
    assert proj and "doctorvape" in str(proj.get("name", "")).lower(), f"proj={proj}"
    assert data["mandatoryAll"] is True, f"mandatoryAll={data['mandatoryAll']}"
    assert data["splitDays"] == 2, f"splitDays={data['splitDays']}"


def test_case3_milano_orphans_25_compact(s):
    """Caso3: Milano + orphans count=25 + targetCount=25 + compact=true"""
    text = ("giro su Milano e recuperare 25 clienti che sono orfani, ma li voglio "
            "tutti vicino, accorpa in una zona singola")
    r = _post_parse(s, text, projects=["DoctorVape"], cities=["Voghera", "Milano"])
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:400]}"
    data = r.json()
    _assert_shape(data)
    assert data["area"]["kind"] == "city"
    assert "milano" in str(data["area"]["value"] or "").lower()
    types = _segment_types(data)
    assert "orphans" in types, f"segments={types}"
    orph = next((s2 for s2 in data["segments"] if s2.get("type") == "orphans"), None)
    assert orph and int(orph.get("count", 0)) == 25, f"orph={orph}"
    assert int(data.get("targetCount") or 0) == 25, f"targetCount={data.get('targetCount')}"
    assert data["compact"] is True, f"compact={data['compact']}"


def test_case4_lago_garda_top5_new_around(s):
    """Caso4: clients_top count=5, new_around, area kind=place (Lago di Garda)"""
    text = "5 migliori clienti del lago di Garda e clienti nuovi tutti lì intorno"
    r = _post_parse(s, text, projects=["DoctorVape"], cities=["Voghera", "Milano"])
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:400]}"
    data = r.json()
    _assert_shape(data)
    types = _segment_types(data)
    assert "clients_top" in types, f"segments={types}"
    top = next((s2 for s2 in data["segments"] if s2.get("type") == "clients_top"), None)
    assert top and int(top.get("count", 0)) == 5, f"top={top}"
    assert "new_around" in types, f"segments={types}"
    # Lago di Garda is not in cities/projects → should be resolved as "place"
    assert data["area"]["kind"] == "place", f"area={data['area']}"
    assert "garda" in str(data["area"]["value"] or "").lower()


def test_parse_brief_empty_text_400(s):
    r = s.post(f"{API}/ai-tour/parse-brief", json={"text": "", "projects": [], "cities": []}, timeout=TIMEOUT)
    assert r.status_code == 400, f"expected 400, got {r.status_code} body={r.text[:200]}"


# ---------- transcribe ----------

def _make_wav_bytes(duration_s=1.0, freq_hz=440, sr=16000):
    """Generate a short mono WAV tone in memory (Whisper accepts wav)."""
    buf = io.BytesIO()
    n = int(duration_s * sr)
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)  # 16-bit
        w.setframerate(sr)
        for i in range(n):
            sample = int(0.2 * 32767 * math.sin(2 * math.pi * freq_hz * i / sr))
            w.writeframes(struct.pack("<h", sample))
    return buf.getvalue()


def test_transcribe_accepts_wav_returns_text_key(s):
    """Endpoint deve rispondere 200 con {text: string}. Il testo può essere vuoto."""
    audio_bytes = _make_wav_bytes(duration_s=1.0)
    files = {"audio": ("voce.wav", audio_bytes, "audio/wav")}
    r = s.post(f"{API}/ai-tour/transcribe", files=files, timeout=TIMEOUT)
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:400]}"
    data = r.json()
    assert isinstance(data, dict) and "text" in data, f"data={data}"
    assert isinstance(data["text"], str)


def test_transcribe_empty_file_400(s):
    """Body vuoto → 400 Audio vuoto"""
    files = {"audio": ("empty.wav", b"", "audio/wav")}
    r = s.post(f"{API}/ai-tour/transcribe", files=files, timeout=TIMEOUT)
    assert r.status_code == 400, f"expected 400, got {r.status_code} body={r.text[:200]}"
