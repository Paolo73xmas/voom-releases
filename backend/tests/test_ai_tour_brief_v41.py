"""AI Tour backend tests: parse-brief v4.1 integration + unit contract/error regressions."""

import json
from pathlib import Path
import sys

import pytest
import requests
from fastapi.testclient import TestClient

sys.path.append('/app/backend')
import server as backend_server


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
TIMEOUT = 100


@pytest.fixture(scope='module')
def api_session():
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    return s


@pytest.fixture()
def unit_client(monkeypatch):
    monkeypatch.setattr(backend_server, 'EMERGENT_LLM_KEY', 'test-key')
    return TestClient(backend_server.app)


# Parse-brief real endpoint (limited calls, no write operations)
def test_api_root_200(api_session):
    r = api_session.get(f"{API}/", timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json().get('message') == 'Hello World'


def test_parse_brief_contract_v41_success(api_session):
    payload = {
        'text': 'Parto da via Roma Milano e finisco in corso Torino Pavia con clienti in mezzo',
        'projects': ['DoctorVape'],
        'cities': ['Milano', 'Pavia'],
        'today': '2026-01-10',
        'capabilities': ['ordered_journey_v1'],
    }
    r = api_session.post(f"{API}/ai-tour/parse-brief", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:400]}"
    data = r.json()
    assert data.get('contractVersion') == '4.1'
    assert 'ordered_journey_v1' in data.get('capabilities', [])
    assert isinstance(data.get('brief'), dict)
    assert 'journey' in data['brief']


def test_parse_brief_preserves_lozano_not_rozzano(api_session):
    payload = {
        'text': 'clienti area sud di Milano poi Lozano poi Pavia',
        'projects': ['DoctorVape'],
        'cities': ['Milano', 'Pavia'],
        'today': '2026-01-10',
        'capabilities': ['ordered_journey_v1'],
    }
    r = api_session.post(f"{API}/ai-tour/parse-brief", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:500]}"
    stages = (
        r.json().get('brief', {})
        .get('journey', {})
        .get('stages', [])
    )
    names = [str(s.get('name', '')) for s in stages if isinstance(s, dict)]
    low = [n.lower() for n in names]
    assert any('lozano' in n for n in low), f"stages={names}"
    assert all('rozzano' not in n for n in low), f"stages={names}"


def test_parse_brief_empty_text_400(api_session):
    r = api_session.post(
        f"{API}/ai-tour/parse-brief",
        json={'text': '', 'projects': [], 'cities': [], 'today': '2026-01-10', 'capabilities': ['ordered_journey_v1']},
        timeout=TIMEOUT,
    )
    assert r.status_code == 400


# Unit regressions with fake LLM (no external AI calls)
class _FakeChat:
    def __init__(self, *args, **kwargs):
        self.reply = kwargs.pop('_reply', None)

    def with_model(self, *_args, **_kwargs):
        return self

    def with_params(self, **_kwargs):
        return self

    async def send_message(self, _msg):
        return self.reply or '{}'


def test_parse_brief_old_client_missing_capability_409(unit_client, monkeypatch):
    fake = _FakeChat()
    fake.reply = json.dumps(
        {
            'version': '4.0',
            'dayType': 'clienti',
            'requestedDate': {'type': 'today', 'value': None},
            'areas': [],
            'selection': {'operator': 'AND', 'conditions': [{'type': 'clients_all'}]},
            'mandatoryStops': [{'rawReference': 'Rossi', 'cityHint': None, 'appointment': None, 'priority': 2}],
            'preferredStops': [],
            'exclusions': [],
            'preferences': [],
            'projectRules': [],
            'fillers': [],
            'visitTarget': {'mode': 'unspecified', 'value': None, 'min': None, 'max': None, 'scope': 'total_including_mandatory'},
            'route': {
                'compact': 'off',
                'startTime': None,
                'endTime': None,
                'finishBy': None,
                'returnHome': False,
                'returnToStart': False,
                'splitAllowed': None,
                'maxDays': None,
                'startPlace': {'kind': 'home', 'rawReference': 'Casa', 'cityHint': None},
                'endPlace': None,
            },
            'interpretation': {'confidence': 0.9, 'needsConfirmation': False, 'unresolvedEntities': [], 'warnings': []},
            'summary': 'test',
            'includeAutomatic': False,
            'journey': None,
        }
    )

    monkeypatch.setattr(backend_server, 'LlmChat', lambda *a, **k: fake)
    r = unit_client.post('/api/ai-tour/parse-brief', json={'text': 'test', 'projects': [], 'cities': [], 'today': '2026-01-10', 'capabilities': []})
    assert r.status_code == 409


def test_parse_brief_malformed_or_truncated_json_502(unit_client, monkeypatch):
    fake = _FakeChat()
    fake.reply = '{"version": "4.0"'  # truncated JSON
    monkeypatch.setattr(backend_server, 'LlmChat', lambda *a, **k: fake)
    r = unit_client.post('/api/ai-tour/parse-brief', json={'text': 'test', 'projects': [], 'cities': [], 'today': '2026-01-10', 'capabilities': ['ordered_journey_v1']})
    assert r.status_code == 502
