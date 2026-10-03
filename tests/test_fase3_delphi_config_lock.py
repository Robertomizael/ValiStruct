"""Fase 3C H-G: Delphi must block new rounds after configuration drift."""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def test_delphi_blocks_round_after_configuration_change():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(5000)
        dialogs=[]
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.on("dialog",lambda d:(dialogs.append(d.message),d.accept()))
        page.goto(URL,wait_until="load")

        page.evaluate("showSection('aiken')")
        page.locator("#delphiJudgeCount").fill("8")
        page.locator("#delphiItemCount").fill("3")
        page.locator("#buildDelphi").click()

        assert page.evaluate("delphiRoundCount")==1
        assert page.locator(".delphi-round").count()==1

        page.locator("#delphiJudgeCount").fill("7")
        page.locator("#addDelphiRound").click()
        page.locator("#evaluateDelphi").click()

        assert page.evaluate("delphiRoundCount")==1
        assert page.locator(".delphi-round").count()==1
        assert sum("configuración Delphi cambió" in msg for msg in dialogs)>=2

        notice=page.locator("#delphiWorkspace .notice").inner_text()
        assert "panel y la configuración de expertos se mantienen constantes entre rondas" in notice
        assert not errors,repr(errors)
        browser.close()
