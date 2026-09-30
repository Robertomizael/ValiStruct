"""Fase 0: desktop must recognize the same navigation marker emitted by v52-shell."""
from pathlib import Path
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def test_desktop_and_frontend_share_stable_nav_marker():
    main=(ROOT/"desktop"/"main.js").read_text(encoding="utf-8")
    shell=(ROOT/"v52-shell.js").read_text(encoding="utf-8")
    assert "dataset.valistructNav = 'v5'" in shell
    assert "dataset.valistructNav === 'v5'" in main
    assert "dataset.v51Grouped === 'yes'" in main
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        page.goto(URL,wait_until="load")
        assert page.evaluate("document.querySelector('nav.nav')?.dataset.valistructNav")=="v5"
        should_skip=page.evaluate(
            "document.querySelector('nav.nav')?.dataset.valistructNav === 'v5' || "
            "document.querySelector('nav.nav')?.dataset.v51Grouped === 'yes'"
        )
        assert should_skip is True
        browser.close()
