"""Fase 6: independent-audit remediation gates for desktop lifecycle and legacy scientific safety."""
from pathlib import Path
import os
import pytest

ROOT=Path(__file__).resolve().parents[1]


def test_desktop_lifecycle_security_and_userdata_guards():
    main=(ROOT/"desktop/main.js").read_text(encoding="utf-8")

    assert "if (backendProcess && backendProcess.exitCode === null && !backendProcess.killed) return backendProcess;" in main
    assert "VALISTRUCT_PROJECT_DIR: path.join(app.getPath('userData'), 'projects')" in main
    assert "setWindowOpenHandler" in main
    assert "will-navigate" in main
    assert "shell.openExternal(url)" in main


def test_legacy_scientific_results_are_quarantined_in_source():
    app=(ROOT/"app.js").read_text(encoding="utf-8")

    assert "legacyScientificResults=sourceAppVersion!==VALISTRUCT_RELEASE.version" in app
    assert "semStructuralResults=legacyScientificResults?null:" in app
    assert "semMediationResults=legacyScientificResults?null:" in app
    assert "Los resultados científicos derivados de una versión anterior no se activaron" in app
    assert "Number.isFinite(p.df)?p.df:'—'" in app
    assert "Number.isFinite(e.dfResidual)?e.dfResidual:'—'" in app


def test_legacy_project_restore_requires_recalculation():
    pytest.importorskip("playwright.sync_api")
    from playwright.sync_api import sync_playwright

    url=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        messages=[]
        page.on("dialog",lambda d:(messages.append(d.message),d.accept()))
        page.goto(url,wait_until="load")
        page.evaluate("""
          restoreProject({
            name:'Legacy',
            release:{appVersion:'5.3.0-beta.1'},
            aiken:[{V:0.9,lower:0.463,upper:0.989}],
            semStructuralResults:{paths:[{from:'X',to:'Y',beta:.2,se:.1,t:2,p:.05}],equations:[{target:'Y',r2:.1}]},
            semMediationResults:[]
          })
        """)
        assert page.evaluate("lastResults.length")==0
        assert page.evaluate("semStructuralResults===null")
        assert any("Recalcule V de Aiken y/o Latencia" in m for m in messages)
        browser.close()
