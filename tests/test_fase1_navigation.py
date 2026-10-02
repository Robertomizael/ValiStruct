"""ValiStruct v5.3 Fase 1: simplified, reversible scientific navigation."""
import os
import re
import pytest
pytest.importorskip("playwright.sync_api")
from playwright.sync_api import sync_playwright

URL=os.getenv("VALISTRUCT_FRONTEND_URL","http://127.0.0.1:8000")

@pytest.fixture()
def page():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        context=browser.new_context(viewport={"width":1440,"height":900})
        pg=context.new_page()
        errors=[]
        pg.on("pageerror",lambda e:errors.append(str(e)))
        pg.goto(URL,wait_until="load")
        pg.evaluate("localStorage.removeItem('valistruct_institutional_ui')")
        pg.reload(wait_until="load")
        yield pg,errors
        browser.close()

def visible_nav_buttons(pg):
    return pg.locator(".nav button[data-section]:visible")

def test_scientific_menu_is_reduced_without_deleting_modules(page):
    pg,errors=page
    modules=pg.evaluate("window.VALISTRUCT_NAV_MODULES")
    assert len(modules)==83
    assert pg.locator(".nav button[data-section]").count()==83
    expected={
        "inicio","dataimport","diagnostics","multidiag","missingpro",
        "aiken","efa","cfa","reliability",
        "stability","criterion","performance",
        "motorpro","resultcenter","projects","methodguide","privacy","acerca"
    }
    configured={m["id"] for m in modules if m["visibility"]=="visible"}
    assert configured==expected
    assert len(configured)<=25
    for section in expected:
        assert pg.locator(f'.nav button[data-section="{section}"]').count()==1
    # Accordions may collapse some valid entries; the number simultaneously
    # displayed must never exceed the scientific inventory.
    assert visible_nav_buttons(pg).count()<=len(expected)
    assert pg.locator(".vs-v53-admin").is_hidden()
    assert pg.locator(".vs-v53-qa-nav").is_hidden()
    assert not errors,repr(errors)

def test_every_integrated_module_is_reachable_from_parent_in_two_clicks(page):
    pg,errors=page
    integrated=pg.evaluate("""() => window.VALISTRUCT_NAV_MODULES
      .filter(x=>x.visibility==='integrated').map(x=>({id:x.id,parent:x.parent}))""")
    for item in integrated:
        parent=item["parent"];child=item["id"]
        # Parent is always one visible menu click away.
        parent_button=pg.locator(f'.nav button[data-section="{parent}"]')
        assert parent_button.is_visible(),(parent,child)
        parent_button.click()
        pg.wait_for_function("(id)=>document.getElementById(id)?.classList.contains('visible')",arg=parent)
        tool=pg.locator(f'#{parent} .vs-v53-tools [data-vs-target="{child}"]')
        assert tool.is_visible(),(parent,child)
        # Programmatic click exercises the real listener without Playwright
        # waiting on scroll/actionability animations from the app shell.
        tool.evaluate("(el)=>el.click()")
        pg.wait_for_function("(id)=>document.getElementById(id)?.classList.contains('visible')",arg=child,timeout=4000)
        assert pg.locator(f'.nav button[data-section="{parent}"]').evaluate(
            "(el)=>el.classList.contains('vs-parent-active')"
        ),(parent,child)
    assert not errors,repr(errors)

def test_external_validation_is_explicitly_preparing(page):
    pg,errors=page
    assert "En preparación" in pg.locator('[data-vs-target="stability"]').inner_text()
    for section in ["stability","criterion","performance"]:
        # open parent accordion when necessary
        group=pg.locator(".vs-v52-group").filter(has=pg.locator("summary",has_text="Validación externa"))
        if not group.evaluate("(el)=>el.open"):
            group.locator("summary").click()
        btn=pg.locator(f'.nav button[data-section="{section}"]')
        assert "En preparación" in btn.inner_text()
        btn.click()
        panel=pg.locator(f"#{section}")
        assert panel.locator(".vs-v53-preparing").inner_text()=="En preparación"
        assert "aún no realiza cálculos" in panel.locator(".vs-v53-preparing-note").inner_text()
    assert not errors,repr(errors)

def test_institutional_and_qa_modules_are_not_normal_navigation(page):
    pg,errors=page
    admin=pg.evaluate("window.VALISTRUCT_NAV_MODULES.filter(x=>x.visibility==='admin').map(x=>x.id)")
    qa=pg.evaluate("window.VALISTRUCT_NAV_MODULES.filter(x=>x.visibility==='qa').map(x=>x.id)")
    for module in admin+qa:
        assert pg.locator(f'.nav button[data-section="{module}"]').count()==1
        assert not pg.locator(f'.nav button[data-section="{module}"]').is_visible()
    pg.locator('.nav button[data-section="privacy"]').click()
    toggle=pg.locator("#vsInstitutionalUiToggle")
    assert toggle.is_visible()
    toggle.check()
    admin_group=pg.locator(".vs-v53-admin")
    assert admin_group.is_visible()
    # The institutional group is intentionally revealed collapsed; expand it
    # before asserting visibility of its individual tools.
    if not admin_group.evaluate("(el)=>el.open"):
        admin_group.locator("summary").evaluate("(el)=>el.click()")
    assert pg.locator('.nav button[data-section="auth"]').is_visible()
    for module in qa:
        assert not pg.locator(f'.nav button[data-section="{module}"]').is_visible()
    assert not errors,repr(errors)

def test_no_legacy_version_badge_is_visible(page):
    pg,errors=page
    texts=pg.locator("span.badge:visible").all_inner_texts()
    legacy=re.compile(r"(?:\bv?\d+\.\d+(?:\.\d+)?\b|\bRC\s*\d*\b)",re.I)
    assert not [text for text in texts if legacy.search(text)],texts
    assert not errors,repr(errors)
