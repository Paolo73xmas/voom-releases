import asyncio
from capture_common import Recorder, OUT
from capture_planning import prepare_journey

REQUEST = ('Lunedì 14 settembre 2026, dalle 09:00 alle 17:00, pianifica 8 visite ai miei clienti. '
           'Parto da Piazza del Duomo a Milano e rientro alla partenza. '
           'Voglio lavorare nelle zone di Milano, poi Rozzano e infine Pieve Emanuele, in questo ordine. '
           'Per ciascuna località considera l’intera zona con raggio di 8 km. '
           'Includi anche i clienti nei corridoi tra queste località, con ampiezza corridoio di 3 km.')


async def main():
    r = await Recorder().start()
    try:
        p = r.page
        await r.open('/ai-tour')
        await p.get_by_test_id('aitour-open-brief').wait_for(timeout=90000)
        await p.get_by_text('Lun', exact=True).click()
        await p.get_by_test_id('aitour-open-brief').click()
        await p.get_by_test_id('brief-request-input').fill(REQUEST)
        await r.shot('25a_multi_prompt', p.get_by_test_id('brief-request-input'))
        await p.get_by_test_id('brief-interpret').click()
        await p.get_by_test_id('brief-date-input').wait_for(timeout=120000)
        await p.get_by_test_id('brief-date-input').fill('2026-09-14')
        await p.get_by_test_id('brief-start-place-search').click()
        await p.get_by_test_id('brief-start-place-choice-0').click(timeout=90000)
        await prepare_journey(r)
        await p.get_by_test_id('brief-journey-confirm').click()
        await r.shot('25_generate_review', p.get_by_test_id('brief-generate'))
        await p.get_by_test_id('brief-generate').click()
        await p.get_by_test_id('aitour-save-btn').wait_for(timeout=180000)
        await r.shot('26_plan_overview', p.get_by_test_id('aitour-save-btn'))
        (OUT / 'plan_text.txt').write_text(await p.locator('body').inner_text())
        await r.shot('27_plan_warnings', p.locator('[data-testid^="aitour-plan-warning-"]').first)
        await r.shot('28_edit_entry', p.get_by_test_id('aitour-edit-btn'))
        await p.get_by_test_id('aitour-edit-btn').click()
        await r.shot('29_edit_preview')
    except Exception:
        (OUT / 'final_plan_error.txt').write_text(await r.page.locator('body').inner_text())
        await r.shot('final_plan_debug')
        raise
    finally:
        await r.finish()


if __name__ == '__main__':
    asyncio.run(main())