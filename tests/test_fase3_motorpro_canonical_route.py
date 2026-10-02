"""Fase 3A H-C: all Motor Pro reuse paths must consume canonical participant CSV."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")
CANON="ID,i01,i02\nP001,1,2\nP002,2,3\n"
STALE="ID,i01,i02\nOLD,9,9\n"

def test_motorpro_reuse_paths_share_canonical_source():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(5000)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(URL,wait_until="load")

        page.evaluate(
            """({canon,stale})=>{
              window.ValiStructParticipantData.setCsv(canon,{source:'canonica.csv',format:'csv'});
              window.unifiedCsvText=stale;
              window.unifiedSourceName='obsoleta.csv';
              window.legacyCsvText=stale;
              window.proCsvText='';
            }""",
            {"canon":CANON,"stale":STALE},
        )

        assert page.evaluate("reuseCentralDataForMotorPro()") is True
        assert page.evaluate("proCsvText")==CANON
        assert "canonica.csv" in page.locator("#proRunStatus").inner_text()

        page.evaluate("proCsvText=''")
        assert page.evaluate("useCentralDataForMotorPro()") is True
        assert page.evaluate("proCsvText")==CANON

        page.evaluate("proCsvText=''")
        page.locator('.nav button[data-section="motorpro"]').click()
        page.wait_for_function("proCsvText.length>0")
        assert page.evaluate("proCsvText")==CANON

        assert not errors,repr(errors)
        browser.close()
