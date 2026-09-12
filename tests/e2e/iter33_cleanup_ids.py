import json
import re
from pathlib import Path

import requests


def read_env_value(env_path: Path, key: str) -> str:
    for line in env_path.read_text(encoding='utf-8').splitlines():
        if line.startswith(f'{key}='):
            return line.split('=', 1)[1].strip().strip('"')
    raise RuntimeError(f'Missing {key} in {env_path}')


def read_admin_credentials(path: Path) -> tuple[str, str]:
    text = path.read_text(encoding='utf-8')
    m = re.search(r"# Role: Admin\s*\nemail:\s*(.+)\npassword:\s*(.+)", text)
    if not m:
        raise RuntimeError('Admin credentials not found in test_credentials.md')
    return m.group(1).strip(), m.group(2).strip()


def auth(supabase_url: str, anon_key: str, email: str, password: str) -> str:
    res = requests.post(
        f"{supabase_url}/auth/v1/token?grant_type=password",
        headers={"apikey": anon_key, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    res.raise_for_status()
    return res.json()["access_token"]


def delete_by_id(supabase_url: str, anon_key: str, token: str, table: str, rid: str) -> int:
    res = requests.delete(
        f"{supabase_url}/rest/v1/{table}",
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {token}",
            "Prefer": "return=representation",
        },
        params={"id": f"eq.{rid}"},
        timeout=30,
    )
    return res.status_code


def cleanup_iter33_notes(supabase_url: str, anon_key: str, token: str) -> list[str]:
    q = requests.get(
        f"{supabase_url}/rest/v1/appointments",
        headers={"apikey": anon_key, "Authorization": f"Bearer {token}"},
        params={
            "select": "id,notes",
            "or": "(notes.ilike.*ITER33_CAL*,notes.ilike.*ITER33_CAL_PATCH*)",
            "limit": "30",
        },
        timeout=30,
    )
    q.raise_for_status()
    rows = q.json() or []
    deleted = []
    for row in rows:
        rid = row.get('id')
        if not rid:
            continue
        status = delete_by_id(supabase_url, anon_key, token, 'appointments', rid)
        if status in (200, 204):
            deleted.append(rid)
    return deleted


def main() -> None:
    env_path = Path('/app/frontend/.env')
    creds_path = Path('/app/memory/test_credentials.md')
    supabase_url = read_env_value(env_path, 'EXPO_PUBLIC_SUPABASE_URL')
    anon_key = read_env_value(env_path, 'EXPO_PUBLIC_SUPABASE_ANON_KEY')
    admin_email, admin_password = read_admin_credentials(creds_path)
    token = auth(supabase_url, anon_key, admin_email, admin_password)

    targets = [
        ("visits", "0f21dfe-a232-4616-a7fe-067f75901536"),
        ("appointments", "990546b0-5b61-4ffe-8fa9-6085945cffca"),
    ]

    deleted_targets = []
    for table, rid in targets:
        status = delete_by_id(supabase_url, anon_key, token, table, rid)
        deleted_targets.append({"table": table, "id": rid, "status": status})

    deleted_iter33 = cleanup_iter33_notes(supabase_url, anon_key, token)

    print(json.dumps({
        "deleted_targets": deleted_targets,
        "deleted_iter33_appointments": deleted_iter33,
        "not_deleted_customer_fixture_id": "b07dfae8-2dab-47a6-a410-9cba3554fcf5"
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
