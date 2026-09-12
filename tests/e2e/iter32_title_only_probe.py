# Iter32 - Title-only free appointment DB probe (empty quick address/city/phone)
from datetime import datetime, timedelta

TITLE = 'PROVA_SOLO_TITOLO_ITER32_' + str(int(datetime.utcnow().timestamp()))

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
    free_mode = page.locator('[data-testid="appointment-mode-free"]')
    await free_mode.scroll_into_view_if_needed()
    await free_mode.click(force=True)

    dt = datetime.now() + timedelta(minutes=210)
    await page.fill('[data-testid="appointment-title"]', TITLE)
    await page.fill('[data-testid="appointment-address"]', '')
    await page.fill('[data-testid="appointment-city"]', '')
    await page.fill('[data-testid="appointment-date"]', dt.strftime('%Y-%m-%d'))
    await page.fill('[data-testid="appointment-time"]', dt.strftime('%H:%M'))
    await page.fill('[data-testid="appointment-duration"]', '30')
    await page.click('[data-testid="appointment-save"]', force=True)
    await page.wait_for_timeout(3400)

    after_ids = await page.evaluate("""() => Array.from(document.querySelectorAll('[data-testid^="calendar-event-follow_up-"]'))
      .map(el => el.getAttribute('data-testid').replace('calendar-event-follow_up-',''))""")
    appt_id = [x for x in after_ids if x not in before_ids][0]
    print('Created title-only id:', appt_id)

    row = await page.evaluate("""async (apptId) => {
      const key = Object.keys(localStorage).find(k => k.includes('-auth-token'));
      const token = key ? (JSON.parse(localStorage.getItem(key) || '{}').access_token) : null;
      const res = await fetch('https://gorwxfzzyzxmxnizmebw.supabase.co/rest/v1/appointments?id=eq.' + apptId + '&select=id,customer_id,quick_customer_name,quick_customer_address,quick_customer_city,quick_customer_phone,status', {
        headers: { apikey: 'sb_publishable_b2wS1IQmu3flvQjeJm7I9w_cMI2fKQI', Authorization: 'Bearer ' + token }
      });
      return { status: res.status, body: await res.json() };
    }""", appt_id)
    print('Title-only row:', row)

except Exception as e:
    print('iter32_title_only_probe failed:', str(e))
