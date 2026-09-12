# Iter33 - VisitSlotWheel click-position probe (blocked if Step1 photo gate cannot be bypassed)
try:
    await page.set_viewport_size({"width": 375, "height": 667})
    await page.goto('https://voom-ios.preview.emergentagent.com/anagrafica', wait_until='domcontentloaded')
    await page.wait_for_timeout(1600)

    if await page.get_by_text('Visita Telefonica', exact=False).count() > 0:
        await page.get_by_text('Visita Telefonica', exact=False).first.click(force=True)
        await page.wait_for_timeout(300)
    sw = page.get_by_role('switch').first
    if await sw.count() > 0:
        await sw.click(force=True)
        await page.wait_for_timeout(300)

    if await page.get_by_text('Avanti', exact=True).count() > 0:
        await page.get_by_text('Avanti', exact=True).click(force=True)
        await page.wait_for_timeout(1200)

    wheel = page.locator('[data-testid="visit-slot-wheel-disc"]')
    print('Wheel visible:', await wheel.count() > 0)
    if await wheel.count() > 0:
        await wheel.scroll_into_view_if_needed()
        box = await wheel.bounding_box()
        for pos in [
            {'x': int(box['width'] * 0.78), 'y': int(box['height'] * 0.5)},
            {'x': int(box['width'] * 0.22), 'y': int(box['height'] * 0.5)},
            {'x': int(box['width'] * 0.50), 'y': int(box['height'] * 0.22)},
        ]:
            await wheel.click(position=pos)
            await page.wait_for_timeout(450)
            print('Selection:', await page.locator('[data-testid="visit-slot-wheel-selection"]').inner_text())

except Exception as e:
    print('iter33_visit_slot_wheel failed:', str(e))
