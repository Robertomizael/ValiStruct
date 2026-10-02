"""Fase 2 hardening: desktop must evaluate the exact navigation guard used by Electron."""
from pathlib import Path
import os
import re
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def test_desktop_and_frontend_share_stable_nav_marker():
    main=(ROOT/"desktop"/"main.js").read_text(encoding="utf-8")
    shell=(ROOT/"v52-shell.js").read_text(encoding="utf-8")

    assert re.search(r"dataset\.valistructNav\s*=\s*['\"]v5['\"]", shell)

    # Extract the exact JavaScript guard from desktop/main.js instead of
    # reconstructing it in the test. This catches accidental changes such as
    # replacing || with &&.
    match=re.search(
        r'"([^"\n]*dataset\.valistructNav\s*===\s*\'v5\'[^"\n]*dataset\.v51Grouped\s*===\s*\'yes\'[^"\n]*)"',
        main,
    )
    assert match, "Desktop navigation guard not found in desktop/main.js"
    desktop_guard=match.group(1)

    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        page.goto(URL,wait_until="load")
        assert page.evaluate("document.querySelector('nav.nav')?.dataset.valistructNav")=="v5"
        assert page.evaluate(f"Boolean({desktop_guard})") is True
        browser.close()
