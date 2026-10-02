"""Fase 2B: direct imports from Reliability, AFE and AFC update the same canonical participant store."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")
CSV=("ID,i01,i02,i03\n"+
     "\n".join(f"P{i:03d},{1+i%5},{2+(i*2)%5},{1+(i*3)%5}" for i in range(1,21))+"\n").encode()

def test_direct_core_module_imports_update_canonical_store():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(5000)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.on("dialog",lambda d:d.accept())
        page.goto(URL,wait_until="load")

        checks=[
            ("reliability","#relCsvFile","reliability.csv","relData.n"),
            ("efa","#efaCsvFile","efa.csv","efaData.n"),
            ("cfa","#cfaCsvFile","cfa.csv","cfaData.n"),
        ]
        for section,selector,name,count_expr in checks:
            page.evaluate(f"showSection('{section}')")
            page.locator(selector).set_input_files({
                "name":name,"mimeType":"text/csv","buffer":CSV
            })
            page.wait_for_function(
                "(name)=>window.ValiStructParticipantData?.summary?.source===name",
                arg=name,
            )
            assert page.evaluate("window.ValiStructParticipantData.summary.n")==20
            assert page.evaluate(count_expr)==20

        summary=page.evaluate("window.ValiStructParticipantData.summary")
        assert summary["source"]=="cfa.csv"
        assert summary["variables"]==["ID","i01","i02","i03"]
        assert not errors,repr(errors)
        browser.close()
