"""Fase 2 hardening: real user clicks can open each visible accordion group."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")


def test_visible_accordion_groups_open_with_real_clicks():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(4000)
        errors=[]
        page.on("pageerror",lambda exc: errors.append(str(exc)))
        page.goto(URL,wait_until="load")
        page.evaluate("window.scrollTo=()=>{}")

        groups=page.locator(".vs-v52-group:visible")
        count=groups.count()
        assert count>=1

        exercised=0
        for i in range(count):
            group=groups.nth(i)
            summary=group.locator("summary")
            if not group.evaluate("(el)=>el.open"):
                summary.click()
            assert group.evaluate("(el)=>el.open") is True

            buttons=group.locator("button[data-section]:visible")
            if buttons.count()==0:
                continue
            btn=buttons.first
            section=btn.get_attribute("data-section")
            btn.click()
            page.wait_for_function(
                "(id)=>document.getElementById(id)?.classList.contains('visible')",
                arg=section,
                timeout=4000,
            )
            exercised+=1

        assert exercised>=3, f"Expected to exercise at least 3 visible accordion groups, got {exercised}"
        assert not errors, errors
        browser.close()
