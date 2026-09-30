#!/usr/bin/env python3
"""Capture informative Fase-0 reference screens (not a blocking visual test)."""
from pathlib import Path
import argparse
from playwright.sync_api import sync_playwright

MODULES=[
    "inicio","dataimport","aiken","efa","cfa","reliability",
    "multidiag","motorpro","resultcenter","projects",
]

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--url",default="http://127.0.0.1:8000")
    parser.add_argument("--out",default="tests/reference-screens")
    args=parser.parse_args()
    out=Path(args.out)
    out.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":1440,"height":1000},device_scale_factor=1)
        page.goto(args.url,wait_until="load")
        for module in MODULES:
            page.locator(f'.nav button[data-section="{module}"]').evaluate("(el)=>el.click()")
            page.wait_for_function(
                "(id)=>document.getElementById(id)?.classList.contains('visible')",module)
            page.screenshot(path=str(out/f"{module}.png"),full_page=True)
        browser.close()

if __name__=="__main__":
    main()
