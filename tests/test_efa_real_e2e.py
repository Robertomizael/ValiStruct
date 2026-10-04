"""End-to-end AFE: browser -> Flask /efa -> R psych -> CSV/HTML downloads."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright
URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def open_efa(page):
    """Open AFE independently of the current accordion state."""
    page.locator(".nav button[data-section='efa']").evaluate("(el)=>el.click()")
    page.wait_for_function("document.getElementById('efa')?.classList.contains('visible')")

def test_real_r_paf_through_browser_and_exports():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(accept_downloads=True,viewport={"width":1440,"height":900})
        errors=[]
        page.on("pageerror",lambda e: errors.append(str(e)))
        page.goto(URL,wait_until="load")
        open_efa(page)
        page.locator("#loadEfaExample").click()
        page.locator("#efaExtraction").select_option("pa")
        page.locator("#efaRotation").select_option("varimax")
        page.locator("#efaParallelRuns").fill("20")
        page.locator("#calculateEfa").click()
        page.wait_for_function(
            "document.querySelector('#efaResults')?.innerText.includes('RESULTADO DEL MOTOR R')",
            timeout=180000)
        assert "Ejes principales" in page.locator("#efaResults").inner_text()
        assert page.locator("#efaResults .efa-diag-cards > div").count()==4
        assert page.locator("#efaResults .efa-r-results table").count() >=1
        assert page.locator("#efaScreeSvg").count() == 1
        assert page.locator("#efaVarianceExplained").count() == 1
        assert page.locator("#efaRotatedPattern").count() == 1
        assert "terminada" in page.locator("#efaEngineStatus").inner_text()
        with page.expect_download() as csv:
            page.locator("#downloadEfaResults").click()
        assert csv.value.suggested_filename.endswith("_resultados.csv")
        with page.expect_download() as html:
            page.locator("#downloadEfaReport").click()
        assert html.value.suggested_filename.endswith("_informe.html")
        assert not errors,repr(errors)
        browser.close()
