"""Fase 2 hardening: every registered section opens and observer loops fail fast.

The test dispatches the real click event to every navigation button, including
hidden/institutional entries, without requiring actionability. Each dispatch has
a short Playwright timeout so an unresponsive browser produces a readable
section-specific failure instead of waiting for the workflow-level 90 s guard.
"""
import os
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")


def test_all_registered_sections_open_without_pageerror():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.set_default_timeout(3000)
        errors=[]
        page.on("pageerror",lambda exc: errors.append(str(exc)))
        page.on("dialog",lambda dialog: dialog.dismiss())
        page.goto(URL,wait_until="load",timeout=10000)
        page.evaluate("window.scrollTo=()=>{}")

        ids=page.eval_on_selector_all(
            ".nav button[data-section]",
            "els=>els.map(el=>el.dataset.section)"
        )
        assert len(ids)>=80
        assert len(ids)==len(set(ids)), "Duplicate data-section buttons found"

        failures=[]
        for section in ids:
            button=page.locator(f'.nav button[data-section="{section}"]')
            assert button.count()==1, section
            try:
                button.dispatch_event("click",timeout=2500)
                page.wait_for_function(
                    "(id)=>document.getElementById(id)?.classList.contains('visible')",
                    arg=section,
                    timeout=2500,
                )
            except PlaywrightTimeoutError:
                failures.append((section,"navigation/event loop became unresponsive"))
                break
            except Exception as exc:
                failures.append((section,str(exc)))
                break

        assert not failures, failures
        assert not errors, errors
        browser.close()
