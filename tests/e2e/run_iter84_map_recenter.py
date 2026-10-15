import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

from iter84_map_recenter import run


async def main() -> None:
    result = {"ok": False}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        try:
            payload = await run(page)
            result = {"ok": True, "browser": "chromium", "result": payload}
        except Exception as exc:  # pragma: no cover - explicit artifact on failures
            result = {"ok": False, "browser": "chromium", "error": str(exc)}
        finally:
            await context.close()
            await browser.close()

    target = Path('/app/test_reports/artifacts_iter85/iter85_browser_result.json')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    asyncio.run(main())
