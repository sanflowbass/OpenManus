from __future__ import annotations
import asyncio
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List
from playwright.async_api import async_playwright, Browser, Page

class Navigator:
    def __init__(self, proxy: Optional[Dict[str, str]] = None, user_agent: Optional[str] = None, headless: bool = True, timeout_ms: int = 30000):
        self.proxy = proxy
        self.user_agent = user_agent
        self.headless = headless
        self.timeout_ms = timeout_ms

    async def navigate_and_har(self, url: str, har_path: str, wait_until: str = "networkidle", extra_steps: Optional[List[Dict[str, Any]]] = None) -> None:
        async with async_playwright() as pw:
            browser: Browser = await pw.chromium.launch(headless=self.headless)
            context = await browser.new_context(
                proxy=self.proxy,
                user_agent=self.user_agent,
                java_script_enabled=True,
                ignore_https_errors=True,
                record_har={"path": har_path, "omit_content": False}
            )
            try:
                page: Page = await context.new_page()
                page.set_default_timeout(self.timeout_ms)
                await page.goto(url, wait_until=wait_until)
                if extra_steps:
                    for step in extra_steps:
                        action = step.get("action")
                        selector = step.get("selector")
                        value = step.get("value")
                        if action == "click" and selector:
                            await page.click(selector)
                        elif action == "fill" and selector is not None and value is not None:
                            await page.fill(selector, value)
                        elif action == "wait" and value:
                            await page.wait_for_timeout(int(value))
            finally:
                await context.close()
                await browser.close()