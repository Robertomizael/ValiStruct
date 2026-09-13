"""
ValiStruct 2.8 - E2E smoke test scaffold.
Requires:
    pip install playwright pytest
    playwright install chromium
Serve the frontend over HTTP before running.
"""
import os
import pytest

pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def test_home_loads():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        page.goto(BASE_URL,wait_until="domcontentloaded")
        assert "ValiStruct" in page.title() or "ValiStruct" in page.locator("body").inner_text()
        browser.close()

def test_guided_project_section_exists():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        page.goto(BASE_URL,wait_until="domcontentloaded")
        assert page.locator("#guidedproject").count()==1
        browser.close()
