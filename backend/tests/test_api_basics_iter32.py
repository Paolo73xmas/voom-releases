import os
import uuid

import pytest
import requests


# Core backend API smoke for root and status persistence
BASE_URL = os.environ.get("EXPO_BACKEND_URL")


@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def _base_url() -> str:
    if not BASE_URL:
        pytest.skip("EXPO_BACKEND_URL non impostata")
    return BASE_URL.rstrip("/")


def test_api_root_ok(api_client):
    url = f"{_base_url()}/api/"
    response = api_client.get(url, timeout=20)
    assert response.status_code == 200
    data = response.json()
    assert data.get("message") == "Hello World"


def test_status_create_and_get_persistence(api_client):
    marker = f"TEST_ITER32_{uuid.uuid4().hex[:8]}"
    create_response = api_client.post(
        f"{_base_url()}/api/status",
        json={"client_name": marker},
        timeout=20,
    )
    assert create_response.status_code == 200
    created = create_response.json()
    assert created.get("client_name") == marker
    assert isinstance(created.get("id"), str)

    get_response = api_client.get(f"{_base_url()}/api/status", timeout=20)
    assert get_response.status_code == 200
    rows = get_response.json()
    assert any(row.get("id") == created["id"] and row.get("client_name") == marker for row in rows)
