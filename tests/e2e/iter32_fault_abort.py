# Iter32 - Fault tests: create abort and patch abort behavior
try:
    await page.set_viewport_size({"width": 390, "height": 844})
    await page.goto('https://voom-ios.preview.emergentagent.com/(tabs)/calendar', wait_until='domcontentloaded')
    await page.wait_for_timeout(2800)

    if await page.locator('[data-testid="session-login"]').count() > 0:
        await page.click('[data-testid="session-login"]', force=True)
        await page.wait_for_timeout(800)
    if await page.locator('[data-testid="login-email"]').count() > 0:
        await page.fill('[data-testid="login-email"]', 'gdeintinis@gmail.com')
        await page.fill('[data-testid="login-password"]', 'GabrieleDeIntinis123!')
        await page.click('[data-testid="login-submit"]', force=True)
        await page.wait_for_timeout(4000)
        await page.goto('https://voom-ios.preview.emergentagent.com/(tabs)/calendar', wait_until='domcontentloaded')
        await page.wait_for_timeout(2800)

    # PATCH abort
    first_fu = page.locator('[data-testid^="calendar-event-follow_up-"]').first
    if await first_fu.count() > 0:
        await first_fu.click(force=True)
        await page.wait_for_timeout(900)

        async def abort_patch(route):
            if route.request.method == 'PATCH':
                await route.abort()
            else:
                await route.continue_()

        await page.route('**/rest/v1/appointments*', abort_patch)
        if await page.locator('[data-testid="calendar-mark-done"]').count() > 0:
            await page.click('[data-testid="calendar-mark-done"]', force=True)
            await page.wait_for_timeout(1500)
        print('Patch abort error visible:', await page.locator('[data-testid="calendar-save-error"]').count() > 0)
        await page.unroute('**/rest/v1/appointments*', abort_patch)

    # CREATE abort
    await page.click('[data-testid="calendar-create"]', force=True)
    await page.wait_for_selector('[data-testid="appointment-form"]', timeout=12000)
    free_mode = page.locator('[data-testid="appointment-mode-free"]')
    await free_mode.scroll_into_view_if_needed()
    await free_mode.click(force=True)
    await page.fill('[data-testid="appointment-title"]', 'ABORT_CHECK_ITER32')
    await page.fill('[data-testid="appointment-duration"]', '30')

    async def abort_create(route):
        await route.abort()

    await page.route('**/rest/v1/appointments', abort_create)
    await page.click('[data-testid="appointment-save"]', force=True)
    await page.wait_for_timeout(1500)
    print('Create abort error visible:', await page.locator('[data-testid="appointment-error"]').count() > 0)
    print('Create abort field retained:', (await page.locator('[data-testid="appointment-title"]').input_value()) == 'ABORT_CHECK_ITER32')
    await page.unroute('**/rest/v1/appointments', abort_create)

except Exception as e:
    print('iter32_fault_abort failed:', str(e))
