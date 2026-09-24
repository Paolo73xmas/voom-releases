"""Bonifica autorizzata dall'utente: chiude i follow-up rimasti "scheduled" quando esiste
già una visita o un'ispezione dello stesso agente sullo stesso cliente in quel giorno o dopo.
Stessa regola del fix applicativo (closeDueFollowUps: confine = fine giornata della visita).
Uso: python3 scripts/close_stale_followups.py            -> solo elenco (dry run)
     python3 scripts/close_stale_followups.py --apply    -> applica la chiusura
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ENV = open('/app/frontend/.env').read()
URL = re.search(r'EXPO_PUBLIC_SUPABASE_URL=(\S+)', ENV).group(1)
ANON = re.search(r'EXPO_PUBLIC_SUPABASE_ANON_KEY=(\S+)', ENV).group(1)
APPLY = '--apply' in sys.argv


def login(email: str, password: str) -> str:
    req = urllib.request.Request(
        f"{URL}/auth/v1/token?grant_type=password",
        data=json.dumps({"email": email, "password": password}).encode(),
        headers={'apikey': ANON, 'Content-Type': 'application/json'},
    )
    return json.load(urllib.request.urlopen(req))['access_token']


def rest(token: str, path: str, method: str = 'GET', body=None, prefer=None):
    headers = {'apikey': ANON, 'Authorization': f'Bearer {token}'}
    data = None
    if body is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(body).encode()
    if prefer:
        headers['Prefer'] = prefer
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", headers=headers, data=data, method=method)
    with urllib.request.urlopen(req) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else []


def day(iso: str) -> str:
    return iso[:10]


def main() -> None:
    token = login('admin1@voomweb.it', 'Test123!')
    now = datetime.now(timezone.utc).isoformat()
    pending = rest(token, 'appointments?' + urllib.parse.urlencode({
        'select': 'id,customer_id,agent_id,appointment_date,notes',
        'appointment_type': 'eq.follow_up',
        'status': 'eq.scheduled',
        'appointment_date': f'lte.{now}',
        'customer_id': 'not.is.null',
        'order': 'appointment_date.desc',
        'limit': '2000',
    }))
    print(f"Follow-up scaduti ancora 'scheduled': {len(pending)}")

    to_close = []
    for appt in pending:
        d = day(appt['appointment_date'])
        params = {'select': 'id', 'customer_id': f"eq.{appt['customer_id']}", 'agent_id': f"eq.{appt['agent_id']}", 'limit': '1'}
        visits = rest(token, 'visits?' + urllib.parse.urlencode({**params, 'visit_date': f'gte.{d}T00:00:00Z'}))
        insp = rest(token, 'inspections?' + urllib.parse.urlencode({**params, 'inspection_date': f'gte.{d}T00:00:00Z'}))
        if visits or insp:
            to_close.append((appt, 'visita' if visits else 'ispezione'))

    print(f"Da chiudere (visita/ispezione nello stesso giorno o dopo): {len(to_close)}")
    for appt, why in to_close:
        print(f" - {appt['id']} | {appt['appointment_date'][:16]} | cliente {appt['customer_id']} | {why} | {(appt.get('notes') or '')[:50]}")

    if not APPLY or not to_close:
        print('DRY RUN: nessuna modifica applicata' if not APPLY else 'Nulla da chiudere')
        return

    closed = 0
    for appt, _ in to_close:
        res = rest(token, f"appointments?id=eq.{appt['id']}", method='PATCH', body={'status': 'completed'}, prefer='return=representation')
        closed += len(res)
    print(f"Chiusi: {closed}")


if __name__ == '__main__':
    main()
