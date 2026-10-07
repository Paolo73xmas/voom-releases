import asyncio
from playwright.async_api import async_playwright

from iter63_gptour_development_fixture import run


async def main() -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        try:
            await run(page)
            print("iter63 fixture run completed")
        finally:
            await context.close()
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())