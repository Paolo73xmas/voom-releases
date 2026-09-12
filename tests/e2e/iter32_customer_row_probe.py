# Iter32 - Customer follow-up row probe (owner IDs + UTC/local timestamp)
from datetime import datetime, timedelta

CUSTOMER_ID = 'b07dfae8-2dab-47a6-a410-9cba3554fcf5'

try:
    await page.set_viewport_size({"width": 390, "height": 844})
    await page.goto('https://voom-ios.preview.emergentagent.com/(tabs)/calendar', wait_until='domcontentloaded')
    await page.wait_for_timeout(2500)

    if await page.locator('[data-testid="session-login"]').count() > 0:
        await page.click('[data-testid="session-login"]', force=True)
        await page.wait_for_timeout(800)
    if await page.locator('[data-testid="login-email"]').count() > 0:
        await page.fill('[data-testid="login-email"]', 'gdeintinis@gmail.com')
        await page.fill('[data-testid="login-password"]', 'GabrieleDeIntinis123!')
        await page.click('[data-testid="login-submit"]', force=True)
        await page.wait_for_timeout(4200)
        await page.goto('https://voom-ios.preview.emergentagent.com/(tabs)/calendar', wait_until='domcontentloaded')
        await page.wait_for_timeout(2500)

    before_ids = await page.evaluate("""() => Array.from(document.querySelectorAll('[data-testid^="calendar-event-follow_up-"]'))
      .map(el => el.getAttribute('data-testid').replace('calendar-event-follow_up-',''))""")

    await page.click('[data-testid="calendar-create"]', force=True)
    await page.wait_for_selector('[data-testid="appointment-form"]', timeout=12000)

    customer_selector = '[data-testid="appointment-customer-' + CUSTOMER_ID + '"]'
    if await page.locator(customer_selector).count() == 0:
        await page.fill('[data-testid="appointment-customer-search"]', 'TEST_AUDIT_20260912')
        await page.wait_for_timeout(1200)
    await page.click(customer_selector, force=True)

    dt = datetime.now() + timedelta(minutes=250)
    chosen_date = dt.strftime('%Y-%m-%d')
    chosen_time = dt.strftime('%H:%M')
    await page.fill('[data-testid="appointment-date"]', chosen_date)
    await page.fill('[data-testid="appointment-time"]', chosen_time)
    await page.fill('[data-testid="appointment-duration"]', '45')
    await page.fill('[data-testid="appointment-notes"]', 'TEST NOTE CUSTOMER ITER32')
    await page.click('[data-testid="appointment-save"]', force=True)
    await page.wait_for_timeout(3600)

    after_ids = await page.evaluate("""() => Array.from(document.querySelectorAll('[data-testid^="calendar-event-follow_up-"]'))
      .map(el => el.getAttribute('data-testid').replace('calendar-event-follow_up-',''))""")
    appt_id = [x for x in after_ids if x not in before_ids][0]

    row = await page.evaluate("""async ({apptId, customerId, chosenDate, chosenTime}) => {
      const key = Object.keys(localStorage).find(k => k.includes('-auth-token'));
      const raw = key ? localStorage.getItem(key) : null;
      const parsed = raw ? JSON.parse(raw) : null;
      const token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token;
      const payload = token ? JSON.parse(atob(token.split('.')[1])) : {};
      const userId = payload.sub;
      const res = await fetch('https://gorwxfzzyzxmxnizmebw.supabase.co/rest/v1/appointments?id=eq.' + apptId + '&select=id,agent_id,created_by_id,customer_id,appointment_date,duration_minutes,notes,status', {
        headers: { apikey: 'sb_publishable_b2wS1IQmu3flvQjeJm7I9w_cMI2fKQI', Authorization: 'Bearer ' + token }
      });
      const rows = await res.json();
      const r = rows?.[0];
      const local = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(r.appointment_date));
      return { status: res.status, row: r, expected: { customerId, chosenDate, chosenTime, userId }, local_rome: local };
    }""", {"apptId": appt_id, "customerId": CUSTOMER_ID, "chosenDate": chosen_date, "chosenTime": chosen_time})

    print('Customer follow-up row probe:', row)

except Exception as e:
    print('iter32_customer_row_probe failed:', str(e))
