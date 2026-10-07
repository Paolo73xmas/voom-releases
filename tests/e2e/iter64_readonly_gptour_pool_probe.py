"""Readonly GPTour pool probe (real Supabase, no writes).

Collects sanitized aggregate metrics only:
- target admin auth status
- target profile/settings lookup
- ai_tour_free_tabaccherie page metrics (0-999,1000-1999,2000-2499)
- aggregate Bacoli/Monte + free/never counts
- estimated candidate total (base customers + effective free rows)
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

import requests


ROOT = Path('/app')
FRONTEND_ENV = ROOT / 'frontend' / '.env'
CREDS_FILE = ROOT / 'memory' / 'test_credentials.md'
OUT_DIR = ROOT / 'test_reports' / 'artifacts_iter64'
OUT_JSON = OUT_DIR / 'iter64_real_pool_probe.json'


def parse_env(path: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def parse_admin_credentials(path: Path) -> Tuple[str, str]:
    text = path.read_text(encoding='utf-8')
    m = re.search(r"# Role: Admin\s*email:\s*(.+)\s*password:\s*(.+)", text)
    if not m:
        raise RuntimeError('Admin credentials not found in memory/test_credentials.md')
    return m.group(1).strip(), m.group(2).strip()


def extract_zone_points(coords: Any) -> List[Tuple[float, float]]:
    points: List[Tuple[float, float]] = []
    def walk(node: Any) -> None:
        if isinstance(node, list):
            if len(node) >= 2 and all(isinstance(x, (int, float)) for x in node[:2]):
                lng, lat = float(node[0]), float(node[1])
                points.append((lat, lng))
                return
            for child in node:
                walk(child)

    walk(coords)
    return points


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    env = parse_env(FRONTEND_ENV)
    supabase_url = env.get('EXPO_PUBLIC_SUPABASE_URL')
    anon_key = env.get('EXPO_PUBLIC_SUPABASE_ANON_KEY')
    if not supabase_url or not anon_key:
        raise RuntimeError('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY')

    admin_email, admin_password = parse_admin_credentials(CREDS_FILE)

    session = requests.Session()
    session.headers.update({
        'apikey': anon_key,
        'content-type': 'application/json',
    })

    auth_resp = session.post(
        f"{supabase_url}/auth/v1/token?grant_type=password",
        json={'email': admin_email, 'password': admin_password},
        timeout=30,
    )
    auth_ok = auth_resp.status_code == 200
    if not auth_ok:
        result = {
            'auth_ok': False,
            'auth_status': auth_resp.status_code,
            'auth_error': auth_resp.text[:500],
        }
        OUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f"Wrote {OUT_JSON}")
        return 1

    token = auth_resp.json().get('access_token')
    if not token:
        raise RuntimeError('Auth succeeded but access_token missing')
    session.headers.update({'authorization': f'Bearer {token}'})

    profiles_resp = session.get(
        f"{supabase_url}/rest/v1/profiles",
        params={'select': 'id,full_name,role,agent_id', 'full_name': 'eq.DELLA VOLPE VINCENZO', 'limit': '1'},
        timeout=30,
    )
    profiles_resp.raise_for_status()
    profiles = profiles_resp.json() or []
    if not profiles:
        raise RuntimeError('Target profile DELLA VOLPE VINCENZO not found')
    target_profile = profiles[0]
    target_agent_id = target_profile.get('id')
    if not target_agent_id:
        raise RuntimeError('Target profile id missing')

    settings_resp = session.get(
        f"{supabase_url}/rest/v1/ai_tour_settings",
        params={'select': '*', 'agent_id': f'eq.{target_agent_id}', 'limit': '1'},
        timeout=30,
    )
    settings_resp.raise_for_status()
    settings_rows = settings_resp.json() or []
    settings = settings_rows[0] if settings_rows else {}

    # Base customer rows (same core filters used by loadCandidates)
    customer_rows: List[Dict[str, Any]] = []
    offset = 0
    while True:
        params = {
            'select': 'id,category,city,province,latitude,longitude,tabaccheria_id,disabled',
            'agent_id': f'eq.{target_agent_id}',
            'disabled': 'eq.false',
            'latitude': 'not.is.null',
            'longitude': 'not.is.null',
            'order': 'id',
            'offset': str(offset),
            'limit': '500',
        }
        resp = session.get(f"{supabase_url}/rest/v1/customers", params=params, timeout=30)
        resp.raise_for_status()
        rows = resp.json() or []
        customer_rows.extend(rows)
        if len(rows) < 500:
            break
        offset += 500

    # Zone points (same preference as app: zones first if present)
    zone_fetch_error = None
    zones: List[Dict[str, Any]] = []
    zones_resp = session.get(
        f"{supabase_url}/rest/v1/agent_zones",
        params={'select': 'id,agent_id,zone_name,coordinates'},
        timeout=30,
    )
    if zones_resp.status_code < 400:
        all_zones = zones_resp.json() or []
        zones = [z for z in all_zones if z.get('agent_id') == target_agent_id]
    else:
        zone_fetch_error = {
            'status': zones_resp.status_code,
            'body': zones_resp.text[:400],
        }

    points: List[Tuple[float, float]] = []
    if zones:
        for z in zones:
            points.extend(extract_zone_points(z.get('coordinates')))
    else:
        for r in customer_rows:
            lat = r.get('latitude')
            lng = r.get('longitude')
            if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
                points.append((float(lat), float(lng)))

    if not points:
        home_lat = settings.get('home_lat')
        home_lng = settings.get('home_lng')
        if isinstance(home_lat, (int, float)) and isinstance(home_lng, (int, float)):
            points.append((float(home_lat), float(home_lng)))
        else:
            raise RuntimeError('No geo points available to compute bounds for readonly probe')

    min_lat = min(p[0] for p in points) - 0.1
    max_lat = max(p[0] for p in points) + 0.1
    min_lng = min(p[1] for p in points) - 0.1
    max_lng = max(p[1] for p in points) + 0.1

    no_interest_resp = session.post(f"{supabase_url}/rest/v1/rpc/ai_tour_no_interest_ids", json={}, timeout=30)
    no_interest_resp.raise_for_status()
    no_interest_rows = no_interest_resp.json() or []
    no_interest_tabs = {r.get('tabaccheria_id') for r in no_interest_rows if r.get('tabaccheria_id')}

    exclude_tab_ids = {r.get('tabaccheria_id') for r in customer_rows if r.get('tabaccheria_id')}
    exclude_tab_ids.discard(None)

    page_metrics: List[Dict[str, Any]] = []
    free_rows_all: List[Dict[str, Any]] = []
    rpc_error = None

    limit_total = 2500
    page_size = 1000
    for start in range(0, limit_total, page_size):
        size = min(page_size, limit_total - start)
        params = {'offset': str(start), 'limit': str(size)}
        payload = {
            'p_min_lat': min_lat,
            'p_max_lat': max_lat,
            'p_min_lng': min_lng,
            'p_max_lng': max_lng,
            'p_limit': limit_total,
            'p_provincia': None,
            'p_comune': None,
            'p_ref_lat': None,
            'p_ref_lng': None,
            'p_agent_id': target_agent_id,
        }
        resp = session.post(f"{supabase_url}/rest/v1/rpc/ai_tour_free_tabaccherie", params=params, json=payload, timeout=60)
        if resp.status_code >= 400:
            rpc_error = {'status': resp.status_code, 'body': resp.text[:500], 'start': start, 'size': size}
            break
        rows = resp.json() or []
        free_rows_all.extend(rows)
        page_metrics.append({
            'range': [start, start + size - 1],
            'rows': len(rows),
            'bacoli': sum(1 for r in rows if (r.get('comune') or '').strip().lower() == 'bacoli'),
            'monte_di_procida': sum(1 for r in rows if (r.get('comune') or '').strip().lower() == 'monte di procida'),
            'free': sum(1 for r in rows if not bool(r.get('assigned'))),
            'never': sum(1 for r in rows if bool(r.get('assigned'))),
        })
        if len(rows) < size:
            break

    effective_free_rows = [
        r for r in free_rows_all
        if r.get('id') not in exclude_tab_ids and r.get('id') not in no_interest_tabs
    ]

    aggregate = {
        'raw_total_rows': len(free_rows_all),
        'effective_total_rows': len(effective_free_rows),
        'raw_bacoli': sum(1 for r in free_rows_all if (r.get('comune') or '').strip().lower() == 'bacoli'),
        'effective_bacoli': sum(1 for r in effective_free_rows if (r.get('comune') or '').strip().lower() == 'bacoli'),
        'raw_monte_di_procida': sum(1 for r in free_rows_all if (r.get('comune') or '').strip().lower() == 'monte di procida'),
        'effective_monte_di_procida': sum(1 for r in effective_free_rows if (r.get('comune') or '').strip().lower() == 'monte di procida'),
        'effective_free': sum(1 for r in effective_free_rows if not bool(r.get('assigned'))),
        'effective_never': sum(1 for r in effective_free_rows if bool(r.get('assigned'))),
    }

    base_count = len(customer_rows)
    estimated_candidate_total = base_count + len(effective_free_rows)

    result = {
        'auth_ok': True,
        'target_profile': {
            'id': target_profile.get('id'),
            'full_name': target_profile.get('full_name'),
            'role': target_profile.get('role'),
            'agent_id': target_profile.get('agent_id'),
        },
        'settings_found': bool(settings_rows),
        'settings_summary': {
            'work_start': settings.get('work_start'),
            'work_end': settings.get('work_end'),
            'home_lat': settings.get('home_lat'),
            'home_lng': settings.get('home_lng'),
        },
        'bounds_used': {
            'min_lat': round(min_lat, 6),
            'max_lat': round(max_lat, 6),
            'min_lng': round(min_lng, 6),
            'max_lng': round(max_lng, 6),
            'points_source': 'agent_zones' if zones else 'customers',
            'points_count': len(points),
            'zones_for_agent': len(zones),
        },
        'zone_fetch_error': zone_fetch_error,
        'pagination_pages': page_metrics,
        'rpc_error': rpc_error,
        'aggregate': aggregate,
        'base_customers_count': base_count,
        'excluded_tabaccherie_count': len(exclude_tab_ids),
        'no_interest_tabaccherie_count': len(no_interest_tabs),
        'estimated_candidate_total': estimated_candidate_total,
    }

    OUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Wrote {OUT_JSON}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
