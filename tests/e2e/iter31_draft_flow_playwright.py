"""Iteration 31 reusable Playwright flow: draft save/resume/delete on mobile web preview."""

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

    # open wizard with fixture customer
    fixture_customer_id = "b07dfae8-2dab-47a6-a410-9cba3554fcf5"
    fixture_customer_name = "TEST_AUDIT_20260912_ZESMAI"
    await page.goto(f"https://voom-ios.preview.emergentagent.com/order-collection-v2?customerId={fixture_customer_id}", wait_until="domcontentloaded")
    await page.wait_for_timeout(2200)

    if await page.get_by_placeholder("Cerca cliente...").count() > 0:
        await page.get_by_placeholder("Cerca cliente...").fill(fixture_customer_name)
        await page.wait_for_timeout(700)
        if await page.get_by_text(fixture_customer_name, exact=True).count() > 0:
            await page.get_by_text(fixture_customer_name, exact=True).first.click(force=True)

    await page.click('[data-testid="order-next-step"]', force=True)
    await page.wait_for_timeout(900)

    # add first product
    await page.get_by_text("+1", exact=True).first.click(force=True)
    await page.wait_for_timeout(800)
    await page.click('[data-testid="order-next-step"]', force=True)
    await page.wait_for_timeout(900)

    # payment
    for label in ["Assegno", "CONTANTI", "Bonifico Istantaneo", "RiBa a 30"]:
        loc = page.get_by_text(label, exact=True)
        if await loc.count() > 0:
            await loc.first.click(force=True)
            break
    await page.wait_for_timeout(500)
    await page.click('[data-testid="order-next-step"]', force=True)
    await page.wait_for_timeout(900)

    # shipping
    for label in ["Ritiro", "Corriere", "GLS", "Spedizione"]:
        loc = page.get_by_text(label, exact=False)
        if await loc.count() > 0:
            await loc.first.click(force=True)
            break
    await page.wait_for_timeout(600)
    await page.click('[data-testid="order-next-step"]', force=True)
    await page.wait_for_timeout(1000)

    # summary fields + save draft
    await page.locator('[data-testid="order-welcome-discount"]').wait_for(timeout=10000)
    await page.click('[data-testid="order-welcome-discount"]', force=True)
    await page.click('[data-testid="order-channel-remoto"]', force=True)
    notes_input = page.get_by_placeholder("Note per l'ordine...")
    await notes_input.fill("TEST_DRAFT_NOTE_ITER31")
    await page.wait_for_timeout(1300)
    await page.click('[data-testid="order-save-draft"]', force=True)
    await page.wait_for_timeout(1200)

    # resume from drafts
    await page.goto("https://voom-ios.preview.emergentagent.com/drafts", wait_until="domcontentloaded")
    await page.wait_for_timeout(1200)
    await page.locator('[data-testid^="draft-resume-"]').first.click(force=True)
    await page.wait_for_timeout(1500)

    await page.get_by_text("Riepilogo Ordine", exact=True).wait_for(timeout=10000)
    _ = await notes_input.input_value()

    # cleanup
    await page.goto("https://voom-ios.preview.emergentagent.com/drafts", wait_until="domcontentloaded")
    await page.wait_for_timeout(1000)
    if await page.locator('[data-testid^="draft-delete-"]').count() > 0:
        await page.locator('[data-testid^="draft-delete-"]').first.click(force=True)
        await page.wait_for_timeout(200)
        await page.click('[data-testid="draft-delete-dialog-confirm"]', force=True)
        await page.wait_for_timeout(800)
