"""Fase 2A: one participant dataset must feed scientific modules without re-importing.
All data are synthetic and remain in browser memory.
"""
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

@pytest.fixture()
def page():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(URL,wait_until="load")
        yield page,errors
        browser.close()

def load_central(page):
    page.evaluate("showSection('dataimport')")
    page.locator("#unifiedDataFile").set_input_files({
        "name":"participantes_fase2.csv","mimeType":"text/csv","buffer":CSV
    })
    page.wait_for_function("window.ValiStructParticipantData?.summary?.n === 30")

def test_canonical_store_preserves_full_csv_and_numeric_frame(page):
    p,errors=page
    load_central(p)
    summary=p.evaluate("window.ValiStructParticipantData.summary")
    assert summary["n"]==30
    assert summary["variables"]==["ID","i01","i02","i03","sexo"]
    frame=p.evaluate("window.ValiStructParticipantData.numericFrame({firstColumn:'auto'})")
    assert frame["names"]==["i01","i02","i03"]
    assert frame["n"]==30
    assert frame["nComplete"]==29
    assert frame["nExcluded"]==1
    csv=p.evaluate("window.ValiStructParticipantData.toCsv()")
    assert "sexo" in csv and "P007" in csv
    assert not errors,repr(errors)

def test_one_load_reuses_diagnostics_multivariate_missing_motor_and_latencia(page):
    p,errors=page
    load_central(p)

    p.evaluate("showSection('diagnostics')")
    p.locator("#useCentralDataForDiagnostics").click()
    assert p.evaluate("diagData.n")==30
    assert p.evaluate("diagData.names.join(',')")=="i01,i02,i03"

    p.evaluate("showSection('multidiag')")
    p.locator("#useCentralDataForMulti").click()
    assert p.evaluate("multiData.n")==30
    assert p.evaluate("multiData.k")==3
    p.locator("#runMultiDiagnostics").click()
    p.wait_for_function("document.querySelector('#multiRunStatus')?.textContent.includes('Cálculo completado')",timeout=25000)
    assert p.evaluate("multiLast.n")==29
    assert p.evaluate("multiLast.nExcluded")==1

    p.evaluate("showSection('missingpro')")
    p.locator("#useCentralDataForMissing").click()
    assert "30" in p.locator("#missingSummary").inner_text()
    assert "1" in p.locator("#missingSummary").inner_text()

    p.evaluate("showSection('motorpro')")
    p.locator("#useCentralDataForPro").click()
    assert "participantes_fase2.csv" in p.locator("#proRunStatus").inner_text()
    assert p.evaluate("proCsvText.includes('sexo')")

    p.evaluate("showSection('latencia')")
    p.locator("#useCentralDataForLatencia").click()
    assert p.evaluate("semData.n")==29
    assert p.evaluate("semData.names.join(',')")=="i01,i02,i03"
    assert "1 excluidos" in p.locator("#semDatasetSummary").inner_text()
    assert not errors,repr(errors)

def test_importing_from_diagnostics_updates_canonical_store(page):
    p,errors=page
    p.evaluate("showSection('diagnostics')")
    p.locator("#diagCsvFile").set_input_files({
        "name":"desde_diagnostico.csv","mimeType":"text/csv","buffer":CSV
    })
    p.wait_for_function("window.ValiStructParticipantData?.summary?.source === 'desde_diagnostico.csv'")
    assert p.evaluate("diagData.names.join(',')")=="i01,i02,i03"
    p.evaluate("showSection('missingpro')")
    p.locator("#useCentralDataForMissing").click()
    assert "30" in p.locator("#missingSummary").inner_text()
    assert not errors,repr(errors)
