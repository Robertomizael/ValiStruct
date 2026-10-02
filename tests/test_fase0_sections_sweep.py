"""Fase 0 safety net: every registered section can be opened without pageerror.
Run once with backend disconnected and once with backend available.

The sweep executes the canonical app.js showSection() function in one browser
evaluation while temporarily disabling smooth scrolling. This preserves the
navigation semantics under test but avoids queuing dozens of headless Chromium
scroll animations, which can keep the browser process alive until the CI job
timeout.
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
        assert page.evaluate("typeof showSection === 'function'")

        result=page.evaluate(
            """(ids)=>{
              const missing=ids.filter(id=>!document.getElementById(id));
              const failures=[];
              const originalScrollTo=window.scrollTo;
              window.scrollTo=()=>{};
              try{
                for(const id of ids){
                  try{
                    showSection(id);
                    if(!document.getElementById(id)?.classList.contains('visible')){
                      failures.push([id,'canonical showSection() did not make panel visible']);
                    }
                  }catch(err){
                    failures.push([id,String(err)]);
                  }
                }
              }finally{
                window.scrollTo=originalScrollTo;
              }
              return {missing,failures};
            }""",
            ids,
        )

        assert not result["missing"], f"Registered sections missing from DOM: {result['missing']}"
        assert not result["failures"], result["failures"]
        assert not errors, errors
        browser.close()
