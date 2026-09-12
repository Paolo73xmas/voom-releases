# Iter32 - VisitSlotWheel touch and chip selection probe on Anagrafica (390x844)
try:
    await page.set_viewport_size({"width": 390, "height": 844})
    await page.goto('https://voom-ios.preview.emergentagent.com/anagrafica', wait_until='domcontentloaded')
    await page.wait_for_timeout(2200)

    if await page.locator('[data-testid="login-email"]').count() > 0:
        await page.fill('[data-testid="login-email"]', 'gdeintinis@gmail.com')
        await page.fill('[data-testid="login-password"]', 'GabrieleDeIntinis123!')
        await page.click('[data-testid="login-submit"]', force=True)
        await page.wait_for_timeout(3500)
        await page.goto('https://voom-ios.preview.emergentagent.com/anagrafica', wait_until='domcontentloaded')
        await page.wait_for_timeout(2000)

    sw = page.get_by_role('switch').first
    if await sw.count() > 0:
        await sw.click(force=True)
        await page.wait_for_timeout(400)

    await page.get_by_text('Avanti', exact=True).click(force=True)
    await page.wait_for_selector('[data-testid="visit-slot-wheel-disc"]', timeout=10000)

    wheel = page.locator('[data-testid="visit-slot-wheel-disc"]')
    box = await wheel.bounding_box()
    coords = [(0.75, 0.52), (0.67, 0.67), (0.50, 0.80)]
    for idx, (rx, ry) in enumerate(coords):
        x = box['x'] + box['width'] * rx
        y = box['y'] + box['height'] * ry
        await page.mouse.click(x, y)
        await page.wait_for_timeout(450)
        txt = await page.locator('[data-testid="visit-slot-wheel-selection"]').inner_text()
        print(f'Disc tap {idx+1} => {txt}')

    option = page.locator('[data-testid^="visit-slot-wheel-option-"]').first
    if await option.count() > 0:
        await option.click(force=True)
        await page.wait_for_timeout(400)
        txt = await page.locator('[data-testid="visit-slot-wheel-selection"]').inner_text()
        print(f'Chip tap => {txt}')

except Exception as e:
    print('iter32_visit_slot_wheel failed:', str(e))
