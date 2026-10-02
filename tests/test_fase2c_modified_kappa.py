"""Subfase 2C: verify modified kappa from the shared CVI relevance matrix."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def test_modified_kappa_matches_controlled_cvi_example():
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
        page.locator("#calculateModifiedKappa").click()

        result=page.evaluate("cviLastResults")
        assert result is not None
        rows=result["kappaRows"]
        assert len(rows)==4

        assert round(rows[0]["pc"],6)==0.015625
        assert round(rows[0]["kappa"],3)==1.000

        assert round(rows[1]["pc"],5)==0.09375
        assert round(rows[1]["kappa"],3)==0.816

        assert round(rows[2]["kappa"],3)==1.000

        assert round(rows[3]["pc"],4)==0.3125
        assert round(rows[3]["kappa"],3)==0.273

        assert round(result["meanKappa"],3)==0.772

        rendered=page.locator("#modifiedKappaResults").inner_text()
        assert "Kappa modificado" in rendered
        assert "Pc" in rendered
        assert "0.816" in rendered
        assert "categorías interpretativas universales" in rendered

        # Shared judge matrix, independent of participant data and Aiken engine.
        assert page.locator("#aikenWorkspace").inner_text().strip()==""
        assert not errors,repr(errors)
        browser.close()
