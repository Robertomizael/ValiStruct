"""Subfase 2C: verify Delphi round traceability and configurable consensus."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def test_delphi_two_round_example_preserves_traceability_and_consensus_metrics():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(5000)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(URL,wait_until="load")

        page.evaluate("showSection('aiken')")
        page.locator("#loadDelphiExample").click()
        page.locator("#calculateDelphi").click()

        result=page.evaluate("delphiLastResults")
        assert result is not None
        assert result["mode"]=="classic"
        assert result["rounds"]==2
        assert len(result["rows"])==6
        assert len(result["latest"])==3

        round1=[r for r in result["rows"] if r["round"]==1]
        round2=[r for r in result["rows"] if r["round"]==2]

        assert round1[1]["agreementPct"] < round2[1]["agreementPct"]
        assert round2[1]["deltaAgreement"] > 0
        assert round2[1]["comment"]=="Redacción refinada tras retroalimentación anónima."

        for row in result["rows"]:
            assert 1 <= row["median"] <= 5
            assert row["iqr"] >= 0

        rendered=page.locator("#delphiResults").inner_text()
        assert "Rondas registradas" in rendered
        assert "Acuerdo favorable" in rendered
        assert "criterios configurados" in rendered.lower()

        # Delphi workflow must remain independent of other content-validity engines.
        assert page.locator("#aikenWorkspace").inner_text().strip()==""
        assert page.locator("#cviMatrix").inner_text().strip()==""
        assert page.locator("#lawsheMatrix").inner_text().strip()==""
        assert not errors,repr(errors)
        browser.close()
