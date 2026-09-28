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

def test_five_factor_civp_style_350_by_28_with_mlr():
    import csv, io, requests
    rng=random.Random(371)
    out=io.StringIO();writer=csv.writer(out)
    items=[f"i{x:02d}" for x in range(1,29)]
    writer.writerow(["ID"]+items)
    blocks=[items[0:5],items[5:11],items[11:17],items[17:23],items[23:28]]
    for n in range(350):
        common=rng.gauss(0,1)
        latent=[.25*common+rng.gauss(0,1) for _ in blocks]
        values=[]
        for j,group in enumerate(blocks):
            values.extend([round(.75*latent[j]+rng.gauss(0,.60),6) for _ in group])
        writer.writerow([n+1]+values)
    syntax="\\n".join(
        f"F{j+1} =~ "+" + ".join(group) for j,group in enumerate(blocks))
    resp=requests.post(BACKEND+"/estimate",json={
        "csv_text":out.getvalue(),"syntax":syntax,"estimator":"MLR",
        "data_type":"continuous","missing":"listwise","bootstrap":0
    },timeout=240)
    assert resp.status_code==200,resp.text
    data=resp.json()
    assert data["ok"],data
    assert data["converged"]
    assert data["n"]==350
    assert data["estimator"]=="MLR"
    assert len([x for x in data["parameters"] if x["op"]=="=~"])==28


def test_reuse_multivariate_data_and_normalization(csv_text):
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        errors=[]
        page.on("pageerror",lambda err:errors.append(str(err)))
        page.goto(FRONTEND,wait_until="load")
        page.evaluate("""() => {
          multiData={names:['i01','i02','i03'],matrix:[[1,2,3],[2,3,4],[3,4,5]],
            n:3,k:3};
        }""")
        page.locator('.nav button[data-section="motorpro"]').click()
        page.locator("#useMotorMultiData").click()
        assert page.evaluate("proCsvText.split('\\n').length")==4
        assert page.evaluate("proCsvText.startsWith('i01,i02,i03')")
        assert "3 casos" in page.locator("#motorProDataStatus").inner_text()
        assert not errors,repr(errors)
        browser.close()


def test_injected_electron_renderer_patch_preserves_canonical_executor():
    from pathlib import Path
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        errors=[];page.on("pageerror",lambda err:errors.append(str(err)))
        page.goto(FRONTEND,wait_until="load")
        patch=(Path(__file__).resolve().parents[1]/"desktop"/"renderer-fixes.js").read_text()
        page.add_script_tag(content=patch)
        assert page.locator("#sendCfaToMotorPro").count()==1
        page.locator('.nav button[data-section="motorpro"]').click()
        page.locator("#proSyntax").fill("F1 = i01, i02, i03")
        page.on("dialog",lambda dialog:dialog.accept())
        page.locator("#runProModel").click()
        assert page.locator("#proSyntax").input_value()=="F1 =~ i01 + i02 + i03"
        assert "Importe" in page.locator("#proResults").inner_text()
        assert not errors,repr(errors)
        browser.close()


def test_standalone_file_protocol_ignores_stale_server_address(csv_text):
    from pathlib import Path
    file_url=(Path(__file__).resolve().parents[1]/"index.html").as_uri()
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        errors=[];page.on("pageerror",lambda err:errors.append(str(err)))
        page.goto(file_url,wait_until="load")
        page.evaluate("localStorage.setItem('valistruct_api_base','https://obsolete.example.org')")
        assert page.evaluate("getProApiBase()")=="http://127.0.0.1:8765"
        page.locator('.nav button[data-section="motorpro"]').click()
        page.locator("#proCsvFile").set_input_files({
            "name":"standalone.csv","mimeType":"text/csv","buffer":csv_text.encode()
        })
        page.wait_for_function("proCsvText?.includes('i01')")
        page.locator("#proEstimator").select_option("ML")
        page.locator("#proBootstrap").fill("0")
        page.locator("#proSyntax").fill("F1 =~ i01 + i02 + i03\\nF2 =~ i04 + i05 + i06")
        page.locator("#runProModel").click()
        page.wait_for_function("proLastResponse?.ok===true",timeout=180000)
        assert "Convergencia" in page.locator("#proResults").inner_text()
        assert not errors,repr(errors)
        browser.close()


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
