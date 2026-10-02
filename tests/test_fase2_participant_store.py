"""Fase 2B: canonical participant store read adapters are safe and Aiken-independent."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")
CSV=b"ID,i01,i02,i03,sexo\nP001,1,2,3,F\nP002,2,NA,4,M\nP003,3,4,5,F\n"

def test_canonical_store_exposes_full_csv_labels_and_missing_aware_frame():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(URL,wait_until="load")

        page.evaluate("""() => {
          window.ValiStructParticipantData.setCsv(
            'ID,i01,i02,i03,sexo\nP001,1,2,3,F\nP002,2,NA,4,M\nP003,3,4,5,F\n',
            {source:'fase2.csv',format:'csv',labels:{i01:'Ítem 1',i02:'Ítem 2'}}
          );
        }""")

        assert page.evaluate("window.ValiStructParticipantData.hasData") is True
        summary=page.evaluate("window.ValiStructParticipantData.summary")
        assert summary["source"]=="fase2.csv"
        assert summary["labels"]["i01"]=="Ítem 1"
        assert summary["labels"]["i02"]=="Ítem 2"

        full_csv=page.evaluate("window.ValiStructParticipantData.toCsv()")
        assert "sexo" in full_csv
        assert "P002" in full_csv

        frame=page.evaluate("window.ValiStructParticipantData.numericFrame({firstColumn:'auto'})")
        assert frame["names"]==["i01","i02","i03"]
        assert frame["n"]==3
        assert frame["nComplete"]==2
        assert frame["nExcluded"]==1
        assert frame["matrix"][1][1] is None

        matrix=page.evaluate("window.ValiStructParticipantData.numericMatrix({firstColumn:'auto'})")
        assert matrix["n"]==2
        assert matrix["nOriginal"]==3
        assert matrix["nExcluded"]==1

        # Participant data must never alter the independent Aiken workspace.
        assert page.locator("#aikenWorkspace").inner_text().strip()==""
        assert not errors,repr(errors)
        browser.close()
