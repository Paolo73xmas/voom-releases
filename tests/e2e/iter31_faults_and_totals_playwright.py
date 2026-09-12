"""Iteration 31 reusable Playwright flow: OrderTotals, duplicate entry, forced error banners, session guard."""

async def run(page):
    await page.set_viewport_size({"width": 375, "height": 667})

    # login
    await page.goto("https://voom-ios.preview.emergentagent.com/login", wait_until="domcontentloaded")
    await page.wait_for_timeout(1000)
    if await page.locator('[data-testid="login-submit"]').count() > 0 and await page.locator('[data-testid="login-submit"]').is_visible():
        await page.fill('[data-testid="login-email"]', "gdeintinis@gmail.com")
        await page.fill('[data-testid="login-password"]', "GabrieleDeIntinis123!")
        await page.click('[data-testid="login-submit"]', force=True)
        await page.wait_for_timeout(2500)

    # Order totals + duplicate route entry
    await page.goto("https://voom-ios.preview.emergentagent.com/orders", wait_until="domcontentloaded")
    await page.wait_for_timeout(1800)
    await page.locator('[data-testid^="order-card-"]').first.click(force=True)
    await page.wait_for_timeout(1200)
    await page.locator('[data-testid="order-totals"]').wait_for(timeout=10000)
    await page.locator('[data-testid="order-totals-stored-value"]').wait_for(timeout=10000)
    await page.click('[data-testid="order-duplicate"]', force=True)
    await page.wait_for_timeout(200)
    await page.click('[data-testid="order-duplicate-dialog-confirm"]', force=True)
    await page.wait_for_timeout(1600)

    # Orders refresh error -> retry
    async def abort_orders(route):
        await route.abort()
    await page.route("**/rest/v1/orders**", abort_orders)
    await page.goto("https://voom-ios.preview.emergentagent.com/orders", wait_until="domcontentloaded")
    await page.wait_for_timeout(1800)
    await page.locator('[data-testid="orders-error"]').wait_for(timeout=10000)
    await page.click('[data-testid="orders-retry"]', force=True)
    await page.wait_for_timeout(600)
    await page.unroute("**/rest/v1/orders**", abort_orders)

    # Calendar GET forced error banner
    async def abort_appt_get(route):
        if route.request.method.upper() == "GET":
            await route.abort()
        else:
            await route.continue_()
    await page.route("**/rest/v1/appointments**", abort_appt_get)
    await page.goto("https://voom-ios.preview.emergentagent.com/calendar", wait_until="domcontentloaded")
    await page.wait_for_timeout(2200)
    await page.locator('[data-testid="calendar-error"]').wait_for(timeout=10000)
    await page.unroute("**/rest/v1/appointments**", abort_appt_get)

    # Hydration guard unauth check
    await page.evaluate("""() => {
      localStorage.removeItem('sb-gorwxfzzyzxmxnizmebw-auth-token');
    }""")
    await page.goto("https://voom-ios.preview.emergentagent.com/order-collection-v2", wait_until="domcontentloaded")
    await page.wait_for_timeout(2200)
    await page.locator('[data-testid="session-required-message"]').wait_for(timeout=10000)
