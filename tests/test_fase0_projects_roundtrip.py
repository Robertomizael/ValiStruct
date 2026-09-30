"""Fase 0 project safety: local roundtrip, privacy default and optional helpers."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def open_section(page,section):
    page.locator(f'.nav button[data-section="{section}"]').evaluate("(el)=>el.click()")
    page.wait_for_function("(id)=>document.getElementById(id)?.classList.contains('visible')",arg=section)

def test_project_roundtrip_and_raw_data_minimization():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(accept_downloads=True)
        page.on("dialog",lambda d:d.accept())
        page.goto(URL,wait_until="load")
        open_section(page,"projects")
        page.locator("#projectName").fill("Fase0 Roundtrip")
        page.locator("#projectAuthor").fill("Dr. Roberto Joel Tirado Reyes")
        page.evaluate("""() => {
          localStorage.removeItem('valistruct_privacy_v21');
          proCsvText='ID,i1,i2\\n1,1,2\\n2,2,3';
          semData=[[1,2],[2,3]];
          lastResults=[{item:'i1',criterion:'claridad',v:.90}];
          relLastResults={alpha:.88,itemRows:[]};
          efaLastResults={n:120,k:6};
          cfaLastResults={n:120};
        }""")
        state=page.evaluate("projectState()")
        assert state["version"]=="3.0"
        assert state["schemaVersion"]=="3.0"
        assert "proCsvText" not in state or state["proCsvText"] is None
        assert "semData" not in state or state["semData"] is None
        page.evaluate("saveProjectLocal()")
        stored=page.evaluate("JSON.parse(localStorage.getItem('valistruct_projects_v1'))[0]")
        assert stored["name"]=="Fase0 Roundtrip"
        assert stored["aiken"][0]["item"]=="i1"
        assert "proCsvText" not in stored or stored["proCsvText"] is None
        with page.expect_download() as download:
            page.locator("#exportProject").click()
        assert download.value.suggested_filename.endswith(".valistruct.json")
        page.evaluate("""() => {
          document.getElementById('projectName').value='Alterado';
          lastResults=[];
        }""")
        page.evaluate("(s)=>restoreProject(s)",stored)
        assert page.locator("#projectName").input_value()=="Fase0 Roundtrip"
        assert page.evaluate("lastResults[0].item")=="i1"
        browser.close()

def test_project_state_survives_missing_optional_preference_helpers():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        page.goto(URL,wait_until="load")
        result=page.evaluate("""() => {
          const originals={
            loadProfile,loadSettings,loadPrivacySettings,loadA11y,loadTelemetrySettings
          };
          try{
            loadProfile=undefined;
            loadSettings=undefined;
            loadPrivacySettings=undefined;
            loadA11y=undefined;
            loadTelemetrySettings=undefined;
            const state=projectState();
            return {ok:true,preferences:state.preferences};
          }catch(e){return {ok:false,error:e.message};}
          finally{
            loadProfile=originals.loadProfile;
            loadSettings=originals.loadSettings;
            loadPrivacySettings=originals.loadPrivacySettings;
            loadA11y=originals.loadA11y;
            loadTelemetrySettings=originals.loadTelemetrySettings;
          }
        }""")
        assert result["ok"],result
        assert result["preferences"]=={
            "profile":None,"settings":None,"privacy":None,
            "accessibility":None,"telemetry":None
        }
        browser.close()
