"""ValiStruct v5.1 stage-1 browser integration tests; run with HTTP frontend."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

BASE = os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")
CSV = b"ID,i1,i2,i3,sexo\nP001,1,2,3,F\nP002,2,,4,M\nP003,4,5,6,F\n"

@pytest.fixture()
def page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("dialog",lambda d:d.accept())
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(BASE,wait_until="load")
        yield page,errors
        browser.close()

def upload(page):
    page.locator('.nav button[data-section="dataimport"]').click()
    page.locator("#unifiedDataFile").set_input_files({
        "name":"participantes.csv","mimeType":"text/csv","buffer":CSV
    })
    page.wait_for_function("window.ValiStructParticipantData?.summary?.n === 3")
    page.locator("#participantItemNames").fill("i1, i2, i3")

def test_scientific_navigation_is_grouped_and_legacy_tools_survive(page):
    p,errors=page
    assert p.locator(".nav-v51-group").count() == 3
    assert p.locator('.nav button[data-section]').count() >= 75
    assert p.locator('.nav button[data-section="aiken"]').count() == 1
    assert p.locator('.nav button[data-section="motorpro"]').count() == 1
    assert "Autor conceptual y director científico" in p.locator(".nav-v51-credit").inner_text()
    assert not errors,repr(errors)

def test_one_import_reuses_participant_data_and_preserves_judges(page):
    p,errors=page
    p.evaluate("lastResults=[{v:0.85,item:'JUECES',criterion:'Claridad'}]")
    upload(p)
    assert p.evaluate("window.ValiStructParticipantData.summary.n")==3
    p.locator("#importToReliability").click()
    assert p.locator("#relDatasetSummary").inner_text().count("2") >= 1
    assert p.evaluate("relData.n") == 2
    assert p.evaluate("relData.k") == 3
    assert p.evaluate("lastResults[0].item") == "JUECES"
    p.locator('.nav button[data-section="dataimport"]').click()
    p.locator("#importToEfa").click()
    assert p.evaluate("efaData.n") == 2
    assert p.locator("#efaDatasetSummary").inner_text().count("2") >= 1
    p.locator('.nav button[data-section="dataimport"]').click()
    p.locator("#importToCfa").click()
    assert p.evaluate("cfaData.n") == 2
    assert p.evaluate("cfaData.itemNames.join(',')") == "i1,i2,i3"
    assert p.evaluate("lastResults[0].item") == "JUECES"
    assert not errors,repr(errors)

def test_dataset_change_invalidates_participant_results_not_aiken(page):
    p,errors=page
    upload(p)
    p.evaluate("""() => {
      lastResults=[{v:0.82,item:'CRITERIO_JUECES'}];
      relLastResults={alpha:.9,itemRows:[]};
      efaLastResults={m:2};
      proLastResponse={fit:{cfi:.95}};
    }""")
    p.locator("#unifiedDataFile").set_input_files({
        "name":"participantes_v2.csv","mimeType":"text/csv",
        "buffer": b"ID,i1,i2,i3,sexo\nP001,3,2,3,F\nP003,4,5,6,F\n"
    })
    p.wait_for_function("window.ValiStructParticipantData?.summary?.n === 2")
    assert p.evaluate("relLastResults === null && efaLastResults === null && proLastResponse === null")
    assert p.evaluate("lastResults[0].item") == "CRITERIO_JUECES"
    assert not errors,repr(errors)

def test_shared_store_rejects_ambiguous_headers(page):
    p,errors=page
    result=p.evaluate("""() => {
      try {
        window.ValiStructParticipantData.setCsv('ID,x,x\\nP01,1,2',{source:'duplicados.csv'});
        return 'accepted';
      } catch(e) { return e.message; }
    }""")
    assert "únicos" in result
    assert not errors,repr(errors)
