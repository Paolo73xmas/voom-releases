import asyncio
from capture_common import Recorder, OUT


async def main():
    r = await Recorder().start()
    try:
        await r.open('/ai-tour')
        await r.page.get_by_test_id('aitour-open-brief').wait_for(timeout=90000)
        await r.shot('01_ai_home', r.page.get_by_test_id('aitour-open-brief'))
        (OUT / 'ai_home_text.txt').write_text(await r.page.locator('body').inner_text())
        print('AI TOUR READY', flush=True)
    finally:
        await r.finish()


if __name__ == '__main__':
    asyncio.run(main())