"""Fase 3D: Penfield-Giacobbi score interval for Aiken V must use n*k."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def test_aiken_score_interval_uses_scale_range():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(5000)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(URL,wait_until="load")

        ci=page.evaluate("scoreCI(.9,5,4,.95)")
        assert ci["lower"]==pytest.approx(0.6989663548,abs=1e-9)
        assert ci["upper"]==pytest.approx(0.9721335188,abs=1e-9)

        page.evaluate("showSection('aiken')")
        page.locator("#judgeCount").fill("5")
        page.locator("#itemCount").fill("1")
        page.locator("#scaleMin").fill("1")
        page.locator("#scaleMax").fill("5")
        page.locator(".criterion-check").evaluate_all(
            """els=>els.forEach((el,i)=>el.checked=i===0)"""
        )
        page.locator("#buildMatrix").click()

        values=["5","5","4","5","4"]
        ratings=page.locator(".rating")
        assert ratings.count()==5
        for i,val in enumerate(values):
            ratings.nth(i).fill(val)

        page.locator("#calculateAiken").click()
        result=page.evaluate("""() => ({
          v:lastResults[0].v,
          lower:lastResults[0].ci.lower,
          upper:lastResults[0].ci.upper
        })""")
        assert result["v"]==pytest.approx(.9,abs=1e-12)
        assert result["lower"]==pytest.approx(0.6989663548,abs=1e-9)
        assert result["upper"]==pytest.approx(0.9721335188,abs=1e-9)
        assert "0.699–0.972" in page.locator("#aikenResults").inner_text()

        assert not errors,repr(errors)
        browser.close()
