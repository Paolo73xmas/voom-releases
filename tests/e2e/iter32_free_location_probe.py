# Iter32 - Free appointment with location + AI location confirm + Supabase row probe
from datetime import datetime, timedelta

TITLE = 'PROVA_CON_LUOGO_ITER32_' + str(int(datetime.utcnow().timestamp()))

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

    dt = datetime.now() + timedelta(minutes=180)
    await page.fill('[data-testid="appointment-title"]', TITLE)
    await page.fill('[data-testid="appointment-address"]', 'Via Roma 1')
    await page.fill('[data-testid="appointment-city"]', 'Milano')
    await page.fill('[data-testid="appointment-date"]', dt.strftime('%Y-%m-%d'))
    await page.fill('[data-testid="appointment-time"]', dt.strftime('%H:%M'))
    await page.fill('[data-testid="appointment-duration"]', '30')
    await page.click('[data-testid="appointment-save"]', force=True)
    await page.wait_for_timeout(3500)

    after_ids = await page.evaluate("""() => Array.from(document.querySelectorAll('[data-testid^="calendar-event-follow_up-"]'))
      .map(el => el.getAttribute('data-testid').replace('calendar-event-follow_up-',''))""")
    appt_id = [x for x in after_ids if x not in before_ids][0]
    print('Created appointment id:', appt_id)

    await page.goto('https://voom-ios.preview.emergentagent.com/ai-tour', wait_until='domcontentloaded')
    await page.wait_for_timeout(3400)
    find_btn = '[data-testid="aitour-free-find-' + appt_id + '"]'
    if await page.locator(find_btn).count() > 0:
        await page.click(find_btn, force=True)
        await page.wait_for_timeout(3200)
        place0 = '[data-testid="aitour-free-place-' + appt_id + '-0"]'
        if await page.locator(place0).count() > 0:
            await page.click(place0, force=True)
            await page.wait_for_timeout(700)
    print('AI location confirmed:', await page.locator('[data-testid="aitour-free-confirmed-' + appt_id + '"]').count() > 0)

    row = await page.evaluate("""async (apptId) => {
      const key = Object.keys(localStorage).find(k => k.includes('-auth-token'));
      const token = key ? (JSON.parse(localStorage.getItem(key) || '{}').access_token) : null;
      const res = await fetch('https://gorwxfzzyzxmxnizmebw.supabase.co/rest/v1/appointments?id=eq.' + apptId + '&select=id,customer_id,quick_customer_name,quick_customer_address,quick_customer_city,quick_customer_phone,status', {
        headers: { apikey: 'sb_publishable_b2wS1IQmu3flvQjeJm7I9w_cMI2fKQI', Authorization: 'Bearer ' + token }
      });
      return { status: res.status, body: await res.json() };
    }""", appt_id)
    print('Supabase row:', row)

except Exception as e:
    print('iter32_free_location_probe failed:', str(e))
