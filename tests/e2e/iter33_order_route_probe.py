# Iter33 - Order route probe (generic, deep-link, invalid id) + map order button attempt
import asyncio

FIXTURE_CUSTOMER_ID = 'b07dfae8-2dab-47a6-a410-9cba3554fcf5'
FIXTURE_CUSTOMER_NAME = 'TEST_AUDIT_20260912_ZESMAI'

try:
    await page.set_viewport_size({"width": 375, "height": 667})
    await page.goto('https://voom-ios.preview.emergentagent.com/order-collection-v2', wait_until='domcontentloaded')
    await page.wait_for_timeout(1500)

    if await page.locator('[data-testid="session-login"]').count() > 0:
        await page.click('[data-testid="session-login"]', force=True)
        await page.wait_for_selector('[data-testid="login-email"]', timeout=15000)
        await page.fill('[data-testid="login-email"]', 'gdeintinis@gmail.com')
        await page.fill('[data-testid="login-password"]', 'GabrieleDeIntinis123!')
        await page.click('[data-testid="login-submit"]', force=True)
        await page.wait_for_timeout(2000)

    await page.goto('https://voom-ios.preview.emergentagent.com/order-collection-v2', wait_until='domcontentloaded')
    await page.wait_for_timeout(2000)
    print('Generic order step visible:', await page.locator('[data-testid="order-current-step"]').count() > 0)

    async def delay_customer_list(route):
        if '/rest/v1/customers' in route.request.url and 'id=eq.' not in route.request.url:
            await asyncio.sleep(1.2)
        await route.continue_()

    await page.route('**/rest/v1/customers*', delay_customer_list)
    await page.goto(f'https://voom-ios.preview.emergentagent.com/order-collection-v2?customerId={FIXTURE_CUSTOMER_ID}&customerName={FIXTURE_CUSTOMER_NAME}&startStep=products', wait_until='domcontentloaded')
    await page.wait_for_timeout(2500)
    print('Deep-link order step label:', await page.locator('[data-testid="order-current-step"]').inner_text() if await page.locator('[data-testid="order-current-step"]').count() > 0 else 'NOT_VISIBLE')
    await page.unroute('**/rest/v1/customers*', delay_customer_list)

    await page.goto('https://voom-ios.preview.emergentagent.com/order-collection-v2?customerId=invalid-id-iter33&startStep=products', wait_until='domcontentloaded')
    await page.wait_for_timeout(2500)
    print('order-customer-load-error:', await page.locator('[data-testid="order-customer-load-error"]').count() > 0)
    print('expected testID order-customer-load-retry:', await page.locator('[data-testid="order-customer-load-retry"]').count() > 0)
    print('actual testID order-customer-retry:', await page.locator('[data-testid="order-customer-retry"]').count() > 0)

    await page.goto('https://voom-ios.preview.emergentagent.com/(tabs)/map', wait_until='domcontentloaded')
    await page.wait_for_timeout(3500)
    found = False
    for i in range(1, 10):
        marker = page.locator('.custom-marker').nth(i)
        if await marker.count() == 0:
            continue
        await marker.click(force=True)
        await page.wait_for_timeout(450)
        if await page.locator('[data-testid="map-customer-order"]').count() > 0:
            found = True
            break
    print('Map popup order button found:', found)

except Exception as e:
    print('iter33_order_route_probe failed:', str(e))
