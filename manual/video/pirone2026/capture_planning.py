import asyncio
from playwright.async_api import expect
from capture_common import Recorder, OUT

PROMPT = ('Lunedì 14 settembre 2026, dalle 09:00 alle 17:00, vorrei 8 visite ai miei clienti. '
          'Voglio lavorare nella zona Nord-est di Milano, con raggio di 8 chilometri. '
          'Parto da Piazza del Duomo, Milano, e rientro alla partenza.')


async def prepare_journey(r):
    p = r.page
    await p.get_by_test_id('brief-journey-prepare').click()
    await p.get_by_test_id('brief-journey-loading').wait_for(state='hidden', timeout=90000)
    choices = p.locator('[data-testid^="brief-stage-"][data-testid*="-choice-"]')
    # Nessuna correzione automatica nascosta: eventuali località vengono confermate a video.
    for index in range(8):
        candidate = p.get_by_test_id(f'brief-stage-{index}-choice-0')
        if await candidate.count():
            await r.shot(f'journey_choice_{index}', candidate)
            await candidate.click()
    if await p.get_by_test_id('brief-journey-confirm').count() == 0:
        await p.get_by_test_id('brief-journey-prepare').click()
        await p.get_by_test_id('brief-journey-loading').wait_for(state='hidden', timeout=90000)
    await p.get_by_test_id('brief-journey-confirm').wait_for(state='visible', timeout=90000)
    await expect(p.get_by_test_id('brief-journey-confirm')).to_be_enabled(timeout=90000)
    # Attesa fotografica delle tessere, dopo che il comando è effettivamente pronto.
    await p.wait_for_timeout(2000)


async def main():
    r = await Recorder().start()
    try:
        p = r.page
        await r.open('/ai-tour')
        await p.get_by_test_id('aitour-open-brief').wait_for(timeout=90000)
        await p.get_by_text('Lun', exact=True).click()
        await r.shot('01_ai_home', p.get_by_test_id('aitour-open-brief'))
        await r.shot('02_date', p.get_by_text('Lun', exact=True))
        await p.get_by_text('Giro Clienti', exact=True).click()
        await r.shot('03_day_type', p.get_by_text('Giro Clienti', exact=True))
        await p.get_by_test_id('aitour-chip-start-address').click()
        await p.get_by_placeholder('Via, città').fill('Piazza del Duomo, Milano')
        await p.get_by_test_id('aitour-chip-end-start').click()
        await r.shot('04_start_return', p.get_by_test_id('aitour-chip-end-start'))
        await r.shot('05_area_modes', p.get_by_test_id('aitour-chip-comune'))
        await p.get_by_test_id('aitour-chip-provincia').click()
        await r.shot('06_chip_one', p.get_by_test_id('aitour-chip-provincia'))
        await p.get_by_test_id('aitour-chip-comune').click()
        await r.shot('08_comune', p.get_by_test_id('aitour-chip-comune'))
        await p.get_by_test_id('aitour-open-brief').click()
        await p.get_by_test_id('brief-request-input').fill(PROMPT)
        await r.shot('09_prompt', p.get_by_test_id('brief-request-input'))
        await p.get_by_test_id('brief-interpret').click()
        await p.get_by_test_id('brief-date-input').wait_for(timeout=120000)
        await p.get_by_test_id('brief-date-input').fill('2026-09-14')
        await r.shot('10_review', p.get_by_test_id('brief-summary'))
        await r.shot('07_chip_multiple', p.get_by_text('Chi', exact=True))
        (OUT / 'brief_single_text.txt').write_text(await p.locator('body').inner_text())
        await r.shot('11_start_confirm', p.get_by_test_id('brief-start-place'))
        if await p.get_by_test_id('brief-start-place-search').count():
            await p.get_by_test_id('brief-start-place-search').click()
            await p.get_by_test_id('brief-start-place-choice-0').click(timeout=60000)
            await r.shot('12_start_confirmed', p.get_by_test_id('brief-start-place-confirmed'))
        await r.shot('13_compass', p.get_by_test_id('brief-stage-0-direction-NE'))
        await p.get_by_test_id('brief-stage-0-direction-N').click()
        await r.shot('14_direction_north', p.get_by_test_id('brief-stage-0-direction-N'))
        await p.get_by_test_id('brief-stage-0-direction-NE').click()
        await r.shot('15_direction_northeast', p.get_by_test_id('brief-stage-0-radius'))
        await r.shot('16_before_verify', p.get_by_test_id('brief-journey-prepare'))
        await prepare_journey(r)
        await r.shot('17_zone_map', p.get_by_test_id('brief-journey-map-description'))
        await r.shot('18_zone_confirm_button', p.get_by_test_id('brief-journey-confirm'))
        await p.get_by_test_id('brief-journey-confirm').click()
        await r.shot('19_zone_confirmed', p.get_by_test_id('brief-journey-confirm'))
        await p.get_by_test_id('brief-stage-0-direction-E').click()
        await r.shot('20_changed_requires_confirm', p.get_by_test_id('brief-journey-prepare'))
        # Esempio multi-comune: modifica solo il modulo, nessun giro salvato.
        await p.get_by_test_id('brief-stage-0-direction-any').click()
        await p.get_by_test_id('brief-journey-add-stage').click()
        await p.get_by_test_id('brief-stage-1-name').fill('Rozzano')
        await p.get_by_test_id('brief-journey-add-stage').click()
        await p.get_by_test_id('brief-stage-2-name').fill('Pieve Emanuele')
        await p.get_by_test_id('brief-journey-width').fill('3')
        await r.shot('21_multiple_towns', p.get_by_test_id('brief-stage-1-title'))
        await r.shot('22_corridor_width', p.get_by_test_id('brief-journey-width'))
        await prepare_journey(r)
        await r.shot('23_corridor_map', p.get_by_test_id('brief-journey-map-description'))
        await p.get_by_test_id('brief-journey-confirm').click()
        await r.shot('24_corridor_confirmed', p.get_by_test_id('brief-journey-confirm'))
        await r.shot('25_generate_review', p.get_by_test_id('brief-generate'))
        (OUT / 'brief_multi_text.txt').write_text(await p.locator('body').inner_text())
        await p.get_by_test_id('brief-generate').click()
        await p.get_by_test_id('aitour-save-btn').wait_for(timeout=180000)
        await r.shot('26_plan_overview', p.get_by_test_id('aitour-save-btn'))
        (OUT / 'plan_text.txt').write_text(await p.locator('body').inner_text())
        warnings = p.locator('[data-testid^="aitour-plan-warning-"]')
        if await warnings.count():
            await r.shot('27_plan_warnings', warnings.first)
        await r.shot('28_edit_entry', p.get_by_test_id('aitour-edit-btn'))
        await p.get_by_test_id('aitour-edit-btn').click()
        await r.shot('29_edit_preview')
        (OUT / 'edit_text.txt').write_text(await p.locator('body').inner_text())
    except Exception:
        (OUT / 'capture_planning_error.txt').write_text(await r.page.locator('body').inner_text())
        await r.shot('planning_debug_error')
        raise
    finally:
        await r.finish()


if __name__ == '__main__':
    asyncio.run(main())