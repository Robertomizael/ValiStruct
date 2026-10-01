"""Fase 0 safety net: every registered section opens without pageerror.
Run once with backend disconnected and once with backend available.

The sweep must fail fast. After the v5.3 shell simplification some buttons are
hidden/integrated, so Playwright locator auto-waits can otherwise spend up to
30 s per missing/detached button and exhaust the whole CI timeout.
"""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")


def test_all_registered_sections_open_without_pageerror():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(4000)
        errors=[]
        page.on("pageerror",lambda exc: errors.append(str(exc)))
        page.on("dialog",lambda dialog: dialog.dismiss())
        page.goto(URL,wait_until="load",timeout=10000)

        ids=page.eval_on_selector_all(
            ".nav button[data-section]",
            "els=>els.map(el=>el.dataset.section)"
        )
        assert len(ids)>=80
        assert len(ids)==len(set(ids)), "Duplicate data-section buttons found"

        failures=[]
        for section in ids:
            try:
                clicked=page.evaluate(
                    """(id)=>{
                      const el=document.querySelector('.nav button[data-section="'+id+'"]');
                      if(!el) return false;
                      el.click();
                      return true;
                    }""",
                    section,
                )
                if not clicked:
                    failures.append((section,"navigation button missing/detached"))
                    continue
                page.wait_for_function(
                    "(id)=>document.getElementById(id)?.classList.contains('visible')",
                    arg=section,
                    timeout=3000,
                )
            except Exception as exc:
                failures.append((section,str(exc)))

        assert not failures, failures
        assert not errors, errors
        browser.close()
