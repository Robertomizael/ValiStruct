"""Subfase 2C: verify I-CVI and S-CVI/Ave numerically and preserve Aiken separation."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def test_icvi_scvi_example_matches_expected_values():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(5000)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(URL,wait_until="load")

        page.evaluate("showSection('aiken')")
        page.locator("#loadCviExample").click()
        page.locator("#calculateCvi").click()

        result=page.evaluate("cviLastResults")
        assert result is not None
        values=[round(row["icvi"],3) for row in result["rows"]]
        assert values==[1.000,0.833,1.000,0.500]
        assert round(result["scviAve"],3)==0.833

        assert result["rows"][0]["agreement"]==6
        assert result["rows"][1]["agreement"]==5
        assert result["rows"][3]["agreement"]==3
        assert result["config"]["relevantFrom"]==3
        assert result["config"]["good"]==0.78

        rendered=page.locator("#cviResults").inner_text()
        assert "S-CVI/Ave" in rendered
        assert "0.833" in rendered
        assert "punto de corte universal" in rendered

        # The existing Aiken workspace is independent and must remain untouched.
        assert page.locator("#aikenWorkspace").inner_text().strip()==""
        assert not errors,repr(errors)
        browser.close()
