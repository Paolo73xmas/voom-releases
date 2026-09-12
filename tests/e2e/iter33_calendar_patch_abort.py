# Iter33 - Calendar auth + create follow-up + PATCH abort marker (exact id from latest created row)
from datetime import datetime, timedelta

CUSTOMER_ID = 'b07dfae8-2dab-47a6-a410-9cba3554fcf5'
NOTE_TAG = f'ITER33_CAL_PATCH_{int(datetime.utcnow().timestamp())}'

try:
    await page.set_viewport_size({"width": 375, "height": 667})
    await page.goto('https://voom-ios.preview.emergentagent.com/calendar', wait_until='domcontentloaded')
    await page.wait_for_timeout(1200)

    if await page.locator('[data-testid="session-login"]').count() > 0:
        await page.click('[data-testid="session-login"]', force=True)
        await page.wait_for_selector('[data-testid="login-email"]', timeout=15000)
        await page.fill('[data-testid="login-email"]', 'gdeintinis@gmail.com')
        await page.fill('[data-testid="login-password"]', 'GabrieleDeIntinis123!')
        await page.click('[data-testid="login-submit"]', force=True)
        await page.wait_for_timeout(2200)

    await page.goto('https://voom-ios.preview.emergentagent.com/calendar', wait_until='domcontentloaded')
    await page.wait_for_timeout(1600)
    print('Calendar visible:', await page.locator('[data-testid="calendar-screen"]').count() > 0)

    if await page.locator('[data-testid="calendar-screen"]').count() > 0:
        await page.click('[data-testid="calendar-create"]', force=True)
        await page.wait_for_selector('[data-testid="appointment-form"]', timeout=12000)
        customer_selector = '[data-testid="appointment-customer-' + CUSTOMER_ID + '"]'
        if await page.locator(customer_selector).count() == 0:
            await page.fill('[data-testid="appointment-customer-search"]', 'TEST_AUDIT_20260912')
            await page.wait_for_timeout(1200)
        await page.click(customer_selector, force=True)

        dt = datetime.now() + timedelta(minutes=200)
        await page.fill('[data-testid="appointment-date"]', dt.strftime('%Y-%m-%d'))
        await page.fill('[data-testid="appointment-time"]', dt.strftime('%H:%M'))
        await page.fill('[data-testid="appointment-duration"]', '45')
        await page.fill('[data-testid="appointment-notes"]', NOTE_TAG)
        await page.click('[data-testid="appointment-save"]', force=True)
        await page.wait_for_timeout(2200)

        latest = page.locator('[data-testid^="calendar-event-follow_up-"]').first
        if await latest.count() > 0:
            await latest.click(force=True)
            await page.wait_for_selector('[data-testid="calendar-event-detail"]', timeout=10000)
            calls = {'n': 0}

            async def abort_patch(route):
                if route.request.method == 'PATCH':
                    calls['n'] += 1
                    await route.abort()
                else:
                    await route.continue_()

            await page.route('**/rest/v1/appointments*', abort_patch)
            await page.click('[data-testid="calendar-mark-done"]', force=True)
            await page.wait_for_timeout(1400)
            print('calendar-save-error visible:', await page.locator('[data-testid="calendar-save-error"]').count() > 0)
            print('PATCH intercept count:', calls['n'])
            await page.unroute('**/rest/v1/appointments*', abort_patch)

except Exception as e:
    print('iter33_calendar_patch_abort failed:', str(e))
