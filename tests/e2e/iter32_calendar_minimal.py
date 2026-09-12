# Iter32 - Calendar minimal flow: free title-only + customer follow-up + AI panel
from datetime import datetime, timedelta

CUSTOMER_ID = 'b07dfae8-2dab-47a6-a410-9cba3554fcf5'
FREE_TITLE = f"PROVA_LOCALE_ITER32_{int(datetime.utcnow().timestamp())}"

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
        await page.wait_for_timeout(2800)

    await page.click('[data-testid="calendar-create"]', force=True)
    await page.wait_for_selector('[data-testid="appointment-form"]', timeout=12000)
    free_mode = page.locator('[data-testid="appointment-mode-free"]')
    await free_mode.scroll_into_view_if_needed()
    await free_mode.click(force=True)

    await page.fill('[data-testid="appointment-title"]', '')
    await page.click('[data-testid="appointment-save"]', force=True)
    await page.wait_for_timeout(900)
    print('Empty title error:', await page.locator('[data-testid="appointment-error"]').count() > 0)

    dt = datetime.now() + timedelta(minutes=130)
    await page.fill('[data-testid="appointment-title"]', FREE_TITLE)
    await page.fill('[data-testid="appointment-address"]', '')
    await page.fill('[data-testid="appointment-city"]', '')
    await page.fill('[data-testid="appointment-date"]', dt.strftime('%Y-%m-%d'))
    await page.fill('[data-testid="appointment-time"]', dt.strftime('%H:%M'))
    await page.fill('[data-testid="appointment-duration"]', '30')
    await page.click('[data-testid="appointment-save"]', force=True)
    await page.wait_for_timeout(3500)
    print('Free save success:', await page.locator('[data-testid="calendar-save-success"]').count() > 0)

    await page.click('[data-testid="calendar-create"]', force=True)
    await page.wait_for_selector('[data-testid="appointment-form"]', timeout=12000)
    customer_selector = '[data-testid="appointment-customer-' + CUSTOMER_ID + '"]'
    if await page.locator(customer_selector).count() == 0:
        await page.fill('[data-testid="appointment-customer-search"]', 'TEST_AUDIT_20260912')
        await page.wait_for_timeout(1200)
    await page.click(customer_selector, force=True)
    await page.fill('[data-testid="appointment-duration"]', '45')
    await page.fill('[data-testid="appointment-notes"]', 'TEST NOTE ITER32')
    await page.click('[data-testid="appointment-save"]', force=True)
    await page.wait_for_timeout(3500)
    print('Customer save success:', await page.locator('[data-testid="calendar-save-success"]').count() > 0)

    await page.goto('https://voom-ios.preview.emergentagent.com/ai-tour', wait_until='domcontentloaded')
    await page.wait_for_timeout(3400)
    print('AI panel visible:', await page.locator('[data-testid="aitour-followup-panel"]').count() > 0)
    print('AI fixture followup visible:', await page.locator('[data-testid="aitour-followup-item-' + CUSTOMER_ID + '"]').count() > 0)

except Exception as e:
    print('iter32_calendar_minimal failed:', str(e))
