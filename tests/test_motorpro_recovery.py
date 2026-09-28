"""Motor Pro restoration: one real backend, browser click, renderer patch and exported response."""
import math, os, random
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

FRONTEND=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")
BACKEND=os.getenv("VALISTRUCT_API_URL","http://127.0.0.1:8765")

@pytest.fixture()
def csv_text():
    import csv, io
    rng=random.Random(20260927)
    buf=io.StringIO()
    out=csv.writer(buf)
    out.writerow(["ID","i01","i02","i03","i04","i05","i06"])
    for i in range(220):
        latent_a,latent_b=rng.gauss(0,1),rng.gauss(0,1)
        out.writerow([f"P{i+1:04d}"]+
            [round(.75*latent_a+rng.gauss(0,.6),6) for _ in range(3)]+
            [round(.72*latent_b+rng.gauss(0,.65),6) for _ in range(3)])
    return buf.getvalue()

def test_backend_health_and_ml_estimation(csv_text):
    import requests
    health=requests.get(BACKEND+"/health",timeout=30)
    assert health.status_code==200,health.text
    assert health.json()["ok"] is True
    result=requests.post(BACKEND+"/estimate",json={
        "csv_text":csv_text,
        "syntax":"F1 =~ i01 + i02 + i03\nF2 =~ i04 + i05 + i06",
        "estimator":"ML","data_type":"continuous","missing":"listwise",
        "bootstrap":0
    },timeout=180)
    assert result.status_code==200,result.text
    data=result.json()
    assert data["ok"] and data["converged"]
    assert len(data["parameters"])>=6
    assert data["fit"].get("cfi") is not None

def test_motorpro_browser_and_report_download(csv_text):
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(accept_downloads=True,viewport={"width":1440,"height":900})
        errors=[]
        page.on("pageerror",lambda error:errors.append(str(error)))
        page.goto(FRONTEND,wait_until="load")
        page.locator('.nav button[data-section="motorpro"]').click()
        assert page.locator("#proBootstrap").input_value()=="0"
        page.locator("#proCsvFile").set_input_files({"name":"test.csv","mimeType":"text/csv","buffer":csv_text.encode()})
        page.wait_for_function("typeof proCsvText==='string' && proCsvText.includes('i01')")
        page.locator("#proEstimator").select_option("ML")
        page.locator("#proMissing").select_option("listwise")
        page.locator("#proBootstrap").fill("0")
        page.locator("#proSyntax").fill("F1 =~ i01 + i02 + i03\nF2 =~ i04 + i05 + i06")
        page.locator("#checkProEngine").click()
        page.wait_for_function("document.querySelector('#proEngineStatusText')?.textContent.includes('Motor disponible')",timeout=30000)
        page.locator("#runProModel").click()
        page.wait_for_function("typeof proLastResponse!=='undefined' && proLastResponse?.ok && proLastResponse?.parameters?.length>5",timeout=180000)
        assert "Convergencia" in page.locator("#proResults").inner_text()
        with page.expect_download() as report:
            page.locator("#downloadProReport").click()
        assert report.value.suggested_filename.endswith(".json")
        assert not errors,repr(errors)
        browser.close()

def test_desktop_patch_does_not_replace_one_canonical_motor_action(csv_text):
    from pathlib import Path
    patch=Path(__file__).resolve().parents[1]/"desktop"/"renderer-fixes.js"
    source=patch.read_text(encoding="utf8")
    assert "stopImmediatePropagation()" not in source
    assert "runProModel" in source  # normalize syntax, never start a second estimate

def test_missing_data_has_clear_feedback():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        page.on("dialog",lambda dialog:dialog.accept())
        page.goto(FRONTEND,wait_until="load")
        page.locator('.nav button[data-section="motorpro"]').click()
        page.locator("#proSyntax").fill("F1 =~ i01 + i02 + i03")
        page.locator("#runProModel").click()
        assert "importe" in page.locator("#proResults").inner_text().lower() or "base" in page.locator("#proResults").inner_text().lower()
        browser.close()
