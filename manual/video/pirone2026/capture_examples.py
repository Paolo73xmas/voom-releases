"""Esempi didattici NON persistiti. Ogni risposta sintetica è marcata nel video e nell'audit."""
import asyncio
import json
import sys
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

from capture_common import Recorder, ACTOR, ENV, SUPABASE, OUT

ZONE = ZoneInfo('Europe/Rome')
DAY = '2026-09-14'
LINKED_ID = '00000000-0000-4000-8000-000000000101'
FREE_ID = '00000000-0000-4000-8000-000000000102'
PLACE_ID = '00000000-0000-4000-8000-000000000103'


async def own_customer(r):
    token = await r.page.evaluate("() => {const k=Object.keys(localStorage).find(k=>k.endsWith('-auth-token')); return JSON.parse(localStorage[k]).access_token;}")
    response = await r.context.request.get(SUPABASE + '/rest/v1/customers', headers={'apikey': ENV['EXPO_PUBLIC_SUPABASE_ANON_KEY'], 'Authorization': 'Bearer ' + token}, params={'select': 'id,business_name,city', 'agent_id': 'eq.' + ACTOR, 'city': 'eq.Milano', 'limit': '1'})
    if not response.ok:
        raise RuntimeError('Lettura cliente non riuscita')
    return (await response.json())[0]


def iso(hour):
    return datetime.fromisoformat(DAY + 'T' + hour).replace(tzinfo=ZONE).isoformat()


