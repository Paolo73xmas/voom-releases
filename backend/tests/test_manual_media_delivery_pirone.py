"""Media delivery tests for AI Tour Pirone guide: integrity, range, headers, and asset routing."""

import hashlib
from pathlib import Path

import pytest
import requests


# Module coverage: public /api/manual/aitour-guida-pirone/* media delivery behaviors.
VIDEO_PATH = Path("/app/manual/video/aitour-guida-pirone-2026.mp4")
SRT_PATH = Path("/app/manual/video/aitour-guida-pirone-2026.srt")
MD_PATH = Path("/app/manual/video/aitour-guida-pirone-2026.md")


def _read_base_url() -> str:
    env_path = Path("/app/frontend/.env")
    if not env_path.exists():
        raise RuntimeError("frontend/.env not found")
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            value = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            if value:
                return value
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL missing in frontend/.env")


BASE_URL = _read_base_url()
API = f"{BASE_URL}/api/manual/aitour-guida-pirone"
TIMEOUT = 180


@pytest.fixture(scope="module")
def api_session():
    session = requests.Session()
    return session


@pytest.fixture(scope="module")
def local_video_bytes() -> bytes:
    return VIDEO_PATH.read_bytes()


@pytest.fixture(scope="module")
def local_video_sha256(local_video_bytes: bytes) -> str:
    return hashlib.sha256(local_video_bytes).hexdigest()


def test_video_inline_get_200_and_sha256_match(api_session, local_video_sha256):
    response = api_session.get(f"{API}/video", timeout=TIMEOUT)
    assert response.status_code == 200
    assert response.headers.get("accept-ranges") == "bytes"
    assert response.headers.get("content-disposition", "").startswith("inline;")
    assert hashlib.sha256(response.content).hexdigest() == local_video_sha256


def test_video_download_get_200_and_sha256_match(api_session, local_video_sha256):
    response = api_session.get(f"{API}/video?download=true", timeout=TIMEOUT)
    assert response.status_code == 200
    assert response.headers.get("content-disposition", "").startswith("attachment;")
    assert hashlib.sha256(response.content).hexdigest() == local_video_sha256


def test_sottotitoli_and_copione_match_originals(api_session):
    srt_response = api_session.get(f"{API}/sottotitoli", timeout=TIMEOUT)
    md_response = api_session.get(f"{API}/copione", timeout=TIMEOUT)
    assert srt_response.status_code == 200
    assert md_response.status_code == 200
    assert srt_response.content == SRT_PATH.read_bytes()
    assert md_response.content == MD_PATH.read_bytes()


def test_unknown_asset_returns_404(api_session):
    response = api_session.get(f"{API}/asset-inesistente", timeout=TIMEOUT)
    assert response.status_code == 404


def test_head_video_200_empty_body_and_full_content_length(api_session):
    full_size = VIDEO_PATH.stat().st_size
    response = api_session.head(f"{API}/video", timeout=TIMEOUT)
    assert response.status_code == 200
    assert response.headers.get("content-length") == str(full_size)
    assert response.content == b""


def test_range_bytes_0_1_returns_206_and_exact_bytes(api_session, local_video_bytes):
    response = api_session.get(f"{API}/video", headers={"Range": "bytes=0-1"}, timeout=TIMEOUT)
    assert response.status_code == 206
    assert response.content == local_video_bytes[0:2]
    assert response.headers.get("content-length") == "2"


def test_range_intermediate_returns_206_and_exact_bytes(api_session, local_video_bytes):
    start, end = 1024, 4095
    response = api_session.get(
        f"{API}/video",
        headers={"Range": f"bytes={start}-{end}"},
        timeout=TIMEOUT,
    )
    assert response.status_code == 206
    assert response.content == local_video_bytes[start : end + 1]
    assert response.headers.get("content-length") == str(end - start + 1)


def test_range_open_ended_returns_206_from_start_to_eof(api_session, local_video_bytes):
    start = 2048
    response = api_session.get(f"{API}/video", headers={"Range": f"bytes={start}-"}, timeout=TIMEOUT)
    assert response.status_code == 206
    assert response.content == local_video_bytes[start:]
    assert response.headers.get("content-length") == str(len(local_video_bytes) - start)


def test_range_suffix_returns_206_last_bytes(api_session, local_video_bytes):
    suffix = 500
    response = api_session.get(f"{API}/video", headers={"Range": f"bytes=-{suffix}"}, timeout=TIMEOUT)
    assert response.status_code == 206
    assert response.content == local_video_bytes[-suffix:]
    assert response.headers.get("content-length") == str(suffix)


def test_range_beyond_eof_returns_416(api_session):
    response = api_session.get(f"{API}/video", headers={"Range": "bytes=999999999-"}, timeout=TIMEOUT)
    assert response.status_code == 416
    assert response.headers.get("content-range", "").startswith("bytes */")


def test_if_range_equal_etag_returns_206(api_session):
    head = api_session.head(f"{API}/video", timeout=TIMEOUT)
    assert head.status_code == 200
    etag = head.headers.get("etag")
    if not etag:
        pytest.skip("ETag non disponibile")
    response = api_session.get(
        f"{API}/video",
        headers={"Range": "bytes=0-9", "If-Range": etag},
        timeout=TIMEOUT,
    )
    assert response.status_code == 206
    assert response.headers.get("content-length") == "10"


def test_if_range_different_returns_200_full(api_session):
    response = api_session.get(
        f"{API}/video",
        headers={"Range": "bytes=0-9", "If-Range": '"invalid-etag-value"'},
        timeout=TIMEOUT,
    )
    assert response.status_code == 200
    assert response.headers.get("content-length") == str(VIDEO_PATH.stat().st_size)


def test_multi_range_request_is_ignored_and_returns_200(api_session):
    response = api_session.get(
        f"{API}/video",
        headers={"Range": "bytes=0-1,10-20"},
        timeout=TIMEOUT,
    )
    assert response.status_code == 200
    assert response.headers.get("content-length") == str(VIDEO_PATH.stat().st_size)
