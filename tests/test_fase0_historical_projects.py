"""Compatibility: generate real historical project states and restore them in current ValiStruct."""
from pathlib import Path
import json, os, subprocess, sys, tempfile
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

def test_historical_project_states_restore_without_pageerror():
    with tempfile.TemporaryDirectory() as td:
        subprocess.run(
            [sys.executable,str(ROOT/"tools/generate_project_fixtures.py"),"--out",td],
            cwd=ROOT,check=True,timeout=120
        )
        fixtures=[
            json.loads((Path(td)/"project_v3_0_rc6.json").read_text(encoding="utf-8")),
            json.loads((Path(td)/"project_v5_2_4.json").read_text(encoding="utf-8")),
        ]
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=True)
            page=browser.new_page()
            errors=[]
            page.on("pageerror",lambda exc:errors.append(str(exc)))
            page.on("dialog",lambda d:d.accept())
            page.goto(URL,wait_until="load")
            for wrapped in fixtures:
                state=wrapped["project"]
                page.evaluate("(s)=>restoreProject(s)",state)
                assert page.locator("#projectName").input_value()==state.get("name","")
                # Project-format migration must not destroy persisted historical keys.
                current=page.evaluate("projectState()")
                assert current["schemaVersion"]=="3.0"
                assert current["name"]==state.get("name","")
            assert not errors,errors
            browser.close()
