"""Motor Pro regression: button -> Flask /estimate -> lavaan -> rendered results and downloads."""
import os
import math
import random
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def csv_data(n=180):
    rng=random.Random(20260927)
    rows=["ID,i01,i02,i03,i04,i05,i06"]
    for i in range(n):
        f1=rng.gauss(0,1); f2=.35*f1+rng.gauss(0,.94)
        vals=[
            .80*f1+rng.gauss(0,.55), .75*f1+rng.gauss(0,.60), .70*f1+rng.gauss(0,.65),
            .82*f2+rng.gauss(0,.52), .74*f2+rng.gauss(0,.60), .68*f2+rng.gauss(0,.66)
        ]
        rows.append("P%03d,"% (i+1)+",".join(f"{v:.6f}" for v in vals))
    return ("\n".join(rows)+"\n").encode()

def open_motor(page):
    page.locator('.nav button[data-section="motorpro"]').click()
    assert page.locator("#motorpro").is_visible()

def test_motorpro_real_model_and_json_downloads():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(accept_downloads=True,viewport={"width":1440,"height":900})
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(URL,wait_until="load")
        open_motor(page)
        page.locator("#proCsvFile").set_input_files({
            "name":"motorpro_test.csv","mimeType":"text/csv","buffer":csv_data()
        })
        page.wait_for_function("document.querySelector('#proDatasetSummary')?.innerText.includes('180')")
        page.locator("#proEstimator").select_option("MLR")
        page.locator("#proDataType").select_option("continuous")
        page.locator("#proMissing").select_option("listwise")
        page.locator("#proBootstrap").fill("0")
        page.locator("#proSyntax").fill("F1 =~ i01 + i02 + i03\nF2 =~ i04 + i05 + i06\nF1 ~~ F2")
        assert page.locator("#runProModel").is_enabled()
        page.locator("#runProModel").click()
        page.wait_for_function("window.proLastResponse?.ok === true",timeout=180000)
        assert "Motor Pro" in page.locator("#proResults").inner_text()
        assert "CFI" in page.locator("#proResults").inner_text()
        assert "RMSEA" in page.locator("#proResults").inner_text()
        assert page.locator("#proResults table").count()>=1
        with page.expect_download() as payload:
            page.locator("#downloadProPayload").click()
        assert payload.value.suggested_filename.endswith("_solicitud.json")
        with page.expect_download() as result:
            page.locator("#downloadProReport").click()
        assert result.value.suggested_filename.endswith("_resultados.json")
        assert not errors,repr(errors)
        browser.close()

def test_motorpro_missing_dataset_and_offline_backend_show_visible_error():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.on("dialog",lambda d:d.accept())
        page.goto(URL,wait_until="load")
        open_motor(page)
        page.locator("#proSyntax").fill("F1 =~ i01 + i02 + i03")
        page.locator("#runProModel").click()
        assert page.locator("#proResults").inner_text()=="" or page.locator("#proResults").count()==1
        page.evaluate("""() => {
          proCsvText='i01,i02,i03\\n1,2,3\\n2,3,4\\n3,4,5\\n4,5,6\\n5,6,7';
          summarizeProCsv(proCsvText);
          localStorage.setItem('valistruct_api_base','http://127.0.0.1:9999');
        }""")
        page.locator("#runProModel").click()
        page.wait_for_function("document.querySelector('#proResults')?.innerText.includes('No se pudo ejecutar')",timeout=15000)
        assert "No se pudo ejecutar" in page.locator("#proResults").inner_text()
        browser.close()
