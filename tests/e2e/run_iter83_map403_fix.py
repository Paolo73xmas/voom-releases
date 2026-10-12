import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright

from iter83_map403_fix import run


async def _run_browser(playwright, browser_name: str):
    browser_type = getattr(playwright, browser_name)
    browser = await browser_type.launch(headless=True)
    context = await browser.new_context()
    page = await context.new_page()
    try:
        result = await run(page)
        return {"browser": browser_name, "ok": True, "result": result}
    finally:
        await context.close()
        await browser.close()


async def main() -> None:
    out: list[dict] = []
    async with async_playwright() as p:
        for name in ("chromium", "webkit"):
            try:
                run_result = await _run_browser(p, name)
                out.append(run_result)
            except Exception as exc:
                out.append({"browser": name, "ok": False, "error": str(exc)})

    target = Path("/app/test_reports/artifacts_iter83/iter83_browser_matrix.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
