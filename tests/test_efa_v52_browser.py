"""AFE v5.2 regression: visible actions, diagnostics without ACP, CSV exports."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def open_efa(page):
    """Open AFE independently of the current accordion state."""
    page.locator(".nav button[data-section=\'efa\']").evaluate("(el)=>el.click()")
    page.wait_for_function("document.getElementById(\'efa\')?.classList.contains(\'visible\')")

def test_efa_toolbar_diagnostics_and_local_export():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(accept_downloads=True,viewport={"width":1440,"height":900})
        errors=[]
        page.on("pageerror",lambda e: errors.append(str(e)))
        page.goto(URL,wait_until="load")
        page.locator(".nav button[data-section='efa']").click()
        assert page.locator("#efaActions").is_visible()
        assert page.locator("#efaDiagnostics").is_visible()
        assert page.locator("#calculateEfa").is_visible()
        assert page.locator("#downloadEfaResults").is_visible()
        assert page.locator("#downloadEfaReport").is_visible()
        assert page.locator("#efaExtraction option").count()==7
        assert page.locator("#efaExtraction option[value='image']").get_attribute("disabled") is not None
        page.locator("#loadEfaExample").click()
        page.route("**/efa",lambda route:route.fulfill(status=503,content_type="application/json",
            headers={"Access-Control-Allow-Origin":"*"},body='{"ok":false,"error":"R desconectado (prueba)"}'))
        page.locator("#efaDiagnostics").click()
        page.wait_for_function("document.querySelector('#efaDiagnosticResults')?.innerText.includes('KMO global')",timeout=10000)
        assert "requiere R" in page.locator("#efaEngineStatus").inner_text()
        page.locator("#efaExtraction").select_option("pca")
        page.locator("#calculateEfa").click()
        page.wait_for_function("document.querySelector('#efaResults')?.innerText.includes('KMO global')",timeout=12000)
        with page.expect_download() as download:
            page.locator("#downloadEfaResults").click()
        assert download.value.suggested_filename.endswith(".csv")
        assert not errors,repr(errors)
        browser.close()

def test_restored_jacobi_eigen_decomposition():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        page.goto(URL,wait_until="load")
        eig=page.evaluate("jacobiEigen([[2,1],[1,2]])")
        assert abs(eig["values"][0]-3)<1e-8
        assert abs(eig["values"][1]-1)<1e-8
        assert len(eig["vectors"])==2
        browser.close()

def test_r_factor_methods_do_not_fall_back_silently():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.goto(URL,wait_until="load")
        page.locator(".nav button[data-section='efa']").click()
        page.locator("#loadEfaExample").click()
        page.locator("#efaExtraction").select_option("pa")
        # Intercept the request; no R backend here. The app must explain failure
        # rather than produce PCA results under a misleading PAF label.
        page.route("**/efa",lambda route:route.fulfill(status=503,content_type="application/json",
            headers={"Access-Control-Allow-Origin":"*"},body='{"ok":false,"error":"R no disponible (prueba)"}'))
        page.locator("#calculateEfa").click()
        page.wait_for_function("document.querySelector('#efaEngineStatus')?.textContent.includes('R no disponible')",timeout=15000)
        assert "Extracción ACP" not in page.locator("#efaResults").inner_text()
        browser.close()
