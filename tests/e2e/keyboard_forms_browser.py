"""Real Expo screens with isolated IO. Browser resize is NOT a native keyboard."""
import json
from pathlib import Path
from playwright.async_api import expect
from keyboard_forms_fixture import install, CUSTOMER, PRODUCT, orders


async def visible_bounds(page, test_id):
    node = page.get_by_test_id(test_id)
    await expect(node).to_be_visible()
    await expect(node).to_be_in_viewport(ratio=1)
    # Modal slide may still be running after fields are visible. Wait for its
    # real bounds, never a guessed animation timeout or a force-click.
    await page.wait_for_function("""id => {
      const el = document.querySelector('[data-testid="' + id + '"]');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1;
    }""", arg=test_id)
    b = await node.bounding_box()
    v = page.viewport_size
    assert b and b['y'] >= -1 and b['y'] + b['height'] <= v['height'] + 1, (test_id, b, v)
    assert b['x'] >= -1 and b['x'] + b['width'] <= v['width'] + 1, (test_id, b, v)
    assert not await page.evaluate('document.documentElement.scrollWidth > window.innerWidth'), 'horizontal overflow'


async def focus_type(page, test_id, text):
    node = page.get_by_test_id(test_id)
    await node.click()
    await node.fill('')
    await expect(node).to_be_focused()
    await node.press_sequentially(text)
    await expect(node).to_be_focused()
    await expect(node).to_have_value(text)


