"""Fase 6C: historical scientific results are quarantined and Delphi evaluation stays configuration-locked."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")


def test_legacy_aiken_and_incomplete_latencia_are_preserved_but_not_reactivated():
    legacy={
        "version":"3.0",
        "name":"Proyecto histórico",
        "author":"Prueba",
        "semNodes":[],
        "semEdges":[],
        "semData":None,
        "semStructuralResults":{
            "paths":[{"from":"X","to":"Y","beta":0.4,"se":0.1,"t":4.0}],
            "equations":[{"target":"Y","r2":0.25}]
        },
        "semMediationResults":None,
        "aiken":[{
            "item":"Ítem 1","criterion":"Claridad","v":0.9,
            "ci":{"lower":0.463,"upper":0.989},
            "mean":4.6,"status":"Favorable"
        }],
        "contentValidity":{"cvi":None,"lawshe":None,"delphi":None},
        "reliability":None,"efa":None,"cfa":None,
        "reportTitle":"","proSyntax":"","latenciaSyntax":""
    }
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        page.on("dialog",lambda d:d.accept())
        page.goto(URL,wait_until="load")
        page.evaluate("(s)=>restoreProject(s)",legacy)

        assert page.evaluate("lastResults.length")==0
        assert page.evaluate("semStructuralResults===null")
        preserved=page.evaluate("window.valistructLegacyScientificResults")
        assert len(preserved["aiken"])==1
        assert preserved["latencia"]["paths"][0]["beta"]==0.4
        assert "histórico" in page.locator("#aikenResults").inner_text().lower()
        assert "histórico" in page.locator("#semResults").inner_text().lower()
        browser.close()


def test_current_scientific_format_can_restore_current_aiken_results():
    current={
        "version":"3.0",
        "scientificResultsVersion":"5.4-fase6",
        "name":"Proyecto actual",
        "semNodes":[],"semEdges":[],"semData":None,
        "semStructuralResults":None,"semMediationResults":None,
        "aiken":[{
            "item":"Ítem 1","criterion":"Claridad","v":0.9,
            "ci":{"lower":0.698966,"upper":0.972134},
            "mean":4.6,"status":"Favorable"
        }],
        "contentValidity":{"cvi":None,"lawshe":None,"delphi":None},
        "reliability":None,"efa":None,"cfa":None,
        "reportTitle":"","proSyntax":"","latenciaSyntax":""
    }
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        page.on("dialog",lambda d:d.accept())
        page.goto(URL,wait_until="load")
        page.evaluate("(s)=>restoreProject(s)",current)
        assert page.evaluate("lastResults.length")==1
        assert page.evaluate("lastResults[0].ci.lower")==pytest.approx(0.698966)
        browser.close()


def test_delphi_evaluation_blocks_configuration_change_after_round_start():
    dialogs=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        page.on("dialog",lambda d:(dialogs.append(d.message),d.accept()))
        page.goto(URL,wait_until="load")

        page.evaluate("""() => {
          document.getElementById('delphiJudgeCount').value='5';
          document.getElementById('delphiItemCount').value='3';
          document.getElementById('delphiScaleMin').value='1';
          document.getElementById('delphiScaleMax').value='5';
          document.getElementById('delphiFavorableFrom').value='4';
          document.getElementById('delphiAgreementThreshold').value='75';
          document.getElementById('delphiIqrThreshold').value='1';
          buildDelphi();
          document.getElementById('delphiItemCount').value='2';
          evaluateDelphi();
        }""")

        assert page.evaluate("delphiLastResults===null")
        assert any("configuración Delphi cambió" in x for x in dialogs)
        browser.close()
