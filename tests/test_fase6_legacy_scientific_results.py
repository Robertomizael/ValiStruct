"""Fase 6: historical scientific results from another app version must be quarantined."""
from pathlib import Path
import os
import pytest

pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")


def test_legacy_aiken_and_latencia_results_require_recalculation():
    legacy={
        "name":"Proyecto 5.3 con resultados derivados",
        "author":"Prueba de regresión",
        "version":"3.0",
        "schemaVersion":"3.0",
        "release":{"channel":"beta","appVersion":"5.3.0-beta.1"},
        "semNodes":[],
        "semEdges":[],
        "semData":None,
        "aiken":[{
            "item":"Ítem 1","criterion":"Claridad","mean":4.6,"v":0.9,
            "ci":{"lower":0.463,"upper":0.989},"status":"Conservar","comment":""
        }],
        "semStructuralResults":{
            "paths":[{"from":"X","to":"Y","beta":0.5,"se":0.1,"t":5.0,"p":0.001}],
            "equations":[{"target":"Y","r2":0.25}]
        },
        "semMediationResults":None,
        "contentValidity":{"cvi":None,"lawshe":None,"delphi":None},
        "reliability":None,"efa":None,"cfa":None,
        "reportTitle":"","proSyntax":"","latenciaSyntax":""
    }

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        dialogs=[]
        page.on("dialog",lambda d:(dialogs.append(d.message),d.accept()))
        page.goto(URL,wait_until="load")
        page.evaluate("(s)=>restoreProject(s)",legacy)
        state=page.evaluate("""() => ({
            aikenCount: typeof lastResults==='undefined' ? -1 : lastResults.length,
            semActive: typeof semStructuralResults==='undefined' ? 'missing' : semStructuralResults,
            legacy: window.valistructLegacyScientificResults || null,
            report: typeof semReportHtml==='function' ? semReportHtml() : 'missing'
        })""")
        browser.close()

    assert state["aikenCount"]==0
    assert state["semActive"] is None
    assert state["report"] is None
    assert state["legacy"]["sourceAppVersion"]=="5.3.0-beta.1"
    assert state["legacy"]["aiken"][0]["ci"]["lower"]==0.463
    assert any("Recalcule V de Aiken y/o Latencia" in message for message in dialogs)
