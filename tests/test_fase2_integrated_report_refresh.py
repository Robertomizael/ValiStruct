"""Fase 2 closure: integrated content-validity download must regenerate after recalculation."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def test_integrated_report_download_uses_latest_recalculated_values(tmp_path):
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True, accept_downloads=True)
        page=browser.new_page(viewport={"width":1440,"height":900}, accept_downloads=True)
        page.set_default_timeout(5000)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(URL,wait_until="load")
        page.evaluate("showSection('aiken')")

        page.locator("#loadLawsheExample").click()
        page.locator("#calculateLawshe").click()
        assert round(page.evaluate("lawsheLastResults.meanCvr"),3)==0.650

        page.locator("#buildContentValidityReport").click()
        assert "0.650" in page.locator("#contentValidityReportResults").inner_text()

        # Change all ratings to essential, recalculate to CVR mean = 1.000,
        # but do not press "Generar informe integrado" again.
        page.locator(".lawshe-rating").evaluate_all(
            "els=>els.forEach(el=>el.value='essential')"
        )
        page.locator("#calculateLawshe").click()
        assert round(page.evaluate("lawsheLastResults.meanCvr"),3)==1.000

        with page.expect_download() as info:
            page.locator("#downloadContentValidityReport").click()
        download=info.value
        path=download.path()
        html=open(path,encoding="utf-8").read()

        assert "CVR promedio: 1.000" in html
        assert "CVR promedio: 0.650" not in html
        assert not errors,repr(errors)
        browser.close()
