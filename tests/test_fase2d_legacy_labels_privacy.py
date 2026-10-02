"""Subfase 2D: SAV/DTA metadata must reach the canonical store without weakening privacy."""
import json
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def test_legacy_import_preserves_labels_and_reuses_canonical_store_privately():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(5000)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.on("dialog",lambda d:d.accept())

        payload={
            "ok":True,
            "csv_text":"ID,i01,i02\nP001,1,2\nP002,2,3\nP003,3,4\n",
            "rows":3,
            "columns":3,
            "meta":{
                "format":"SPSS SAV",
                "labels":{"i01":"Competencia clínica","i02":"Seguridad del paciente"},
                "value_labels":{"i01":{"1":"Bajo","2":"Alto"}}
            }
        }
        page.route("**/legacy-to-csv",lambda route:route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(payload,ensure_ascii=False)
        ))
        page.goto(URL,wait_until="load")

        page.evaluate("showSection('legacyimport')")
        page.locator("#legacyDataFile").set_input_files({
            "name":"instrumento_demo.sav",
            "mimeType":"application/octet-stream",
            "buffer":b"FAKE-SAV-FOR-FRONTEND-ROUTE"
        })
        page.locator("#convertLegacyFile").click()

        page.wait_for_function("window.ValiStructParticipantData?.summary?.source==='instrumento_demo.sav'")
        summary=page.evaluate("window.ValiStructParticipantData.summary")
        assert summary["format"]=="SPSS SAV"
        assert summary["n"]==3
        assert summary["labels"]["i01"]=="Competencia clínica"
        assert summary["labels"]["i02"]=="Seguridad del paciente"
        assert summary["valueLabels"]["i01"]["1"]=="Bajo"
        assert summary["valueLabels"]["i01"]["2"]=="Alto"

        assert "2 etiqueta(s) de variable detectadas" in page.locator("#legacyPreview").inner_text()

        page.locator("#legacyToDiagnostics").click()
        page.wait_for_function("document.getElementById('diagnostics')?.classList.contains('visible')")
        assert page.evaluate("diagData.n")==3
        assert page.evaluate("diagData.names.join(',')")=="i01,i02"
        assert page.evaluate("window.ValiStructParticipantData.summary.labels.i01")=="Competencia clínica"

        # Fail-closed privacy remains intact: canonical/raw records are not serialized by default.
        state=page.evaluate("""() => {
          localStorage.removeItem('valistruct_privacy_v21');
          document.getElementById('projectName').value='Legacy privacy';
          return projectState();
        }""")
        serialized=json.dumps(state,ensure_ascii=False)
        assert "P001" not in serialized
        assert "Competencia clínica" not in serialized
        assert '"Bajo"' not in serialized
        assert '"Alto"' not in serialized
        assert state.get("semData") is None or "semData" not in state
        assert state.get("proCsvText") is None or "proCsvText" not in state

        assert not errors,repr(errors)
        browser.close()
