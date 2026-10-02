"""Fase 3B H-D: derived content-validity results survive project roundtrip without raw judge matrices."""
import json
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def test_content_validity_results_survive_project_roundtrip_without_raw_judge_data():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(5000)
        dialogs=[]
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.on("dialog",lambda d:(dialogs.append(d.message),d.accept()))
        page.goto(URL,wait_until="load")
        page.evaluate("showSection('aiken')")

        page.locator("#loadCviExample").click()
        page.locator("#calculateCvi").click()
        page.locator("#calculateModifiedKappa").click()
        page.locator("#loadLawsheExample").click()
        page.locator("#calculateLawshe").click()
        page.locator("#loadDelphiExample").click()
        page.locator("#calculateDelphi").click()

        state=page.evaluate("projectState()")
        cv=state["contentValidity"]
        assert round(cv["cvi"]["scviAve"],3)==0.833
        assert round(cv["cvi"]["meanKappa"],3)==0.772
        assert round(cv["lawshe"]["meanCvr"],3)==0.650
        assert cv["delphi"]["rounds"]==2

        # Project stores derived summaries, not the raw judge-entry matrices.
        serialized=json.dumps(state,ensure_ascii=False)
        assert "cvi-rating" not in serialized
        assert "lawshe-rating" not in serialized
        assert "delphi-rating" not in serialized

        page.evaluate("""() => {
          cviLastResults=null;
          lawsheLastResults=null;
          delphiLastResults=null;
          document.getElementById('cviResults').innerHTML='';
          document.getElementById('modifiedKappaResults').innerHTML='';
          document.getElementById('lawsheResults').innerHTML='';
          document.getElementById('delphiResults').innerHTML='';
        }""")
        page.evaluate("state=>restoreProject(state)",state)

        restored=page.evaluate("""() => ({
          scvi:cviLastResults?.scviAve,
          kappa:cviLastResults?.meanKappa,
          lawshe:lawsheLastResults?.meanCvr,
          rounds:delphiLastResults?.rounds
        })""")
        assert round(restored["scvi"],3)==0.833
        assert round(restored["kappa"],3)==0.772
        assert round(restored["lawshe"],3)==0.650
        assert restored["rounds"]==2

        assert "S-CVI/Ave" in page.locator("#cviResults").inner_text()
        assert "Kappa modificado" in page.locator("#modifiedKappaResults").inner_text()
        assert "CVR de Lawshe" in page.locator("#lawsheResults").inner_text()
        assert "Rondas registradas" in page.locator("#delphiResults").inner_text()

        # Historical project with no new field remains loadable.
        historical={"name":"Histórico","author":"","semNodes":[],"semEdges":[]}
        page.evaluate("state=>restoreProject(state)",historical)
        assert page.evaluate("cviLastResults") is None
        assert page.evaluate("lawsheLastResults") is None
        assert page.evaluate("delphiLastResults") is None

        assert not errors,repr(errors)
        browser.close()
