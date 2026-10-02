"""Subfase 2C: verify Lawshe CVR numerically with a controlled example."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def test_lawshe_cvr_matches_controlled_example():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(5000)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(URL,wait_until="load")

        page.evaluate("showSection('aiken')")
        page.locator("#loadLawsheExample").click()
        page.locator("#calculateLawshe").click()

        result=page.evaluate("lawsheLastResults")
        assert result is not None
        values=[round(row["cvr"],3) for row in result["rows"]]
        assert values==[1.000,0.800,0.600,0.200]
        assert round(result["meanCvr"],3)==0.650

        assert result["rows"][0]["essential"]==10
        assert result["rows"][1]["essential"]==9
        assert result["rows"][2]["essential"]==8
        assert result["rows"][3]["essential"]==6
        assert result["config"]["good"]==0.62

        rendered=page.locator("#lawsheResults").inner_text()
        assert "CVR de Lawshe" in rendered
        assert "1.000" in rendered
        assert "0.800" in rendered
        assert "tabla crítica universal" in rendered

        # Lawshe is independent from both Aiken and the CVI workspaces.
        assert page.locator("#aikenWorkspace").inner_text().strip()==""
        assert page.locator("#cviMatrix").inner_text().strip()==""
        assert not errors,repr(errors)
        browser.close()
