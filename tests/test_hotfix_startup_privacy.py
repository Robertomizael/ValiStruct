"""Fase 0-A: browser start-up and privacy regression tests (no backend required)."""
import json
import os
import pytest

pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("VALISTRUCT_FRONTEND_URL", "http://127.0.0.1:8000")

@pytest.fixture()
def page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE_URL, wait_until="load")
        yield page, errors
        browser.close()

def test_full_app_loads_without_js_errors(page):
    browser_page, errors = page
    assert not errors, "Uncaught JavaScript errors: " + repr(errors)
    assert browser_page.evaluate("typeof buildQualityDashboard") == "function"
    assert browser_page.evaluate("typeof previewUnifiedCsv") == "function"
    assert browser_page.evaluate("typeof projectState") == "function"
    assert browser_page.evaluate("typeof window.ValiStructJaspImporter?.parse") == "function"

def test_reliability_writes_dashboard_and_report_adapter(page):
    browser_page, errors = page
    browser_page.evaluate("relExample(); calcRel();")
    result = browser_page.evaluate("({alpha:relLastResults.alpha, itemCount:relLastResults.itemRows.length, legacy:relLast.A})")
    assert result["itemCount"] == 6
    assert isinstance(result["alpha"], (int, float))
    assert abs(result["alpha"] - result["legacy"]) < 1e-12
    browser_page.evaluate("buildQualityDashboard()")
    assert "Confiabilidad" in browser_page.locator("#qualityDashboardContent").inner_text()
    assert not errors, repr(errors)

def test_project_privacy_is_fail_closed_and_explicit_opt_in(page):
    browser_page, errors = page
    outcome = browser_page.evaluate("""() => {
      localStorage.removeItem('valistruct_privacy_v21');
      semData = [{id:'SENSITIVE_TEST_SEM'}];
      proCsvText = 'ID,diagnosis\\nSENSITIVE_TEST,1';
      document.getElementById('projectName').value = 'Privacy Regression';
      const defaultState = projectState();
      const defaultJson = JSON.stringify(defaultState);
      localStorage.setItem('valistruct_privacy_v21', JSON.stringify({rawData:'yes'}));
      const consentState = projectState();
      localStorage.removeItem('valistruct_privacy_v21');
      return {
        defaultContainsRaw: defaultJson.includes('SENSITIVE_TEST'),
        defaultSem: defaultState.semData,
        defaultPro: defaultState.proCsvText,
        consentSem: consentState.semData,
        consentPro: consentState.proCsvText
      };
    }""")
    assert not outcome["defaultContainsRaw"]
    assert outcome["defaultSem"] is None
    assert outcome["defaultPro"] is None
    assert outcome["consentSem"]
    assert "SENSITIVE_TEST" in outcome["consentPro"]
    assert not errors, repr(errors)

def test_save_and_export_project_without_new_project_click(page):
    browser_page, errors = page
    browser_page.evaluate("""() => {
      localStorage.removeItem('valistruct_privacy_v21');
      document.getElementById('projectName').value='Startup Regression';
    }""")
    browser_page.on("dialog", lambda dialog: dialog.accept())
    browser_page.evaluate("saveProjectLocal()")
    saved = browser_page.evaluate("JSON.parse(localStorage.getItem('valistruct_projects_v1'))")
    assert saved and saved[0]["name"] == "Startup Regression"
    assert saved[0].get("proCsvText") is None
    assert saved[0].get("semData") is None
    assert not errors, repr(errors)