async def run(page, origin, output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    state = await install(page, origin)
    passed = []
    async def open_route(route, ready):
        await page.goto(origin + route)
        await page.get_by_test_id(ready).wait_for()

    async def photo(name):
        await page.screenshot(path=str(output / f'{name}.jpg'), quality=20, full_page=False)

    try:
        await page.set_viewport_size({'width': 390, 'height': 844})
        await open_route('/anagrafica', 'anagrafica-form')
        toggle = page.get_by_test_id('anagrafica-phone-visit')
        # RN Web testID belongs to switch wrapper; check its actual native input.
        await toggle.get_by_role('switch').check() if await toggle.get_by_role('switch').count() else await toggle.check()
        await expect(page.get_by_test_id('anagrafica-next')).to_be_enabled()
        await page.get_by_test_id('anagrafica-next').click()
        await page.get_by_test_id('anagrafica-details-scroll').wait_for()
        values = {'businessName': 'TEST ANAGRAFICA', 'vatNumber': '58371620495', 'fiscalCode': 'RSSMRA80A01H501U',
                  'address': 'VIA TEST 1', 'city': 'MILANO', 'province': 'MI', 'postalCode': '20100',
                  'contactName': 'MARIO', 'contactSurname': 'ROSSI', 'iban': 'IT60X0542811101000000123456', 'notes': 'Note della visita'}
        for key, value in values.items():
            await focus_type(page, f'anagrafica-input-{key}', value)
        await page.get_by_test_id('anagrafica-search-open').click()
        await focus_type(page, 'anagrafica-search-city', 'Milano')
        await page.get_by_test_id('anagrafica-search-close').click()
        await expect(page.get_by_test_id('anagrafica-input-notes')).to_have_value(values['notes'])
        await page.get_by_test_id('anagrafica-project-open').click()
        await page.get_by_test_id('anagrafica-project-p1').click()
        await expect(page.get_by_test_id('anagrafica-project-picker')).to_be_hidden()
        await page.get_by_test_id('anagrafica-customer-type-open').click()
        await page.get_by_test_id('anagrafica-type-ct1').click()
        await expect(page.get_by_test_id('anagrafica-type-picker')).to_be_hidden()
        await page.get_by_test_id('anagrafica-next').click()
        follow = page.get_by_test_id('anagrafica-followup-toggle')
        await follow.get_by_role('switch').check() if await follow.get_by_role('switch').count() else await follow.check()
        await focus_type(page, 'anagrafica-input-appointmentNotes', 'Follow-up locale')
        await page.get_by_test_id('anagrafica-previous').click()
        await expect(page.get_by_test_id('anagrafica-input-businessName')).to_have_value(values['businessName'])
        await page.get_by_test_id('anagrafica-next').click()
        await expect(page.get_by_test_id('anagrafica-input-appointmentNotes')).to_have_value('Follow-up locale')
        await page.get_by_test_id('anagrafica-input-appointmentNotes').click()
        await photo('anagrafica-followup')
        passed.append('anagrafica_complete_required_fields_search_pickers_followup_preserved')
        for w, h in [(320, 568), (800, 1280), (800, 650)]:
            await page.set_viewport_size({'width': w, 'height': h})
            await page.get_by_test_id('anagrafica-input-appointmentNotes').click()
            await visible_bounds(page, 'anagrafica-navigation')
            await photo(f'anagrafica-{w}-{h}')
        passed.append('anagrafica_viewport_matrix')
        await page.set_viewport_size({'width': 390, 'height': 844})
        await open_route(f'/customer/{CUSTOMER}', 'customer-edit-contact')
        for section, field in [('contact', 'contact_email'), ('address', 'postal_code'), ('fiscal', 'sdi')]:
            await page.get_by_test_id(f'customer-edit-{section}').click()
            await focus_type(page, f'customer-edit-input-{field}', 'TEST' if field == 'sdi' else '12345')
            await visible_bounds(page, 'customer-edit-footer')
            await photo(f'customer-{section}')
            await page.get_by_test_id('customer-edit-cancel').click()
        passed.append('customer_three_edit_sections')

        await open_route('/rimborsi', 'reimbursement-create-open')
        await page.get_by_test_id('reimbursement-create-open').click()
        await focus_type(page, 'reimbursement-amount', '12,50')
        await focus_type(page, 'reimbursement-description', 'Spesa di prova multilinea')
        await page.get_by_test_id('reimbursement-category-cat1').click()
        for w, h in [(390, 844), (800, 650), (320, 568)]:
            await page.set_viewport_size({'width': w, 'height': h})
            await page.get_by_test_id('reimbursement-description').click()
            await visible_bounds(page, 'reimbursement-footer')
            await photo(f'reimbursement-{w}-{h}')
        await page.get_by_test_id('reimbursement-create-close').click()
        await page.get_by_test_id('reimbursement-create-open').click()
        await expect(page.get_by_test_id('reimbursement-amount')).to_have_value('')
        await page.get_by_test_id('reimbursement-create-close').click()
        passed.append('reimbursement_fields_category_close_reopen_matrix')

        await page.set_viewport_size({'width': 390, 'height': 844})
        await open_route('/inspection/new', 'inspection-customer-picker')
        await page.get_by_test_id('inspection-customer-picker').click()
        await focus_type(page, 'inspection-customer-search', 'ALFA')
        await page.get_by_test_id(f'inspection-customer-{CUSTOMER}').click()
        await expect(page.get_by_test_id('inspection-customer-search')).to_have_count(0)
        await focus_type(page, 'inspection-notes', 'Ispezione locale senza GPS reale')
        await page.get_by_test_id('inspection-submit').scroll_into_view_if_needed()
        await photo('inspection')
        passed.append('inspection_customer_firsttap_notes')

        await open_route('/substitutions', 'substitutions-new')
        await page.get_by_test_id('substitutions-new').click()
        await focus_type(page, 'substitution-customer-search', 'ALFA')
        await page.get_by_test_id(f'substitution-customer-{CUSTOMER}').click()
        await page.get_by_test_id('substitution-next').click()
        await page.get_by_text('Prodotti da Ritirare', exact=True).wait_for()
        await page.get_by_test_id('substitution-next').click()
        await page.get_by_text('Prodotti da Inviare', exact=True).wait_for()
        await page.get_by_test_id('substitution-next').click()
        await focus_type(page, 'substitution-reason', 'Motivo di prova')
        await focus_type(page, 'substitution-notes', 'Note di prova')
        await visible_bounds(page, 'substitution-navigation')
        await expect(page.get_by_test_id('substitution-submit')).to_be_enabled()
        await photo('substitution')
        passed.append('substitution_all_steps_and_notes')

        await open_route('/rivendite-no-mappa', 'rivendita-business-name')
        await page.get_by_role('switch').first.check()
        await focus_type(page, 'rivendita-latitude', '45.4642')
        await focus_type(page, 'rivendita-longitude', '9.19')
        for key, value in {'business-name': 'TEST RIVENDITA', 'vat': '58371620495', 'address': 'Via Test 1', 'city': 'Milano', 'province': 'MI', 'notes': 'Note rivendita'}.items():
            await focus_type(page, f'rivendita-{key}', value)
        await page.get_by_test_id('rivendita-next').click()
        await page.get_by_test_id('rivendita-photos-scroll').wait_for()
        await visible_bounds(page, 'rivendita-navigation')
        await photo('rivendita')
        passed.append('rivendita_validated_manual_gps_to_photo_step')
        assert not state['page_errors'], state['page_errors']
        assert not state['unknown'], state['unknown']
        assert not state['writes'], state['writes']
    except Exception as error:
        state['failure'] = str(error)
        await photo('failure')
        raise
    finally:
        state['passed'] = passed
        (output / 'result.json').write_text(json.dumps(state, indent=2))
        print(json.dumps(state, indent=2))
    return state


async def run_extra(page, origin, output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    state = await install(page, origin)
    passed = []
    try:
        await page.set_viewport_size({'width': 390, 'height': 844})
        await page.goto(origin + '/order-collection-v2')
        await page.get_by_test_id('order-customer-search').wait_for()
        await focus_type(page, 'order-customer-search', 'ALFA')
        await page.get_by_test_id(f'order-customer-option-{CUSTOMER}').click()
        await page.get_by_test_id('order-next-step').click()
        await focus_type(page, 'order-product-search', 'STD-ELIGIBLE')
        await page.get_by_test_id(f'order-product-add-one-{PRODUCT}').click()
        await page.get_by_test_id(f'order-product-edit-{PRODUCT}').click()
        await focus_type(page, 'edit-modal-price-input', '95.50')
        await page.get_by_test_id('edit-modal-confirm').click()
        await expect(page.get_by_test_id('order-edit-product-form')).to_be_hidden()
        await page.get_by_test_id('order-packages-open').click()
        await focus_type(page, 'order-package-search', 'TEST')
        await page.get_by_test_id('order-packages-close').click()
        await expect(page.get_by_test_id('order-package-search')).to_be_hidden()
        await page.get_by_test_id('order-next-step').click()
        await page.get_by_test_id(f'order-payment-option-{orders.PAYMENT_ID}').click()
        await page.get_by_test_id('order-next-step').click()
        await page.get_by_test_id(f'order-shipping-option-{orders.SHIPPING_ID}').click()
        await focus_type(page, 'order-shipping-address', 'Via spedizione 10')
        await page.get_by_test_id('order-next-step').click()
        await focus_type(page, 'order-notes', 'Note riepilogo ordine di prova')
        for w, h in [(390, 844), (320, 568), (800, 1280), (800, 650)]:
            await page.set_viewport_size({'width': w, 'height': h})
            await page.get_by_test_id('order-notes').click()
            await visible_bounds(page, 'order-bottom-navigation')
            await page.screenshot(path=str(output / f'order-{w}-{h}.jpg'), quality=20, full_page=False)
        await page.get_by_test_id('order-previous-step').click()
        await expect(page.get_by_test_id('order-shipping-address')).to_have_value('Via spedizione 10')
        await page.get_by_test_id('order-next-step').click()
        await expect(page.get_by_test_id('order-notes')).to_have_value('Note riepilogo ordine di prova')
        passed.append('order_search_price_package_shipping_summary_state_and_viewports')

        await page.set_viewport_size({'width': 390, 'height': 844})
        await page.goto(origin + '/calendar')
        await page.get_by_test_id('calendar-create').click()
        await page.get_by_test_id('appointment-mode-free').click()
        for key, value in {'title': 'Appuntamento Test', 'address': 'Via Test 10', 'city': 'Milano', 'date': '2026-10-20', 'time': '10:30', 'duration': '45', 'notes': 'Note locali'}.items():
            await focus_type(page, f'appointment-{key}', value)
        for w, h in [(390, 844), (320, 568), (800, 650)]:
            await page.set_viewport_size({'width': w, 'height': h})
            await page.get_by_test_id('appointment-notes').click()
            await visible_bounds(page, 'appointment-footer')
            await page.screenshot(path=str(output / f'appointment-{w}-{h}.jpg'), quality=20, full_page=False)
        await page.get_by_test_id('appointment-mode-customer').click()
        await focus_type(page, 'appointment-customer-search', 'ALFA')
        await page.get_by_test_id(f'appointment-customer-{CUSTOMER}').click()
        await expect(page.get_by_test_id('appointment-selected-customer')).to_contain_text('ALFA')
        await page.get_by_test_id('appointment-cancel').click()
        await expect(page.get_by_test_id('appointment-form')).to_be_hidden()
        passed.append('appointment_free_all_fields_customer_pick_and_cancel')

        await page.goto(origin + '/substitutions')
        await page.get_by_test_id('substitutions-new').click()
        await focus_type(page, 'substitution-customer-search', 'ALFA')
        await page.get_by_test_id(f'substitution-customer-{CUSTOMER}').click()
        await page.get_by_test_id('substitution-next').click()
        await page.get_by_test_id('substitution-product-open-retrieve-0').click()
        await focus_type(page, 'substitution-product-search', 'STD')
        await page.get_by_test_id(f'substitution-product-{PRODUCT}').click()
        await expect(page.get_by_test_id('substitution-product-search')).to_be_hidden()
        await expect(page.get_by_test_id('substitution-product-open-retrieve-0')).to_contain_text('STD-ELIGIBLE')
        await visible_bounds(page, 'substitution-navigation')
        await page.get_by_test_id('substitution-create-close').click()
        passed.append('substitution_nested_product_picker_selection')
        assert not state['page_errors'], state['page_errors']
        assert not state['unknown'], state['unknown']
        assert not state['writes'], state['writes']
    except Exception as error:
        state['failure'] = str(error)
        await page.screenshot(path=str(output / 'extra-failure.jpg'), quality=20, full_page=False)
        raise
    finally:
        state['passed'] = passed
        (output / 'extra-result.json').write_text(json.dumps(state, indent=2))
        print(json.dumps(state, indent=2))
    return state