async def calendar(r):
    p = r.page
    customer = await own_customer(r)
    await r.open('/calendar')
    await p.get_by_test_id('calendar-create').wait_for(timeout=90000)
    await r.shot('30_calendar_entry', p.get_by_test_id('calendar-create'))
    await p.get_by_test_id('calendar-create').click()
    await p.get_by_test_id('appointment-mode-free').click()
    await p.get_by_test_id('appointment-title').fill('DEMO · Riunione organizzativa')
    await p.get_by_test_id('appointment-date').fill(DAY)
    await p.get_by_test_id('appointment-time').fill('08:30')
    await p.get_by_test_id('appointment-duration').fill('30')
    await r.shot('31_calendar_free', p.get_by_test_id('appointment-title'), simulation=True)
    await r.shot('32_calendar_fields', p.get_by_test_id('appointment-duration'), simulation=True)
    await p.get_by_test_id('appointment-cancel').click()
    await p.get_by_test_id('calendar-create').click()
    await p.get_by_test_id('appointment-customer-search').fill(customer['business_name'])
    await p.get_by_test_id('appointment-customer-' + customer['id']).click(timeout=90000)
    await p.get_by_test_id('appointment-date').fill(DAY)
    await p.get_by_test_id('appointment-time').fill('11:00')
    await p.get_by_test_id('appointment-duration').fill('30')
    await p.get_by_test_id('appointment-notes').fill('DEMO DIDATTICA — appuntamento non salvato')
    await r.shot('33_calendar_customer', p.get_by_test_id('appointment-selected-customer'), simulation=True)
    await r.shot('34_calendar_save_not_pressed', p.get_by_test_id('appointment-save'), simulation=True)
    await p.get_by_test_id('appointment-cancel').click()

    base = {'agent_id': ACTOR, 'created_by_id': ACTOR, 'appointment_type': 'follow_up', 'status': 'scheduled', 'completed_at': None, 'duration_minutes': 30, 'notes': 'ESEMPIO DIDATTICO NON SALVATO', 'follow_up_reason': 'ESEMPIO DIDATTICO NON SALVATO'}
    rows = [
        {**base, 'id': LINKED_ID, 'customer_id': customer['id'], 'appointment_date': iso('11:00'), 'customers': {'id': customer['id'], 'business_name': 'CLIENTE DIMOSTRATIVO', 'city': 'Milano', 'address': '', 'contact_phone': ''}},
        {**base, 'id': FREE_ID, 'customer_id': None, 'appointment_date': iso('08:30'), 'quick_customer_name': 'DEMO · Riunione organizzativa', 'quick_customer_address': '', 'quick_customer_city': '', 'quick_customer_phone': ''},
        {**base, 'id': PLACE_ID, 'customer_id': None, 'appointment_date': iso('15:00'), 'quick_customer_name': 'DEMO · Incontro in centro', 'quick_customer_address': 'Piazza del Duomo', 'quick_customer_city': 'Milano', 'quick_customer_phone': ''},
    ]

    async def agenda_fixture(request):
        parsed = urlparse(request.url)
        if not parsed.path.endswith('/appointments'):
            return None
        params = parse_qs(parsed.query)
        selected = rows[:]
        for condition in params.get('appointment_date', []):
            op, value = condition.split('.', 1)
            pivot = datetime.fromisoformat(value.replace('Z', '+00:00'))
            if pivot.tzinfo is None:
                pivot = pivot.replace(tzinfo=ZONE)
            selected = [a for a in selected if (datetime.fromisoformat(a['appointment_date']) >= pivot if op == 'gte' else datetime.fromisoformat(a['appointment_date']) < pivot)]
        if params.get('customer_id') == ['is.null']:
            selected = [a for a in selected if a['customer_id'] is None]
        if params.get('customer_id') == ['not.is.null']:
            selected = [a for a in selected if a['customer_id'] is not None]
        return selected

    r.simulation_handler = agenda_fixture
    await r.open('/ai-tour')
    await p.get_by_test_id('aitour-open-brief').wait_for(timeout=90000)
    await p.get_by_text('Lun', exact=True).click()
    await p.get_by_test_id('aitour-followup-item-' + customer['id']).wait_for(timeout=90000)
    await r.shot('35_followup_reminder', p.get_by_test_id('aitour-followup-item-' + customer['id']), simulation=True)
    followup_row = p.get_by_test_id('aitour-followup-item-' + customer['id'])
    await followup_row.click()
    await r.shot('36_followup_ignored', followup_row, simulation=True)
    await followup_row.click()
    await r.shot('37_followup_considered', followup_row, simulation=True)
    await r.shot('38_free_reminder', p.get_by_test_id('aitour-free-no-location-' + FREE_ID), simulation=True)
    await p.get_by_test_id('aitour-free-find-' + PLACE_ID).click()
    await p.get_by_test_id('aitour-free-place-' + PLACE_ID + '-0').click(timeout=90000)
    await r.shot('39_free_place_confirmed', p.get_by_test_id('aitour-free-confirmed-' + PLACE_ID), simulation=True)
    (OUT / 'agenda_demo_metadata.json').write_text(json.dumps({'customerId': customer['id'], 'demoOnly': True, 'rows': rows}, ensure_ascii=False, indent=2))


