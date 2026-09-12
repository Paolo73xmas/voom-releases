import json
from datetime import datetime, timedelta, timezone

import requests

SUPABASE_URL = "https://gorwxfzzyzxmxnizmebw.supabase.co"
ANON_KEY = "sb_publishable_b2wS1IQmu3flvQjeJm7I9w_cMI2fKQI"
EMAIL = "gdeintinis@gmail.com"
PASSWORD = "GabrieleDeIntinis123!"


def main():
    auth = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        json={"email": EMAIL, "password": PASSWORD},
        timeout=30,
    )
    auth.raise_for_status()
    token = auth.json()["access_token"]
    user_id = auth.json().get("user", {}).get("id")

    since = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    params = {
        "select": "id,quick_customer_name,notes,appointment_date",
        "agent_id": f"eq.{user_id}",
        "appointment_date": f"gte.{since}",
        "or": "(quick_customer_name.ilike.*ITER32*,notes.ilike.*ITER32*)",
    }
    rows = requests.get(
        f"{SUPABASE_URL}/rest/v1/appointments",
        headers={"apikey": ANON_KEY, "Authorization": f"Bearer {token}"},
        params=params,
        timeout=30,
    )
    rows.raise_for_status()
    data = rows.json()

    deleted = []
    for row in data:
        rid = row["id"]
        res = requests.delete(
            f"{SUPABASE_URL}/rest/v1/appointments",
            headers={"apikey": ANON_KEY, "Authorization": f"Bearer {token}"},
            params={"id": f"eq.{rid}"},
            timeout=30,
        )
        if res.status_code in (200, 204):
            deleted.append(rid)

    print(json.dumps({"matched": [r["id"] for r in data], "deleted": deleted}, ensure_ascii=False))


if __name__ == "__main__":
    main()
