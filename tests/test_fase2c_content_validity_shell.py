"""Subfase 2C: Content Validity workspace must preserve the existing Aiken engine."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def test_content_validity_selector_preserves_aiken_controls_and_engine():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(5000)
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(URL,wait_until="load")

        label=page.evaluate("""() => {
          const cfg=(window.VALISTRUCT_NAV_MODULES||[]).find(x=>x.id==='aiken');
          return cfg?.label||'';
        }""")
        assert label=="Validez de contenido"

        nav=page.locator('.nav button[data-section="aiken"]')
        assert nav.count()==1
        nav.evaluate("(el)=>el.click()")
        page.wait_for_function("document.getElementById('aiken')?.classList.contains('visible')")

        methods=page.locator("#contentValidityMethods [data-content-method]")
        assert methods.count()==7
        assert page.locator('[data-content-method="aiken"]').count()==1
        assert "Disponible" in page.locator('[data-content-method="aiken"]').inner_text()

        planned=page.locator("#contentValidityMethods .planned")
        assert planned.count()==4
        available=page.locator("#contentValidityMethods .active-method")
        assert available.count()==3
        assert "Disponible" in page.locator('[data-content-method="icvi"]').inner_text()
        assert "Disponible" in page.locator('[data-content-method="scvi"]').inner_text()

        # Existing Aiken engine contract must remain intact.
        for control in [
            "#judgeCount","#itemCount","#scaleMin","#scaleMax","#confidenceLevel",
            "#buildAiken","#csvFile","#aikenWorkspace","#calculateAiken","#aikenResults"
        ]:
            assert page.locator(control).count()==1, control

        formula=page.locator("#aiken").inner_text()
        assert "V = Σ(r − l" in formula
        assert "V de Aiken · módulo disponible" in formula
        assert not errors,repr(errors)
        browser.close()