async def live(r):
    p = r.page
    tour_id = '00000000-0000-4000-8000-000000000201'
    stop_id = '00000000-0000-4000-8000-000000000202'
    subject_id = '00000000-0000-4000-8000-000000000203'
    now = datetime.now(ZONE)
    tour = {'id': tour_id, 'agent_id': ACTOR, 'tour_date': now.date().isoformat(), 'start_time': now.strftime('%H:%M'), 'end_time': '23:59', 'start_label': 'ESEMPIO DIDATTICO', 'start_lat': 45.4642, 'start_lng': 9.1900, 'end_label': None, 'end_lat': None, 'end_lng': None, 'tour_type': 'clienti', 'resolved_tour_type': 'clienti', 'status': 'active', 'planned_visits': 1, 'planned_distance_km': 0, 'planned_drive_minutes': 0, 'planned_visit_minutes': 20, 'planned_buffer_minutes': 0, 'potential_value': 0, 'ai_summary': 'SIMULAZIONE — nessun tour avviato o salvato', 'created_at': now.isoformat(), 'lunch_break_start': None, 'lunch_break_end': None, 'lunch_break_minutes': 0, 'area_filter': None, 'route_geometry': []}
    stop = {'id': stop_id, 'tour_id': tour_id, 'customer_id': None, 'tabaccheria_id': subject_id, 'entity_type': 'prospect', 'business_name': 'PUNTO VENDITA DIMOSTRATIVO', 'address': 'Indirizzo di esempio', 'city': 'Milano', 'province': 'MI', 'latitude': 45.4642, 'longitude': 9.1900, 'planned_sequence': 1, 'planned_arrival': now.strftime('%H:%M'), 'planned_departure': (now + timedelta(minutes=20)).strftime('%H:%M'), 'planned_duration_minutes': 20, 'travel_minutes': 0, 'travel_km': 0, 'mandatory': False, 'status': 'planned', 'priority_score': 30, 'priority_class': 'Media', 'ai_reason': 'Dimostrazione non collegata ad attività reali', 'is_follow_up': False}

    async def live_fixture(request):
        parsed = urlparse(request.url)
        if parsed.path.endswith('/ai_tours'):
            if 'application/vnd.pgrst.object+json' in request.headers.get('accept', ''):
                return tour
            return [tour]
        if parsed.path.endswith('/ai_tour_stops'):
            return [stop]
        if parsed.path.endswith('/ai_tour_events') or parsed.path.endswith('/ai_tour_locations'):
            return []
        if parsed.path.endswith('/tabaccherie') and subject_id in request.url:
            row = {'id': subject_id, 'denominazione': stop['business_name'], 'comune': 'Milano', 'indirizzo': 'Indirizzo di esempio', 'provincia': 'MI'}
            return row if 'application/vnd.pgrst.object+json' in request.headers.get('accept', '') else [row]
        return None

    r.simulation_handler = live_fixture
    await r.open('/ai-tour')
    await p.get_by_test_id('aitour-live-verify-label').wait_for(timeout=90000)
    await r.shot('40_live_demo', p.get_by_test_id('aitour-live-verify-label'), simulation=True)
    await p.get_by_test_id('aitour-live-verify-label').click()
    await p.get_by_test_id('verification-review').wait_for(timeout=30000)
    await r.shot('41_verification_types', p.get_by_test_id('verification-type-closed'), simulation=True)
    await p.get_by_test_id('verification-type-other').click()
    await p.get_by_test_id('verification-notes').fill('ESEMPIO: trovata chiusa durante più passaggi. Verificare gli orari; chiusura definitiva NON accertata.')
    await r.shot('42_often_closed', p.get_by_test_id('verification-notes'), simulation=True)
    await p.get_by_test_id('verification-type-closed').click()
    await r.shot('43_definitively_closed', p.get_by_test_id('verification-type-closed'), simulation=True)
    await p.get_by_test_id('verification-type-moved').click()
    await r.shot('44_moved', p.get_by_test_id('verification-type-moved'), simulation=True)
    await p.get_by_test_id('verification-notes').fill('ESEMPIO DIDATTICO: attività trasferita. Indicare il nuovo indirizzo solo se verificato. Nessun invio nel tutorial.')
    await r.shot('45_gps_optional', p.get_by_test_id('verification-gps-notice'), simulation=True)
    await p.get_by_test_id('verification-review').click()
    await r.shot('46_verification_confirm_not_pressed', p.get_by_test_id('verification-summary'), simulation=True)
    await r.shot('47_verification_send_button', p.get_by_test_id('verification-confirm'), simulation=True)
    await p.get_by_test_id('verification-close').click()
    await r.shot('48_stop_unchanged', p.get_by_test_id('aitour-live-verify-label'), simulation=True)


async def main():
    r = await Recorder().start()
    try:
        await (live(r) if len(sys.argv) > 1 and sys.argv[1] == 'live' else calendar(r))
    except Exception:
        phase = 'live' if len(sys.argv) > 1 and sys.argv[1] == 'live' else 'calendar'
        (OUT / f'capture_{phase}_error.txt').write_text(await r.page.locator('body').inner_text())
        await r.shot(phase + '_debug_error', simulation=True)
        raise
    finally:
        await r.finish()


if __name__ == '__main__':
    asyncio.run(main())