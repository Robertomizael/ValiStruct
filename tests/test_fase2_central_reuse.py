"""Fase 2B: one central participant import feeds diagnostics, multivariate and missingness."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")
CSV=("ID,i01,i02,i03,sexo\n"+
     "\n".join(
       f"P{i:03d},{1+i%5},{2+(i*2)%5},{'' if i==7 else 1+(i*3)%5},{'F' if i%2 else 'M'}"
       for i in range(1,31)
     )+"\n").encode()

def test_one_central_import_reuses_diagnostics_multivariate_and_missingness():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(5000)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.on("dialog",lambda d:d.accept())
        page.goto(URL,wait_until="load")

        page.evaluate("showSection('dataimport')")
        page.locator("#unifiedDataFile").set_input_files({
            "name":"participantes_fase2.csv","mimeType":"text/csv","buffer":CSV
        })
        page.wait_for_function("window.ValiStructParticipantData?.summary?.n===30")

        page.locator("#importToDiagnostics").click()
        page.wait_for_function("document.getElementById('diagnostics')?.classList.contains('visible')")
        assert page.evaluate("diagData.n")==30
        assert page.evaluate("diagData.names.join(',')")=="i01,i02,i03"

        page.evaluate("showSection('dataimport')")
        page.locator("#importToMulti").click()
        page.wait_for_function("document.getElementById('multidiag')?.classList.contains('visible')")
        assert page.evaluate("multiData.n")==30
        assert page.evaluate("multiData.k")==3
        assert "Centro de datos" in page.locator("#multiRunStatus").inner_text()

        page.evaluate("showSection('dataimport')")
        page.locator("#importToMissing").click()
        page.wait_for_function("document.getElementById('missingpro')?.classList.contains('visible')")
        summary=page.locator("#missingSummary").inner_text()
        assert "30" in summary
        assert page.evaluate("missingDataText.includes('sexo')")

        assert page.evaluate("window.ValiStructParticipantData.summary.source")=="participantes_fase2.csv"
        assert not errors,repr(errors)
        browser.close()
