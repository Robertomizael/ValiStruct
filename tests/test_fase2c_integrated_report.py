"""Subfase 2C: integrated report must summarize methods without combining heterogeneous coefficients."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def test_integrated_content_validity_report_keeps_methods_separate():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(5000)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(URL,wait_until="load")
        page.evaluate("showSection('aiken')")

        page.locator("#loadCviExample").click()
        page.locator("#calculateCvi").click()
        page.locator("#calculateModifiedKappa").click()

        page.locator("#loadLawsheExample").click()
        page.locator("#calculateLawshe").click()

        page.locator("#loadDelphiExample").click()
        page.locator("#calculateDelphi").click()

        page.locator("#buildContentValidityReport").click()

        text=page.locator("#contentValidityReportResults").inner_text()
        assert "Delphi" in text
        assert "I-CVI / S-CVI/Ave" in text
        assert "Kappa modificado" in text
        assert "CVR de Lawshe" in text
        assert "puntaje global combinando" in text
        assert "puntaje global:" not in text.lower()

        snapshot=page.evaluate("contentValiditySnapshot()")
        labels=[m["label"] for m in snapshot]
        assert "Delphi" in labels
        assert "I-CVI / S-CVI/Ave" in labels
        assert "Kappa modificado" in labels
        assert "CVR de Lawshe" in labels
        assert not errors,repr(errors)
        browser.close()
