"""Fase 3A H-B: rejected direct imports must not replace valid canonical participant data."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")
GOOD="ID,i01,i02,i03\nP001,1,2,3\nP002,2,3,4\nP003,3,4,5\n"
BAD=b"ID,i01,i02,i03\nP001,1,2,3\nP002,2,ERROR,4\nP003,3,4,5\n"

def test_rejected_direct_imports_preserve_canonical_store():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(5000)
        errors=[]
        dialogs=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.on("dialog",lambda d:(dialogs.append(d.message),d.accept()))
        page.goto(URL,wait_until="load")

        page.evaluate(
            """csv => window.ValiStructParticipantData.setCsv(
              csv,{source:'base_buena.csv',format:'csv'}
            )""",
            GOOD,
        )
        baseline=page.evaluate("""() => ({
          source:window.ValiStructParticipantData.summary.source,
          revision:window.ValiStructParticipantData.revision,
          csv:window.ValiStructParticipantData.toCsv()
        })""")

        for section,selector,name in [
            ("reliability","#relCsvFile","mala_fiabilidad.csv"),
            ("efa","#efaCsvFile","mala_afe.csv"),
            ("cfa","#cfaCsvFile","mala_afc.csv"),
        ]:
            page.evaluate(f"showSection('{section}')")
            before=len(dialogs)
            page.locator(selector).set_input_files({
                "name":name,"mimeType":"text/csv","buffer":BAD
            })
            page.wait_for_function("(n)=>window.__dummy===undefined || true",arg=before)
            page.wait_for_timeout(150)
            assert len(dialogs)>before, (section,dialogs)

            current=page.evaluate("""() => ({
              source:window.ValiStructParticipantData.summary.source,
              revision:window.ValiStructParticipantData.revision,
              csv:window.ValiStructParticipantData.toCsv()
            })""")
            assert current==baseline, (section,current,baseline)

        assert not errors,repr(errors)
        browser.close()
