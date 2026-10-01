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
        page.on("dialog",lambda d:d.accept())
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


def test_imports_from_core_modules_update_same_canonical_store(page):
    p,errors=page
    complete=("ID,i01,i02,i03\n"+
              "\n".join(f"P{i:03d},{1+i%5},{2+(i*2)%5},{1+(i*3)%5}" for i in range(1,21))+"\n").encode()
    checks=[
        ("reliability","#relCsvFile","reliability.csv"),
        ("efa","#efaCsvFile","efa.csv"),
        ("cfa","#cfaCsvFile","cfa.csv"),
        ("motorpro","#proCsvFile","motor.csv"),
    ]
    for section,selector,name in checks:
        p.evaluate(f"showSection('{section}')")
        p.locator(selector).set_input_files({"name":name,"mimeType":"text/csv","buffer":complete})
        p.wait_for_function(
            "(name)=>window.ValiStructParticipantData?.summary?.source===name",
            arg=name
        )
        assert p.evaluate("window.ValiStructParticipantData.summary.n")==20
    assert not errors,repr(errors)

def test_replacing_canonical_dataset_invalidates_local_module_copies(page):
    p,errors=page
    load_central(p)
    p.evaluate("showSection('diagnostics')")
    p.locator("#useCentralDataForDiagnostics").click()
    p.evaluate("showSection('multidiag')")
    p.locator("#useCentralDataForMulti").click()
    assert p.evaluate("diagData!==null && multiData!==null")
    replacement=b"ID,i01,i02,i03\nP001,1,2,3\nP002,2,3,4\nP003,3,4,5\n"
    p.evaluate("showSection('dataimport')")
    p.locator("#unifiedDataFile").set_input_files({
        "name":"replacement.csv","mimeType":"text/csv","buffer":replacement
    })
    p.wait_for_function("window.ValiStructParticipantData?.summary?.source==='replacement.csv'")
    stale=p.evaluate("""() => ({
      rel:relData,efa:efaData,cfa:cfaData,diag:diagData,multi:multiData,
      missing:missingDataText,pro:proCsvText,sem:semData
    })""")
    assert all(value is None for value in stale.values()),stale
    assert not errors,repr(errors)


def test_legacy_sav_conversion_becomes_canonical_without_second_import(page):
    p,errors=page
    p.route("**/legacy-to-csv",lambda route:route.fulfill(
        status=200,content_type="application/json",
        body='{"ok":true,"csv_text":"ID,i01,i02\\nP001,1,2\\nP002,2,3\\nP003,3,4\\n","rows":3,"columns":3,"meta":{"format":"SPSS SAV","labels":{"i01":"Item 1"}}}'
    ))
    p.evaluate("showSection('legacyimport')")
    p.locator("#legacyDataFile").set_input_files({
        "name":"ensayo.sav","mimeType":"application/octet-stream","buffer":b"fake-sav-for-mocked-ui"
    })
    p.locator("#convertLegacyFile").click()
    p.wait_for_function("window.ValiStructParticipantData?.summary?.source==='ensayo.sav'")
    summary=p.evaluate("window.ValiStructParticipantData.summary")
    assert summary["format"]=="SPSS SAV"
    assert summary["n"]==3
    assert summary["labels"]["i01"]=="Item 1"
    p.locator("#legacyToDiagnostics").click()
    assert p.evaluate("diagData.n")==3
    assert p.evaluate("diagData.names.join(',')")=="i01,i02"
    assert not errors,repr(errors)


def test_standard_missing_tokens_are_consistent_in_shared_missingness(page):
    p,errors=page
    raw=b"ID,i01,i02\nP001,1,NA\nP002,2,N/A\nP003,3,NULL\nP004,4,.\nP005,5,6\n"
    p.evaluate("showSection('dataimport')")
    p.locator("#unifiedDataFile").set_input_files({
        "name":"missing_tokens.csv","mimeType":"text/csv","buffer":raw
    })
    p.wait_for_function("window.ValiStructParticipantData?.summary?.n===5")
    frame=p.evaluate("window.ValiStructParticipantData.numericFrame({firstColumn:'auto'})")
    assert frame["nExcluded"]==4
    p.evaluate("showSection('missingpro')")
    p.locator("#useCentralDataForMissing").click()
    summary=p.locator("#missingSummary").inner_text()
    assert "4" in summary
    p.locator("#runMissingPattern").click()
    assert "Patrones de ausencia" in p.locator("#missingResults").inner_text()
    assert not errors,repr(errors)


def test_central_item_selection_controls_diagnostics_and_multivariate(page):
    p,errors=page
    load_central(p)
    p.evaluate("showSection('dataimport')")
    p.locator("#participantItemNames").fill("i01, i02")
    p.evaluate("showSection('diagnostics')")
    p.locator("#useCentralDataForDiagnostics").click()
    assert p.evaluate("diagData.k")==2
    assert p.evaluate("diagData.names.join(',')")=="i01,i02"
    p.evaluate("showSection('multidiag')")
    p.locator("#useCentralDataForMulti").click()
    assert p.evaluate("multiData.k")==2
    assert p.evaluate("multiData.names.join(',')")=="i01,i02"
    assert not errors,repr(errors)


def test_data_center_routes_directly_to_new_shared_destinations(page):
    p,errors=page
    load_central(p)
    p.evaluate("showSection('dataimport')")
    p.locator("#importToMulti").click()
    assert p.locator("#multidiag").is_visible()
    assert p.evaluate("multiData.n")==30

    p.evaluate("showSection('dataimport')")
    p.locator("#importToMissing").click()
    assert p.locator("#missingpro").is_visible()
    assert "30" in p.locator("#missingSummary").inner_text()

    p.evaluate("showSection('dataimport')")
    p.locator("#importToLatencia").click()
    assert p.locator("#latencia").is_visible()
    assert p.evaluate("semData.n")==29
    assert not errors,repr(errors)


def test_project_state_keeps_canonical_data_private_by_default_and_restores_with_consent(page):
    p,errors=page
    load_central(p)
    private_state=p.evaluate("projectState()")
    assert "participantData" not in private_state
    p.evaluate("""() => {
      localStorage.setItem('valistruct_privacy_v21',JSON.stringify({
        rawData:'yes',variableNames:'yes',backendMode:'local',clearOnClose:'no'
      }));
    }""")
    consent_state=p.evaluate("projectState()")
    assert consent_state["participantData"]["source"]=="participantes_fase2.csv"
    assert "sexo" in consent_state["participantData"]["csv"]
    p.evaluate("window.ValiStructParticipantData.clear()")
    assert p.evaluate("window.ValiStructParticipantData.summary") is None
    p.evaluate("(state)=>restoreProject(state)",consent_state)
    p.wait_for_function("window.ValiStructParticipantData?.summary?.n===30")
    restored=p.evaluate("window.ValiStructParticipantData.summary")
    assert restored["source"]=="participantes_fase2.csv"
    assert not errors,repr(errors)
